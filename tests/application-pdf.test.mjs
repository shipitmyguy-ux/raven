import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplicationDocumentPreparer} from '../scripts/application-pdf.mjs';
import {createOneClickServer} from '../scripts/oneclick-server.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const docs={resume:{document_type:'resume',document_url:'data:text/html,resume'},coverLetter:{document_type:'coverLetter',document_url:'data:text/html,letter'}};
for(const doc of Object.values(docs)){doc.document_sha256=hash(doc.document_url);doc.job_id='job-1';}
const requestDocs=()=>Object.entries(docs).map(([document_type,doc])=>({document_type,document_sha256:doc.document_sha256}));
function fixture({changeAtEnd=false,receiptPatch={},bytes,missing=false}={}){
 let reads=0;const downloads=[],calls=[];
 const originals={resume:Buffer.from('%PDF-1.7 original Drive resume'),coverLetter:Buffer.from('%PDF-1.7 original Drive cover letter')};
 const dispatch=async raw=>{const rpc=JSON.parse(raw);calls.push(rpc.params.name);assert.equal(rpc.params.name,'get_document','Apply must never render, save or upload');const doc=docs[rpc.params.arguments.document_type];reads++;return JSON.stringify({result:{structuredContent:{...doc,...(changeAtEnd&&reads>2?{document_url:'changed',document_sha256:hash('changed')}:{})}}});};
 const rest=async path=>{assert.ok(path.includes('job_id=eq.job-1'));assert.ok(path.includes('folder_id=eq.folder12345'));const kind=path.includes('document_type=eq.resume')?'resume':'coverLetter';assert.ok(path.includes(docs[kind].document_sha256));return missing?[]:[{metadata:{document_type:kind,document_sha256:docs[kind].document_sha256,folder_id:'folder12345',file_id:'file1234567890'+kind,drive_url:'https://drive.google.com/file/d/file1234567890'+kind+'/view',pdf_sha256:hash(originals[kind]),...receiptPatch}}];};
 const downloadPdf=async input=>{downloads.push(input);return bytes||originals[input.fileId.endsWith('resume')?'resume':'coverLetter'];};
 return {prepare:createApplicationDocumentPreparer({dispatch,rest,downloadPdf,config:{driveFolderId:'folder12345'}}),originals,downloads,calls};
}
test('Apply reuses byte-for-byte existing Drive PDFs and never invokes renderer or upload',async()=>{
 const f=fixture();const result=await f.prepare({job_id:'job-1',documents:requestDocs()});
 assert.equal(result.documents.length,2);
 for(const output of result.documents){const original=f.originals[output.document_type];assert.equal(output.pdf_sha256,hash(original));assert.deepEqual(Buffer.from(output.data_url.split(',')[1],'base64'),original);assert.equal('file_path' in output,false);}
 assert.deepEqual(f.downloads.map(d=>d.fileId),['file1234567890resume','file1234567890coverLetter']);
 assert.ok(f.downloads.every(d=>d.folderId==='folder12345'));
});
test('Apply fails closed for stale documents, missing or invalid receipts and altered PDF bytes',async()=>{
 await assert.rejects(fixture().prepare({job_id:'job-1',documents:requestDocs().map((d,i)=>i?d:{...d,document_sha256:'a'.repeat(64)})}),/VERSION_CONFLICT/);
 await assert.rejects(fixture({changeAtEnd:true}).prepare({job_id:'job-1',documents:requestDocs()}),/VERSION_CONFLICT/);
 for(const opts of [{missing:true},{receiptPatch:{folder_id:'other'}},{receiptPatch:{document_type:'wrong'}},{receiptPatch:{document_sha256:'a'.repeat(64)}},{receiptPatch:{drive_url:'https://evil.test/file'}},{receiptPatch:{pdf_sha256:null}}]){
  const f=fixture(opts);await assert.rejects(f.prepare({job_id:'job-1',documents:requestDocs()}),/EXPORT_RECORD_NOT_CONFIRMED/);assert.equal(f.downloads.length,0);
 }
 await assert.rejects(fixture({bytes:Buffer.from('%PDF-1.7 freshly re-rendered')}).prepare({job_id:'job-1',documents:requestDocs()}),/PDF_READBACK_NOT_CONFIRMED/);
 for(const bytes of [Buffer.from('not pdf'),Buffer.alloc(2*1024*1024+1)])await assert.rejects(fixture({bytes}).prepare({job_id:'job-1',documents:requestDocs()}),/PDF_EXPORT_INVALID/);
});
test('application document HTTP route enforces origin, session, authorization, exact body and health capability',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-app-route-'));let preparations=0,authorizations=0;
 const origin='https://shipitmyguy-ux.github.io';
 const runtime=await createOneClickServer({
  stateDir:dir,runWorkflow:async()=>{},rest:async()=>[],
  authorizeJob:async id=>{authorizations++;if(id==='forbidden')throw Error('UNAUTHORIZED');},
  prepareApplicationDocuments:async body=>{preparations++;return {job_id:body.job_id,documents:[]};}
 });
 await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+runtime.server.address().port;
 const common={Origin:origin,Referer:origin+'/raven/','X-Raven-Local-Client':'raven-web-v1','Content-Type':'application/json'};
 const send=(body,headers={})=>fetch(base+'/application-documents',{method:'POST',headers:{...common,...headers},body:JSON.stringify(body)});
 try{
  const health=await (await fetch(base+'/health')).json();assert.equal(health.application_prepare_supported,true);
  assert.equal((await send({job_id:'job-1',documents:requestDocs()})).status,401);
  assert.equal((await send({job_id:'job-1',documents:requestDocs()},{Origin:'https://evil.test'})).status,403);
  const session=await (await fetch(base+'/session',{method:'POST',headers:common,body:'{}'})).json();
  const auth={Authorization:'Bearer '+session.token};
  assert.equal((await send({job_id:'job-1',documents:requestDocs(),extra:'x'},auth)).status,400);
  assert.equal((await send({job_id:'forbidden',documents:requestDocs()},auth)).status,403);
  assert.equal(authorizations,1);assert.equal(preparations,0);
  assert.equal((await send({job_id:'job-1',documents:requestDocs()},auth)).status,200);
  assert.equal(authorizations,2);assert.equal(preparations,1);
 }finally{await new Promise(resolve=>runtime.server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
