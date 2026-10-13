import http from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPrivateDispatcher} from './private-mcp-stdio.mjs';
import {createOneClickWorkflow} from './oneclick-workflow.mjs';
import {createCodexAdapters} from './oneclick-codex.mjs';

export async function atomicJson(path,value){
 const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value));await rename(temporary,path);
}
export async function createReceiptJournal(directory){
 await mkdir(directory,{recursive:true});
 const path=key=>join(directory,createHash('sha256').update(key).digest('hex')+'.json');
 return {async get(key){try{return JSON.parse(await readFile(path(key),'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw Error('RECEIPT_JOURNAL_INVALID');}},async set(key,value){await atomicJson(path(key),value);}};
}
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

export async function createOneClickServer({runWorkflow,rest,authorizeJob,stateDir=resolve('private/oneclick/runs'),allowedOrigin='https://shipitmyguy-ux.github.io',refererPrefix='https://shipitmyguy-ux.github.io/raven/'}){
 if(![runWorkflow,rest,authorizeJob].every(value=>typeof value==='function'))throw Error('ONE_CLICK_NOT_CONFIGURED');
 await mkdir(stateDir,{recursive:true});
 const runs=new Map(),active=new Map(),sessions=new Map();let queue=Promise.resolve();
 for(const name of await readdir(stateDir)){
  if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
  const state=JSON.parse(await readFile(join(stateDir,name),'utf8'));
  if(!['complete','failed'].includes(state.stage)){state.stage='failed';state.error='The helper restarted. Click again to resume safely from the saved document and upload receipt.';}
  runs.set(state.run_id,state);
 }
 const save=state=>atomicJson(join(stateDir,state.run_id+'.json'),state);
 async function persist(state){
  await save(state);
  await rest('raven_job_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({job_id:state.job_id,event_type:'resume_workflow',source:'raven-one-click',summary:`Resume workflow: ${state.stage}`,metadata:{run_id:state.run_id,stage:state.stage,document_type:state.document_type,error:state.error||null,documents:(state.documents||[]).map(({document_type,document_sha256,drive_url,file_id})=>({document_type,document_sha256,drive_url,file_id}))}})});
 }
 function enqueue(input){
  const key=input.job_id+'|'+input.document_type;
  const current=active.get(key);if(current)return current;
  const state={run_id:randomUUID(),job_id:input.job_id,document_type:input.document_type,stage:'queued',created_at:new Date().toISOString()};
  runs.set(state.run_id,state);active.set(key,state);
  queue=queue.catch(()=>{}).then(async()=>{
   let writes=Promise.resolve();
   try{
    await persist(state);
    const result=await runWorkflow({jobId:state.job_id,documentType:state.document_type},progress=>{
     // Complete is published only after the workflow and all durable progress writes finish.
     if(progress.stage==='complete'||progress.stage==='failed')return;
     Object.assign(state,progress);const snapshot={...state};
     writes=writes.then(()=>persist(snapshot));
    });
    await writes;
    const complete={...state,...result,stage:'complete'};await persist(complete);Object.assign(state,complete);
   }catch(error){
    await writes.catch(()=>{});state.stage='failed';state.error=safeError(error);state.documents=error.partial_documents||state.documents||[];
    await persist(state).catch(()=>save(state));
   }finally{active.delete(key);}
  });
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
  if(req.method==='GET'&&path==='/health')return send(200,{app:'raven-one-click',ready:true});
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
   if(req.method==='POST'&&path==='/runs'){
    if(!body||Object.keys(body).some(key=>!['job_id','document_type'].includes(key))||!/^[A-Za-z0-9_-]{1,160}$/.test(body.job_id||'')||!['resume','coverLetter','both'].includes(body.document_type))return send(400,{error:'Invalid document request.'});
    try{await authorizeJob(body.job_id);}catch(error){return send(error.message==='NOT_FOUND'?404:403,{error:safeError(error)});}
    return send(202,enqueue(body));
   }
   if(req.method==='GET'&&/^\/runs\/[a-f0-9-]{36}$/.test(path)){
    const run=runs.get(path.slice(6));return run?send(200,run):send(404,{error:'Request not found.'});
   }
   return send(404,{error:'Action not found.'});
  }catch{return send(500,{error:'Raven helper could not confirm this request.'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,drain:()=>queue};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const config=JSON.parse(await readFile(process.env.RAVEN_PRIVATE_CONFIG,'utf8'));
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.CONTROL_PLANE_API_KEY;
  const dispatch=await createPrivateDispatcher({config,serviceKey});
  const rest=async(path,init={})=>{const r=await fetch(config.supabaseUrl+'/rest/v1/'+path,{...init,signal:AbortSignal.timeout(15000),headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...init.headers}});if(!r.ok)throw Error('DATABASE_UNAVAILABLE');const text=await r.text();return text?JSON.parse(text):[];};
  const adapters=createCodexAdapters({codexPath:process.env.RAVEN_CODEX_CLI_PATH});
  const receiptStore=await createReceiptJournal(resolve('private/oneclick/receipts'));
  const runWorkflow=createOneClickWorkflow({dispatch,rest,config,receiptStore,...adapters});
  const authorizeJob=async id=>{
   if(Date.parse(config.expiresAt)<=Date.now()||(config.allowSavedJobs!==true&&!config.jobIds.includes(id)))throw Error('UNAUTHORIZED');
   const rows=await rest('raven_jobs?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1');if(rows?.[0]?.id!==id)throw Error('NOT_FOUND');
  };
  const {server}=await createOneClickServer({runWorkflow,rest,authorizeJob});
  server.listen(8766,'127.0.0.1',()=>process.stdout.write('Raven one-click helper ready on this computer.\n'));
  server.on('error',()=>{process.stderr.write('Raven helper could not start. Check whether it is already running.\n');process.exitCode=1;});
 }catch{process.stderr.write('Raven helper is not configured. Check the saved credentials, local grant, Codex sign-in and resume folder.\n');process.exitCode=1;}
}
