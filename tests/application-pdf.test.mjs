import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApplicationDocumentPreparer} from '../scripts/application-pdf.mjs';
import {createOneClickServer} from '../scripts/oneclick-server.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const docs={resume:{document_type:'resume',document_url:'data:text/html,resume'},coverLetter:{document_type:'coverLetter',document_url:'data:text/html,letter'}};
for(const doc of Object.values(docs)){doc.document_sha256=hash(doc.document_url);doc.job_id='job-1';}
const requestDocs=()=>Object.entries(docs).map(([document_type,doc])=>({document_type,document_sha256:doc.document_sha256}));
function dispatcher({changeAtEnd=false,overridePath}={}){
 let reads=0;
 return async raw=>{
  const rpc=JSON.parse(raw),{name,arguments:args}=rpc.params;
  let value;
  if(name==='get_document'){
   reads++;
   const d=docs[args.document_type];
   value={...d,...(changeAtEnd&&reads>2?{document_url:'data:text/html,changed',document_sha256:hash('data:text/html,changed')}:{})};
  }else if(name==='export_document_pdf'){
   const pdf=Buffer.from('%PDF-1.7\nfixture');
   value={job_id:args.job_id,document_type:args.document_type,document_sha256:args.document_sha256,file_name:`${args.job_id}-${args.document_type}-${args.document_sha256.slice(0,12)}.pdf`,file_path:overridePath||join(globalThis.__pdfTestDir,`${args.job_id}-${args.document_type}-${args.document_sha256.slice(0,12)}.pdf`),pdf_sha256:hash(pdf)};
  }
  return JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{structuredContent:value}});
 };
}
test('preparer returns exact current resume and letter PDF bytes with digests and no file paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-app-pdf-'));globalThis.__pdfTestDir=dir;
 try{
  const pdf=Buffer.from('%PDF-1.7\nfixture');
  for(const [kind,doc] of Object.entries(docs))await writeFile(join(dir,`job-1-${kind}-${doc.document_sha256.slice(0,12)}.pdf`),pdf);
  const prepare=createApplicationDocumentPreparer({dispatch:dispatcher(),authorizeJob:async()=>{},exportDirectory:dir});
  const result=await prepare({job_id:'job-1',documents:requestDocs()});
  assert.equal(result.job_id,'job-1');assert.equal(result.documents.length,2);
  for(const output of result.documents){assert.equal(output.pdf_sha256,hash(pdf));assert.equal(output.data_url,'data:application/pdf;base64,'+pdf.toString('base64'));assert.equal('file_path'in output,false);}
 }finally{delete globalThis.__pdfTestDir;await rm(dir,{recursive:true,force:true});}
});
test('preparer rejects stale hashes, changed final readback, and arbitrary file paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-app-pdf-'));globalThis.__pdfTestDir=dir;
 try{
  const pdf=Buffer.from('%PDF-1.7\nfixture');
  for(const [kind,doc] of Object.entries(docs))await writeFile(join(dir,`job-1-${kind}-${doc.document_sha256.slice(0,12)}.pdf`),pdf);
  const prep=opts=>createApplicationDocumentPreparer({dispatch:dispatcher(opts),authorizeJob:async()=>{},exportDirectory:dir});
  await assert.rejects(prep()({job_id:'job-1',documents:requestDocs().map((d,i)=>i?d:{...d,document_sha256:'a'.repeat(64)})}),/VERSION_CONFLICT/);
  await assert.rejects(prep({changeAtEnd:true})({job_id:'job-1',documents:requestDocs()}),/VERSION_CONFLICT/);
  await assert.rejects(prep({overridePath:resolve(dir,'..','outside.pdf')})({job_id:'job-1',documents:requestDocs()}),/PDF_PATH_INVALID/);
 }finally{delete globalThis.__pdfTestDir;await rm(dir,{recursive:true,force:true});}
});
test('preparer rejects PDFs above the renderer limit before returning bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-app-pdf-limit-'));
 try{
  const bytes=Buffer.alloc(2*1024*1024+1,0x20);Buffer.from('%PDF-').copy(bytes);
  let exported=false;
  const dispatch=async raw=>{
   const rpc=JSON.parse(raw),{name,arguments:args}=rpc.params;let value;
   if(name==='get_document')value=docs[args.document_type];
   if(name==='export_document_pdf'){
    exported=true;const file_name=`${args.job_id}-${args.document_type}-${args.document_sha256.slice(0,12)}.pdf`;
    const file_path=join(dir,file_name);await writeFile(file_path,bytes);
    value={job_id:args.job_id,document_type:args.document_type,document_sha256:args.document_sha256,file_name,file_path,pdf_sha256:hash(bytes)};
   }
   return JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{structuredContent:value}});
  };
  const prepare=createApplicationDocumentPreparer({dispatch,exportDirectory:dir});
  await assert.rejects(prepare({job_id:'job-1',documents:requestDocs()}),/PDF_EXPORT_INVALID/);
  assert.equal(exported,true);
 }finally{await rm(dir,{recursive:true,force:true});}
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
