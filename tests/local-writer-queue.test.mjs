import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQueueHandler} from '../supabase/functions/raven-local-queue/handler.mjs';
import {createRemotePump} from '../scripts/oneclick-remote.mjs';
import {createRemoteWriterClient} from '../remote-writer-client.mjs';
const token='a'.repeat(64),id='00000000-0000-4000-8000-000000000001';
const device={id,worker_id:id,expires_at:'2099-01-01',revoked:false};
const req=(data,auth=token,origin='https://shipitmyguy-ux.github.io')=>new Request('https://queue.test',{method:'POST',headers:{'content-type':'application/json','x-raven-device':auth,origin},body:JSON.stringify(data)});
test('queue rejects missing, revoked and expired device tokens before enqueue',async()=>{
 let writes=0,active=device;
 const h=createQueueHandler({rest:async path=>{if(path.startsWith('raven_local_devices'))return [active];writes++;return [];}});
 assert.equal((await h(req({action:'enqueue'},''))).status,401);
 active={...device,revoked:true};assert.equal((await h(req({action:'enqueue'}))).status,401);
 active={...device,expires_at:'2000-01-01'};assert.equal((await h(req({action:'enqueue'}))).status,401);
 assert.equal(writes,0);
});
test('queue validates input, origin, size and filters status by authenticated device',async()=>{
 const paths=[];const h=createQueueHandler({rest:async path=>{paths.push(path);return path.startsWith('raven_local_devices')?[device]:[];}});
 assert.equal((await h(req({},token,'https://evil.test'))).status,403);
 assert.equal((await h(req({action:'enqueue',job_id:'valid',document_type:'resume',replace:true}))).status,400);
 assert.equal((await h(req({action:'enqueue',job_id:'x'.repeat(3000)}))).status,413);
 assert.equal((await h(req({action:'status',run_id:id}))).status,404);
 assert.ok(paths.some(p=>p.includes('device_id=eq.'+id)));
});
test('queue reports offline honestly and enqueue only uses server-resolved device ID',async()=>{
 let body;
 const h=createQueueHandler({rest:async(path,init)=>path.startsWith('raven_local_devices')?[device]:path.startsWith('rpc/')?(body=JSON.parse(init.body),[{run_id:id,job_id:'JT-test',stage:'queued'}]):[]});
 const r=await h(req({action:'enqueue',job_id:'JT-test',document_type:'both'}));assert.equal(r.status,202);assert.equal((await r.json()).online,false);assert.deepEqual(body,{p_device:id,p_job:'JT-test',p_kind:'both'});
});
test('worker claims once, rechecks authorization and persists workflow outcome',async()=>{
 const writes=[];let submits=0;
 const pump=createRemotePump({remote:{workerId:id,heartbeat:async()=>{}},rest:async(path,init)=>{
  if(init){writes.push(JSON.parse(init.body));return [{}];}
  if(path.startsWith('raven_local_devices'))return [device];
  return [{run_id:id,device_id:id,job_id:'JT-test',document_type:'resume'}];
 },authorizeJob:async()=>{},submit:async()=>{submits++;return {run_id:id};},getRun:()=>({stage:'complete',documents:[{file_id:'verified'}]})});
 await Promise.all([pump.tick(),pump.tick()]);assert.equal(submits,1);assert.equal(writes[0].stage,'running');assert.equal(writes.at(-1).stage,'complete');
});
test('worker never invokes generation for an expired pairing or unauthorized job',async()=>{
 let submissions=0;const writes=[];
 const pump=createRemotePump({remote:{workerId:id,heartbeat:async()=>{}},rest:async(path,init)=>{
  if(init){writes.push(JSON.parse(init.body));return [{}];}
  return path.startsWith('raven_local_devices')?[device]:[{run_id:id,device_id:id,job_id:'forbidden',document_type:'resume'}];
 },authorizeJob:async()=>{throw Error('UNAUTHORIZED');},submit:async()=>{submissions++;},getRun:()=>{}});
 await pump.tick();assert.equal(submissions,0);assert.equal(writes.at(-1).stage,'failed');
});
test('phone worker claims two authorized rows and runs them together',async()=>{
 const rows=[{run_id:id,device_id:id,job_id:'job-one',document_type:'resume'},
  {run_id:'00000000-0000-4000-8000-000000000002',device_id:id,job_id:'job-two',document_type:'resume'}];
 let release,started;const gate=new Promise(r=>release=r),bothStarted=new Promise(r=>started=r);
 const authorized=[],submitted=[],updates=[];
 const pump=createRemotePump({remote:{workerId:id,heartbeat:async()=>{}},rest:async(path,init)=>{
  if(path.startsWith('raven_local_devices'))return [device];
  if(!init)return rows.filter(row=>!updates.some(update=>update.id===row.run_id&&update.stage==='running')).slice(0,1);
  const row=rows.find(item=>path.includes(item.run_id));const body=JSON.parse(init.body);updates.push({id:row.run_id,...body});return [row];
 },authorizeJob:async job=>authorized.push(job),submit:async input=>{submitted.push(input.job_id);if(submitted.length===2)started();await gate;return {run_id:input.job_id};},getRun:()=>({stage:'complete',documents:[{file_id:'verified'}]})});
 const pending=pump.tick();await bothStarted;assert.deepEqual(new Set(submitted),new Set(['job-one','job-two']));
 assert.deepEqual(new Set(authorized),new Set(['job-one','job-two']));
 release();await pending;assert.equal(updates.filter(item=>item.stage==='running').length,2);
 assert.equal(updates.filter(item=>item.stage==='complete').length,2);
});
test('remote browser polls without local calls and rejects unconfirmed success',async()=>{
 const stages=[];let calls=0;
 const c=createRemoteWriterClient({token,pollMs:0,fetchImpl:async(url,init)=>{
  assert.match(url,/functions\/v1\/raven-local-queue$/);assert.equal(init.headers['x-raven-device'],token);
  calls++;return {ok:true,json:async()=>({run_id:id,job_id:'JT-test',stage:calls===1?'queued':'complete',online:false,documents:[]})};
 }});
 await assert.rejects(c.run({job_id:'JT-test',document_type:'both'},s=>stages.push(s)),/not confirmed/);assert.deepEqual(stages,['offline']);
});
