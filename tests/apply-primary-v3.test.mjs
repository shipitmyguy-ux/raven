import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  async function beginApplication(job,button){'),source.indexOf('  function previewableDocumentUrl(value) {'))
  .replaceAll(/await import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'Promise.resolve(mockApi)')
  .replaceAll(/import\("\.\/application-prepare\.mjs\?v=\d+"\)/g,'Promise.resolve(api)')
  .replaceAll(/await import\("\.\/oneclick-client\.mjs\?v=\d+"\)/g,'Promise.resolve({createOneClickClient:()=>client})');
const job=()=>({id:'JT-test',url:'https://example.test/listing',title:'Artist',company:'Acme',resume:'saved resume',coverLetter:''});
function harness({bridge=true,ready=true,coverReady=false,slowResume=false,savedAttempt=false}={}){
 const calls=[],statuses=[],fileCalls=[];
 const mockApi={applicationTargetUrl:x=>x};
 const client={resolveApplicationDestination:async()=>{calls.push('resolve');return 'https://example.test/apply';}};
 const ctx={job:job(),mockApi,client,console:{warn(){}},URL,Promise,crypto:{randomUUID:()=>String(++ctx.ids).padStart(8,'0')+'-1111-4111-8111-111111111111'},ids:0,
  activeApplyAttempts:new Map(),savedApplyAttempts:()=>savedAttempt?[{attemptId:'11111111-1111-4111-8111-111111111111',jobId:'JT-test',jobUrl:'https://example.test/listing'}]:[],render:()=>{},Event,document:{getElementById:()=>bridge?{dataset:{},dispatchEvent(event){this.dataset.applyCapability=bridge==='v2'?'2':'3';return true;}}:null},window:{open:url=>{calls.push('manual:'+url);return {location:{replace:x=>calls.push('navigate:'+x)}}},RavenAPI:{listJobs:async()=>[{...ctx.job,coverLetter:coverReady?'saved cover':''}]}},
  state:{jobs:[],jobDocumentHashes:{},runtime:{settings:{}}},setStatus:x=>statuses.push(x),applicationDocumentText:()=> 'cover text',
  prepareApplyDocument:async(_job,kind)=>{calls.push('prepare:'+kind);if(kind==='resume'&&slowResume)await new Promise(resolve=>setTimeout(resolve,20));if(kind==='coverLetter'&&!coverReady)throw Error('cover unavailable');return {kind,documentSha256:'a'.repeat(64)};},
  applyExtensionRequest:async(_api,_attempt,action,payload)=>{calls.push(action+(payload.targetUrl?':'+payload.targetUrl:payload.useCurrentPage?':current-page':''));return {phase:'reserved',status:'reserved'};},
  waitForApplyReady:async()=>({phase:ready?'ready':'needs_user'}),deliverApplyOperation:async(_api,_attempt,payload)=>{if(payload.coverLetterText)calls.push('cover-text:'+payload.coverLetterText.text);return {phase:'ready'};},
  deliverApplyDocument:async(_job,kind)=>{fileCalls.push(kind);return {phase:'ready'};},
  rememberApplyAttempt:()=>{},applyOutcomeMessage:()=> 'manual review',readCache:()=>({}),readAnswerMemory:()=>({}),APPLICATION_PROFILE_KEY:'profile',
  normalizeJobs:x=>x,refreshCurrentDocumentHashes:async()=>{ctx.state.jobDocumentHashes['JT-test']={coverLetter:{sha256:'a'.repeat(64)}};},localPreparationClient:client,
  setTimeout,clearTimeout};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {apply:()=>vm.runInContext('beginApplication(job,null)',ctx),calls,statuses,fileCalls};
}
test('primary Apply reserves one owned tab before destination resolution and delivers resume without cover',async()=>{
 const h=harness();await h.apply();
 assert.ok(h.calls.indexOf('open')<h.calls.indexOf('resolve'));
 assert.ok(h.calls.includes('prepare:resume'));
 assert.ok(h.calls.includes('prepare:coverLetter'));
 assert.equal(h.calls.filter(x=>x==='open').length,1);
 assert.deepEqual(h.fileCalls,['resume']);
 assert.ok(h.statuses.some(x=>/Cover-letter PDF was not ready|Employer form opened/.test(x)));
});
test('primary Apply does not deliver personal data when bound form is not ready',async()=>{
 const h=harness({ready:false});await h.apply();
 assert.deepEqual(h.fileCalls,[]);
 assert.ok(h.statuses.some(x=>/manual review/.test(x)));
});
test('without a bridge, primary Apply opens employer listing during user gesture',async()=>{
 const h=harness({bridge:false});await h.apply();
 assert.equal(h.calls[0],'manual:https://example.test/listing');
 assert.ok(h.calls.includes('navigate:https://example.test/apply'));
});

test('stale version-two bridge opens listing immediately for manual Apply',async()=>{
 const h=harness({bridge:'v2'});await h.apply();
 assert.equal(h.calls[0],'manual:https://example.test/listing');
 assert.ok(h.calls.includes('navigate:https://example.test/apply'));
});
test('legacy completion events have no listener that can mark a job Applied',()=>{
 assert.equal(source.includes('addEventListener("raven-application-complete"'),false);
});

test('newly ready cover text reaches the same attempt without waiting for slow resume',async()=>{
 const h=harness({coverReady:true,slowResume:true});await h.apply();
 assert.ok(h.calls.includes('cover-text:cover text'));
 assert.deepEqual(h.fileCalls,['coverLetter','resume']);
});

test('reloaded Apply continues the owned tab and reinspects a landing page',async()=>{
 const h=harness({savedAttempt:true});await h.apply();
 assert.equal(h.calls.filter(x=>x==='open').length,0);
 assert.ok(h.calls.includes('inspect:current-page'));
 assert.deepEqual(h.fileCalls,['resume']);
});
