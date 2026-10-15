import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {directPrompt} from '../chatgpt-direct.mjs';
import {createDocumentWorkflow} from '../scripts/private-document-workflow.mjs';
const job={id:'JT-test',company:'Example',title:'Artist'};
test('direct prompt uses exact job, facts, create-only save, readback and no manual transfer',()=>{
 const prompt=directPrompt(job,'both');
 for(const text of ['JT-test','get_verified_profile','save_generated_document','get_document','Re-read get_job','preserve it'])assert.ok(prompt.includes(text));
 assert.doesNotMatch(prompt,/raven-chatgpt-v1/);
 assert.throws(()=>directPrompt({...job,id:'../../bad'},'resume'));
});
test('Drive prompt exports saved content and requires PDF metadata readback before recording',()=>{
 const p=directPrompt(job,'resume',{folderId:'folder1234567890',exportOnly:true});
 assert.match(p,/Do not rewrite/);assert.match(p,/export_document_pdf/);assert.match(p,/folder1234567890/);
 assert.match(p,/Only after successful metadata readback/);assert.match(p,/record_drive_export/);
});
test('actual button direct route saves discovery job before launch and never requests JSON',async()=>{
 const source=fs.readFileSync('app.js','utf8');
 const handler=source.slice(source.indexOf('  async function launchChatGptPrompt('),source.indexOf('  function parseChatGptPayload(')).replace('await import("./chatgpt-direct.mjs?v=1")','directModule');
 let prepared=false,url='',status='';
 const tab={document:{body:{}},location:{replace:value=>url=value}};
 const context={state:{runtime:{settings:{'chatgpt-direct-save':true}}},directModule:{directPrompt},window:{open:()=>tab},prepareJobForGeneration:async()=>{prepared=true;},requestChatGptPrompt:()=>{throw Error('legacy JSON path');},copyTextToClipboard:async()=>true,setGenerationButton:()=>{},setStatus:s=>status=s,encodeURIComponent};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("  // All document actions"),source.indexOf("  const activeOneClickJobs=")),context);await vm.runInContext(handler+'\nlaunchChatGptPrompt({id:"JT-test"},"resume")',context);
 assert.equal(prepared,true);assert.match(new URL(url).searchParams.get('q'),/save_generated_document/);assert.match(status,/saves directly/);
});
const sha='a'.repeat(64),pdfsha='b'.repeat(64);
const args={job_id:'JT-test',document_type:'resume',document_sha256:sha};
function fixture({changed=false,fail=false}={}){
 let rendered=false,writes=0,row;
 const workflow=createDocumentWorkflow({config:{driveFolderId:'folder1234567890'},readPdfHash:async()=>pdfsha,readDocument:async()=>({document_sha256:changed?'c'.repeat(64):sha,document_url:'saved-html'}),renderPdf:async input=>{rendered=true;assert.equal(input.documentUrl,'saved-html');return {pdf_sha256:pdfsha,file_path:'private/export.pdf'};},rest:async(_path,init)=>{if(init){writes++;row=JSON.parse(init.body);return [row];}return fail?[]:[row];}});
 return {workflow,rendered:()=>rendered,writes:()=>writes};
}
test('stale PDF export fails before rendering or writing',async()=>{
 const f=fixture({changed:true});await assert.rejects(f.workflow('export_document_pdf',args),/VERSION_CONFLICT/);assert.equal(f.rendered(),false);assert.equal(f.writes(),0);
});
test('saved PDF uses exact saved HTML and a sanitized deterministic filename',async()=>{
 const f=fixture();const r=await f.workflow('export_document_pdf',args);assert.equal(r.document_sha256,sha);assert.equal(f.rendered(),true);assert.equal(f.writes(),0);
});
const record={...args,pdf_sha256:pdfsha,file_id:'file12345678900',folder_id:'folder1234567890',file_name:'resume.pdf'};
test('Drive record rejects wrong folder, invalid link IDs and stale documents',async()=>{
 for(const override of [{folder_id:'wrongfolder'},{file_id:'https://evil.test'},{pdf_sha256:'invalid'}]){
  const f=fixture();await assert.rejects(f.workflow('record_drive_export',{...record,...override}));assert.equal(f.writes(),0);
 }
 const f=fixture({changed:true});await assert.rejects(f.workflow('record_drive_export',record),/VERSION_CONFLICT/);assert.equal(f.writes(),0);
});
test('Drive record returns success only after durable readback and labels connector verification',async()=>{
 const f=fixture();const result=await f.workflow('record_drive_export',record);assert.equal(result.recorded,true);assert.equal(result.verification,'connected-drive-metadata-readback');
 await assert.rejects(fixture({fail:true}).workflow('record_drive_export',record),/NOT_CONFIRMED/);
});
