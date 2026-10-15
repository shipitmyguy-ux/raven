import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applicationTargetUrl,createPreparationRecovery,dispatchPreparedApplication,extensionUnavailableReason,preflightPreparationApplication,probePreparationExtension} from '../application-prepare.mjs';

test('only bounded same-job posting routes gain their verified application paths',()=>{
 const lever='https://jobs.lever.co/blackbirdinteractive/98050e1b-0adb-4842-96e9-a6b9c987b799';
 const gusto='https://jobs.gusto.com/postings/dlvr-3d-artist-68896d07-c740-4488-83bc-8bbbd5fcfffc';
 const breezy='https://illfonic.breezy.hr/p/5c1600aa06b4-principal-environment-artist';
 for(const [posting,suffix] of [[lever,'/apply'],[gusto,'/applicants/new'],[breezy,'/apply']]){
  assert.equal(applicationTargetUrl(posting),posting+suffix);
  assert.equal(applicationTargetUrl(posting+'/?source=Raven'),posting+suffix+'?source=Raven');
  assert.equal(applicationTargetUrl(posting+suffix),posting+suffix);
 }
 for(const url of [lever.replace('jobs.lever.co','jobs.lever.co.evil.example'),
   'https://jobs.lever.co/blackbirdinteractive/another-job',lever+'/other',
   gusto.replace('jobs.gusto.com','jobs.gusto.com.evil.example'),
   gusto.replace('jobs.gusto.com','jobs.gusto.com:8443'),
   gusto.replace('jobs.gusto.com','user:pass@jobs.gusto.com'),
   'https://jobs.gusto.com/postings/dlvr-3d-artist-no-job-id',gusto+'/other',
   breezy.replace('illfonic.breezy.hr','team.illfonic.breezy.hr'),
   breezy.replace('5c1600aa06b4','5c1600aa06b'),breezy+'/other',
   'https://ingamejob.com/example'])assert.equal(applicationTargetUrl(url),url);
});

class Bridge extends EventTarget{
  dataset={};
  dispatchEvent(event){const sent=super.dispatchEvent(event);if(event.type==='raven-prepare-probe'){this.dataset.prepareCapability='2';super.dispatchEvent(new Event('raven-prepare-capability'));}if(event.type==='raven-prepare-application'){const {requestId}=JSON.parse(this.dataset.prepareRequest);this.dataset.prepareResponse=JSON.stringify({requestId,ok:true,tabId:42});super.dispatchEvent(new Event('raven-prepare-response'));}return sent;}
  removeEventListener(...args){return super.removeEventListener(...args);}
}
const documentFor=bridge=>({getElementById:id=>id==='ravenExtensionBridge'?bridge:null});

test('extension capability is probed before any preparation request',async()=>{
 const bridge=new Bridge();assert.equal(await probePreparationExtension({documentRef:documentFor(bridge)}),true);
});
test('missing extension capability fails clearly',async()=>{
 const bridge=new Bridge();bridge.dispatchEvent=EventTarget.prototype.dispatchEvent.bind(bridge);
 await assert.rejects(probePreparationExtension({documentRef:documentFor(bridge),timeoutMs:1}),error=>Boolean(extensionUnavailableReason(error)&&/preparation support/.test(error.message)));
});
test('older extension capability reports actionable unavailability',async()=>{
 const bridge=new Bridge();bridge.dispatchEvent=event=>{if(event.type==='raven-prepare-probe'){bridge.dataset.prepareCapability='1';EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-prepare-capability'));}return EventTarget.prototype.dispatchEvent.call(bridge,event);};
 await assert.rejects(probePreparationExtension({documentRef:documentFor(bridge),timeoutMs:1}),error=>Boolean(extensionUnavailableReason(error)&&/latest preparation update/.test(error.message)));
});
test('absent bridge has a narrow extension-unavailable code',async()=>{
 await assert.rejects(probePreparationExtension({documentRef:documentFor(null)}),error=>Boolean(extensionUnavailableReason(error)&&/Install or enable/.test(error.message)));
 assert.equal(extensionUnavailableReason(Error('The destination is a different job.')),null);
});
test('prepared application dispatch waits for its matching extension response',async()=>{
 const bridge=new Bridge(),packet={version:2,mode:'prepare',jobId:'JT-test'};
 const response=await dispatchPreparedApplication(packet,{documentRef:documentFor(bridge)});
 assert.equal(response.ok,true);assert.equal(response.tabId,42);
 assert.deepEqual(JSON.parse(bridge.dataset.prepareRequest).packet,packet);
});
test('preflight requires a ready destination and keeps its token with the final packet',async()=>{
 const bridge=new Bridge(),requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',preflightId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 const prior=bridge.dispatchEvent.bind(bridge);
 bridge.dispatchEvent=event=>{
  if(event.type==='raven-preflight-application'){
   const request=JSON.parse(bridge.dataset.preparePreflightRequest);
   bridge.dataset.preparePreflightResponse=JSON.stringify({requestId:request.requestId,ok:true,status:'ready',preflightId});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-preflight-response'));
  }
  return prior(event);
 };
 const preflight=await preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1',title:'Artist',company:'Acme'},{documentRef:documentFor(bridge),requestId});
 assert.equal(preflight.preflightId,preflightId);
 assert.equal(JSON.parse(bridge.dataset.preparePreflightRequest).requestId,requestId);
 await dispatchPreparedApplication({version:2,mode:'prepare',jobId:'JT-test'},{documentRef:documentFor(bridge),requestId,preflightId});
 assert.deepEqual(JSON.parse(bridge.dataset.prepareRequest).preflightId,preflightId);
 assert.equal(JSON.parse(bridge.dataset.prepareRequest).requestId,requestId);
});
test('manual preflight resolves for document preparation without a packet',async()=>{
 const bridge=new Bridge();let packets=0;
 bridge.dispatchEvent=event=>{
  if(event.type==='raven-preflight-application'){
   const {requestId}=JSON.parse(bridge.dataset.preparePreflightRequest);
   bridge.dataset.preparePreflightResponse=JSON.stringify({requestId,ok:false,status:'manual',reason:'Employer sign-in required'});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-preflight-response'));
  }
  if(event.type==='raven-prepare-application')packets++;
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 const result=await preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'},{documentRef:documentFor(bridge)});
 assert.deepEqual(result,{status:'manual',reason:'Employer sign-in required'});
 assert.equal(packets,0);
});
test('hard blocked preflight remains a protocol error',async()=>{
 const bridge=new Bridge();
 bridge.dispatchEvent=event=>{
  if(event.type==='raven-preflight-application'){
   const {requestId}=JSON.parse(bridge.dataset.preparePreflightRequest);
   bridge.dataset.preparePreflightResponse=JSON.stringify({requestId,ok:false,status:'blocked',reason:'This request ID belongs to a different application.'});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-preflight-response'));
  }
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 await assert.rejects(preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'},{documentRef:documentFor(bridge)}),/different application/);
});
for(const legacyError of [
 'Extension did not respond.',
 'Could not establish connection. Receiving end does not exist.',
 'Extension context invalidated.',
 'The message port closed before a response was received.'
])for(const phase of ['preflight','dispatch'])test(phase+' recognizes legacy transport failure: '+legacyError,async()=>{
 const bridge=new EventTarget();bridge.dataset={};
 const requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 bridge.dispatchEvent=event=>{
  if(event.type===(phase==='preflight'?'raven-preflight-application':'raven-prepare-application')){
   if(phase==='preflight')bridge.dataset.preparePreflightResponse=JSON.stringify({requestId,ok:false,status:'blocked',reason:legacyError});
   else bridge.dataset.prepareResponse=JSON.stringify({requestId,ok:false,error:legacyError});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event(phase==='preflight'?'raven-preflight-response':'raven-prepare-response'));
  }
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 const action=phase==='preflight'
  ? preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'},{documentRef:documentFor(bridge),requestId,timeoutMs:1})
  : dispatchPreparedApplication({version:2,mode:'prepare',jobId:'JT-test'},{documentRef:documentFor(bridge),requestId,timeoutMs:1});
 await assert.rejects(action,error=>Boolean(extensionUnavailableReason(error)));
});
test('an unknown explicit extension rejection stays a hard error',async()=>{
 const bridge=new EventTarget();bridge.dataset={};
 const requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 bridge.dispatchEvent=event=>{
  if(event.type==='raven-prepare-application'){
   bridge.dataset.prepareResponse=JSON.stringify({requestId,ok:false,error:'This request ID belongs to a different application.'});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-prepare-response'));
  }
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 await assert.rejects(dispatchPreparedApplication({version:2,mode:'prepare',jobId:'JT-test'},{documentRef:documentFor(bridge),requestId}),error=>{
  assert.equal(extensionUnavailableReason(error),null);assert.match(error.message,/different application/);return true;
 });
});
for(const phase of ['preflight','dispatch'])for(const responseKind of ['mismatch','malformed','silent'])test(phase+' '+responseKind+' response has the correct timeout boundary',async()=>{
 const bridge=new EventTarget();bridge.dataset={};
 const requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 bridge.dispatchEvent=event=>{
  if(responseKind!=='silent'&&event.type===(phase==='preflight'?'raven-preflight-application':'raven-prepare-application')){
   const key=phase==='preflight'?'preparePreflightResponse':'prepareResponse';
   bridge.dataset[key]=responseKind==='malformed'?'{':JSON.stringify({requestId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',ok:true,status:'ready',preflightId:'ffffffff-ffff-4fff-8fff-ffffffffffff'});
   EventTarget.prototype.dispatchEvent.call(bridge,new Event(phase==='preflight'?'raven-preflight-response':'raven-prepare-response'));
  }
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 const action=phase==='preflight'
  ? preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'},{documentRef:documentFor(bridge),requestId,timeoutMs:1})
  : dispatchPreparedApplication({version:2,mode:'prepare',jobId:'JT-test'},{documentRef:documentFor(bridge),requestId,timeoutMs:1});
 await assert.rejects(action,error=>{
  assert.equal(Boolean(extensionUnavailableReason(error)),responseKind==='silent');
  if(responseKind!=='silent')assert.match(error.message,/invalid application/);
  return true;
 });
});
test('preflight ignores a stale reply when a matching valid reply follows',async()=>{
 const bridge=new EventTarget();bridge.dataset={};
 const requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',preflightId='ffffffff-ffff-4fff-8fff-ffffffffffff';
 bridge.dispatchEvent=event=>{
  if(event.type==='raven-preflight-application'){
   for(const reply of [{requestId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',ok:true,status:'ready',preflightId},{requestId,ok:true,status:'ready',preflightId}]){
    bridge.dataset.preparePreflightResponse=JSON.stringify(reply);
    EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-preflight-response'));
   }
  }
  return EventTarget.prototype.dispatchEvent.call(bridge,event);
 };
 const result=await preflightPreparationApplication({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'},{documentRef:documentFor(bridge),requestId,timeoutMs:1});
 assert.equal(result.preflightId,preflightId);
});
test('preparation reload reads metadata only and retains a stable extension request ID',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let time=Date.parse('2026-10-14T12:00:00Z'),ids=0;
 const options={storage,now:()=>time,uuid:()=>ids++?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',locks:null};
 const first=createPreparationRecovery(options),started=first.start({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'});
 first.update(started.preparationId,{runId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',state:'documents-ready',documents:{resume:{documentSha256:'a'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}},lastStage:'complete',reason:'The Raven Chrome extension is unavailable.',reasonType:'extension-unavailable'});
 time+=5000;
 const restored=createPreparationRecovery(options).load();
 assert.equal(restored.runId,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 assert.equal(restored.extensionRequestId,started.extensionRequestId);
 assert.equal(restored.reasonType,'extension-unavailable');
 assert.equal(restored.expired,false);
 assert.equal(values.size,1,'reading recovery state cannot initiate side effects');
 assert.equal(JSON.stringify([...values.values()]).includes('profile'),false);
 assert.throws(()=>first.update(started.preparationId,{documents:{resume:{documentSha256:'c'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}}}),/hash changed/);
 assert.throws(()=>first.update(started.preparationId,{answers:{secret:'yes'}}),/Invalid preparation metadata update/);
 assert.throws(()=>first.update(started.preparationId,{reasonType:'other'}),/Invalid preparation metadata/);
 assert.match([...values.values()][0],/documentSha256/);
});
test('stale metadata requires an explicit new start and active lease excludes a second tab',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let time=Date.parse('2026-10-14T12:00:00Z');const options={storage,now:()=>time,locks:null};
 const first=createPreparationRecovery(options),intent=first.start({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'});
 let release;const waiting=new Promise(resolve=>release=resolve);
 const active=first.withLease(intent.preparationId,()=>waiting);
 await assert.rejects(createPreparationRecovery(options).withLease(intent.preparationId,async()=>{}),/already active/);
 release();await active;
 time+=24*60*60*1000+1;
 assert.equal(createPreparationRecovery(options).load().expired,true);
 await assert.rejects(first.withLease(intent.preparationId,async()=>{}),/expired/);
 const restarted=first.start({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'});
 assert.notEqual(restarted.preparationId,intent.preparationId);
});
test('app reload shows saved intent without contacting helper or employer',()=>{
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  function updatePreparationRecoveryBanner('),source.indexOf('  function oneClickSession('));
 const text={textContent:''},resume={hidden:false},clear={textContent:''},banner={hidden:true,querySelector:selector=>selector.includes('text')?text:selector.includes('resume')?resume:clear};
 let reads=0;const ctx={document:{getElementById:()=>banner},preparationRecovery:{load:()=>{reads++;return {jobId:'JT-test',state:'generating',expired:false};}},knownJobById:()=>({title:'Artist'}),window:{RavenAPI:{listJobs:()=>{throw Error('network on reload');}}},fetch:()=>{throw Error('network on reload');}};
 vm.createContext(ctx);vm.runInContext(code+'\nupdatePreparationRecoveryBanner()',ctx);
 assert.equal(reads,1);assert.equal(banner.hidden,false);assert.match(text.textContent,/Artist/);assert.equal(resume.hidden,false);
});
test('app reload identifies extension setup as form filling unavailable',()=>{
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  function updatePreparationRecoveryBanner('),source.indexOf('  function oneClickSession('));
 const text={textContent:''},resume={hidden:false},clear={textContent:''},banner={hidden:true,querySelector:selector=>selector.includes('text')?text:selector.includes('resume')?resume:clear};
 const ctx={document:{getElementById:()=>banner},preparationRecovery:{load:()=>({jobId:'JT-test',state:'documents-ready',reason:'The Raven Chrome extension is unavailable. Install or enable it.',reasonType:'extension-unavailable',expired:false})},knownJobById:()=>({title:'Artist'})};
 vm.createContext(ctx);vm.runInContext(code+'\nupdatePreparationRecoveryBanner()',ctx);
 assert.match(text.textContent,/Documents ready for Artist; form filling is unavailable/);
 assert.match(text.textContent,/Resume preparation after the extension is ready/);
 assert.doesNotMatch(text.textContent,/employer form needs manual access/);
 assert.equal(resume.hidden,false);
});
test('already prepared destination verifies saved hashes and receipts but skips writer, PDF and packet dispatch',async()=>{
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function prepareApplication('),source.indexOf('  async function launchChatGptPrompt(')).replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'prepareModule');
 const job={id:'JT-test',url:'https://example.test/apply',title:'Artist',company:'Acme'};
 let writer=0,pdfs=0,receipts=0,dispatch=0,preflights=0,cleared=0,status='';
 const docs=['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:(i?'b':'a').repeat(64),file_id:document_type+'1234567890',drive_url:'https://drive.google.com/file/d/'+document_type+'1234567890/view'}));
 let intent={preparationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensionRequestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jobId:job.id,jobUrl:job.url,state:'dispatching',documents:{resume:{documentSha256:'a'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}},expired:false};
 const recovery={load:()=>intent,start:()=>{throw Error('duplicate intent');},update:(_id,patch)=>{intent={...intent,...patch};return intent;},clear:()=>{cleared++;intent=null;},withLease:async(_id,action)=>action()};
 const helper={ensureApplicationPreparation:async()=>({}),verifyApplicationReceipts:async()=>{receipts++;},prepareApplicationDocuments:async()=>{pdfs++;}};
 const ctx={URL,job,state:{runtime:{settings:{}},preparationFeedback:null},activeApplicationPrepares:new Map(),activeOneClickJobs:new Map(),localPreparationClient:helper,getPreparationRecovery:async()=>recovery,prepareJobForGeneration:async()=>job,verifiedPreparationDocuments:async(_jobId,expected)=>{assert.equal(expected.resume.documentSha256,docs[0].document_sha256);return {job,result:{documents:docs}};},prepareModule:{applicationTargetUrl,probePreparationExtension:async()=>true,extensionUnavailableReason,preflightPreparationApplication:async()=>{preflights++;return {alreadyPrepared:true,tabId:42};},dispatchPreparedApplication:async()=>{dispatch++;}},generateOneClick:async()=>{writer++;},setStatus:value=>status=value,setGenerationButton:()=>{},render:()=>{},updatePreparationRecoveryBanner:()=>{},console};
 vm.createContext(ctx);await vm.runInContext(code+'\nprepareApplication(job,null)',ctx);
 assert.equal(preflights,1);assert.equal(writer,0);assert.equal(pdfs,0);assert.equal(receipts,1);assert.equal(dispatch,0);assert.equal(cleared,1);assert.match(status,/already opened/);
});

for(const caseName of ['missing','changed'])test('already prepared destination with '+caseName+' hashes cannot clear the saved intent',async()=>{
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function prepareApplication('),source.indexOf('  async function launchChatGptPrompt(')).replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'prepareModule');
 const job={id:'JT-test',url:'https://example.test/apply',title:'Artist',company:'Acme'};
 const docs=['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:(i?'b':'a').repeat(64),file_id:document_type+'1234567890',drive_url:'https://drive.google.com/file/d/'+document_type+'1234567890/view'}));
 let intent={preparationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensionRequestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jobId:job.id,jobUrl:job.url,state:'dispatching',expired:false};
 if(caseName==='changed')intent.documents={resume:{documentSha256:'a'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}};
 let cleared=0,receipts=0,writer=0,pdfs=0,dispatch=0;
 const recovery={load:()=>intent,update:(_id,patch)=>{intent={...intent,...patch};return intent;},clear:()=>{cleared++;intent=null;},withLease:async(_id,action)=>action()};
 const ctx={URL,job,state:{runtime:{settings:{}},preparationFeedback:null},activeApplicationPrepares:new Map(),activeOneClickJobs:new Map(),localPreparationClient:{ensureApplicationPreparation:async()=>({}),verifyApplicationReceipts:async()=>{receipts++;},prepareApplicationDocuments:async()=>{pdfs++;}},getPreparationRecovery:async()=>recovery,prepareJobForGeneration:async()=>job,verifiedPreparationDocuments:async()=>{if(caseName==='changed')throw Error('A saved document changed. Review it before preparing the employer form.');return {job,result:{documents:docs}};},prepareModule:{applicationTargetUrl,probePreparationExtension:async()=>true,extensionUnavailableReason,preflightPreparationApplication:async()=>({alreadyPrepared:true,tabId:42}),dispatchPreparedApplication:async()=>{dispatch++;}},generateOneClick:async()=>{writer++;return {job,result:{documents:docs}};},setStatus:()=>{},setGenerationButton:()=>{},render:()=>{},updatePreparationRecoveryBanner:()=>{},console};
 vm.createContext(ctx);await vm.runInContext(code+'\nprepareApplication(job,null)',ctx);
 assert.equal(intent.state,'needs-review');assert.equal(cleared,0);assert.equal(receipts,caseName==='missing'?1:0);assert.equal(writer,caseName==='missing'?1:0);assert.equal(pdfs,0);assert.equal(dispatch,0);
 if(caseName==='missing')assert.deepEqual(Object.keys(intent.documents).sort(),['coverLetter','resume']);
 assert.equal(ctx.state.preparationFeedback.kind,'error');
 assert.match(intent.reason,caseName==='missing'?/no prior verified document hashes/:/saved document changed/);
});

function preparationHarness({pdfFailure=false,writerFailure=false,receiptFailure=false,extensionMode='manual',jobUrl='https://example.test/apply'}={}){
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function prepareApplication('),source.indexOf('  async function launchChatGptPrompt(')).replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'prepareModule');
 const job={id:'JT-test',url:jobUrl,title:'Artist',company:'Acme'};
 const docs=['resume','coverLetter'].map((document_type,i)=>({document_type,document_url:'data:text/html,document-'+document_type,document_sha256:(i?'b':'a').repeat(64),file_id:document_type+'1234567890',drive_url:'https://drive.google.com/file/d/'+document_type+'1234567890/view'}));
 const counts={writer:0,receipts:0,pdfs:0,dispatch:0,preflights:0,cleared:0};
 let intent=null,status='',mode=extensionMode,probes=0,profileReads=0,answerReads=0,preflightInput=null,packet=null,startedUrl=null;const steps=[];
 const recovery={load:()=>intent,start:()=>{startedUrl=job.url;intent={preparationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensionRequestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jobId:job.id,jobUrl:job.url,state:'generating',expired:false};return intent;},update:(_id,patch)=>{intent={...intent,...patch};return intent;},clear:()=>{counts.cleared++;intent=null;},withLease:async(_id,action)=>action()};
 const missing=()=>Object.assign(Error('The Raven Chrome extension is unavailable. Install or enable it, then refresh Raven.'),{code:'PREPARATION_EXTENSION_UNAVAILABLE'});
 const old=()=>Object.assign(Error('The Raven Chrome extension needs the latest preparation update. Update or reload it in Chrome, then refresh Raven.'),{code:'PREPARATION_EXTENSION_UNAVAILABLE'});
 const helper={ensureApplicationPreparation:async()=>({}),verifyApplicationReceipts:async input=>{steps.push('receipts');counts.receipts++;if(receiptFailure)throw Error('Drive receipt could not be verified');assert.deepEqual(input.documents.map(doc=>doc.document_sha256),docs.map(doc=>doc.document_sha256));},prepareApplicationDocuments:async input=>{steps.push('pdf');counts.pdfs++;if(pdfFailure)throw Error('PDF byte verification failed');return {documents:input.documents.map(doc=>({...doc,data_url:'data:application/pdf;base64,JVBERi0='}))};}};
 const assertDocumentsReady=()=>{assert.equal(intent.state,'documents-ready');assert.ok(intent.documents?.resume?.documentSha256);assert.ok(intent.documents?.coverLetter?.documentSha256);};
 const ctx={URL,job,state:{runtime:{settings:{}},preparationFeedback:null},activeApplicationPrepares:new Map(),activeOneClickJobs:new Map(),localPreparationClient:helper,getPreparationRecovery:async()=>recovery,prepareJobForGeneration:async()=>job,prepareModule:{applicationTargetUrl,probePreparationExtension:async()=>{assertDocumentsReady();steps.push('probe');probes++;if(mode==='missing')throw missing();if(mode==='old')throw old();if(mode==='disappeared'&&probes===2)throw missing();return true;},extensionUnavailableReason,preflightPreparationApplication:async input=>{preflightInput=input;assertDocumentsReady();steps.push('preflight');counts.preflights++;if(mode==='preflight-disappeared')throw missing();if(mode==='blocked')throw Error('This request ID belongs to a different application.');return mode==='manual'?{status:'manual',reason:'Application requires sign-in or an account.'}:{status:'ready',preflightId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};},dispatchPreparedApplication:async input=>{packet=input;steps.push('dispatch');counts.dispatch++;if(mode==='dispatch-disappeared')throw missing();}},generateOneClick:async(_job,_type,_button,options)=>{steps.push('writer');counts.writer++;options.onAccepted({run_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});if(writerFailure)throw Error('Writer could not save the resume');return {job,result:{documents:docs}};},verifiedPreparationDocuments:async(_jobId,expectedHashes)=>{if(expectedHashes)for(const doc of docs)assert.equal(expectedHashes[doc.document_type].documentSha256,doc.document_sha256);return {job,result:{documents:docs}};},setStatus:value=>status=value,setGenerationButton:()=>{},render:()=>{},updatePreparationRecoveryBanner:()=>{},readCache:()=>{profileReads++;return {name:'Private profile'};},readAnswerMemory:()=>{answerReads++;return {};},APPLICATION_PROFILE_KEY:'profile',console};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {job,counts,recovery,ctx,prepare:()=>vm.runInContext('prepareApplication(job,null)',ctx),setMode:value=>mode=value,setManual:value=>mode=value?'manual':'ready',getStatus:()=>status,getSteps:()=>steps,getStartedUrl:()=>startedUrl,getPreflight:()=>preflightInput,getPacket:()=>packet,getPrivateReads:()=>({profileReads,answerReads}),mutateResumeHash:()=>{docs[0].document_sha256='c'.repeat(64);}};
}

test('canonical documents and live receipts finish before browser capability or destination inspection',async()=>{
 const flow=preparationHarness({extensionMode:'ready'});
 await flow.prepare();
 assert.deepEqual(flow.getSteps(),['writer','receipts','probe','preflight','probe','pdf','dispatch']);
});

for(const [provider,posting,suffix] of [
 ['Lever','https://jobs.lever.co/blackbirdinteractive/98050e1b-0adb-4842-96e9-a6b9c987b799','/apply'],
 ['Gusto','https://jobs.gusto.com/postings/dlvr-3d-artist-68896d07-c740-4488-83bc-8bbbd5fcfffc','/applicants/new'],
 ['Breezy','https://illfonic.breezy.hr/p/5c1600aa06b4-principal-environment-artist','/apply']
])test('verified '+provider+' job keeps the saved posting URL while binding form delivery to its application route',async()=>{
 const flow=preparationHarness({extensionMode:'ready',jobUrl:posting});
 await flow.prepare();
 assert.equal(flow.getStartedUrl(),posting);
 assert.equal(flow.getPreflight().jobUrl,posting+suffix);
 assert.equal(flow.getPacket().jobUrl,posting+suffix);
 assert.equal(flow.getPacket().jobId,flow.job.id);
 assert.equal(flow.getPacket().title,flow.job.title);
 assert.equal(flow.getPacket().company,flow.job.company);
 assert.equal(flow.counts.dispatch,1);
});

test('access gate still verifies and saves both documents, then explicit retry reuses them',async()=>{
 const flow=preparationHarness();
 await flow.prepare();
 const saved=flow.recovery.load();
 assert.equal(saved.state,'documents-ready');
 assert.match(saved.reason,/sign-in/);
 assert.equal(saved.runId,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 assert.deepEqual(Object.keys(saved.documents).sort(),['coverLetter','resume']);
 assert.deepEqual(flow.counts,{writer:1,receipts:1,pdfs:0,dispatch:0,preflights:1,cleared:0});
 assert.deepEqual(flow.getPrivateReads(),{profileReads:0,answerReads:0});
 assert.match(flow.getStatus(),/Documents ready; employer form needs manual access/);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'success');
 flow.setManual(false);
 await flow.prepare();
 assert.deepEqual(flow.counts,{writer:1,receipts:2,pdfs:1,dispatch:1,preflights:2,cleared:1});
 assert.equal(flow.recovery.load(),null);
});

for(const mode of ['missing','old','preflight-disappeared','disappeared'])test(mode+' extension leaves verified documents ready without fetching PDF bytes or private data',async()=>{
 const flow=preparationHarness({extensionMode:mode});
 await flow.prepare();
 const saved=flow.recovery.load();
 assert.equal(saved.state,'documents-ready');
 assert.equal(saved.reasonType,'extension-unavailable');
 assert.deepEqual(Object.keys(saved.documents).sort(),['coverLetter','resume']);
 assert.equal(flow.counts.writer,1);assert.equal(flow.counts.receipts,1);
 assert.equal(flow.counts.pdfs,0);assert.equal(flow.counts.dispatch,0);
 assert.deepEqual(flow.getPrivateReads(),{profileReads:0,answerReads:0});
 assert.match(flow.getStatus(),/Documents ready; form filling is unavailable/);
 assert.match(flow.getStatus(),/Resume preparation after the extension is ready/);
 flow.setMode('ready');
 await flow.prepare();
 assert.equal(flow.counts.writer,1,'Resume must reuse the saved document hashes');
 assert.equal(flow.counts.receipts,2);assert.equal(flow.counts.pdfs,1);assert.equal(flow.counts.dispatch,1);
 assert.equal(flow.recovery.load(),null);
});

test('extension disappearing at dispatch retains the verified documents for explicit Resume',async()=>{
 const flow=preparationHarness({extensionMode:'dispatch-disappeared'});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'documents-ready');
 assert.equal(flow.recovery.load().reasonType,'extension-unavailable');
 assert.equal(flow.counts.writer,1);assert.equal(flow.counts.receipts,1);assert.equal(flow.counts.dispatch,1);
 flow.setMode('ready');await flow.prepare();
 assert.equal(flow.counts.writer,1);assert.equal(flow.counts.dispatch,2);
 assert.equal(flow.recovery.load(),null);
});

test('explicit destination rejection blocks packet delivery but retains completed documents',async()=>{
 const flow=preparationHarness({extensionMode:'blocked'});
 await flow.prepare();
 assert.equal(flow.counts.writer,1);assert.equal(flow.counts.receipts,1);assert.equal(flow.counts.pdfs,0);assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.deepEqual(Object.keys(flow.recovery.load().documents).sort(),['coverLetter','resume']);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.deepEqual(flow.getPrivateReads(),{profileReads:0,answerReads:0});
 assert.match(flow.getStatus(),/different application/);
});

test('changed saved hash on Resume cannot start another writer or deliver a packet',async()=>{
 const flow=preparationHarness({extensionMode:'missing'});
 await flow.prepare();flow.mutateResumeHash();flow.setMode('ready');
 await flow.prepare();
 assert.equal(flow.counts.writer,1);assert.equal(flow.counts.dispatch,0);assert.equal(flow.counts.pdfs,0);
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
});

test('unavailable extension cannot turn a failed Drive receipt into success',async()=>{
 const flow=preparationHarness({extensionMode:'missing',receiptFailure:true});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.equal(flow.counts.pdfs,0);assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.equal(flow.getSteps().includes('probe'),false);
 assert.doesNotMatch(flow.getStatus(),/Documents ready; form filling is unavailable/);
});

test('a PDF verification failure before delivery cannot claim the application was opened',async()=>{
 const flow=preparationHarness({pdfFailure:true,extensionMode:'ready'});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.match(flow.recovery.load().reason,/PDF byte verification failed/);
 assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.doesNotMatch(flow.getStatus(),/Application opened/);
});

test('a failed writer after an access gate cannot claim documents ready',async()=>{
 const flow=preparationHarness({writerFailure:true});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.match(flow.recovery.load().reason,/Writer could not save/);
 assert.equal(flow.counts.receipts,0);assert.equal(flow.counts.pdfs,0);assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.equal(flow.getSteps().includes('probe'),false);
 assert.doesNotMatch(flow.getStatus(),/Documents ready; employer form needs manual access/);
});
