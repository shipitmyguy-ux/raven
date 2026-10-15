import http from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPrivateDispatcher} from './private-mcp-stdio.mjs';
import {createApplicationReceiptVerifier,createOneClickWorkflow} from './oneclick-workflow.mjs';
import {prepareRemoteWorker,createRemotePump} from './oneclick-remote.mjs';
import {createCodexAdapters} from './oneclick-codex.mjs';
import {createJobActivity,createWindowsJobActivity} from './oneclick-power.mjs';

export async function atomicJson(path,value){
 const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value));await rename(temporary,path);
}
export async function createReceiptJournal(directory){
 await mkdir(directory,{recursive:true});
 const path=key=>join(directory,createHash('sha256').update(key).digest('hex')+'.json');
 return {async get(key){try{return JSON.parse(await readFile(path(key),'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw Error('RECEIPT_JOURNAL_INVALID');}},async set(key,value){await atomicJson(path(key),value);}};
}
export function createWriterScheduler(capacity=2){
 if(!Number.isInteger(capacity)||capacity<1||capacity>2)throw Error('INVALID_WRITER_CONCURRENCY');
 let used=0;const waiting=[],idle=[];
 const notifyIdle=()=>{if(used===0&&!waiting.length)for(const resolve of idle.splice(0))resolve();};
 const pump=()=>{
  while(waiting.length&&used+waiting[0].weight<=capacity){
   const item=waiting.shift();used+=item.weight;
   Promise.resolve().then(item.work).then(item.resolve,item.reject).finally(()=>{used-=item.weight;pump();notifyIdle();});
  }
  notifyIdle();
 };
 return {schedule(work,weight=1){if(typeof work!=='function'||!Number.isInteger(weight)||weight<1||weight>capacity)throw Error('INVALID_WRITER_WEIGHT');return new Promise((resolve,reject)=>{waiting.push({work,weight,resolve,reject});pump();});},drain(){return used===0&&!waiting.length?Promise.resolve():new Promise(resolve=>idle.push(resolve));}};
}
export function createDocumentLock(){
 const tails=new Map();
 return async(jobId,kind,work)=>{
  const key=jobId+'|'+kind,previous=tails.get(key)||Promise.resolve();
  let release;const done=new Promise(resolve=>release=resolve);tails.set(key,done);
  await previous;
  try{return await work();}finally{release();if(tails.get(key)===done)tails.delete(key);}
 };
}
export function serializePrivateDispatch(dispatch){
 let tail=Promise.resolve();
 return line=>{const pending=tail.then(()=>dispatch(line));tail=pending.catch(()=>{});return pending;};
}
const diagnosticCodes=new Set(['CHATGPT_RUNNER_FAILED','FACTUAL_REVIEW_BLOCKED','INVALID_DOCUMENT','VERSION_CONFLICT','DRIVE_METADATA_NOT_CONFIRMED','DRIVE_UPLOAD_NOT_CONFIRMED','DRIVE_UPLOAD_NOT_VERIFIED','DOCUMENT_UNAVAILABLE','NOT_FOUND','DATABASE_UNAVAILABLE','UNAUTHORIZED','GENERATION_CONTEXT_INCOMPLETE','DOCUMENT_READBACK_NOT_CONFIRMED','EXPORT_LOOKUP_FAILED','PDF_READBACK_NOT_CONFIRMED','EXPORT_RECORD_NOT_CONFIRMED','PDF_OR_DRIVE_EXPORT_FAILED','RECEIPT_JOURNAL_INVALID']);
const safeError=error=>({
 CHATGPT_RUNNER_FAILED:'ChatGPT generation or Drive access failed. Your saved document is preserved; retry after checking your ChatGPT connection.',
 FACTUAL_REVIEW_BLOCKED:'The draft did not pass Raven’s factual review. Your existing documents were preserved.',
 INVALID_DOCUMENT:'The draft did not pass Raven’s validation. Your existing documents were preserved.',
 VERSION_CONFLICT:'This document changed during the request. Review the saved version before retrying.',
 DRIVE_METADATA_NOT_CONFIRMED:'Google Drive did not confirm the PDF in your resume folder. Your Raven document is saved; retry the Drive step.',
 DRIVE_UPLOAD_NOT_CONFIRMED:'Google Drive upload was not confirmed. Your Raven document is preserved.',
 DOCUMENT_UNAVAILABLE:'The saved document is not available.',NOT_FOUND:'This job is not available in Raven.',
 DATABASE_UNAVAILABLE:'Raven could not confirm its saved state. Your documents are preserved; try again.',
 UNAUTHORIZED:'The private Raven connection expired. Restart it with a renewed local grant.'
}[error.message]||'The request did not complete. Your saved documents are preserved; retry to resume the remaining steps.');

export async function createOneClickServer({runWorkflow,rest,authorizeJob,pairRemote,prepareApplicationDocuments,verifyApplicationReceipts,activity=createJobActivity(),writerConcurrency=2,stateDir=resolve('private/oneclick/runs'),allowedOrigin='https://shipitmyguy-ux.github.io',refererPrefix='https://shipitmyguy-ux.github.io/raven/'}){
 if(![runWorkflow,rest,authorizeJob].every(value=>typeof value==='function'))throw Error('ONE_CLICK_NOT_CONFIGURED');
 if(writerConcurrency!==2)throw Error('INVALID_WRITER_CONCURRENCY');
 await mkdir(stateDir,{recursive:true});
 const runs=new Map(),active=new Map(),sessions=new Map(),scheduler=createWriterScheduler(writerConcurrency);
 for(const name of await readdir(stateDir)){
  if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
  const state=JSON.parse(await readFile(join(stateDir,name),'utf8'));
  if(!['complete','failed'].includes(state.stage)){state.failed_stage=state.stage;state.error_code='HELPER_RESTARTED';state.stage='failed';state.error='The helper restarted. Click again to resume safely from the saved document and upload receipt.';}
  runs.set(state.run_id,state);
 }
 const save=state=>atomicJson(join(stateDir,state.run_id+'.json'),state);
 async function persist(state){
  await save(state);
  await rest('raven_job_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({job_id:state.job_id,event_type:'resume_workflow',source:'raven-one-click',summary:`Resume workflow: ${state.stage}`,metadata:{run_id:state.run_id,stage:state.stage,document_type:state.document_type,error:state.error||null,failed_stage:state.failed_stage||null,failed_document_type:state.failed_document_type||null,error_code:state.error_code||null,stage_started_at:state.stage_started_at||null,elapsed_ms:state.elapsed_ms||0,stage_timings:state.stage_timings||[],documents:(state.documents||[]).map(({document_type,document_sha256,drive_url,file_id})=>({document_type,document_sha256,drive_url,file_id}))}})});
 }
 function enqueue(input){
  const kinds=input.document_type==='both'?['resume','coverLetter']:[input.document_type];
  const keys=kinds.map(kind=>input.job_id+'|'+kind);
  const overlapping=keys.map(key=>active.get(key)).filter(Boolean);
  if(overlapping.length){if(overlapping.every(run=>run===overlapping[0])&&overlapping[0].document_type===input.document_type)return overlapping[0];throw Error('WORK_ALREADY_ACTIVE');}
  const state={run_id:randomUUID(),job_id:input.job_id,document_type:input.document_type,stage:'queued',created_at:new Date().toISOString()};
  runs.set(state.run_id,state);for(const key of keys)active.set(key,state);
  void activity.run(()=>scheduler.schedule(async()=>{
   let writes=Promise.resolve(),failureStage;
   try{
    failureStage='persisting';await persist(state);failureStage=undefined;
    const result=await runWorkflow({jobId:state.job_id,documentType:state.document_type},progress=>{
     // Complete is published only after the workflow and all durable progress writes finish.
     if(progress.stage==='complete'||progress.stage==='failed')return;
     const {document_type:currentKind,...fields}=progress;
     Object.assign(state,fields,{current_document_type:currentKind||null});const snapshot={...state};
     writes=writes.then(()=>persist(snapshot));
    });
    failureStage='persisting';await writes;
    const complete={...state,...result,stage:'complete'};await persist(complete);Object.assign(state,complete);
   }catch(error){
    await writes.catch(()=>{});if(error.diagnostics){const {document_type,...diagnostics}=error.diagnostics;Object.assign(state,diagnostics);}state.failed_stage=error.failed_stage||failureStage||state.stage;state.failed_document_type=error.failed_document_type||state.current_document_type||state.document_type;state.error_code=diagnosticCodes.has(error.message)?error.message:'WORKFLOW_FAILED';state.stage='failed';state.error=safeError(error);state.documents=error.partial_documents||state.documents||[];
    await persist(state).catch(()=>save(state));
   }finally{for(const key of keys)if(active.get(key)===state)active.delete(key);}
  },input.document_type==='both'?2:1)).catch(()=>{});
  return state;
 }
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const send=(status,value)=>{res.writeHead(status,headers);res.end(JSON.stringify(value));};
  if((req.headers.host||'').split(':')[0]!=='127.0.0.1')return send(403,{error:'Untrusted local host.'});
  if(origin&&origin!==allowedOrigin)return send(403,{error:'Untrusted Raven origin.'});
  if(origin===allowedOrigin){Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Raven-Local-Client','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Private-Network':'true'});}
  if(req.method==='OPTIONS')return origin===allowedOrigin?send(204,{}):send(403,{error:'Untrusted Raven origin.'});
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&path==='/health')return send(200,{app:'raven-one-click',ready:true,active_tasks:activity.active,job_scoped_awake:true,writer_concurrency:writerConcurrency,phone_queue_supported:Boolean(pairRemote),application_prepare_supported:typeof prepareApplicationDocuments==='function',application_receipts_supported:typeof verifyApplicationReceipts==='function'});
  if(origin!==allowedOrigin||req.headers['x-raven-local-client']!=='raven-web-v1'||!String(req.headers.referer||'').startsWith(refererPrefix))return send(403,{error:'Open this action from the Raven website.'});
  try{
   let body;
   if(req.method==='POST'){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return send(415,{error:'JSON required.'});
    let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)return send(413,{error:'Request too large.'});chunks.push(chunk);}
    try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid JSON.'});}
   }
   if(req.method==='POST'&&path==='/session'){
    for(const [key,expires] of sessions)if(expires<Date.now())sessions.delete(key);
    if(sessions.size>=100)return send(429,{error:'Too many local sessions.'});
    const token=randomBytes(32).toString('base64url');sessions.set(token,Date.now()+3600000);return send(200,{token});
   }
   const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
   if(!sessions.has(token)||sessions.get(token)<Date.now())return send(401,{error:'Raven helper session expired.'});
   if(req.method==='GET'&&path==='/power')return send(200,activity.status());
   if(req.method==='POST'&&path==='/power/stop'){
    if(!body||Object.keys(body).length)return send(400,{error:'Invalid keep-awake request.'});
    return send(200,activity.stop());
   }
   if(req.method==='POST'&&path==='/pair'){
    if(!pairRemote)return send(503,{error:'Phone queue is not configured on this computer.'});
    return send(200,await pairRemote());
   }
   if(req.method==='POST'&&path==='/application-documents'){
    if(typeof prepareApplicationDocuments!=='function')return send(503,{error:'Application document preparation is not configured.'});
    if(!body||Object.keys(body).sort().join(',')!=='documents,job_id'||!/^[A-Za-z0-9_-]{1,160}$/.test(body.job_id||'')||!Array.isArray(body.documents)||body.documents.length!==2||body.documents.some(d=>!d||Object.keys(d).sort().join(',')!=='document_sha256,document_type'||!['resume','coverLetter'].includes(d.document_type)||!/^[a-f0-9]{64}$/.test(d.document_sha256||''))||new Set(body.documents.map(d=>d.document_type)).size!==2)return send(400,{error:'Invalid application documents request.'});
    try{
     await authorizeJob(body.job_id);
     return send(200,await activity.run(()=>prepareApplicationDocuments(body)));
    }catch(error){return send(error.message==='NOT_FOUND'?404:error.message==='UNAUTHORIZED'?403:error.message==='VERSION_CONFLICT'?409:error.message==='INVALID_APPLICATION_DOCUMENTS'?400:422,{error:safeError(error)});}
   }
   if(req.method==='POST'&&path==='/application-receipts'){
    if(typeof verifyApplicationReceipts!=='function')return send(503,{error:'Application receipt verification is not configured.'});
    if(!body||Object.keys(body).sort().join(',')!=='documents,job_id'||!/^[A-Za-z0-9_-]{1,160}$/.test(body.job_id||'')||!Array.isArray(body.documents)||body.documents.length!==2||body.documents.some(d=>!d||Object.keys(d).sort().join(',')!=='document_sha256,document_type,drive_url,file_id'||!['resume','coverLetter'].includes(d.document_type)||!/^[a-f0-9]{64}$/.test(d.document_sha256||'')||!/^[A-Za-z0-9_-]{10,160}$/.test(d.file_id||'')||d.drive_url!==`https://drive.google.com/file/d/${d.file_id}/view`)||new Set(body.documents.map(d=>d.document_type)).size!==2)return send(400,{error:'Invalid application receipts request.'});
    try{await authorizeJob(body.job_id);return send(200,await activity.run(()=>verifyApplicationReceipts(body)));}
    catch(error){return send(error.message==='NOT_FOUND'?404:error.message==='UNAUTHORIZED'?403:error.message==='VERSION_CONFLICT'?409:422,{error:safeError(error)});}
   }
   if(req.method==='POST'&&path==='/runs'){
    if(!body||Object.keys(body).some(key=>!['job_id','document_type'].includes(key))||!/^[A-Za-z0-9_-]{1,160}$/.test(body.job_id||'')||!['resume','coverLetter','both'].includes(body.document_type))return send(400,{error:'Invalid document request.'});
    try{await authorizeJob(body.job_id);}catch(error){return send(error.message==='NOT_FOUND'?404:403,{error:safeError(error)});}
    try{return send(202,enqueue(body));}catch(error){return send(error.message==='WORK_ALREADY_ACTIVE'?409:422,{error:error.message==='WORK_ALREADY_ACTIVE'?'This document is already being prepared. Wait for that run to finish.':safeError(error)});}
   }
   if(req.method==='GET'&&/^\/runs\/[a-f0-9-]{36}$/.test(path)){
    const run=runs.get(path.slice(6));return run?send(200,run):send(404,{error:'Request not found.'});
   }
   return send(404,{error:'Action not found.'});
  }catch{return send(500,{error:'Raven helper could not confirm this request.'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,drain:()=>scheduler.drain(),submit:async input=>{await authorizeJob(input.job_id);return enqueue(input);},getRun:id=>runs.get(id)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const config=JSON.parse(await readFile(process.env.RAVEN_PRIVATE_CONFIG,'utf8'));
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.CONTROL_PLANE_API_KEY;
  const dispatch=await createPrivateDispatcher({config,serviceKey});
  // The private bridge updates an in-memory, per-call grant before awaiting its handler.
  // Keep only those brief tool calls serialized; Codex workers run independently.
  const serialDispatch=serializePrivateDispatch(dispatch);
  const rest=async(path,init={})=>{const r=await fetch(config.supabaseUrl+'/rest/v1/'+path,{...init,signal:AbortSignal.timeout(15000),headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...init.headers}});if(!r.ok)throw Error('DATABASE_UNAVAILABLE');const text=await r.text();return text?JSON.parse(text):[];};
  const adapters=createCodexAdapters({codexPath:process.env.RAVEN_CODEX_CLI_PATH});
  const receiptStore=await createReceiptJournal(resolve('private/oneclick/receipts'));
  const withDocumentLock=createDocumentLock();
  const runWorkflow=createOneClickWorkflow({dispatch:serialDispatch,rest,config,receiptStore,withDocumentLock,...adapters});
  const authorizeJob=async id=>{
   if(Date.parse(config.expiresAt)<=Date.now()||(config.allowSavedJobs!==true&&!config.jobIds.includes(id)))throw Error('UNAUTHORIZED');
   const rows=await rest('raven_jobs?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1');if(rows?.[0]?.id!==id)throw Error('NOT_FOUND');
  };
  const {createApplicationDocumentPreparer}=await import('./application-pdf.mjs');
  const preparePdf=createApplicationDocumentPreparer({dispatch:serialDispatch,authorizeJob,exportDirectory:resolve('private/exports')});
  const prepareApplicationDocuments=body=>withDocumentLock(body.job_id,'resume',()=>withDocumentLock(body.job_id,'coverLetter',()=>preparePdf(body)));
  const verifyApplicationReceipts=createApplicationReceiptVerifier({dispatch:serialDispatch,rest,verifyUpload:adapters.verifyUpload,config});
  let remote,pump;
  const runtime=await createOneClickServer({runWorkflow,rest,authorizeJob,prepareApplicationDocuments,verifyApplicationReceipts,activity:createWindowsJobActivity(),pairRemote:async()=>{if(!remote)throw Error('QUEUE_NOT_READY');return remote.pair();}});
  const {server}=runtime;
  server.listen(8766,'127.0.0.1',async()=>{
   process.stdout.write('Raven one-click helper ready on this computer.\n');
   // Only the process that successfully owns the loopback listener can claim remote work.
   let initializing=false;
   const poll=async()=>{
    if(initializing)return;initializing=true;
    try{
     if(!remote){remote=await prepareRemoteWorker({rest,config,directory:resolve('private/oneclick')});pump=createRemotePump({rest,remote,submit:runtime.submit,getRun:runtime.getRun,authorizeJob});}
     await pump.tick();
    }catch{process.stderr.write('Raven phone queue unavailable; local generation remains available.\n');}
    finally{initializing=false;}
   };
   void poll();setInterval(()=>void poll(),10000).unref();
  });
  server.on('error',()=>{process.stderr.write('Raven helper could not start. Check whether it is already running.\n');process.exitCode=1;});
 }catch{process.stderr.write('Raven helper is not configured. Check the saved credentials, local grant, Codex sign-in and resume folder.\n');process.exitCode=1;}
}
