import {test} from "node:test";
import assert from "node:assert/strict";
import {createLLMCompletion,llmProviderStatus} from "../supabase/functions/_shared/llm-router.mjs";

const schema={type:"object",properties:{summary:{type:"string"}},required:["summary"],additionalProperties:false};
const withEnv=(vars)=>name=>vars[name];

test("OpenAI remains disabled even when a key exists unless provider order opts in",()=>{
  const env=withEnv({RAVEN_OPENAI_API_KEY:"synthetic-key"});
  const status=llmProviderStatus(env);
  assert.equal(status.configured.openai,true);
  assert.equal(status.order.includes("openai"),false);
  assert.throws(()=>createLLMCompletion({getEnv:env,fetchImpl:()=>{throw Error("Unexpected paid request");}}),{code:"LLM_NOT_CONFIGURED"});
});

test("OpenAI without an API key cannot initiate a paid call",()=>{
  const env=withEnv({RAVEN_LLM_PROVIDER_ORDER:"openai"});
  assert.equal(llmProviderStatus(env).configured.openai,false);
  assert.throws(()=>createLLMCompletion({getEnv:env,fetchImpl:()=>{throw Error("Unexpected paid request");}}),{code:"LLM_NOT_CONFIGURED"});
});

test("Explicit OpenAI route sends structured input only server-side and parses mocked result",async()=>{
  const env=withEnv({
    RAVEN_LLM_PROVIDER_ORDER:"openai",
    RAVEN_OPENAI_API_KEY:"synthetic-key",
    RAVEN_OPENAI_MODEL:"gpt-5.6-luna"
  });
  let calls=0;
  const fetchImpl=async(url,init)=>{
    calls+=1;
    assert.equal(url,"https://api.openai.com/v1/chat/completions");
    assert.equal(init.method,"POST");
    assert.equal(init.headers.Authorization,"Bearer synthetic-key");
    const body=JSON.parse(init.body);
    assert.equal(body.model,"gpt-5.6-luna");
    assert.equal(body.response_format.type,"json_schema");
    assert.equal(body.response_format.json_schema.strict,true);
    assert.deepEqual(body.response_format.json_schema.schema,schema);
    assert.deepEqual(body.messages.map(message=>message.role),["system","user"]);
    assert.deepEqual(JSON.parse(body.messages[1].content),{syntheticJob:"Mock Job",evidenceIds:["mock-1"]});
    return Response.json({model:"gpt-5.6-luna",choices:[{finish_reason:"stop",message:{content:JSON.stringify({summary:"Verified source-only summary."})}}]});
  };
  const complete=createLLMCompletion({getEnv:env,fetchImpl});
  const result=await complete({instructions:"Use only supplied facts.",input:{syntheticJob:"Mock Job",evidenceIds:["mock-1"]},schema,name:"resume_pilot",maxOutputTokens:500});
  assert.equal(calls,1);
  assert.equal(result.provider,"openai");
  assert.equal(result.model,"gpt-5.6-luna");
  assert.deepEqual(result.data,{summary:"Verified source-only summary."});
  assert.equal(result.providerAttempts,1);
});
