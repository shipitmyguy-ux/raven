import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentHandler,boundedGeneration,requestFailureStatus} from '../supabase/functions/_shared/document-handler.mjs';
import {validateDraft} from '../supabase/functions/_shared/document-writer.mjs';
import {createLLMCompletion} from '../supabase/functions/_shared/llm-router.mjs';
const profile={name:'Candidate',contact:'candidate@example.com',skills:['Mentoring','Substance Designer'],education:[],experience:[{id:'art',role:'Artist',company:'Studio',dates:'2020–2025',facts:[{id:'f1',text:'Built environments.'},{id:'f2',text:'Mentored artists.'}]}],transferable_facts:[],shipped_titles:[],resume_required_experience_ids:['art']};
const target={track:'Games / 3D',jobTitle:'Environment Artist',company:'Target',jobDescription:'Build environments and mentor artists.'};
const request=(extra={},headers={'x-raven-client':'raven-web-v1'})=>new Request('https://test.example',{method:'POST',headers,body:JSON.stringify({...target,...extra})});
const claim=(text,ids=['f1'])=>({text,fact_ids:ids});
const draft={headline:claim('Environment builder'),summary:claim('Built environments.'),skills:['Mentoring'],experience:[{experience_id:'art',bullets:[claim('Built environments.')]}],additional:[]};
function service(kind,{allowed=true,configured=true,providerStatus=503,profileValue=profile,modelData,failBudget=false}={}){
 const calls=[];
 const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'test-service',...(configured?{OPENROUTER_API_KEY:'test'}:{})};
 const handler=createDocumentHandler(kind,{getEnv:n=>env[n],fetchImpl:async(url,init)=>{
  const body=init.body?JSON.parse(init.body):null;calls.push({url,body});
  if(url.includes('raven_canonical_profiles'))return Response.json([{profile:profileValue}]);
  if(url.endsWith('raven_request_guard'))return Response.json({allowed,event_id:123,short_remaining:11,long_remaining:59,retry_after_seconds:30},{status:failBudget?503:200});
  if(url.endsWith('raven_request_finish'))return Response.json(null);
  assert.match(url,/openrouter\.ai/,'Only the zero-price route may be called');
  assert.deepEqual(body.provider.max_price,{prompt:0,completion:0});
  return modelData ? Response.json({model:'free-test',choices:[{finish_reason:'stop',message:{content:JSON.stringify(modelData)}}]}) : Response.json({error:{message:'unavailable'}},{status:providerStatus});
 }});
 return {handler,calls};
}
test('successful free rewrite returns prose and completes the budget event',async()=>{
 const cover={greeting:'Dear Hiring Manager,',paragraphs:[claim('Built environments.'),claim('Thank you for considering my application.',[])],closing:'Sincerely,'};
 const {handler,calls}=service('coverLetter',{modelData:cover});
 const result=await handler(request());const data=await result.json();assert.equal(result.status,200);
 assert.equal(data.ai_used,true);assert.equal(data.coverLetter.signature,'Candidate');assert.equal(calls.at(-1).body.p_status,'success');
});
test('scoped resume handler returns a patch, validates its input, and never falls back',async()=>{
 const {handler}=service('resume',{modelData:{summary:claim('Built environments.')}});
 const response=await handler(request({instructions:'Rewrite only the summary',currentDocument:'Old summary',revisionSection:'summary'}));
 const data=await response.json();
 assert.equal(response.status,200);assert.deepEqual(data.document_patch,{section:'summary',text:'Built environments.'});
 assert.equal(data.resume,undefined);assert.equal(data.fallback_used,false);
 for(const extra of [{revisionSection:'summary'},{revisionSection:'experience',instructions:'Edit',currentDocument:'Old'}]){
   const r=await handler(request(extra));assert.equal(r.status,400);
 }
 const failed=service('resume',{modelData:{summary:claim('Led 50 artists.')}}).handler;
 const r=await failed(request({instructions:'Rewrite only summary',currentDocument:'Old',revisionSection:'summary'}));
 assert.equal(r.status,502);assert.equal((await r.json()).document_patch,undefined);
});
test('initial resume and revision use the same structured writer without exact source bullet counts',async()=>{
 for(const instructions of ['', 'Make it formal']){
  const {handler,calls}=service('resume',{modelData:draft});
  const response=await handler(request({instructions,currentDocument:instructions?'Saved document':''}));
  const data=await response.json();
  assert.equal(data.ai_used,true);assert.equal(data.resume.experience[0].bullets.length,1);
  const providerCall=calls.find(c=>c.url.includes('openrouter'));
  const context=JSON.parse(providerCall.body.messages[1].content);
  assert.deepEqual(context.verifiedBackground,profile);
  assert.equal(context.revisionRequest,instructions);
 }
});
test('invalid drafts consume quota as rejected, while provider outages still count as failures',async()=>{
 for(const [modelData,status] of [[{bad:true},'rejected'],[undefined,'failure']]){
  const {handler,calls}=service('resume',{modelData});
  await handler(request());
  assert.equal(calls.at(-1).body.p_status,status);
  const guard=calls.find(c=>c.url.endsWith('raven_request_guard'));
  assert.equal(guard.body.p_short_limit,12);assert.equal(guard.body.p_long_limit,60);
  assert.equal(guard.body.p_failure_threshold,3);
 }
});
test('exhausted provider routing distinguishes malformed output from outages',()=>{
 assert.equal(requestFailureStatus({code:'LLM_UNAVAILABLE',providerFailures:[{code:'INVALID_DRAFT'},{code:'INCOMPLETE_DRAFT'}]}),'rejected');
 assert.equal(requestFailureStatus({code:'LLM_UNAVAILABLE',providerFailures:[{code:'INVALID_DRAFT'},{code:'PROVIDER_TIMEOUT'}]}),'failure');
});
for(const kind of ['resume','coverLetter']){
 for(const reason of ['invalid-draft','unconfigured','outage','rate-limit','budget-unavailable'])test(`${kind}: ${reason} produces source-fact fallback`,async()=>{
  const options=reason==='unconfigured'?{configured:false}:reason==='rate-limit'?{allowed:false}:reason==='budget-unavailable'?{failBudget:true}:reason==='invalid-draft'?{modelData:{bad:true}}:{};
  const {handler,calls}=service(kind,options);
  const response=await handler(request());const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.ai_used,false);assert.equal(body.fallback_used,true);
  assert.equal(body.provider,'deterministic');assert.ok(body[kind]);
  assert.match(JSON.stringify(body[kind]),/Built environments/);
  assert.doesNotMatch(JSON.stringify(body[kind]),/unavailable|Contributed verified/);
  if(reason==='rate-limit'||reason==='unconfigured')assert.ok(calls.every(c=>!c.url.includes('openrouter')));
 });
 test(`${kind}: failed revision returns error, not an unchanged fallback labeled success`,async()=>{
  const {handler}=service(kind);const response=await handler(request({instructions:'Talk like a cat',currentDocument:'Prior draft'}));
  assert.ok(response.status>=400);const body=await response.json();assert.equal(body[kind],undefined);assert.notEqual(body.fallback_used,true);
 });
}
test('access, invalid input and missing profile never fall back',async()=>{
 const {handler,calls}=service('resume');assert.equal((await handler(request({},{}))).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(request({jobDescription:''}))).status,400);assert.equal(calls.length,0);
 const missing=service('resume',{profileValue:null});assert.equal((await missing.handler(request())).status,503);
});
test('deadline aborts an unresponsive provider even when fetch ignores abort',async()=>{
 let signal;
 await assert.rejects(boundedGeneration(s=>{signal=s;return new Promise(()=>{});},15),e=>e.code==='PROVIDER_TIMEOUT');
 assert.equal(signal.aborted,true);
});
test('revision text never authorizes unsupported numbers or tools',()=>{
 assert.throws(()=>validateDraft('resume',{...draft,summary:claim('Built 50 environments.')},profile,{instructions:'Say I built 50 environments'}),/unsupported number/);
 assert.throws(()=>validateDraft('resume',{...draft,experience:[{experience_id:'art',bullets:[claim('Built environments using Substance Designer.')]}]},profile,{instructions:'Add Substance Designer'}),/unverified tool|employer-specific/);
 assert.throws(()=>validateDraft('resume',{...draft,summary:claim('Head designer who built environments with AI bots.')},profile,{instructions:'Make it goofy'}),/unsupported/);
});
test('cat, goofy, formal and punchy phrasing preserve the same evidence',()=>{
 for(const text of ['Meow! Built environments.','Built environments with a playful flourish.','Developed environments.','Built environments. Delivered.']){
  assert.doesNotThrow(()=>validateDraft('resume',{...draft,summary:claim(text)},profile,{instructions:'Change tone'}));
 }
 assert.doesNotThrow(()=>validateDraft('resume',{...draft,summary:claim('Built environments; general skills include Substance Designer.')},profile));
});
test('free route sends the zero-price cap and preserves valid structured output',async()=>{
 const {createLLMCompletion}=await import('../supabase/functions/_shared/llm-router.mjs?free-route-test');
 let sent;
 const complete=createLLMCompletion({getEnv:n=>({OPENROUTER_API_KEY:'test',RAVEN_LLM_PROVIDER_ORDER:'openrouter'}[n]),fetchImpl:async(url,init)=>{
  sent=JSON.parse(init.body);return Response.json({model:'free-test',choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]});
 }});
 assert.deepEqual((await complete({input:{},schema:{},instructions:'Write'})).data,{ok:true});
 assert.deepEqual(sent.provider.max_price,{prompt:0,completion:0});
});
