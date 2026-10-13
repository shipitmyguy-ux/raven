import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOneClickServer,createReceiptJournal} from '../scripts/oneclick-server.mjs';
import {verifiedDriveReceipt} from '../scripts/oneclick-codex.mjs';
const origin='https://shipitmyguy-ux.github.io';
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
test('duplicate active starts share a run and dispatcher work is serial; completion waits for persistence',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);let running=0,max=0,calls=0;
 const f=await fixture(async(input,onProgress)=>{calls++;running++;max=Math.max(max,running);onProgress({stage:'writing'});await gate;running--;return {job_id:input.jobId,stage:'complete',documents:[]};});
 try{
  const a=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();
  const duplicate=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();
  assert.equal(a.run_id,duplicate.run_id);
  await f.request('/runs',{job_id:'two',document_type:'resume'});
  const pending=await (await f.request('/runs/'+a.run_id)).json();assert.notEqual(pending.stage,'complete');
  release();await f.runtime.drain();assert.equal(calls,2);assert.equal(max,1);
  assert.equal((await (await f.request('/runs/'+a.run_id)).json()).stage,'complete');
  assert.equal(f.writes.filter(row=>row.metadata.stage==='complete').length,2);
 }finally{release();await f.cleanup();}
});
test('workflow failure is durable and cannot become complete',async()=>{
 const f=await fixture(async()=>{throw Error('FACTUAL_REVIEW_BLOCKED');});
 try{const run=await (await f.request('/runs',{job_id:'one',document_type:'resume'})).json();await f.runtime.drain();const result=await (await f.request('/runs/'+run.run_id)).json();assert.equal(result.stage,'failed');assert.match(result.error,/factual review/);assert.equal(f.writes.at(-1).metadata.stage,'failed');}
 finally{await f.cleanup();}
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
