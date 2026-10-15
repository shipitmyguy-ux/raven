import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {join,resolve,sep,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createOneClickClient} from '../oneclick-client.mjs';

const origin='https://shipitmyguy-ux.github.io',jobId='recovery-job',folderId='recovery_fixture_folder';
const fixture=fileURLToPath(new URL('./fixtures/oneclick-recovery-helper.mjs',import.meta.url));
const sha=value=>createHash('sha256').update(value).digest('hex');
async function bounded(promise,label,ms=10000){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+' timed out')),ms))]);}
 finally{clearTimeout(timer);}
}
async function stop(helper){
 if(!helper||helper.child.exitCode!==null||helper.child.signalCode!==null)return;
 const exited=once(helper.child,'exit');helper.child.kill('SIGKILL');await bounded(exited,'fixture process exit');
}
async function start(root,mode,type,port=0){
 // Do not pass credentials, private configuration, or the developer's NODE_OPTIONS to this fixture.
 const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','TMPDIR'].includes(name.toUpperCase())));
 const child=fork(fixture,[root,mode,type,String(port)],{env,execArgv:[],windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
 const messages=[];let diagnostics='';
 child.stdout.on('data',chunk=>{diagnostics+=chunk;});child.stderr.on('data',chunk=>{diagnostics+=chunk;});
 child.on('message',message=>messages.push(message));
 const message=async type=>{
  const deadline=Date.now()+10000;
  while(!messages.some(message=>message.type===type)){
   assert.ok(child.exitCode===null&&child.signalCode===null,'Fixture exited: '+diagnostics);
   assert.ok(Date.now()<deadline,'Missing '+type+' message: '+diagnostics);
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  return messages.find(message=>message.type===type);
 };
 const helper={child,message};
 try{const ready=await message('ready');assert.notEqual(ready.port,8766);assert.notEqual(ready.port,8767);return {...helper,...ready,base:'http://127.0.0.1:'+ready.port};}
 catch(error){await stop(helper);throw error;}
}
function clientFor(helper){
 const calls=[];
 const client=createOneClickClient({baseUrl:helper.base,pollMs:5,maxWaitMs:10000,fetchImpl:(url,options)=>{
  calls.push(new URL(url).pathname);
  return fetch(url,{...options,headers:{...options.headers,Origin:origin,Referer:origin+'/raven/'}});
 }});
 return {client,calls};
}
async function database(root){return JSON.parse(await readFile(join(root,'database.json'),'utf8'));}
async function pdfSnapshot(root){
 const result={};
 for(const name of await readdir(join(root,'pdf'))){const file=join(root,'pdf',name),bytes=await readFile(file),info=await stat(file);result[name]={sha256:sha(bytes),mtime_ms:info.mtimeMs,size:info.size};}
 return result;
}
async function driveIds(root){return (await readdir(join(root,'drive'))).filter(name=>name.endsWith('.pdf')).sort();}

for(const scenario of ['fail-once','crash'])for(const documentType of ['resume','coverLetter','both']){
 test('post-upload '+scenario+' recovery: '+documentType,{timeout:30000},async t=>{
  const root=await mkdtemp(join(tmpdir(),'raven-recovery-'));
  const untouched={id:'control-job',status:'Applied',resume:'existing control resume',coverLetter:'existing control letter',approval:'approved'};
  await writeFile(join(root,'database.json'),JSON.stringify({jobs:{[jobId]:{version:1,status:'Saved',approvals:{resume:false,coverLetter:false}},'control-job':untouched},files:[],events:[],counts:{generate:0,save:0,render:0,upload:0,verify:0,record:0,blocked:0}}));
  let helper;
  t.after(async()=>{
   await stop(helper);
   // Remove only the uniquely created test directory, never a supplied/private runtime path.
   assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('raven-recovery-'));
   await rm(root,{recursive:true,force:true});
  });
  helper=await start(root,scenario,documentType);
  const {client,calls}=clientFor(helper),input={job_id:jobId,document_type:documentType};
  const kinds=documentType==='both'?['resume','coverLetter']:[documentType];
  let accept;
  const accepted=new Promise(resolve=>accept=resolve);
  // Observe rejection immediately, including the expected transport break on SIGKILL.
  const first=client.run(input,()=>{},{onAccepted:run=>accept(run)}).then(result=>({result}),error=>({error}));
  const initialRun=await bounded(accepted,'initial request acceptance');
  if(scenario==='crash')await helper.message('checkpoint');
  else{
   const outcome=await bounded(first,'injected link-write failure');assert.ok(outcome.error);assert.equal(outcome.error.failed_stage,'recording');assert.equal(outcome.error.error_code,'PDF_OR_DRIVE_EXPORT_FAILED');
  }
  const failed=await database(root),beforePdfs=await pdfSnapshot(root),beforeDrive=await driveIds(root);
  assert.deepEqual(failed.jobs['control-job'],untouched);
  assert.equal(failed.counts.generate,kinds.length);assert.equal(failed.counts.save,kinds.length);
  assert.equal(failed.counts.render,kinds.length);assert.equal(failed.counts.upload,kinds.length);
  assert.equal(failed.counts.blocked,kinds.length);assert.equal(failed.counts.record,0);
  assert.equal(failed.events.filter(e=>e.event_type==='document_drive_export').length,0);
  assert.equal(failed.files.length,kinds.length);assert.equal(beforeDrive.length,kinds.length);
  const documentHashes=Object.fromEntries(kinds.map(kind=>[kind,sha(failed.jobs[jobId][kind])]));
  for(const kind of kinds){
   const key=[jobId,kind,documentHashes[kind],folderId].join('|');
   const receipt=JSON.parse(await readFile(join(root,'receipts',sha(key)+'.json'),'utf8'));
   assert.ok(failed.files.some(file=>file.file_id===receipt.file_id));assert.equal(receipt.pdf.document_sha256,documentHashes[kind]);
  }
  if(scenario==='crash'){
   const interrupted=JSON.parse(await readFile(join(root,'runs',initialRun.run_id+'.json'),'utf8'));assert.equal(interrupted.stage,'recording');
   const port=helper.port;await stop(helper);assert.ok((await bounded(first,'interrupted client')).error);
   helper=await start(root,'normal',documentType,port);
   // Same client/base URL retains the old bearer; production client must renew its session.
   await assert.rejects(client.resumeRun(input,initialRun.run_id),error=>error.error_code==='HELPER_RESTARTED'&&error.failed_stage==='recording'&&error.run_id===initialRun.run_id);
   assert.equal((await database(root)).counts.upload,kinds.length,'Startup/readback must not requeue uploads');
   assert.ok(calls.filter(path=>path==='/session').length>=2,'Restart must renew the in-memory session');
  }
  const recovered=await client.run(input);
  assert.equal(recovered.stage,'complete');assert.notEqual(recovered.run_id,initialRun.run_id);
  assert.deepEqual(recovered.documents.map(doc=>doc.document_type),kinds);
  assert.ok(!recovered.stage_timings.some(t=>['writing','saving','uploading'].includes(t.stage)),'Retry must not generate, save, or upload again');
  const saved=await database(root);
  for(const key of ['generate','save','render','upload'])assert.equal(saved.counts[key],failed.counts[key],key+' must not run on retry');
  assert.equal(saved.counts.record,kinds.length);assert.equal(saved.counts.verify,kinds.length);
  assert.deepEqual(await pdfSnapshot(root),beforePdfs,'PDF bytes and modification times must be unchanged');
  assert.deepEqual(await driveIds(root),beforeDrive,'No duplicate physical Drive files');assert.deepEqual(saved.files,failed.files);
  assert.equal(saved.events.filter(e=>e.event_type==='document_drive_export').length,kinds.length);
  for(const doc of recovered.documents){
   assert.equal(doc.reused_existing,true);assert.equal(sha(saved.jobs[jobId][doc.document_type]),documentHashes[doc.document_type]);assert.equal(doc.document_sha256,documentHashes[doc.document_type]);
   assert.equal(doc.document_url,saved.jobs[jobId][doc.document_type]);assert.ok(failed.files.some(file=>file.file_id===doc.file_id));
   const exports=saved.events.filter(e=>e.event_type==='document_drive_export'&&e.metadata.document_type===doc.document_type);
   assert.equal(exports.length,1);assert.equal(exports[0].job_id,jobId);assert.equal(exports[0].metadata.document_sha256,doc.document_sha256);assert.equal(exports[0].metadata.file_id,doc.file_id);assert.equal(exports[0].metadata.drive_url,doc.drive_url);
  }
  assert.equal(saved.jobs[jobId].status,'Saved');assert.deepEqual(saved.jobs[jobId].approvals,{resume:false,coverLetter:false});assert.deepEqual(saved.jobs['control-job'],untouched);
  // A second retry must reuse the canonical link too, not just the receipt.
  await client.run(input);
  const retried=await database(root);for(const key of ['generate','save','render','upload','record'])assert.equal(retried.counts[key],saved.counts[key],key+' must be idempotent');
  const port=helper.port;await stop(helper);helper=await start(root,'normal',documentType,port);
  const refreshed=await clientFor(helper).client.resumeRun(input,recovered.run_id);
  assert.deepEqual(refreshed.documents,recovered.documents,'New process/session must retain correct links');
  assert.deepEqual(await driveIds(root),beforeDrive);assert.deepEqual((await database(root)).jobs,saved.jobs);
 });
}

for(const firstType of ['both','resume','coverLetter']){
 test('concurrent duplicate and overlapping requests: '+firstType+' first',{timeout:30000},async t=>{
  const root=await mkdtemp(join(tmpdir(),'raven-recovery-'));
  const control={version:1,status:'Applied',resume:'preserved control resume'};
  await writeFile(join(root,'database.json'),JSON.stringify({jobs:{[jobId]:{version:1,status:'Saved'},'control-job':control},files:[],events:[],counts:{generate:0,save:0,render:0,upload:0,verify:0,record:0,blocked:0}}));
  let helper;
  t.after(async()=>{await stop(helper);assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('raven-recovery-'));await rm(root,{recursive:true,force:true});});
  helper=await start(root,'hold-writing','both');
  const headers={'X-Raven-Local-Client':'raven-web-v1',Origin:origin,Referer:origin+'/raven/','Content-Type':'application/json'};
  const session=await fetch(helper.base+'/session',{method:'POST',headers,body:'{}'});assert.equal(session.status,200);
  headers.Authorization='Bearer '+(await session.json()).token;
  const submit=async document_type=>{
   const response=await fetch(helper.base+'/runs',{method:'POST',headers,body:JSON.stringify({job_id:jobId,document_type})});
   return {status:response.status,body:await response.json()};
  };
  const first=await submit(firstType);assert.equal(first.status,202);
  await helper.message('writing-'+(firstType==='both'?'resume':firstType));
  if(firstType==='both')await helper.message('writing-coverLetter');
  const duplicates=await Promise.all(Array.from({length:8},()=>submit(firstType)));
  for(const result of duplicates){assert.equal(result.status,202);assert.equal(result.body.run_id,first.body.run_id,'Repeated clicks must share the active run');}
  const runs=[first.body];
  if(firstType==='both'){
   for(const kind of ['resume','coverLetter'])assert.equal((await submit(kind)).status,409,'Paired run must reserve '+kind);
  }else{
   assert.equal((await submit('both')).status,409,'Partial overlap must not queue another pair');
   const other=firstType==='resume'?'coverLetter':'resume';
   const independent=await submit(other);assert.equal(independent.status,202);assert.notEqual(independent.body.run_id,first.body.run_id);runs.push(independent.body);
   await helper.message('writing-'+other);
   const overlaps=await Promise.all(Array.from({length:8},(_,i)=>submit(i%2?firstType:other)));
   for(let i=0;i<overlaps.length;i++){assert.equal(overlaps[i].status,202);assert.equal(overlaps[i].body.run_id,i%2?first.body.run_id:independent.body.run_id);}
   assert.equal((await submit('both')).status,409,'Two independent active documents must reject an overlapping pair');
  }
  const held=await database(root);assert.equal(held.counts.generate,2);assert.equal(held.counts.upload,0);
  for(const kind of ['resume','coverLetter'])helper.child.send({type:'release',document_type:kind});
  const {client}=clientFor(helper);
  const completed=await Promise.all(runs.map(run=>client.resumeRun({job_id:jobId,document_type:run.document_type},run.run_id)));
  const documents=completed.flatMap(run=>run.documents),saved=await database(root);
  assert.equal(documents.length,2);assert.equal(new Set(documents.map(doc=>doc.file_id)).size,2);
  for(const key of ['generate','save','render','upload','record'])assert.equal(saved.counts[key],2,key+' must occur once per document');
  assert.equal(saved.files.length,2);assert.equal((await driveIds(root)).length,2);
  for(const kind of ['resume','coverLetter']){
   const doc=documents.find(doc=>doc.document_type===kind);assert.ok(doc);
   assert.equal(doc.document_url,saved.jobs[jobId][kind]);assert.equal(doc.document_sha256,sha(saved.jobs[jobId][kind]));
   const links=saved.events.filter(e=>e.event_type==='document_drive_export'&&e.metadata.document_type===kind);
   assert.equal(links.length,1);assert.equal(links[0].job_id,jobId);assert.equal(links[0].metadata.file_id,doc.file_id);assert.equal(links[0].metadata.drive_url,doc.drive_url);
   const file=saved.files.find(file=>file.file_id===doc.file_id);assert.ok(file);assert.equal(sha(await readFile(join(root,'drive',doc.file_id+'.pdf'))),file.pdf_sha256);
  }
  assert.deepEqual(saved.jobs['control-job'],control);
  const before=await pdfSnapshot(root),files=await driveIds(root);
  const repeated=await client.run({job_id:jobId,document_type:'both'});
  assert.deepEqual(repeated.documents.map(doc=>doc.file_id).sort(),documents.map(doc=>doc.file_id).sort());
  const after=await database(root);for(const key of ['generate','save','render','upload','record'])assert.equal(after.counts[key],2,'Completed retry must reuse '+key);
  assert.deepEqual(await pdfSnapshot(root),before);assert.deepEqual(await driveIds(root),files);
  // A fresh client represents refresh: durable runs must retain their exact job/document links.
  const refreshed=clientFor(helper).client;
  for(const run of completed)assert.deepEqual((await refreshed.resumeRun({job_id:jobId,document_type:run.document_type},run.run_id)).documents,run.documents);
 });
}
