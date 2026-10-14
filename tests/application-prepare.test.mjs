import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createPreparationRecovery,dispatchPreparedApplication,preflightPreparationApplication,probePreparationExtension} from '../application-prepare.mjs';

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
 await assert.rejects(probePreparationExtension({documentRef:documentFor(bridge),timeoutMs:1}),/latest preparation update/);
});
test('older extension capability fails before preflight or writer work',async()=>{
 const bridge=new Bridge();bridge.dispatchEvent=event=>{if(event.type==='raven-prepare-probe'){bridge.dataset.prepareCapability='1';EventTarget.prototype.dispatchEvent.call(bridge,new Event('raven-prepare-capability'));}return EventTarget.prototype.dispatchEvent.call(bridge,event);};
 await assert.rejects(probePreparationExtension({documentRef:documentFor(bridge),timeoutMs:1}),/latest preparation update/);
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
test('hard blocked preflight still rejects before writer work',async()=>{
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
test('preparation reload reads metadata only and retains a stable extension request ID',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let time=Date.parse('2026-10-14T12:00:00Z'),ids=0;
 const options={storage,now:()=>time,uuid:()=>ids++?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',locks:null};
 const first=createPreparationRecovery(options),started=first.start({jobId:'JT-test',jobUrl:'https://example.com/jobs/1'});
 first.update(started.preparationId,{runId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',state:'documents-ready',documents:{resume:{documentSha256:'a'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}},lastStage:'complete'});
 time+=5000;
 const restored=createPreparationRecovery(options).load();
 assert.equal(restored.runId,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 assert.equal(restored.extensionRequestId,started.extensionRequestId);
 assert.equal(restored.expired,false);
 assert.equal(values.size,1,'reading recovery state cannot initiate side effects');
 assert.equal(JSON.stringify([...values.values()]).includes('profile'),false);
 assert.throws(()=>first.update(started.preparationId,{documents:{resume:{documentSha256:'c'.repeat(64)},coverLetter:{documentSha256:'b'.repeat(64)}}}),/hash changed/);
 assert.throws(()=>first.update(started.preparationId,{answers:{secret:'yes'}}),/Invalid preparation metadata update/);
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
test('already prepared destination skips writer, PDF, receipt and packet dispatch',async()=>{
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function prepareApplication('),source.indexOf('  async function launchChatGptPrompt(')).replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'prepareModule');
 const job={id:'JT-test',url:'https://example.test/apply',title:'Artist',company:'Acme'};
 let writer=0,pdfs=0,receipts=0,dispatch=0,preflights=0,cleared=0,status='';
 let intent={preparationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensionRequestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jobId:job.id,jobUrl:job.url,state:'dispatching',expired:false};
 const recovery={load:()=>intent,start:()=>{throw Error('duplicate intent');},update:(_id,patch)=>{intent={...intent,...patch};return intent;},clear:()=>{cleared++;intent=null;},withLease:async(_id,action)=>action()};
 const helper={ensureApplicationPreparation:async()=>({}),verifyApplicationReceipts:async()=>{receipts++;},prepareApplicationDocuments:async()=>{pdfs++;}};
 const ctx={URL,job,state:{runtime:{settings:{}},preparationFeedback:null},activeApplicationPrepares:new Map(),activeOneClickJobs:new Map(),localPreparationClient:helper,getPreparationRecovery:async()=>recovery,prepareJobForGeneration:async()=>job,prepareModule:{probePreparationExtension:async()=>true,preflightPreparationApplication:async()=>{preflights++;return {alreadyPrepared:true,tabId:42};},dispatchPreparedApplication:async()=>{dispatch++;}},generateOneClick:async()=>{writer++;},setStatus:value=>status=value,setGenerationButton:()=>{},render:()=>{},updatePreparationRecoveryBanner:()=>{},console};
 vm.createContext(ctx);await vm.runInContext(code+'\nprepareApplication(job,null)',ctx);
 assert.equal(preflights,1);assert.equal(writer,0);assert.equal(pdfs,0);assert.equal(receipts,0);assert.equal(dispatch,0);assert.equal(cleared,1);assert.match(status,/already opened/);
});

function preparationHarness({pdfFailure=false,writerFailure=false}={}){
 const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function prepareApplication('),source.indexOf('  async function launchChatGptPrompt(')).replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'prepareModule');
 const job={id:'JT-test',url:'https://example.test/apply',title:'Artist',company:'Acme'};
 const docs=['resume','coverLetter'].map((document_type,i)=>({document_type,document_url:'data:text/html,document-'+document_type,document_sha256:(i?'b':'a').repeat(64),file_id:document_type+'1234567890',drive_url:'https://drive.google.com/file/d/'+document_type+'1234567890/view'}));
 const counts={writer:0,receipts:0,pdfs:0,dispatch:0,preflights:0,cleared:0};
 let intent=null,status='',manual=true;
 const recovery={load:()=>intent,start:()=>{intent={preparationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensionRequestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jobId:job.id,jobUrl:job.url,state:'generating',expired:false};return intent;},update:(_id,patch)=>{intent={...intent,...patch};return intent;},clear:()=>{counts.cleared++;intent=null;},withLease:async(_id,action)=>action()};
 const helper={ensureApplicationPreparation:async()=>({}),verifyApplicationReceipts:async input=>{counts.receipts++;assert.deepEqual(input.documents.map(doc=>doc.document_sha256),docs.map(doc=>doc.document_sha256));},prepareApplicationDocuments:async input=>{counts.pdfs++;if(pdfFailure)throw Error('PDF byte verification failed');return {documents:input.documents.map(doc=>({...doc,data_url:'data:application/pdf;base64,JVBERi0='}))};}};
 const ctx={URL,job,state:{runtime:{settings:{}},preparationFeedback:null},activeApplicationPrepares:new Map(),activeOneClickJobs:new Map(),localPreparationClient:helper,getPreparationRecovery:async()=>recovery,prepareJobForGeneration:async()=>job,prepareModule:{probePreparationExtension:async()=>true,preflightPreparationApplication:async()=>{counts.preflights++;return manual?{status:'manual',reason:'Application requires sign-in or an account.'}:{status:'ready',preflightId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};},dispatchPreparedApplication:async()=>{counts.dispatch++;}},generateOneClick:async(_job,_type,_button,options)=>{counts.writer++;options.onAccepted({run_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});if(writerFailure)throw Error('Writer could not save the resume');return {job,result:{documents:docs}};},verifiedPreparationDocuments:async(_jobId,expectedHashes)=>{if(expectedHashes)for(const doc of docs)assert.equal(expectedHashes[doc.document_type].documentSha256,doc.document_sha256);return {job,result:{documents:docs}};},setStatus:value=>status=value,setGenerationButton:()=>{},render:()=>{},updatePreparationRecoveryBanner:()=>{},readCache:()=>({name:'Private profile'}),readAnswerMemory:()=>({}),APPLICATION_PROFILE_KEY:'profile',console};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {job,counts,recovery,ctx,prepare:()=>vm.runInContext('prepareApplication(job,null)',ctx),setManual:value=>manual=value,getStatus:()=>status};
}

test('access gate still verifies and saves both documents, then explicit retry reuses them',async()=>{
 const flow=preparationHarness();
 await flow.prepare();
 const saved=flow.recovery.load();
 assert.equal(saved.state,'documents-ready');
 assert.match(saved.reason,/sign-in/);
 assert.equal(saved.runId,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 assert.deepEqual(Object.keys(saved.documents).sort(),['coverLetter','resume']);
 assert.deepEqual(flow.counts,{writer:1,receipts:1,pdfs:1,dispatch:0,preflights:1,cleared:0});
 assert.match(flow.getStatus(),/Documents ready; employer form needs manual access/);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'success');
 flow.setManual(false);
 await flow.prepare();
 assert.deepEqual(flow.counts,{writer:1,receipts:2,pdfs:2,dispatch:1,preflights:2,cleared:1});
 assert.equal(flow.recovery.load(),null);
});

test('a PDF verification failure after an access gate cannot claim documents ready',async()=>{
 const flow=preparationHarness({pdfFailure:true});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.match(flow.recovery.load().reason,/PDF byte verification failed/);
 assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.doesNotMatch(flow.getStatus(),/Documents ready; employer form needs manual access/);
});

test('a failed writer after an access gate cannot claim documents ready',async()=>{
 const flow=preparationHarness({writerFailure:true});
 await flow.prepare();
 assert.equal(flow.recovery.load().state,'needs-review');
 assert.match(flow.recovery.load().reason,/Writer could not save/);
 assert.equal(flow.counts.receipts,0);assert.equal(flow.counts.pdfs,0);assert.equal(flow.counts.dispatch,0);
 assert.equal(flow.ctx.state.preparationFeedback.kind,'error');
 assert.doesNotMatch(flow.getStatus(),/Documents ready; employer form needs manual access/);
});
