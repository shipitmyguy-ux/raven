import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOneClickWorkflow} from '../scripts/oneclick-workflow.mjs';
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
 const factory=()=>createOneClickWorkflow({receiptStore:options.receiptStore,dispatch,config:{driveFolderId:'folder12345'},rest:async path=>path.startsWith('raven_jobs?')?[{id:'JT-1',company:'Acme',title:'Artist'}]:events.filter(e=>path.includes('document_type=eq.'+e.metadata.document_type)),generateDraft:async args=>{calls.push({name:'writer',a:args});return {draft:true};},uploadPdf:async args=>{calls.push({name:'upload',a:args});uploads++;if(options.uploadFailure)throw Error('UPLOAD_FAILED');return {...metadata,parent_ids:options.wrongFolder?['otherfolder']:metadata.parent_ids};},verifyUpload:async()=>metadata});
 let run=factory();
 return {restart:()=>{run=factory();},run:args=>run(args,p=>progress.push(p)),calls,docs,events,progress,get uploads(){return uploads;},get writes(){return writes;}};
}
test('creates, verifies and persists both documents sequentially; retry reuses exports',async()=>{
 const f=fixture();const result=await f.run({jobId:'JT-1',documentType:'both'});
 assert.equal(result.stage,'complete');assert.equal(result.documents.length,2);assert.equal(f.writes,2);assert.equal(f.uploads,2);
 assert.equal(f.calls.filter(c=>c.name==='writer').length,2);
 assert.deepEqual(f.calls.filter(c=>c.name==='upload').map(c=>c.a.fileName),['Acme - Artist - Resume.pdf','Acme - Artist - Cover letter.pdf']);
 assert.equal(f.calls.find(c=>c.name==='upload').a.pdf.file_name,'resume.pdf','local PDF filename is retained');
 await f.run({jobId:'JT-1',documentType:'both'});assert.equal(f.uploads,2);assert.equal(f.writes,2);
 assert.equal(f.progress.at(-1).stage,'complete');
});
test('existing documents are preserved without invoking writer',async()=>{
 const f=fixture({existing:true});await f.run({jobId:'JT-1'});assert.equal(f.docs.resume,'data:text/html;charset=utf-8,existing');assert.equal(f.writes,0);
 assert.equal(f.calls.find(c=>c.name==='upload').a.fileName,'Acme - Artist - Resume.pdf');
});
test('factual rejection gets exactly one bounded repair',async()=>{
 const f=fixture({reject:true});await f.run({jobId:'JT-1'});assert.equal(f.writes,2);assert.equal(f.calls.filter(c=>c.name==='writer')[1].a.repair.error,'FACTUAL_REVIEW_BLOCKED');
 const bad=fixture({reject:'always'});await assert.rejects(bad.run({jobId:'JT-1'}),/FACTUAL_REVIEW_BLOCKED/);assert.equal(bad.writes,2);assert.equal(bad.uploads,0);
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
