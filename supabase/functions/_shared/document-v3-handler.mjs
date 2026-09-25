import {writeResumeV3,DOCUMENT_V3_VERSION,DOCUMENT_SCHEMA_VERSION} from "./document-v3.mjs";
import {WriterError} from "./document-writer.mjs";
import {createLLMCompletion,llmProviderStatus} from "./llm-router.mjs";

const ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const TRACKS=new Set(["Professional","Labor","Wildcard","Games / 3D"]);

function field(value,max,label){
  if(value==null)return "";
  if(typeof value!=="string"||value.length>max)throw new WriterError(label+" is too long or invalid.","INVALID_INPUT",400);
  return value.trim();
}

export function createResumeV3Handler({getEnv,fetchImpl=fetch}){
  return async(req)=>{
    const origin=req.headers.get("origin")||"";
    const headers={
      "Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io",
      Vary:"Origin",
      "Access-Control-Allow-Headers":"content-type,x-raven-client",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Content-Type":"application/json",
      "Cache-Control":"no-store"
    };
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==="OPTIONS")return new Response("ok",{headers});
    if((origin&&!ORIGINS.has(origin))||req.headers.get("x-raven-client")!=="raven-web-v1")return json({error:"Forbidden"},403);

    const providerStatus=llmProviderStatus(getEnv);
    const primaryProvider=providerStatus.order.find(name=>providerStatus.configured[name])||"";
    if(req.method==="GET")return json({
      ok:true,
      service:"raven-generate-v3",
      architecture:DOCUMENT_V3_VERSION,
      schema_version:DOCUMENT_SCHEMA_VERSION,
      mode:"shadow",
      configured:Boolean(primaryProvider),
      primary_provider:primaryProvider,
      providers:providerStatus.configured,
      provider_order:providerStatus.order
    });
    if(req.method!=="POST")return json({error:"GET or POST required"},405);

    let eventId=null;
    const rpc=async(name,payload,timeout=10000)=>{
      const url=getEnv("SUPABASE_URL"),key=getEnv("SUPABASE_SERVICE_ROLE_KEY");
      if(!url||!key)throw new WriterError("Raven's document service is not configured.","SERVER_NOT_CONFIGURED",503);
      const r=await fetchImpl(url+"/rest/v1/rpc/"+name,{
        method:"POST",signal:AbortSignal.timeout(timeout),
        headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      if(!r.ok)throw new WriterError("Generation request budget is unavailable.","BUDGET_UNAVAILABLE",503);
      const text=await r.text();return text?JSON.parse(text):null;
    };
    const finish=async(status,http,detail=null)=>{
      if(eventId)await rpc("raven_request_finish",{p_event_id:eventId,p_status:status,p_http_status:http,p_detail:detail},5000).catch(()=>{});
    };

    try{
      let body;try{body=await req.json();}catch{throw new WriterError("Invalid JSON.","INVALID_INPUT",400);}
      if(!body||typeof body!=="object"||Array.isArray(body))throw new WriterError("Invalid request.","INVALID_INPUT",400);
      const track=field(body.track||"Professional",40,"Track");
      if(!TRACKS.has(track))throw new WriterError("Invalid track.","INVALID_INPUT",400);
      const target={
        track,
        title:field(body.jobTitle,240,"Job title"),
        company:field(body.company,240,"Company"),
        description:field(body.jobDescription||body.description,60000,"Job description")
      };
      if(!target.title||!target.description)throw new WriterError("Job title and description are required.","INVALID_INPUT",400);

      // V3 shadow traffic is isolated from production V2 request budgets.
      const budget=await rpc("raven_request_guard",{
        p_kind:"generation_v3",
        p_scope:"resume-v3-shadow",
        p_short_limit:24,
        p_short_seconds:60,
        p_long_limit:160,
        p_long_seconds:3600,
        p_failure_threshold:8,
        p_failure_window_seconds:300,
        p_circuit_seconds:180
      });
      if(!budget?.allowed)return json({
        error:"V3 shadow-test request budget reached.",
        code:"REQUEST_BUDGET_EXCEEDED",
        retryable:true,
        retryAfterSeconds:Number(budget?.retry_after_seconds||60)
      },429);
      eventId=Number(budget.event_id||0)||null;

      const url=getEnv("SUPABASE_URL"),key=getEnv("SUPABASE_SERVICE_ROLE_KEY");
      const profileResponse=await fetchImpl(
        url+"/rest/v1/raven_canonical_profiles?profile_key=eq.default&select=profile&limit=1",
        {signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:"Bearer "+key}}
      );
      if(!profileResponse.ok)throw new WriterError("Could not load your verified background.","PROFILE_UNAVAILABLE",503);
      const rows=await profileResponse.json(),profile=rows?.[0]?.profile;
      if(!profile||JSON.stringify(profile).length>150000)throw new WriterError("Verified candidate background is missing or too large.","PROFILE_UNAVAILABLE",503);

      const complete=createLLMCompletion({getEnv,fetchImpl,signal:AbortSignal.timeout(140000)});
      const written=await writeResumeV3({profile,target,complete});
      await finish("success",200);
      return json({
        ok:true,
        mode:"shadow",
        architecture:written.architecture,
        schema_version:DOCUMENT_SCHEMA_VERSION,
        provider:written.provider,
        model:written.model,
        resume:written.document,
        job_analysis:written.analysis,
        evidence_selection:written.selection,
        validation:written.diagnostics,
        budget:{short_remaining:budget.short_remaining,long_remaining:budget.long_remaining}
      });
    }catch(error){
      const known=error instanceof WriterError;
      const status=known?error.status:503,code=known?error.code:"GENERATION_UNAVAILABLE";
      await finish("failure",status,code+(known?": "+error.message:""));
      return json({
        error:known?error.message:"V3 generation is temporarily unavailable.",
        code,
        provider:"raven-llm-router-v1",
        retryable:status>=500&&code!=="LLM_NOT_CONFIGURED"
      },status);
    }
  };
}
