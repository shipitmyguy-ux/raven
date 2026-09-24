import {WriterError} from "./document-writer.mjs";

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
function timeoutFor(input){
  return String(input?.revisionRequest||"").trim()?14000:26000;
}
function geminiSchema(schema){
  if(Array.isArray(schema))return schema.map(geminiSchema);
  if(!schema||typeof schema!=="object")return schema;
  return Object.fromEntries(Object.entries(schema).filter(([key])=>key!=="additionalProperties").map(([key,value])=>[key,geminiSchema(value)]));
}
function configured(getEnv){
  return {
    cerebras:Boolean(getEnv("RAVEN_CEREBRAS_API_KEY")||getEnv("CEREBRAS_API_KEY")),
    groq:Boolean(getEnv("RAVEN_GROQ_API_KEY")||getEnv("GROQ_API_KEY")),
    gemini:Boolean(getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY"))
  };
}
function providerOrder(getEnv){
  const requested=String(getEnv("RAVEN_LLM_PROVIDER_ORDER")||"cerebras,groq,gemini")
    .split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  return [...new Set(requested.filter(v=>["cerebras","groq","gemini"].includes(v)))];
}
async function openAICompatibleComplete({provider,baseUrl,apiKey,model,fetchImpl,signal,instructions,input,schema,name,maxOutputTokens}){
  const response=await fetchImpl(baseUrl+"/chat/completions",{
    method:"POST",signal,
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({
      model,
      messages:[{role:"system",content:instructions},{role:"user",content:JSON.stringify(input)}],
      response_format:{type:"json_schema",json_schema:{name:name||"raven_document",strict:true,schema}},
      max_completion_tokens:maxOutputTokens,
      reasoning_effort:"low"
    })
  });
  const raw=await response.json().catch(()=>null);
  if(!response.ok)throw new WriterError(provider+" is temporarily unavailable.","PROVIDER_UNAVAILABLE",response.status>=500||response.status===429?503:502);
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason&&String(choice.finish_reason).toLowerCase()!=="stop")
    throw new WriterError(provider+" did not finish the document.","INCOMPLETE_DRAFT",502);
  const content=choice?.message?.content;
  const text=Array.isArray(content)?content.map(p=>p?.text||"").join(""):content;
  return {data:parseJsonText(text),provider,model:raw?.model||model};
}
async function cerebrasComplete(args){
  const apiKey=args.getEnv("RAVEN_CEREBRAS_API_KEY")||args.getEnv("CEREBRAS_API_KEY");
  if(!apiKey)throw new WriterError("Cerebras is not configured.","PROVIDER_NOT_CONFIGURED",503);
  return openAICompatibleComplete({...args,provider:"cerebras",baseUrl:"https://api.cerebras.ai/v1",apiKey,
    model:args.getEnv("RAVEN_CEREBRAS_MODEL")||"gpt-oss-120b"});
}
async function groqComplete(args){
  const apiKey=args.getEnv("RAVEN_GROQ_API_KEY")||args.getEnv("GROQ_API_KEY");
  if(!apiKey)throw new WriterError("Groq is not configured.","PROVIDER_NOT_CONFIGURED",503);
  return openAICompatibleComplete({...args,provider:"groq",baseUrl:"https://api.groq.com/openai/v1",apiKey,
    model:args.getEnv("RAVEN_GROQ_MODEL")||"openai/gpt-oss-120b"});
}
async function geminiComplete({getEnv,fetchImpl,signal,instructions,input,schema,maxOutputTokens}){
  const apiKey=getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY");
  if(!apiKey)throw new WriterError("Gemini is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const revision=Boolean(String(input?.revisionRequest||"").trim());
  const preferred=getEnv("RAVEN_GEMINI_MODEL")||"gemini-3.8-flash";
  const fallback=getEnv("RAVEN_GEMINI_FALLBACK_MODEL")||"gemini-3.5-flash-lite";
  const models=[...new Set((revision
    ? [fallback,preferred,"gemini-3.6-flash"]
    : [preferred,fallback,"gemini-3.6-flash"]).filter(Boolean))];
  const bases=["https://generativelanguage.googleapis.com","https://gateway.ai.cloudflare.com/v1/0be401023d08048c03bbfbb0576fa89f/raven/google-ai-studio"];
  let lastStatus=503;
  for(const model of models){
    for(const base of bases){
      const routeSignal=combineSignals([signal,AbortSignal.timeout(7000)]);
      let response;
      try{
        response=await fetchImpl(base+"/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
          method:"POST",signal:routeSignal,headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
          body:JSON.stringify({
            systemInstruction:{parts:[{text:instructions}]},
            contents:[{role:"user",parts:[{text:JSON.stringify(input)}]}],
            generationConfig:{maxOutputTokens,thinkingConfig:{thinkingLevel:"low"},responseMimeType:"application/json",responseSchema:geminiSchema(schema)}
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
    const stageSignal=combineSignals([signal,AbortSignal.timeout(timeoutFor(input))]);
    for(const provider of order){
      try{
        const common={getEnv,fetchImpl,signal:stageSignal,instructions,input,schema,name,maxOutputTokens};
        if(provider==="cerebras")return await cerebrasComplete(common);
        if(provider==="groq")return await groqComplete(common);
        if(provider==="gemini")return await geminiComplete(common);
      }catch(error){
        if(stageSignal?.aborted)break;
        if(error?.code==="INVALID_DRAFT"||error?.code==="INCOMPLETE_DRAFT"||error?.code==="PROVIDER_UNAVAILABLE"||error?.code==="WRITING_REFUSED")continue;
        throw error;
      }
    }
    throw new WriterError("All configured LLM providers are temporarily unavailable. Please try again.","LLM_UNAVAILABLE",503);
  };
}
