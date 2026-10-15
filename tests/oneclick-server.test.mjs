import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOneClickServer,createReceiptJournal,createWriterScheduler,createDocumentLock,serializePrivateDispatch} from '../scripts/oneclick-server.mjs';
import {verifiedDriveReceipt} from '../scripts/oneclick-codex.mjs';
import {createJobActivity} from '../scripts/oneclick-power.mjs';
const origin='https://shipitmyguy-ux.github.io';
function within(promise,label){
 let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+' did not start concurrently')),1500))]).finally(()=>clearTimeout(timer));
}
async function fixture(runWorkflow,options={}){
 const dir=await mkdtemp(join(tmpdir(),'raven-oneclick-test-'));
 const writes=[];const runtime=await createOneClickServer({stateDir:dir,runWorkflow,rest:async(_path,init)=>{writes.push(JSON.parse(init.body));assert.equal(init.headers.Prefer,'return=representation');return [];},authorizeJob:async id=>{if(id==='forbidden')throw Error('UNAUTHORIZED');},...options});
 await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+runtime.server.address().port;
 const headers={Origin:origin,Referer:origin+'/raven/','X-Raven-Local-Client':'raven-web-v1','Content-Type':'application/json'};
 const request=(path,body,overrides={})=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...headers,...overrides},body:body===undefined?undefined:JSON.stringify(body)});
 const session=await (await request('/session',{})).json();headers.Authorization='Bearer '+session.token;
 return {runtime,request,writes,dir,cleanup:async()=>{await runtime.drain();await new Promise(resolve=>runtime.server.close(resolve));await rm(dir,{recursive:true,force:true});}};
}
test('local helper rejects foreign origin, missing bearer, GET mutations and unauthorized jobs before events',async()=>{
 const f=await fixture(async()=>{throw Error('must not run');});
 try{
  assert.equal((await f.request('/session',{}, {Origin:'https://evil.test'})).status,403);
  assert.equal((await f.request('/runs',{job_id:'fixture',document_type:'resume'},{Authorization:''})).status,401);
  assert.equal((await f.request('/runs')).status,404);
  assert.equal((await f.request('/runs',{job_id:'forbidden',document_type:'resume'})).status,403);
  assert.equal(f.writes.length,0);
 }finally{await f.cleanup();}
});

test('power status and Stop require a Raven session and cannot cancel or submit work',async()=>{
 let finish;const gate=new Promise(r=>finish=r);let releases=0;
 const activity=createJobActivity({startHold(){return ()=>releases++;}});
 const f=await fixture(async()=>{await gate;return {documents:[]};},{activity});
 try{
  assert.equal((await f.request('/power',undefined,{Authorization:''})).status,401);
  assert.equal((await f.request('/power/stop',{}, {Origin:'https://evil.test'})).status,403);
  assert.equal((await f.request('/power/stop',{}, {Authorization:''})).status,401);
  assert.equal((await f.request('/power/stop',{extra:true})).status,400);
  assert.equal((await f.request('/power/stop')).status,404);
  await f.request('/runs',{job_id:'one',document_type:'resume'});
  assert.equal((await (await f.request('/power')).json()).state,'awake');
  assert.deepEqual(await (await f.request('/power/stop',{})).json(),{supported:true,active_tasks:1,state:'stopped'});
  assert.equal(releases,1);assert.equal(activity.active,1);
  finish();await f.runtime.drain();await new Promise(r=>setImmediate(r));
  assert.equal((await (await f.request('/power')).json()).state,'idle');
 }finally{finish();await f.cleanup();}
});
test('receipt verification is read only and enforces origin, session, job authorization and exact shape',async()=>{
 let checks=0;const documents=['resume','coverLetter'].map(document_type=>({document_type,document_sha256:'a'.repeat(64),file_id:'file1234567890',drive_url:'https://drive.google.com/file/d/file1234567890/view'}));
 const f=await fixture(async()=>{throw Error('writer must not run');},{verifyApplicationReceipts:async body=>{checks++;return body;}});
 try{
  const body={job_id:'allowed',documents};
  assert.equal((await f.request('/application-receipts',body,{Origin:'https://evil.test'})).status,403);
  assert.equal((await f.request('/application-receipts',body,{Authorization:''})).status,401);
  assert.equal((await f.request('/application-receipts',{...body,job_id:'forbidden'})).status,403);
  assert.equal((await f.request('/application-receipts',{...body,documents:[documents[0],{...documents[1],file_id:'other'}]})).status,400);
  assert.equal(checks,0);
  const result=await f.request('/application-receipts',body);assert.equal(result.status,200);assert.deepEqual(await result.json(),body);assert.equal(checks,1);assert.equal(f.writes.length,0);
 }finally{await f.cleanup();}
});
test('duplicate active starts share a run; two jobs write together and completion waits for persistence',async()=>{
 let release,bothStarted;const gate=new Promise(resolve=>release=resolve),begun=new Promise(resolve=>bothStarted=resolve);let running=0,max=0,calls=0;
 const f=await fixture(async(input,onProgress)=>{calls++;running++;max=Math.max(max,running);if(running===2)bothStarted();onProgress({stage:'writing'});await gate;running--;return {job_id:input.jobId,stage:'complete',documents:[]};});
 try{
  const a=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();
  const duplicate=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();
  assert.equal(a.run_id,duplicate.run_id);
  await f.request('/runs',{job_id:'two',document_type:'resume'});
  const pending=await (await f.request('/runs/'+a.run_id)).json();assert.notEqual(pending.stage,'complete');
  await within(begun,'Two different-job writers');
  release();await f.runtime.drain();assert.equal(calls,2);assert.equal(max,2);
  assert.equal((await (await f.request('/runs/'+a.run_id)).json()).stage,'complete');
  assert.equal(f.writes.filter(row=>row.metadata.stage==='complete').length,2);
 }finally{release();await f.cleanup();}
});
test('workflow failure is durable and cannot become complete',async()=>{
 const f=await fixture(async()=>{throw Error('FACTUAL_REVIEW_BLOCKED');});
 try{const run=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();await f.runtime.drain();const result=await (await f.request('/runs/'+run.run_id)).json();assert.equal(result.stage,'failed');assert.match(result.error,/factual review/);assert.equal(f.writes.at(-1).metadata.stage,'failed');}
 finally{await f.cleanup();}
});

test('job sleep hold covers queued work and durable failure writes but not idle health polling',async()=>{
 const events=[];let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);
 const activity=createJobActivity({startHold(){events.push('hold');return ()=>events.push('release');}});
 const f=await fixture(async()=>{started();await gate;throw Error('FACTUAL_REVIEW_BLOCKED');},{activity});
 try{
  assert.equal((await (await f.request('/health')).json()).active_tasks,0);assert.deepEqual(events,[]);
  for(const job_id of ['one','two','three'])await f.request('/runs',{job_id,document_type:'resume'});
  await begun;assert.equal(activity.active,3);assert.deepEqual(events,['hold']);
  const health=await (await f.request('/health')).json();assert.equal(health.active_tasks,3);
  release();await f.runtime.drain();await new Promise(r=>setImmediate(r));
  assert.equal(f.writes.filter(row=>row.metadata.stage==='failed').length,3);
  assert.equal(activity.active,0);assert.deepEqual(events,['hold','release']);
 }finally{release();await f.cleanup();}
});
test('receipt journal survives process recreation with exact PDF hash',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-receipt-test-'));
 try{const a=await createReceiptJournal(dir);await a.set('job|resume|hash|folder',{file_id:'existing',pdf:{pdf_sha256:'exact'}});const b=await createReceiptJournal(dir);assert.equal((await b.get('job|resume|hash|folder')).pdf.pdf_sha256,'exact');assert.equal(await b.get('absent'),undefined);}
 finally{await rm(dir,{recursive:true,force:true});}
});
const meta={id:'file1234567890',mime_type:'application/pdf',parent_ids:['folder1234567890'],url:'https://drive.google.com/file/d/file1234567890/view',title:'resume.pdf'};
const item=(tool,args,data)=>({type:'mcp_tool_call',tool:'google_drive.'+tool,status:'completed',arguments:args,result:{structured_content:data}});
test('a model manifest never substitutes for actual upload and metadata tool readback',()=>{
 const options={folderId:'folder1234567890',pdfPath:'C:/private/resume.pdf',fileName:'resume.pdf'};
 assert.throws(()=>verifiedDriveReceipt([{type:'agent_message',text:JSON.stringify(meta)}],options),/UPLOAD_NOT_CONFIRMED/);
 const upload=item('upload_file',{file_uri:options.pdfPath,parent_folder_id:options.folderId,file_name:options.fileName},{success:true,id:meta.id});
 assert.throws(()=>verifiedDriveReceipt([upload],options),/METADATA_NOT_CONFIRMED/);
 assert.throws(()=>verifiedDriveReceipt([upload,item('get_file_metadata',{fileId:meta.id},{...meta,parent_ids:['wrong']})],options),/METADATA_NOT_CONFIRMED/);
 assert.equal(verifiedDriveReceipt([upload,item('get_file_metadata',{fileId:meta.id},meta)],options).file_id,meta.id);
});

test('cover letter for the same job writes while resume runs',async()=>{
 let release,started,coverStarted;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r),coverBegun=new Promise(r=>coverStarted=r);const order=[];
 const f=await fixture(async(input,onProgress)=>{order.push(input.documentType);onProgress({stage:'writing',document_type:input.documentType});if(input.documentType==='resume'){started();await gate;}else coverStarted();return {job_id:input.jobId,stage:'complete',documents:[{document_type:input.documentType}]};});
 try{
  const resume=await (await f.request('/runs',{job_id:'same',document_type:'resume'})).json();await begun;
  const response=await f.request('/runs',{job_id:'same',document_type:'coverLetter'});assert.equal(response.status,202);const cover=await response.json();assert.notEqual(cover.run_id,resume.run_id);assert.equal(cover.stage,'queued');
  await within(coverBegun,'Same-job cover-letter writer');assert.deepEqual(order,['resume','coverLetter']);release();await f.runtime.drain();
  assert.equal((await (await f.request('/runs/'+cover.run_id)).json()).stage,'complete');
 }finally{release();await f.cleanup();}
});
test('paired run reserves both kinds and keeps its request identity during progress',async()=>{
 let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);let calls=0;
 const f=await fixture(async(input,onProgress)=>{calls++;onProgress({stage:'writing',document_type:'resume'});started();await gate;return {job_id:input.jobId,stage:'complete',documents:[]};});
 try{
  const both=await (await f.request('/runs',{job_id:'same',document_type:'both'})).json();await begun;
  assert.equal((await f.request('/runs',{job_id:'same',document_type:'resume'})).status,409);
  assert.equal((await f.request('/runs',{job_id:'same',document_type:'coverLetter'})).status,409);
  const duplicate=await (await f.request('/runs',{job_id:'same',document_type:'both'})).json();assert.equal(duplicate.run_id,both.run_id);
  const state=await (await f.request('/runs/'+both.run_id)).json();assert.equal(state.document_type,'both');assert.equal(state.current_document_type,'resume');
  release();await f.runtime.drain();assert.equal(calls,1);
 }finally{release();await f.cleanup();}
});
test('writer scheduler admits two single tasks, but a paired task waits for both slots',async()=>{
 const scheduler=createWriterScheduler(2),started=[];let releaseA,releaseB;
 const gateA=new Promise(r=>releaseA=r),gateB=new Promise(r=>releaseB=r);
 const a=scheduler.schedule(async()=>{started.push('a');await gateA;});
 const b=scheduler.schedule(async()=>{started.push('b');await gateB;});
 const both=scheduler.schedule(async()=>{started.push('both');},2);
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(started,['a','b']);
 releaseA();await a;await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(started,['a','b']);
 releaseB();await Promise.all([b,both]);await scheduler.drain();assert.deepEqual(started,['a','b','both']);
});
test('unsupported one-worker setting fails before a paired run can reserve state',async()=>{
 await assert.rejects(createOneClickServer({writerConcurrency:1,runWorkflow:async()=>{},rest:async()=>[],authorizeJob:async()=>{},stateDir:join(tmpdir(),'unused-raven-state')}),/INVALID_WRITER_CONCURRENCY/);
});
test('document lock serializes the same document and allows different kinds together',async()=>{
 const lock=createDocumentLock(),started=[];let release;const gate=new Promise(r=>release=r);
 const a=lock('job','resume',async()=>{started.push('resume-1');await gate;});
 const b=lock('job','resume',async()=>{started.push('resume-2');});
 const c=lock('job','coverLetter',async()=>{started.push('cover');});
 await c;assert.deepEqual(started,['resume-1','cover']);release();await Promise.all([a,b]);assert.deepEqual(started,['resume-1','cover','resume-2']);
});
test('private grant dispatch is isolated across concurrent jobs',async()=>{
 let grant,maximum=0,active=0;const seen=[];
 const dispatch=serializePrivateDispatch(async line=>{const job=JSON.parse(line).job;grant=job;active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,0));seen.push([job,grant]);active--;return job;});
 assert.deepEqual(await Promise.all([dispatch(JSON.stringify({job:'A'})),dispatch(JSON.stringify({job:'B'}))]),['A','B']);
 assert.deepEqual(seen,[['A','A'],['B','B']]);assert.equal(maximum,1);
});

test('stage diagnostics survive disk reload and event readback; unknown errors are redacted',async()=>{
 for(const message of ['EXPORT_RECORD_NOT_CONFIRMED','PRIVATE_SECRET_VALUE']){
  const f=await fixture(async(input,onProgress)=>{onProgress({stage:'recording',document_type:'resume',elapsed_ms:42,stage_timings:[{stage:'uploading',document_type:'resume',duration_ms:20}]});throw Error(message);});
  try{
   const run=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();await f.runtime.drain();
   const result=await (await f.request('/runs/'+run.run_id)).json();
   assert.equal(result.failed_stage,'recording');assert.equal(result.failed_document_type,'resume');
   assert.equal(result.error_code,message==='PRIVATE_SECRET_VALUE'?'WORKFLOW_FAILED':message);
   assert.equal(f.writes.at(-1).metadata.elapsed_ms,42);assert.equal(f.writes.at(-1).metadata.stage_timings[0].duration_ms,20);
   assert.ok(!JSON.stringify(f.writes).includes('PRIVATE_SECRET_VALUE'));
   const reloaded=await createOneClickServer({stateDir:f.dir,runWorkflow:async()=>{},rest:async()=>[],authorizeJob:async()=>{}});
   const {readFile}=await import('node:fs/promises');
   const disk=JSON.parse(await readFile(join(f.dir,run.run_id+'.json'),'utf8'));
   assert.equal(disk.failed_stage,'recording');assert.equal(disk.run_id,run.run_id);
   assert.equal(reloaded.server.listening,false);
  }finally{await f.cleanup();}
 }
});

test('durable progress write failure identifies persistence and never publishes success',async()=>{
 let writes=0;
 const f=await fixture(async(input,progress)=>{progress({stage:'writing',document_type:'resume'});return {job_id:input.jobId,stage:'complete',documents:[]};},{rest:async()=>{if(++writes===2)throw Error('DATABASE_UNAVAILABLE');return [];}});
 try{
  const run=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();await f.runtime.drain();
  const result=await (await f.request('/runs/'+run.run_id)).json();assert.equal(result.stage,'failed');assert.equal(result.failed_stage,'persisting');assert.equal(result.error_code,'DATABASE_UNAVAILABLE');
 }finally{await f.cleanup();}
});

test('destination resolution requires a Raven session, authorized job and canonical server URL',async()=>{
 let reads=0;
 const f=await fixture(async()=>{throw Error('writer must not run');},{rest:async path=>{reads++;assert.match(path,/^raven_jobs\?select=id,url,title,company&id=eq.allowed&limit=1$/);return [{id:'allowed',url:'https://example.breezy.hr/p/job',title:'Artist',company:'Example'}];}});
 try{
  assert.equal((await f.request('/application-destination',{job_id:'allowed'},{Authorization:''})).status,401);
  assert.equal((await f.request('/application-destination',{job_id:'forbidden'})).status,403);
  assert.equal((await f.request('/application-destination',{job_id:'allowed',url:'http://127.0.0.1'})).status,400);
  const result=await f.request('/application-destination',{job_id:'allowed'});
  assert.equal(result.status,200);assert.equal((await result.json()).destination_url,'https://example.breezy.hr/p/job');assert.equal(reads,1);
 }finally{await f.cleanup();}
});
