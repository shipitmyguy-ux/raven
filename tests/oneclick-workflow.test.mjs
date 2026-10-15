import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createApplicationReceiptVerifier,createOneClickWorkflow} from '../scripts/oneclick-workflow.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(options={}){
 const docs={},events=[],calls=[],progress=[];
 let version=1,uploads=0,writes=0,records=0;
 const metadata={file_id:'abcdefghijklmno',mime_type:'application/pdf',parent_ids:['folder12345'],file_name:'resume.pdf'};
 if(options.existing)docs.resume='data:text/html;charset=utf-8,existing';
 const dispatch=async line=>{
  const {params:{name,arguments:a}}=JSON.parse(line);calls.push({name,a});
  try{
   let value;
   if(name==='get_document'){
    if(options.changed&&uploads)docs[a.document_type]='changed';
    if(!docs[a.document_type])throw Error('DOCUMENT_UNAVAILABLE');
    value={job_id:'JT-1',document_type:a.document_type,document_url:docs[a.document_type],document_sha256:sha(docs[a.document_type]),expected_version:String(version)};
   }else if(name==='get_job')value={job:{id:'JT-1',company:'Acme',title:'Artist',description:'Full job',expected_version:String(version)},writing_prompt:'grounded prompt'};
   else if(name==='get_verified_profile')value={profile:{facts:['verified']}};
   else if(name==='save_generated_document'){
    writes++;
    if(options.conflict)throw Error('VERSION_CONFLICT');
    if(options.rejectCover&&a.document_type==='coverLetter')throw Error('FACTUAL_REVIEW_BLOCKED');
    if(options.reject&&(options.reject==='always'||writes===1))throw Error('FACTUAL_REVIEW_BLOCKED');
    assert.equal(a.expected_version,String(version));assert.equal(a.replace,undefined);
    docs[a.document_type]='data:text/html;charset=utf-8,'+a.document_type;version++;
    value={saved:true,document_url:docs[a.document_type],expected_version:String(version)};
   }else if(name==='export_document_pdf')value={file_path:'private/test.pdf',file_name:'resume.pdf',pdf_sha256:'a'.repeat(64),document_sha256:a.document_sha256};
   else if(name==='record_drive_export'){
    records++;if(options.recordFailure&&records===1)throw Error('PDF_OR_DRIVE_EXPORT_FAILED');
    events.push({metadata:a});value={recorded:true,drive_url:'https://drive.google.com/file/d/'+a.file_id+'/view'};
   }else throw Error('UNKNOWN');
   return JSON.stringify({result:{structuredContent:value}});
  }catch(error){return JSON.stringify({result:{isError:true,content:[{text:error.message}]}});}
 };
 const factory=()=>createOneClickWorkflow({receiptStore:options.receiptStore,dispatch,config:{driveFolderId:'folder12345'},rest:async path=>path.startsWith('raven_jobs?')?[{id:'JT-1',company:'Acme',title:'Artist'}]:events.filter(e=>path.includes('document_type=eq.'+e.metadata.document_type)),generateDraft:async args=>{calls.push({name:'writer',a:args});if(options.generateDraft)await options.generateDraft(args);return {draft:true};},uploadPdf:async args=>{calls.push({name:'upload',a:args});uploads++;if(options.uploadFailure)throw Error('UPLOAD_FAILED');return {...metadata,parent_ids:options.wrongFolder?['otherfolder']:metadata.parent_ids};},verifyUpload:async()=>metadata});
 let run=factory();
 return {restart:()=>{run=factory();},run:args=>run(args,p=>progress.push(p)),calls,docs,events,progress,get uploads(){return uploads;},get writes(){return writes;}};
}
test('creates, verifies and persists both documents; retry reuses exports',async()=>{
 const f=fixture();const result=await f.run({jobId:'JT-1',documentType:'both'});
 assert.equal(result.stage,'complete');assert.equal(result.documents.length,2);assert.equal(f.writes,2);assert.equal(f.uploads,2);
 assert.equal(f.calls.filter(c=>c.name==='writer').length,2);
 assert.deepEqual(new Set(f.calls.filter(c=>c.name==='upload').map(c=>c.a.fileName)),new Set(['Acme - Artist - Resume.pdf','Acme - Artist - Cover letter.pdf']));
 assert.equal(f.calls.find(c=>c.name==='upload').a.pdf.file_name,'resume.pdf','local PDF filename is retained');
 await f.run({jobId:'JT-1',documentType:'both'});assert.equal(f.uploads,2);assert.equal(f.writes,2);
 assert.equal(f.progress.at(-1).stage,'complete');
});
test('paired drafts overlap before either save and sibling saves use fresh versions',async()=>{
 let release,started;const gate=new Promise(r=>release=r),bothStarted=new Promise(r=>started=r);const kinds=[];
 const f=fixture({generateDraft:async({documentType})=>{kinds.push(documentType);if(kinds.length===2)started();await gate;}});
 const pending=f.run({jobId:'JT-1',documentType:'both'});await bothStarted;
 assert.deepEqual(new Set(kinds),new Set(['resume','coverLetter']));assert.equal(f.writes,0);
 release();const result=await pending;assert.equal(result.documents.length,2);
 assert.deepEqual(f.calls.filter(c=>c.name==='save_generated_document').map(c=>c.a.expected_version),['1','2']);
});
test('failed sibling leaves completed document reusable on retry',async()=>{
 const options={rejectCover:true};const f=fixture(options);
 let failure;try{await f.run({jobId:'JT-1',documentType:'both'});}catch(error){failure=error;}
 assert.match(failure?.message||'',/FACTUAL_REVIEW_BLOCKED/);
 assert.deepEqual(failure.partial_documents.map(doc=>doc.document_type),['resume']);
 assert.ok(f.docs.resume);assert.equal(f.docs.coverLetter,undefined);assert.equal(f.uploads,1);
 options.rejectCover=false;const retried=await f.run({jobId:'JT-1',documentType:'both'});
 assert.equal(retried.documents.find(doc=>doc.document_type==='resume').reused_existing,true);
 assert.equal(f.uploads,2);
});
test('existing documents are preserved without invoking writer',async()=>{
 const f=fixture({existing:true});await f.run({jobId:'JT-1'});assert.equal(f.docs.resume,'data:text/html;charset=utf-8,existing');assert.equal(f.writes,0);
 assert.equal(f.calls.find(c=>c.name==='upload').a.fileName,'Acme - Artist - Resume.pdf');
 assert.deepEqual(f.progress.slice(0,3).map(p=>p.stage),['queued','checking_saved_state','checking_drive_receipts']);
});
test('factual rejection gets exactly one bounded repair',async()=>{
 const f=fixture({reject:true});await f.run({jobId:'JT-1'});assert.equal(f.writes,2);assert.equal(f.calls.filter(c=>c.name==='writer')[1].a.repair.error,'FACTUAL_REVIEW_BLOCKED');
 const bad=fixture({reject:'always'});await assert.rejects(bad.run({jobId:'JT-1'}),/FACTUAL_REVIEW_BLOCKED/);assert.equal(bad.writes,2);assert.equal(bad.uploads,0);
 assert.match(f.calls.filter(c=>c.name==='writer')[1].a.repair.details,/unverified skill|incomplete document/);
});
test('version conflicts do not retry or overwrite',async()=>{
 const f=fixture({conflict:true});await assert.rejects(f.run({jobId:'JT-1'}),/VERSION_CONFLICT/);assert.equal(f.writes,1);assert.equal(f.uploads,0);
});
test('upload failure preserves saved document and is never complete',async()=>{
 const f=fixture({uploadFailure:true});await assert.rejects(f.run({jobId:'JT-1'}),/UPLOAD_FAILED/);assert.ok(f.docs.resume);assert.equal(f.events.length,0);assert.equal(f.progress.at(-1).stage,'failed');
});
test('wrong folder metadata is rejected',async()=>{
 const f=fixture({wrongFolder:true});await assert.rejects(f.run({jobId:'JT-1'}),/DRIVE_UPLOAD_NOT_VERIFIED/);assert.equal(f.events.length,0);
});
test('recording retry retains actual upload receipt and avoids duplicate copy',async()=>{
 const f=fixture({recordFailure:true});await assert.rejects(f.run({jobId:'JT-1'}),/PDF_OR_DRIVE_EXPORT_FAILED/);await f.run({jobId:'JT-1'});assert.equal(f.uploads,1);assert.equal(f.writes,1);assert.equal(f.events.length,1);
});
test('durable receipt survives helper restart after recording failure',async()=>{
 const journal=new Map();
 const f=fixture({recordFailure:true,receiptStore:{get:async key=>journal.get(key),set:async(key,value)=>journal.set(key,value)}});
 await assert.rejects(f.run({jobId:'JT-1'}),/PDF_OR_DRIVE_EXPORT_FAILED/);
 assert.equal(journal.size,1);f.restart();
 const result=await f.run({jobId:'JT-1'});assert.equal(f.uploads,1);assert.equal(result.documents[0].reused_existing,true);
 assert.equal(f.calls.filter(call=>call.name==='export_document_pdf').length,1,'retry must retain original PDF bytes and hash');
});
test('document mutation after PDF upload cannot be recorded as current',async()=>{
 const f=fixture({changed:true});await assert.rejects(f.run({jobId:'JT-1'}),/VERSION_CONFLICT/);assert.equal(f.events.length,0);
});
test('invalid input fails before any tool call',async()=>{
 const f=fixture();await assert.rejects(f.run({jobId:'bad/id'}),/INVALID_ARGUMENTS/);assert.equal(f.calls.length,0);
});
test('resume receipt check requires exact canonical hash, saved event and live Drive folder',async()=>{
 const folder='folder12345',fileId='abcdefghijklmno',driveUrl=`https://drive.google.com/file/d/${fileId}/view`;
 const documents=['resume','coverLetter'].map(document_type=>({document_type,document_sha256:sha('saved-'+document_type),file_id:fileId,drive_url:driveUrl}));
 let metadataReads=0,eventReads=0,failFolder=false;
 const verifier=createApplicationReceiptVerifier({config:{driveFolderId:folder},dispatch:async line=>{
  const {params:{arguments:args}}=JSON.parse(line);return JSON.stringify({result:{structuredContent:{job_id:'JT-1',document_type:args.document_type,document_url:'saved-'+args.document_type,document_sha256:sha('saved-'+args.document_type)}}});
 },rest:async path=>{eventReads++;const kind=path.includes('document_type=eq.coverLetter')?'coverLetter':'resume';return [{metadata:{...documents.find(d=>d.document_type===kind),folder_id:folder}}];},verifyUpload:async()=>{metadataReads++;return {file_id:fileId,mime_type:'application/pdf',parent_ids:[failFolder?'other':folder],file_name:'verified.pdf'};}});
 assert.deepEqual((await verifier({job_id:'JT-1',documents})).documents,documents);
 assert.equal(metadataReads,2);assert.equal(eventReads,2);
 await assert.rejects(verifier({job_id:'JT-1',documents:[{...documents[0],document_sha256:'f'.repeat(64)},documents[1]]}),/VERSION_CONFLICT/);
 failFolder=true;await assert.rejects(verifier({job_id:'JT-1',documents}),/DRIVE_UPLOAD_NOT_VERIFIED/);
});

test('diagnostics record stage timing, document kind and the exact failed stage',async()=>{
 for(const [options,stage] of [[{uploadFailure:true},'uploading'],[{recordFailure:true},'recording'],[{conflict:true},'saving'],[{changed:true},'confirming']]){
  const f=fixture(options);
  await assert.rejects(f.run({jobId:'JT-1'}),error=>{
   assert.equal(error.failed_stage,stage);assert.equal(error.failed_document_type,'resume');
   assert.equal(error.diagnostics.stage_timings.find(t=>t.document_type==='resume'&&t.stage===stage)?.stage,stage);
   assert.ok(error.diagnostics.stage_timings.every(t=>Number.isFinite(t.duration_ms)&&t.duration_ms>=0));return true;
  });
 }
 const f=fixture();const result=await f.run({jobId:'JT-1',documentType:'both'});
 for(const kind of ['resume','coverLetter'])for(const stage of ['checking_saved_state','context','writing','saving','pdf','uploading','recording','confirming'])assert.ok(result.stage_timings.some(t=>t.document_type===kind&&t.stage===stage),kind+': '+stage);
 assert.ok(Number.isFinite(Date.parse(result.stage_started_at)));
 assert.equal(result.documents.length,2);
});

test('parallel sibling completion cannot overwrite the failed document stage',async()=>{
 const f=fixture({rejectCover:true});
 await assert.rejects(f.run({jobId:'JT-1',documentType:'both'}),error=>{
  assert.equal(error.failed_document_type,'coverLetter');assert.equal(error.failed_stage,'saving');
  assert.deepEqual(error.partial_documents.map(doc=>doc.document_type),['resume']);
  assert.ok(error.diagnostics.stage_timings.some(t=>t.document_type==='coverLetter'&&t.stage==='saving'));return true;
 });
});
