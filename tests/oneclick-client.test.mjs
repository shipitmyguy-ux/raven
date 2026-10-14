import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createOneClickClient} from '../oneclick-client.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const doc={document_type:'resume',document_url:'saved-html',document_sha256:'a'.repeat(64),file_id:'file1234567890',drive_url:'https://drive.google.com/file/d/file1234567890/view'};
test('session and bounded stage polling keep credentials in memory and verify outputs',async()=>{
 const calls=[],stages=[],responses=[{token:'secret'},{run_id:id,stage:'queued'},{run_id:id,job_id:'JT-test',stage:'writing'},{run_id:id,job_id:'JT-test',stage:'complete',documents:[doc]}];
 const client=createOneClickClient({pollMs:0,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>responses.shift()};}});
 const run=await client.run({job_id:'JT-test',document_type:'resume'},stage=>stages.push(stage));
 assert.equal(run.documents[0].drive_url,doc.drive_url);assert.deepEqual(stages,['queued','writing','complete']);
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer secret');assert.equal(calls[1].options.referrerPolicy,'unsafe-url');
 assert.deepEqual(JSON.parse(calls[1].options.body),{job_id:'JT-test',document_type:'resume'});
});
test('stopped helper and unconfirmed output never succeed',async()=>{
 await assert.rejects(createOneClickClient({fetchImpl:async()=>{throw Error('offline');}}).run({job_id:'JT-test',document_type:'resume'}),/Start the Raven one-click helper/);
 for(const response of [{run_id:id,stage:'failed',error:'Writer failed'},{run_id:id,stage:'complete',documents:[]},{run_id:id,job_id:'other',stage:'complete',documents:[doc]}]){
 let n=0;await assert.rejects(createOneClickClient({fetchImpl:async()=>({ok:true,json:async()=>n++?response:{token:'secret'}})}).run({job_id:'JT-test',document_type:'resume'}));
 }
});
test('helper timeout is bounded and reports possible continued background work',async()=>{
 let n=0;await assert.rejects(createOneClickClient({maxWaitMs:0,fetchImpl:async()=>({ok:true,json:async()=>n++?{run_id:id,stage:'queued'}:{token:'secret'}})}).run({job_id:'JT-test',document_type:'resume'}),/may still be working/);
 assert.throws(()=>createOneClickClient({baseUrl:'https://evil.test'}));
});
test('helper restart renews the in-memory session once after unauthorized response',async()=>{
 let sessions=0,starts=0;const tokens=[];
 const client=createOneClickClient({fetchImpl:async(url,options)=>{
  if(url.endsWith('/session'))return {ok:true,json:async()=>({token:'token-'+(++sessions)})};
  tokens.push(options.headers.Authorization);starts++;
  if(starts===1)return {ok:false,status:401,json:async()=>({error:'Session expired'})};
  return {ok:true,json:async()=>({run_id:id,job_id:'JT-test',stage:'complete',documents:[doc]})};
 }});
 await client.run({job_id:'JT-test',document_type:'resume'});
 assert.equal(sessions,2);assert.deepEqual(tokens,['Bearer token-1','Bearer token-2']);
});
test('application preparation requires backend readiness and verifies returned PDF bytes',async()=>{
 const bytes=Buffer.from('%PDF-test'),pdfHash=await crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(pdfHash),b=>b.toString(16).padStart(2,'0')).join('');
 const source=[{document_type:'resume',document_sha256:'a'.repeat(64)},{document_type:'coverLetter',document_sha256:'b'.repeat(64)}],calls=[];
 const client=createOneClickClient({fetchImpl:async(url,options)=>{
  calls.push({url,options});let payload;
  if(url.endsWith('/health'))payload={application_prepare_supported:true};
  else if(url.endsWith('/session'))payload={token:'secret'};
  else payload={job_id:'JT-test',documents:source.map(d=>({...d,pdf_sha256:hex,file_name:d.document_type+'.pdf',data_url:'data:application/pdf;base64,'+bytes.toString('base64')}))};
  return {ok:true,json:async()=>payload};
 }});
 const result=await client.prepareApplicationDocuments({job_id:'JT-test',documents:source});
 assert.equal(result.documents.length,2);assert.equal(calls[0].url.endsWith('/health'),true);
 assert.deepEqual(JSON.parse(calls.at(-1).options.body),{job_id:'JT-test',documents:source});
});
test('application preparation rejects unsupported backend and altered PDF bytes',async()=>{
 const client=createOneClickClient({fetchImpl:async(url)=>({ok:true,json:async()=>url.endsWith('/health')?{application_prepare_supported:false}:{}})});
 await assert.rejects(client.ensureApplicationPreparation(),/does not support preparing/);
 const pdf=Buffer.from('%PDF-x'),good=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdf)),b=>b.toString(16).padStart(2,'0')).join('');
 const docs=['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:String(i).repeat(64)}));
 const bad=createOneClickClient({fetchImpl:async(url)=>{
  let payload;
  if(url.endsWith('/health'))payload={application_prepare_supported:true};
  else if(url.endsWith('/session'))payload={token:'t'};
  else payload={job_id:'JT-test',documents:docs.map((d,i)=>({...d,pdf_sha256:i?'f'.repeat(64):good,file_name:'doc.pdf',data_url:'data:application/pdf;base64,'+pdf.toString('base64')}))};
  return {ok:true,json:async()=>payload};
 }});
 await assert.rejects(bad.prepareApplicationDocuments({job_id:'JT-test',documents:docs}),/failed its byte and digest check/);
});
function appFixture({persisted=true}={}){
 const source=fs.readFileSync('app.js','utf8');
 const start=source.indexOf('  const activeOneClickJobs=');
 const end=source.indexOf('  function parseChatGptPayload(');
 const handler=source.slice(start,end).replaceAll('await import("./oneclick-client.mjs?v=2")','clientModule').replaceAll('await import("./remote-writer-client.mjs?v=1")','remoteModule');
 let opened=0,status='',review=0,runs=0,prepared=0;
 const job={id:'JT-test',resume:'saved-html'};
 const ctx={localStorage:{getItem:()=>null},remoteModule:{PAIR_KEY:'pair'},state:{selectedId:'JT-test',runtime:{settings:{'chatgpt-one-click':true}},jobs:[]},clientModule:{createOneClickClient:()=>({run:async(input,onStage)=>{runs++;onStage('writing');await Promise.resolve();return {documents:[doc]};}})},window:{open:()=>{opened++;throw Error('must not open');},RavenAPI:{listJobs:async()=>[job],listJobEvents:async()=>({events:persisted?[{event_type:'document_drive_export',metadata:doc}]:[]})}},prepareJobForGeneration:async()=>{prepared++;},setGenerationButton:()=>{},setStatus:value=>status=value,normalizeJobs:v=>v,mergePendingDocuments:v=>v,writeCache:()=>{},CACHE_JOBS_KEY:'jobs',loadJobActivity:async()=>{},render:()=>{},document:{querySelector:()=>null},openDocumentReview:async()=>{review++;}};
 vm.createContext(ctx);return {ctx,handler,counts:()=>({opened,status,review,runs,prepared})};
}
test('actual one-click button opens no ChatGPT window, saves and reviews only after canonical readback',async()=>{
 const f=appFixture();await vm.runInContext(f.handler+'\nlaunchChatGptPrompt({id:"JT-test"},"resume")',f.ctx);
 assert.equal(f.counts().opened,0);assert.equal(f.counts().review,1);assert.match(f.counts().status,/copied to Drive/);
});
test('actual button rejects missing durable Drive event and suppresses duplicate job clicks',async()=>{
 const f=appFixture({persisted:false});await vm.runInContext(f.handler+'\nPromise.all([launchChatGptPrompt({id:"JT-test"},"resume"),launchChatGptPrompt({id:"JT-test"},"resume")])',f.ctx);
 assert.equal(f.counts().runs,1);assert.equal(f.counts().review,0);assert.match(f.counts().status,/could not confirm/);
});
