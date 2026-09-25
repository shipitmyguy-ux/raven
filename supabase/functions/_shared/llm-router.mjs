import {WriterError} from "./document-writer.mjs";

const providerHealth=new Map();
const HEALTH_COOLDOWN_MS={
  PROVIDER_BILLING:30*60*1000,
  PROVIDER_AUTH:30*60*1000,
  PROVIDER_RATE_LIMIT:60*1000,
  PROVIDER_TIMEOUT:30*1000,
  PROVIDER_UPSTREAM:30*1000,
  PROVIDER_UNAVAILABLE:30*1000
};
function providerOnCooldown(name){
  const until=Number(providerHealth.get(name)?.until||0);
  return until>Date.now();
}
function markProviderFailure(name,error){
  const code=String(error?.code||"PROVIDER_UNAVAILABLE");
  const cooldown=HEALTH_COOLDOWN_MS[code]||30000;
  providerHealth.set(name,{until:Date.now()+cooldown,code,status:Number(error?.upstreamStatus||0)});
}
function clearProviderFailure(name){ providerHealth.delete(name); }
function providerError(provider,status,raw=null,message=""){
  const upstreamCode=String(raw?.error?.code||raw?.error?.type||"").slice(0,120);
  let code="PROVIDER_UNAVAILABLE",http=503,text=message||provider+" is temporarily unavailable.";
  if(status===401||status===403){code="PROVIDER_AUTH";http=502;text=provider+" authentication was rejected.";}
  else if(status===402){code="PROVIDER_BILLING";http=502;text=provider+" billing or credits are unavailable.";}
  else if(status===429){code="PROVIDER_RATE_LIMIT";http=503;text=provider+" is rate limited.";}
  else if(status>=500){code="PROVIDER_UPSTREAM";http=503;text=provider+" returned an upstream service error ("+status+").";}
  const error=new WriterError(text,code,http);
  error.upstreamStatus=status;
  error.upstreamCode=upstreamCode;
  error.upstreamMessage=String(raw?.error?.message||raw?.message||"").slice(0,300);
  error.provider=provider;
  return error;
}
function timeoutError(provider){
  const error=new WriterError(provider+" timed out.","PROVIDER_TIMEOUT",503);
  error.provider=provider;
  return error;
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
function timeoutFor(input){
  return String(input?.revisionRequest||"").trim()?30000:45000;
}
function openAICompatibleSchema(schema){
  if(Array.isArray(schema))return schema.map(openAICompatibleSchema);
  if(!schema||typeof schema!=="object")return schema;
  return Object.fromEntries(Object.entries(schema)
    .filter(([key])=>key!=="minItems"&&key!=="maxItems")
    .map(([key,value])=>[key,openAICompatibleSchema(value)]));
}
function geminiSchema(schema){
  if(Array.isArray(schema))return schema.map(geminiSchema);
  if(!schema||typeof schema!=="object")return schema;
  return Object.fromEntries(Object.entries(schema).filter(([key])=>key!=="additionalProperties").map(([key,value])=>[key,geminiSchema(value)]));
}
function configured(getEnv){
  return {
    openrouter:Boolean(getEnv("RAVEN_OPENROUTER_API_KEY")||getEnv("OPENROUTER_API_KEY")),
    cloudflare:Boolean(
      (getEnv("RAVEN_CLOUDFLARE_API_TOKEN")||getEnv("CLOUDFLARE_API_TOKEN")||getEnv("CLOUDFLARE_AUTH_TOKEN")) &&
      (getEnv("RAVEN_CLOUDFLARE_ACCOUNT_ID")||getEnv("CLOUDFLARE_ACCOUNT_ID"))
    ),
    cerebras:Boolean(getEnv("RAVEN_CEREBRAS_API_KEY")||getEnv("CEREBRAS_API_KEY")),
    groq:Boolean(getEnv("RAVEN_GROQ_API_KEY")||getEnv("GROQ_API_KEY")),
    gemini:Boolean(getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY"))
  };
}
function providerOrder(getEnv){
  const requested=String(getEnv("RAVEN_LLM_PROVIDER_ORDER")||"openrouter,cloudflare,gemini,cerebras,groq")
    .split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  return [...new Set(requested.filter(v=>["openrouter","cloudflare","cerebras","groq","gemini"].includes(v)))];
}
async function openAICompatibleComplete({provider,baseUrl,apiKey,model,fetchImpl,signal,instructions,input,schema,name,maxOutputTokens}){
  const response=await fetchImpl(baseUrl+"/chat/completions",{
    method:"POST",signal,
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({
      model,
      messages:[{role:"system",content:instructions},{role:"user",content:JSON.stringify(input)}],
      response_format:{type:"json_schema",json_schema:{name:name||"raven_document",strict:true,schema:openAICompatibleSchema(schema)}},
      max_completion_tokens:maxOutputTokens,
      reasoning_effort:"low",
      ...(provider==="cloudflare"?{options:{rejectIfBusy:true}}:{})
    })
  });
  const raw=await response.json().catch(()=>null);
  if(!response.ok) throw providerError(provider,response.status,raw);
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason&&String(choice.finish_reason).toLowerCase()!=="stop")
    throw new WriterError(provider+" did not finish the document.","INCOMPLETE_DRAFT",502);
  const content=choice?.message?.content;
  const text=Array.isArray(content)?content.map(p=>p?.text||"").join(""):content;
  return {data:parseJsonText(text),provider,model:raw?.model||model};
}
async function openrouterComplete({getEnv,fetchImpl,signal,instructions,input,schema,name,maxOutputTokens}){
  const apiKey=getEnv("RAVEN_OPENROUTER_API_KEY")||getEnv("OPENROUTER_API_KEY");
  if(!apiKey)throw new WriterError("OpenRouter is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const model=getEnv("RAVEN_OPENROUTER_MODEL")||"inclusionai/ling-3.0-flash:free";
  const schemaPrompt=[
    instructions,
    "Return one JSON object only. It must match this schema exactly. Raven validates it locally:",
    JSON.stringify(openAICompatibleSchema(schema))
  ].join("\n\n");
  let response;
  try{
    response=await fetchImpl("https://openrouter.ai/api/v1/chat/completions",{
      method:"POST",
      signal,
      headers:{
        "Authorization":"Bearer "+apiKey,
        "Content-Type":"application/json",
        "HTTP-Referer":"https://shipitmyguy-ux.github.io/raven/",
        "X-Title":"Raven"
      },
      body:JSON.stringify({
        model,
        messages:[
          {role:"system",content:schemaPrompt},
          {role:"user",content:JSON.stringify(input)}
        ],
        max_completion_tokens:maxOutputTokens,
        reasoning:{effort:"low"}
      })
    });
  }catch{
    throw timeoutError("openrouter");
  }
  const raw=await response.json().catch(()=>null);
  if(!response.ok)throw providerError("openrouter",response.status,raw);
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason&&String(choice.finish_reason).toLowerCase()!=="stop")
    throw new WriterError("OpenRouter did not finish the document.","INCOMPLETE_DRAFT",502);
  const content=choice?.message?.content;
  const text=Array.isArray(content)?content.map(p=>p?.text||"").join(""):content;
  return {data:parseJsonText(text),provider:"openrouter",model:raw?.model||model};
}

async function cloudflareComplete(args){
  const token=args.getEnv("RAVEN_CLOUDFLARE_API_TOKEN")||args.getEnv("CLOUDFLARE_API_TOKEN")||args.getEnv("CLOUDFLARE_AUTH_TOKEN");
  const accountId=args.getEnv("RAVEN_CLOUDFLARE_ACCOUNT_ID")||args.getEnv("CLOUDFLARE_ACCOUNT_ID");
  if(!token||!accountId)throw new WriterError("Cloudflare Workers AI is not configured.","PROVIDER_NOT_CONFIGURED",503);
  const model=args.getEnv("RAVEN_CLOUDFLARE_MODEL")||"@cf/meta/llama-3.1-8b-instruct-fp8";
  return openAICompatibleComplete({
    ...args,
    provider:"cloudflare",
    baseUrl:"https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(accountId)+"/ai/v1",
    apiKey:token,
    model
  });
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
  const model=revision
    ? (getEnv("RAVEN_GEMINI_FALLBACK_MODEL")||"gemini-3.5-flash-lite")
    : (getEnv("RAVEN_GEMINI_MODEL")||"gemini-3.8-flash");
  const base=getEnv("RAVEN_GEMINI_BASE_URL")||"https://generativelanguage.googleapis.com";
  const routeSignal=combineSignals([signal,AbortSignal.timeout(10000)]);

  let response;
  try{
    response=await fetchImpl(base+"/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",
      signal:routeSignal,
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:instructions}]},
        contents:[{role:"user",parts:[{text:JSON.stringify(input)}]}],
        generationConfig:{
          maxOutputTokens,
          thinkingConfig:{thinkingLevel:"low"},
          responseMimeType:"application/json",
          responseSchema:geminiSchema(schema)
        }
      })
    });
  }catch(error){
    if(signal?.aborted)throw timeoutError("gemini");
    throw timeoutError("gemini");
  }

  const raw=await response.json().catch(()=>null);
  if(!response.ok)throw providerError("gemini",response.status,raw);
  if(raw?.promptFeedback?.blockReason){
    const error=new WriterError("Gemini declined this writing request.","WRITING_REFUSED",502);
    error.provider="gemini";
    throw error;
  }
  const candidate=raw?.candidates?.[0];
  if(candidate?.finishReason!=="STOP"){
    const error=new WriterError("Gemini did not finish the document.","INCOMPLETE_DRAFT",502);
    error.provider="gemini";
    error.upstreamCode=String(candidate?.finishReason||"").slice(0,120);
    throw error;
  }
  const output=(candidate.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
  return {data:parseJsonText(output),provider:"gemini",model:raw?.modelVersion||model};
}

export function llmProviderStatus(getEnv){
  return {configured:configured(getEnv),order:providerOrder(getEnv)};
}

export function createLLMCompletion({getEnv,fetchImpl=fetch,signal}){
  const status=configured(getEnv);
  const configuredOrder=providerOrder(getEnv).filter(name=>status[name]);
  if(!configuredOrder.length)throw new WriterError("No LLM provider is configured for Raven.","LLM_NOT_CONFIGURED",503);

  let remainingProviderCalls=2;
  let totalProviderCalls=0;
  return async({instructions,input,schema,name,maxOutputTokens=6000})=>{
    if(remainingProviderCalls<=0){
      const error=new WriterError("Raven reached its two-call LLM limit for this generation request.","LLM_CALL_BUDGET_EXHAUSTED",502);
      error.providerAttempts=totalProviderCalls;
      throw error;
    }
    const stageSignal=combineSignals([signal,AbortSignal.timeout(timeoutFor(input))]);
    const healthy=configuredOrder.filter(name=>!providerOnCooldown(name));
    const candidates=[...healthy,...configuredOrder.filter(name=>providerOnCooldown(name))].slice(0,remainingProviderCalls);
    const failures=[];

    for(const provider of candidates){
      if(providerOnCooldown(provider)){
        failures.push({
          provider,
          code:String(providerHealth.get(provider)?.code||"PROVIDER_UNAVAILABLE"),
          status:Number(providerHealth.get(provider)?.status||0),
          skipped:true
        });
        continue;
      }

      try{
        remainingProviderCalls-=1;
        totalProviderCalls+=1;
        const common={getEnv,fetchImpl,signal:stageSignal,instructions,input,schema,name,maxOutputTokens};
        let result;
        if(provider==="openrouter")result=await openrouterComplete(common);
        else if(provider==="cloudflare")result=await cloudflareComplete(common);
        else if(provider==="cerebras")result=await cerebrasComplete(common);
        else if(provider==="groq")result=await groqComplete(common);
        else if(provider==="gemini")result=await geminiComplete(common);
        else continue;
        clearProviderFailure(provider);
        return {...result,providerAttempts:totalProviderCalls};
      }catch(caught){
        const error=stageSignal?.aborted?timeoutError(provider):caught;
        const code=String(error?.code||"ERROR");
        const failure={
          provider,
          code,
          status:Number(error?.upstreamStatus||0),
          upstreamCode:String(error?.upstreamCode||""),
          upstreamMessage:String(error?.upstreamMessage||"")
        };
        failures.push(failure);
        console.warn("[raven-llm-router]",provider,code,Number(error?.status||0),failure.status,failure.upstreamCode,failure.upstreamMessage);

        if(stageSignal?.aborted)break;
        if(["PROVIDER_BILLING","PROVIDER_AUTH","PROVIDER_RATE_LIMIT","PROVIDER_TIMEOUT","PROVIDER_UPSTREAM","PROVIDER_UNAVAILABLE"].includes(code)){
          markProviderFailure(provider,error);
          continue;
        }
        if(["INVALID_DRAFT","INCOMPLETE_DRAFT","WRITING_REFUSED"].includes(code))continue;
        throw error;
      }
    }

    const active=failures.filter(f=>!f.skipped);
    let message="No configured LLM provider completed the request.";
    let code="LLM_UNAVAILABLE";
    if(active.length){
      const details=active.map(f=>{
        if(f.code==="PROVIDER_BILLING")return f.provider+" billing/credits unavailable";
        if(f.code==="PROVIDER_AUTH")return f.provider+" authentication rejected";
        if(f.code==="PROVIDER_RATE_LIMIT")return f.provider+" rate limited";
        if(f.code==="PROVIDER_TIMEOUT")return f.provider+" timed out";
        if(f.code==="PROVIDER_UPSTREAM")return f.provider+" upstream error"+(f.status?" "+f.status:"");
        if(f.code==="WRITING_REFUSED")return f.provider+" declined the request";
        if(f.code==="INCOMPLETE_DRAFT")return f.provider+" returned an incomplete draft";
        return f.provider+" unavailable";
      });
      message=details.join("; ")+".";
      if(active.every(f=>f.code==="PROVIDER_RATE_LIMIT"))code="LLM_RATE_LIMITED";
      else if(active.every(f=>["PROVIDER_BILLING","PROVIDER_AUTH"].includes(f.code)))code="LLM_PROVIDER_ACCOUNT_ERROR";
    }
    const error=new WriterError(message,code,503);
    error.providerFailures=failures;
    error.providerAttempts=totalProviderCalls;
    throw error;
  };
}

