import {WriterError} from "./document-writer.mjs";

function cleanSchema(schema){
  if(Array.isArray(schema))return schema.map(cleanSchema);
  if(!schema||typeof schema!=="object")return schema;
  return Object.fromEntries(Object.entries(schema).filter(([key])=>key!=="additionalProperties").map(([key,value])=>[key,cleanSchema(value)]));
}
function parseJsonText(text){
  const value=String(text||"").trim();
  if(!value)throw new WriterError("The LLM returned an empty document.","INVALID_DRAFT",502);
  try{return JSON.parse(value);}catch{
    const fenced=value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if(fenced){try{return JSON.parse(fenced[1]);}catch{}}
    throw new WriterError("The LLM returned an unreadable document. Please try again.","INVALID_DRAFT",502);
  }
}
function combineSignals(signals){
  const live=signals.filter(Boolean);
  return typeof AbortSignal.any==="function"?AbortSignal.any(live):live[0];
}
function timeoutFor(name,input){
  const revision=Boolean(String(input?.revisionRequest||"").trim());
  if(revision)return name==="raven_factual_review"?9000:12000;
  return name==="raven_factual_review"?18000:26000;
}
function configured(getEnv){
  return {
    openrouter:Boolean(getEnv("RAVEN_OPENROUTER_API_KEY")||getEnv("OPENROUTER_API_KEY")),
    openai:Boolean(getEnv("RAVEN_OPENAI_API_KEY")||getEnv("OPENAI_API_KEY")),
    gemini:Boolean(getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY"))
  };
}
function providerOrder(getEnv){
  const requested=String(getEnv("RAVEN_LLM_PROVIDER_ORDER")||"openrouter,openai,gemini")
    .split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  return [...new Set(requested.filter(v=>["openrouter","openai","gemini"].includes(v)))];
}
async function openRouterComplete({getEnv,fetchImpl,signal,instructions,input,schema,name,maxOutputTokens}){
  const apiKey=getEnv("RAVEN_OPENROUTER_API_KEY")||getEnv("OPENROUTER_API_KEY");
  if(!apiKey)throw new WriterError("OpenRouter is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const model=getEnv("RAVEN_OPENROUTER_MODEL")||"openrouter/auto-beta";
  const response=await fetchImpl("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",signal,
    headers:{
      "Authorization":"Bearer "+apiKey,
      "Content-Type":"application/json",
      "HTTP-Referer":"https://shipitmyguy-ux.github.io/raven/",
      "X-Title":"Raven"
    },
    body:JSON.stringify({
      model,
      messages:[{role:"system",content:instructions},{role:"user",content:JSON.stringify(input)}],
      response_format:{type:"json_schema",json_schema:{name:name||"raven_document",strict:true,schema:cleanSchema(schema)}},
      max_tokens:maxOutputTokens,
      provider:{require_parameters:true}
    })
  });
  const raw=await response.json().catch(()=>null);
  if(!response.ok)throw new WriterError("OpenRouter is temporarily unavailable.","PROVIDER_UNAVAILABLE",response.status>=500||response.status===429?503:502);
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason&& !["stop","length"].includes(String(choice.finish_reason).toLowerCase()))
    throw new WriterError("OpenRouter did not finish the document.","INCOMPLETE_DRAFT",502);
  const content=choice?.message?.content;
  const text=Array.isArray(content)?content.map(p=>p?.text||"").join(""):content;
  return {data:parseJsonText(text),provider:"openrouter",model:raw?.model||model};
}
async function openAIComplete({getEnv,fetchImpl,signal,instructions,input,schema,name,maxOutputTokens}){
  const apiKey=getEnv("RAVEN_OPENAI_API_KEY")||getEnv("OPENAI_API_KEY");
  if(!apiKey)throw new WriterError("OpenAI is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const model=getEnv("RAVEN_OPENAI_MODEL")||"gpt-5.6-luna";
  const response=await fetchImpl("https://api.openai.com/v1/chat/completions",{
    method:"POST",signal,
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({
      model,
      messages:[{role:"system",content:instructions},{role:"user",content:JSON.stringify(input)}],
      response_format:{type:"json_schema",json_schema:{name:name||"raven_document",strict:true,schema:cleanSchema(schema)}},
      max_completion_tokens:maxOutputTokens
    })
  });
  const raw=await response.json().catch(()=>null);
  if(!response.ok)throw new WriterError("OpenAI is temporarily unavailable.","PROVIDER_UNAVAILABLE",response.status>=500||response.status===429?503:502);
  const message=raw?.choices?.[0]?.message;
  if(message?.refusal)throw new WriterError("OpenAI declined this writing request.","WRITING_REFUSED",502);
  return {data:parseJsonText(message?.content),provider:"openai",model:raw?.model||model};
}
async function geminiComplete({getEnv,fetchImpl,signal,instructions,input,schema,maxOutputTokens}){
  const apiKey=getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY");
  if(!apiKey)throw new WriterError("Gemini is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const models=[...new Set([
    getEnv("RAVEN_GEMINI_MODEL")||"gemini-3.8-flash",
    getEnv("RAVEN_GEMINI_FALLBACK_MODEL")||"gemini-3.5-flash-lite",
    "gemini-3.6-flash"
  ].filter(Boolean))];
  const bases=["https://generativelanguage.googleapis.com","https://gateway.ai.cloudflare.com/v1/0be401023d08048c03bbfbb0576fa89f/raven/google-ai-studio"];
  let lastStatus=503;
  for(const model of models){
    for(const base of bases){
      const routeTimeout=AbortSignal.timeout(7000);
      const routeSignal=combineSignals([signal,routeTimeout]);
      let response;
      try{
        response=await fetchImpl(base+"/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
          method:"POST",signal:routeSignal,headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
          body:JSON.stringify({
            systemInstruction:{parts:[{text:instructions}]},
            contents:[{role:"user",parts:[{text:JSON.stringify(input)}]}],
            generationConfig:{maxOutputTokens,responseMimeType:"application/json",responseSchema:cleanSchema(schema)}
          })
        });
      }catch{
        if(signal?.aborted)throw new WriterError("LLM writing took too long. Please try again.","LLM_UNAVAILABLE",503);
        continue;
      }
      const raw=await response.json().catch(()=>null);
      if(!response.ok){lastStatus=response.status;continue;}
      if(raw?.promptFeedback?.blockReason)throw new WriterError("Gemini declined this writing request.","WRITING_REFUSED",502);
      const candidate=raw?.candidates?.[0];
      if(candidate?.finishReason!=="STOP")continue;
      const output=(candidate.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
      return {data:parseJsonText(output),provider:"gemini",model:raw?.modelVersion||model};
    }
  }
  throw new WriterError(lastStatus===429?"Gemini is at its usage limit.":"Gemini is temporarily unavailable.","PROVIDER_UNAVAILABLE",503);
}

export function llmProviderStatus(getEnv){
  return {configured:configured(getEnv),order:providerOrder(getEnv)};
}

export function createLLMCompletion({getEnv,fetchImpl=fetch,signal}){
  const status=configured(getEnv);
  const order=providerOrder(getEnv).filter(name=>status[name]);
  if(!order.length)throw new WriterError("No LLM provider is configured for Raven.","LLM_NOT_CONFIGURED",503);
  return async({instructions,input,schema,name,maxOutputTokens=6000})=>{
    const stageTimeout=AbortSignal.timeout(timeoutFor(name,input));
    const stageSignal=combineSignals([signal,stageTimeout]);
    const errors=[];
    for(const provider of order){
      try{
        if(provider==="openrouter")return await openRouterComplete({getEnv,fetchImpl,signal:stageSignal,instructions,input,schema,name,maxOutputTokens});
        if(provider==="openai")return await openAIComplete({getEnv,fetchImpl,signal:stageSignal,instructions,input,schema,name,maxOutputTokens});
        if(provider==="gemini")return await geminiComplete({getEnv,fetchImpl,signal:stageSignal,instructions,input,schema,name,maxOutputTokens});
      }catch(error){
        if(stageSignal?.aborted)break;
        if(error?.code==="WRITING_REFUSED")errors.push(provider+":refused");
        else errors.push(provider+":"+(error?.code||"failed"));
      }
    }
    throw new WriterError("All configured LLM providers are temporarily unavailable. Please try again.","LLM_UNAVAILABLE",503);
  };
}
