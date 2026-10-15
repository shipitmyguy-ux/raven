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
test('accepted run is exposed before polling so a resumed click never queues a duplicate',async()=>{
 const calls=[],accepted=[],responses=[{token:'secret'},{run_id:id,job_id:'JT-test',document_type:'resume',stage:'queued'},{run_id:id,job_id:'JT-test',document_type:'resume',stage:'complete',documents:[doc]}];
 const fetchImpl=async(url,options)=>{calls.push({url,method:options.method});return {ok:true,json:async()=>responses.shift()};};
 const client=createOneClickClient({fetchImpl,pollMs:0});
 await client.run({job_id:'JT-test',document_type:'resume'},()=>{},{onAccepted:async run=>accepted.push(run.run_id)});
 assert.deepEqual(accepted,[id]);
 const resumeCalls=[];
 const resumed=createOneClickClient({fetchImpl:async(url,options)=>{resumeCalls.push({url,method:options.method});return {ok:true,json:async()=>url.endsWith('/session')?{token:'next'}:{run_id:id,job_id:'JT-test',document_type:'resume',stage:'complete',documents:[doc]}};}});
 const result=await resumed.resumeRun({job_id:'JT-test',document_type:'resume'},id);
 assert.equal(result.stage,'complete');
 assert.equal(resumeCalls.some(call=>call.url.endsWith('/runs')&&call.method==='POST'),false);
 assert.equal(resumeCalls.some(call=>call.url.endsWith('/runs/'+id)&&call.method==='GET'),true);
});
test('unknown saved run requires explicit recovery without starting another run',async()=>{
 const calls=[];const client=createOneClickClient({fetchImpl:async(url,options)=>{calls.push(url);if(url.endsWith('/session'))return {ok:true,json:async()=>({token:'secret'})};return {ok:false,status:404,json:async()=>({error:'Request not found.'})};}});
 await assert.rejects(client.resumeRun({job_id:'JT-test',document_type:'both'},id),/start again explicitly/);
 assert.equal(calls.some(url=>url.endsWith('/runs')),false);
});
test('a mismatched accepted run is rejected before its ID can be persisted',async()=>{
 let accepted=false,n=0;
 const client=createOneClickClient({fetchImpl:async()=>({ok:true,json:async()=>n++?{run_id:id,job_id:'JT-other',document_type:'both',stage:'queued'}:{token:'secret'}})});
 await assert.rejects(client.run({job_id:'JT-test',document_type:'both'},()=>{},{onAccepted:()=>{accepted=true;}}),/invalid run/);
 assert.equal(accepted,false);
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
test('receipt client verifies exact read only response and never accepts changed file ID',async()=>{
 const source=['resume','coverLetter'].map(document_type=>({document_type,document_sha256:'a'.repeat(64),file_id:'file1234567890',drive_url:'https://drive.google.com/file/d/file1234567890/view'}));
 const input={job_id:'JT-test',documents:source},calls=[];
 const client=createOneClickClient({fetchImpl:async(url,options)=>{calls.push({url,method:options.method});return {ok:true,json:async()=>url.endsWith('/health')?{application_prepare_supported:true,application_receipts_supported:true}:url.endsWith('/session')?{token:'secret'}:{job_id:'JT-test',documents:source}};}});
 assert.equal((await client.verifyApplicationReceipts(input)).documents.length,2);
 assert.equal(calls.at(-1).url.endsWith('/application-receipts'),true);
 assert.equal(calls.some(call=>call.url.endsWith('/runs')),false);
 const bad=createOneClickClient({fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/health')?{application_prepare_supported:true,application_receipts_supported:true}:url.endsWith('/session')?{token:'secret'}:{job_id:'JT-test',documents:[{...source[0],file_id:'other'},source[1]]}})});
 await assert.rejects(bad.verifyApplicationReceipts(input),/mismatched application receipts/);
});
function appFixture({persisted=true}={}){
 const source=fs.readFileSync('app.js','utf8');
 const start=source.indexOf('  // All document actions');
 const end=source.indexOf('  function parseChatGptPayload(');
 const handler=source.slice(start,end).replaceAll(/await import\("\.\/oneclick-client\.mjs\?v=\d+"\)/g,'clientModule').replaceAll('await import("./remote-writer-client.mjs?v=1")','remoteModule');
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

test('power controls validate status and keep Stop behind the authenticated local session',async()=>{
 const calls=[];
 const client=createOneClickClient({fetchImpl:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/session')?{token:'power-token'}:{supported:true,active_tasks:2,state:url.endsWith('/stop')?'stopped':'awake'}};
 }});
 assert.equal((await client.getPowerStatus()).state,'awake');
 assert.equal((await client.stopKeepingAwake()).state,'stopped');
 assert.equal(calls.length,3);assert.equal(calls[2].options.headers.Authorization,'Bearer power-token');
 assert.equal(calls[2].options.method,'POST');assert.deepEqual(JSON.parse(calls[2].options.body),{});
 const malformed=createOneClickClient({fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/session')?{token:'token'}:{supported:true,state:'idle'}})});
 await assert.rejects(malformed.getPowerStatus(),/Update and restart/);
});

test('all four public document actions use the shared dispatcher and preserve fallback/revision behavior',async()=>{
 const source=fs.readFileSync('app.js','utf8'),calls=[];
 const take=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
 const handler=take('  // All document actions','  const activeOneClickJobs=')+
  take('  async function generateBothForJob(','  async function generateBothLegacy(')+
  take('  async function generateForJob(','  async function generateLegacy(')+
  take('  async function launchChatGptPrompt(','  async function launchChatGptLegacy(')+
  take('  async function saveDocumentToDrive(','  async function saveDocumentToDriveLegacy(');
 const ctx={activeApplicationPrepares:new Map(),state:{runtime:{settings:{'chatgpt-one-click':true}}},setStatus:s=>calls.push(['status',s])};
 for(const name of ['generateOneClick','generateBothLegacy','generateLegacy','launchChatGptLegacy','saveDocumentToDriveLegacy','openDocumentReview'])ctx[name]=(...args)=>calls.push([name,...args]);
 vm.createContext(ctx);vm.runInContext(handler,ctx);
 for(const type of ['resume','coverLetter']){
  await ctx.generateForJob({id:'job'},type);assert.equal(calls.at(-1)[0],'generateOneClick');assert.equal(calls.at(-1)[2],type);
  await ctx.launchChatGptPrompt({id:'job'},type);assert.equal(calls.at(-1)[0],'generateOneClick');
  await ctx.saveDocumentToDrive({id:'job',[type]:'saved'},type);assert.equal(calls.at(-1)[0],'generateOneClick');
  await ctx.generateForJob({id:'job',[type]:'saved'},type);assert.equal(calls.at(-1)[0],'openDocumentReview');
  await ctx.generateForJob({id:'job',[type]:'saved'},type,null,{force:true});assert.equal(calls.at(-1)[0],'generateLegacy');
 }
 await ctx.generateBothForJob({id:'job'});assert.equal(calls.at(-1)[0],'generateOneClick');assert.equal(calls.at(-1)[2],'both');
 await ctx.saveDocumentToDrive({id:'job'},'resume');assert.equal(calls.at(-1)[0],'status');
 ctx.state.runtime.settings['chatgpt-one-click']=false;
 for(const [action,args,expected] of [['generateForJob',[{id:'job'},'resume'],'generateLegacy'],['generateBothForJob',[{id:'job'}],'generateBothLegacy'],['launchChatGptPrompt',[{id:'job'},'both'],'launchChatGptLegacy'],['saveDocumentToDrive',[{id:'job',resume:'saved'},'resume'],'saveDocumentToDriveLegacy']]){
  await ctx[action](...args);assert.equal(calls.at(-1)[0],expected);
 }
 assert.throws(()=>ctx.routeDocumentRequest({id:'job'},'invalid'),/Invalid document request/);
});

test('failed polling identifies request and stage without exposing raw helper errors',async()=>{
 let n=0;
 const client=createOneClickClient({fetchImpl:async()=>({ok:true,json:async()=>n++?{run_id:id,job_id:'JT-test',stage:'failed',failed_stage:'recording',error_code:'EXPORT_RECORD_NOT_CONFIRMED',error:'Saved links could not be confirmed.'}:{token:'secret'}})});
 await assert.rejects(client.run({job_id:'JT-test',document_type:'resume'}),error=>error.run_id===id&&error.failed_stage==='recording'&&error.error_code==='EXPORT_RECORD_NOT_CONFIRMED'&&error.message.includes(id));
});
