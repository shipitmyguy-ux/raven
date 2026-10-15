// Synthetic services only. This process never reads Raven configuration or contacts Drive.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve,sep,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {atomicJson,createOneClickServer,createReceiptJournal,createDocumentLock,serializePrivateDispatch} from '../../scripts/oneclick-server.mjs';
import {createOneClickWorkflow} from '../../scripts/oneclick-workflow.mjs';

const [root,mode,documentType,port="0"]=process.argv.slice(2);
assert.ok(Number(port)===0||(Number(port)>1024&&![8766,8767].includes(Number(port))));
assert.ok(root&&resolve(root).startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('raven-recovery-'),'Fixture requires its own temporary directory');
assert.ok(['fail-once','crash','normal'].includes(mode));
const kinds=documentType==='both'?['resume','coverLetter']:[documentType];
assert.ok(kinds.every(k=>['resume','coverLetter'].includes(k)));
const folderId='recovery_fixture_folder',jobId='recovery-job',sha=value=>createHash('sha256').update(value).digest('hex');
const dbPath=join(root,'database.json');
const db=JSON.parse(await readFile(dbPath,'utf8'));
await mkdir(join(root,'drive'),{recursive:true});await mkdir(join(root,'pdf'),{recursive:true});
let writes=Promise.resolve();
function update(action){
 const next=writes.then(async()=>{const value=await action();await atomicJson(dbPath,db);return value;});
 writes=next.catch(()=>{});return next;
}
async function snapshot(){await writes;return structuredClone(db);}
const waiters=new Map(kinds.map(kind=>[kind,{}]));
for(const waiter of waiters.values())waiter.promise=new Promise(resolve=>waiter.resolve=resolve);
const blocked=new Set();
const receiptStore=await createReceiptJournal(join(root,'receipts'));
function exportRows(path,state){
 const query=new URL(path,'https://synthetic.invalid/').searchParams;
 return state.events.filter(event=>event.event_type==='document_drive_export'&&event.job_id===jobId&&
  ['document_type','document_sha256','folder_id'].every(key=>event.metadata[key]===query.get('metadata->>'+key)?.replace(/^eq\./,'')));
}
const rest=async(path,init)=>{
 if(init?.method==='POST')return update(()=>{
  const event=JSON.parse(init.body);assert.equal(path,'raven_job_events');assert.equal(event.job_id,jobId);
  db.events.push(event);
  // Server writes local state before this event. Wait for this transaction before reporting a crash checkpoint.
  if(event.metadata.stage==='recording'){
   for(const kind of kinds)if(event.metadata.stage_timings?.some(t=>t.document_type===kind))waiters.get(kind).resolve();
  }
  return [event];
 });
 const state=await snapshot();
 if(path.startsWith('raven_jobs?'))return [{id:jobId,company:'Fixture Company',title:'Fixture Role'}];
 assert.ok(path.startsWith('raven_job_events?'));return exportRows(path,state);
};
const baseDispatch=serializePrivateDispatch(async line=>{
 const request=JSON.parse(line),{name,arguments:a={}}=request.params;
 try{
  let value;
  if(name==='get_verified_profile')value={profile:{facts:['Synthetic verified experience']}};
  else{
   assert.equal(a.job_id,jobId);
   const state=await snapshot(),job=state.jobs[jobId];
   if(name==='get_job')value={job:{id:jobId,company:'Fixture Company',title:'Fixture Role',description:'Synthetic complete posting',track:'Professional',url:'https://synthetic.invalid/job',expected_version:String(job.version),has_resume:Boolean(job.resume),has_cover_letter:Boolean(job.coverLetter)},writing_prompt:'Use synthetic verified facts only'};
   else if(name==='get_document'){
    const document=job[a.document_type];if(!document)throw Error('DOCUMENT_UNAVAILABLE');
    value={job_id:jobId,document_type:a.document_type,document_url:document,document_sha256:sha(document),expected_version:String(job.version)};
   }else if(name==='save_generated_document')value=await update(()=>{
    const current=db.jobs[jobId];assert.equal(a.expected_version,String(current.version));assert.ok(!current[a.document_type]);
    db.counts.save++;current[a.document_type]='data:text/html;charset=utf-8,'+encodeURIComponent('<h1>'+jobId+' '+a.document_type+'</h1><p>'+a.document.body+'</p>');current.version++;
    return {saved:true,document_url:current[a.document_type],expected_version:String(current.version)};
   });
   else if(name==='export_document_pdf')value=await update(async()=>{
    db.counts.render++;const document=db.jobs[jobId][a.document_type];assert.equal(a.document_sha256,sha(document));
    // Stable synthetic PDF bytes; renderer layout is outside this orchestration regression.
    const bytes=Buffer.from('%PDF-1.7\n'+jobId+' '+a.document_type+' '+sha(document)+'\n%%EOF\n');
    const file=join(root,'pdf',a.document_type+'.pdf');await writeFile(file,bytes);
    return {file_path:file,file_name:a.document_type+'.pdf',pdf_sha256:sha(bytes),document_sha256:sha(document)};
   });
   else if(name==='record_drive_export')value=await update(()=>{
    db.counts.record++;assert.equal(a.document_sha256,sha(db.jobs[jobId][a.document_type]));
    const file=db.files.find(file=>file.file_id===a.file_id);assert.ok(file);assert.equal(file.pdf_sha256,a.pdf_sha256);
    if(!db.events.some(e=>e.event_type==='document_drive_export'&&e.metadata.document_type===a.document_type&&e.metadata.document_sha256===a.document_sha256))db.events.push({job_id:jobId,event_type:'document_drive_export',metadata:{...a,drive_url:file.drive_url}});
    return {recorded:true,drive_url:file.drive_url};
   });
   else throw Error('UNKNOWN_FIXTURE_TOOL');
  }
  return JSON.stringify({jsonrpc:'2.0',id:request.id,result:{structuredContent:value}});
 }catch(error){return JSON.stringify({jsonrpc:'2.0',id:request.id,result:{isError:true,content:[{type:'text',text:error.message}]}});}
});
const dispatch=async line=>{
 const request=JSON.parse(line),{name,arguments:a={}}=request.params;
 if(name==='record_drive_export'&&mode!=='normal'&&!blocked.has(a.document_type)){
  await waiters.get(a.document_type).promise;
  const receipt=await receiptStore.get([jobId,a.document_type,a.document_sha256,folderId].join('|'));
  assert.ok(receipt,'Crash must follow durable receipt write');assert.equal(receipt.file_id,a.file_id);
  assert.equal(receipt.pdf.pdf_sha256,a.pdf_sha256);blocked.add(a.document_type);
  await update(()=>{db.counts.blocked++;});
  if(mode==='crash'&&blocked.size===kinds.length){
   const deadline=Date.now()+5000;
   while((await snapshot()).events.filter(e=>e.event_type==='resume_workflow'&&e.metadata.stage==='recording').length<kinds.length){
    assert.ok(Date.now()<deadline,'Recording checkpoints did not persist');await new Promise(resolve=>setTimeout(resolve,5));
   }
   process.send?.({type:'checkpoint',file_ids:(await snapshot()).files.map(file=>file.file_id)});
  }
  if(mode==='crash')await new Promise(()=>{});
  return JSON.stringify({jsonrpc:'2.0',id:request.id,result:{isError:true,content:[{type:'text',text:'PDF_OR_DRIVE_EXPORT_FAILED'}]}});
 }
 return baseDispatch(line);
};
const workflow=createOneClickWorkflow({dispatch,rest,config:{driveFolderId:folderId},receiptStore,withDocumentLock:createDocumentLock(),
 generateDraft:async({documentType})=>update(()=>{db.counts.generate++;return {body:'Fresh synthetic '+documentType};}),
 uploadPdf:async({pdf,folderId:parent,fileName})=>update(async()=>{
  assert.equal(parent,folderId);db.counts.upload++;
  const file_id='recovery_file_'+String(db.counts.upload).padStart(6,'0');
  const bytes=await readFile(pdf.file_path);assert.equal(sha(bytes),pdf.pdf_sha256);
  await copyFile(pdf.file_path,join(root,'drive',file_id+'.pdf'));
  const file={file_id,file_name:fileName,mime_type:'application/pdf',parent_ids:[folderId],drive_url:'https://drive.google.com/file/d/'+file_id+'/view',pdf_sha256:sha(bytes)};db.files.push(file);return file;
 }),
 verifyUpload:async({fileId,folderId:parent})=>update(async()=>{
  db.counts.verify++;const file=db.files.find(file=>file.file_id===fileId);assert.ok(file);assert.ok(file.parent_ids.includes(parent));
  assert.equal(sha(await readFile(join(root,'drive',fileId+'.pdf'))),file.pdf_sha256);return file;
 })
});
const runtime=await createOneClickServer({runWorkflow:workflow,rest,authorizeJob:async id=>{if(id!==jobId)throw Error('NOT_FOUND');},stateDir:join(root,'runs')});
runtime.server.listen(Number(port),'127.0.0.1',()=>process.send?.({type:'ready',port:runtime.server.address().port,pid:process.pid}));
