import {test} from 'node:test';
import assert from 'node:assert/strict';
test('provider fallback leaves one factual repair and never opens an unbounded retry loop',async()=>{
 const {createLLMCompletion}=await import('../supabase/functions/_shared/llm-router.mjs?repair-reserve');
 const calls=[];
 const complete=createLLMCompletion({getEnv:n=>({CLOUDFLARE_API_TOKEN:'test',CLOUDFLARE_ACCOUNT_ID:'repair-account',OPENROUTER_API_KEY:'test',RAVEN_LLM_PROVIDER_ORDER:'cloudflare,openrouter'}[n]),fetchImpl:async(url,init)=>{
  calls.push(url);
  if(url.endsWith('/subscriptions'))return Response.json({success:false},{status:403});
  assert.match(url,/openrouter/);assert.deepEqual(JSON.parse(init.body).provider.max_price,{prompt:0,completion:0});
  return Response.json({choices:[{finish_reason:'stop',message:{content:'{"summary":"AI prose"}'}}]});
 }});
 await complete({instructions:'Draft',input:{},schema:{}});
 const repaired=await complete({instructions:'Repair',input:{factualCorrection:{issues:['Citation mismatch']}},schema:{}});
 assert.equal(repaired.providerAttempts,3);assert.equal(calls.length,3);
 await assert.rejects(complete({instructions:'Repair again',input:{factualCorrection:{}},schema:{}}),e=>e.code==='LLM_CALL_BUDGET_EXHAUSTED');
 assert.equal(calls.length,3);
});
import {cloudflareFreeStatus} from '../supabase/functions/_shared/cloudflare-free.mjs';
const env={CLOUDFLARE_API_TOKEN:'test',CLOUDFLARE_ACCOUNT_ID:'account',RAVEN_LLM_PROVIDER_ORDER:'cloudflare'};
const getEnv=n=>env[n];
test('free-plan verification rejects denied, paid, incomplete and invalid responses',async()=>{
 for(const [body,status,reason] of [
  [{success:false},403,'plan_unreadable'],
  [{success:true,result:[{rate_plan:{id:'workers_paid',public_name:'Workers Paid'}}]},200,'paid_workers_plan'],
  [{success:true,result:[],result_info:{total_pages:2}},200,'incomplete_plan_list'],
  [{success:true,result:[{}]},200,'unknown_subscription']
 ]){
  const result=await cloudflareFreeStatus(getEnv,async()=>Response.json(body,{status}));
  assert.equal(result.verified,false);assert.equal(result.reason,reason);
 }
});
test('complete free subscription response enables eligibility without exposing credentials',async()=>{
 const result=await cloudflareFreeStatus(getEnv,async(url,init)=>{
  assert.match(url,/\/accounts\/account\/subscriptions$/);assert.equal(init.headers.Authorization,'Bearer test');
  return Response.json({success:true,result:[]});
 });
 assert.equal(result.verified,true);assert.doesNotMatch(JSON.stringify(result),/test|account/);
});
test('Cloudflare native adapter sends supported token/schema fields and parses structured output',async()=>{
 const {createLLMCompletion}=await import('../supabase/functions/_shared/llm-router.mjs?cloudflare-success');
 let calls=0;
 const schema={type:'object',properties:{summary:{type:'string'}},required:['summary']};
 const complete=createLLMCompletion({getEnv,fetchImpl:async(url,init)=>{
  calls++;
  if(url.endsWith('/subscriptions'))return Response.json({success:true,result:[]});
  assert.match(url,/\/ai\/run\/@cf\/meta\/llama-3.3-70b-instruct-fp8-fast$/);
  const body=JSON.parse(init.body);assert.equal(body.max_tokens,1800);assert.equal(body.max_completion_tokens,undefined);
  assert.deepEqual(body.response_format,{type:'json_schema',json_schema:schema});
  return Response.json({success:true,result:{response:{summary:'Grounded prose.'}}});
 }});
 const output=await complete({instructions:'Write',input:{},schema,maxOutputTokens:1800});
 assert.equal(output.provider,'cloudflare');assert.equal(output.data.summary,'Grounded prose.');assert.equal(calls,2);
});
test('unreadable Free plan sends no Cloudflare inference and can use zero-price fallback',async()=>{
 const {createLLMCompletion}=await import('../supabase/functions/_shared/llm-router.mjs?cloudflare-denied');
 const calls=[];
 const complete=createLLMCompletion({getEnv:n=>({ ...env,OPENROUTER_API_KEY:'test',RAVEN_LLM_PROVIDER_ORDER:'cloudflare,openrouter'}[n]),fetchImpl:async(url,init)=>{
  calls.push(url);
  if(url.endsWith('/subscriptions'))return Response.json({success:false},{status:403});
  assert.match(url,/openrouter\.ai/);
  assert.deepEqual(JSON.parse(init.body).provider.max_price,{prompt:0,completion:0});
  return Response.json({choices:[{finish_reason:'stop',message:{content:'{"summary":"Fallback AI"}'}}]});
 }});
 const output=await complete({instructions:'Write',input:{},schema:{}});
 assert.equal(output.provider,'openrouter');assert.equal(calls.length,2);assert.ok(calls.every(url=>!url.includes('/ai/run/')));
});
