import {createGeminiCompletion,writeDocument,WriterError,WRITER_VERSION,DEFAULT_MODEL} from "./document-writer.mjs";
const ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const TRACKS=new Set(["Professional","Labor","Wildcard","Games / 3D"]);
function field(value,max,label){
  if(value==null)return "";
  if(typeof value!=="string"||value.length>max)throw new WriterError(label+" is too long or invalid.","INVALID_INPUT",400);
  return value.trim();
}
export function createDocumentHandler(kind,{getEnv,fetchImpl=fetch}){
  const service=kind==="resume"?"raven-generate-v2":"raven-cover-v2";
  return async(req)=>{
    const origin=req.headers.get("origin")||"";
    const headers={"Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io",
      Vary:"Origin","Access-Control-Allow-Headers":"content-type,x-raven-client","Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Content-Type":"application/json","Cache-Control":"no-store"};
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==="OPTIONS")return new Response("ok",{headers});
    if((origin&&!ORIGINS.has(origin))||req.headers.get("x-raven-client")!=="raven-web-v1")return json({error:"Forbidden"},403);
    const apiKey=getEnv("RAVEN_GEMINI_API_KEY")||getEnv("GEMINI_API_KEY")||"";
    const model=getEnv("RAVEN_GEMINI_MODEL")||DEFAULT_MODEL;
    if(req.method==="GET")return json({ok:true,service,architecture:WRITER_VERSION,provider:"gemini",model,configured:Boolean(apiKey)});
    if(req.method!=="POST")return json({error:"GET or POST required"},405);
    let eid=null;
    const rpc=async(name,payload,timeout=10000)=>{
      const url=getEnv("SUPABASE_URL"),key=getEnv("SUPABASE_SERVICE_ROLE_KEY");
      if(!url||!key)throw new WriterError("Raven's document service is not configured.","SERVER_NOT_CONFIGURED",503);
      const r=await fetchImpl(url+"/rest/v1/rpc/"+name,{method:"POST",signal:AbortSignal.timeout(timeout),
        headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!r.ok)throw new WriterError("Generation request budget is unavailable.","BUDGET_UNAVAILABLE",503);
      const text=await r.text();return text?JSON.parse(text):null;
    };
    const finish=async(status,http,detail=null)=>{
      if(eid)await rpc("raven_request_finish",{p_event_id:eid,p_status:status,p_http_status:http,p_detail:detail},5000).catch(()=>{});
    };
    try{
      let body;try{body=await req.json();}catch{throw new WriterError("Invalid JSON.","INVALID_INPUT",400);}
      if(!body||typeof body!=="object"||Array.isArray(body))throw new WriterError("Invalid request.","INVALID_INPUT",400);
      const track=field(body.track||"Professional",40,"Track");
      if(!TRACKS.has(track))throw new WriterError("Invalid track.","INVALID_INPUT",400);
      const target={track,title:field(body.jobTitle,240,"Job title"),company:field(body.company,240,"Company"),
        description:field(body.jobDescription||body.description,60000,"Job description")};
      if(!target.title||!target.description)throw new WriterError("Job title and description are required.","INVALID_INPUT",400);
      const instructions=field(body.instructions,5000,"Revision request"),currentDocument=field(body.currentDocument,40000,"Current document");
      // A single deadline bounds all model calls, including the optional factual repair.
      const complete=createGeminiCompletion({apiKey,model,fallbackModel:getEnv("RAVEN_GEMINI_FALLBACK_MODEL")||"gemini-3.5-flash-lite",fetchImpl,signal:AbortSignal.timeout(110000)});
      const budget=await rpc("raven_request_guard",{p_kind:"generation_v2",p_scope:kind==="resume"?"resume":"cover",
        p_short_limit:12,p_short_seconds:60,p_long_limit:60,p_long_seconds:3600,
        p_failure_threshold:3,p_failure_window_seconds:300,p_circuit_seconds:600});
      if(!budget?.allowed)return json({error:"Generation request budget reached.",code:"REQUEST_BUDGET_EXCEEDED",retryable:true,retryAfterSeconds:Number(budget?.retry_after_seconds||60)},429);
      eid=Number(budget.event_id||0)||null;
      const url=getEnv("SUPABASE_URL"),key=getEnv("SUPABASE_SERVICE_ROLE_KEY");
      const r=await fetchImpl(url+"/rest/v1/raven_canonical_profiles?profile_key=eq.default&select=profile&limit=1",
        {signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:"Bearer "+key}});
      if(!r.ok)throw new WriterError("Could not load your verified background.","PROFILE_UNAVAILABLE",503);
      const rows=await r.json(),profile=rows?.[0]?.profile;
      if(!profile||JSON.stringify(profile).length>150000)throw new WriterError("Verified candidate background is missing or too large.","PROFILE_UNAVAILABLE",503);
      const written=await writeDocument({kind,profile,target,instructions,currentDocument,complete});
      await finish("success",200);
      return json({ok:true,provider:written.provider,model:written.model,verification_model:written.verification_model,
        architecture:written.architecture,validation_errors:[],[kind]:written.document,
        budget:{short_remaining:budget.short_remaining,long_remaining:budget.long_remaining}});
    }catch(error){
      const known=error instanceof WriterError;
      const status=known?error.status:503,code=known?error.code:"GENERATION_UNAVAILABLE";
      await finish("failure",status,code);
      return json({error:known?error.message:"Document generation is temporarily unavailable. Please try again.",code,provider:"gemini",retryable:status>=500&&code!=="GEMINI_NOT_CONFIGURED"},status);
    }
  };
}
