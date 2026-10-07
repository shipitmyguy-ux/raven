import {getStudioContext} from "./studio-context.mjs";
import {cloudflareFreeStatus} from "./cloudflare-free.mjs";
import {writeDocument,validateDraft,resumeKeywordGuidance,WriterError,WRITER_VERSION} from "./document-writer.mjs";
import {createLLMCompletion,llmProviderStatus,llmUsageStatus} from "./llm-router.mjs";
import {buildDeterministicResumeV3} from "./document-v3.mjs";
// Content failures consume rate quota, but do not imply a provider outage.
export function requestFailureStatus(error){
  const contentCodes=["INVALID_DRAFT","INCOMPLETE_DRAFT","FACT_CHECK_FAILED","LLM_CALL_BUDGET_EXHAUSTED","FINAL_REVIEW_BLOCKED"];
  const failures=(error?.providerFailures||[]).filter(item=>!item.skipped);
  return contentCodes.includes(error?.code)||(failures.length&&failures.every(item=>contentCodes.includes(item.code)))?"rejected":"failure";
}
// Race as well as abort: an unresponsive provider cannot hold the fallback open.
export async function boundedGeneration(run,ms){
  const controller=new AbortController();
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
    controller.abort();
    reject(new WriterError("Free AI timed out. Your previous document is unchanged.","PROVIDER_TIMEOUT",503));
  },ms);});
  try{return await Promise.race([Promise.resolve().then(()=>run(controller.signal)),timeout]);}
  finally{clearTimeout(timer);controller.abort();}
}
export function buildDeterministicCover(profile,target){
  const resume=buildDeterministicResumeV3(profile,target);
  const paragraphs=["I am applying for the "+target.title+(target.company?" position at "+target.company:" position")+"."];
  if(resume.document.skills.length)paragraphs.push("My skills include "+resume.document.skills.slice(0,5).join(", ")+".");
  // Copy source facts intact so employer attribution cannot drift.
  for(const role of resume.document.experience.slice(0,2)){
    if(role.bullets.length)paragraphs.push(role.company+" — "+role.role+". "+role.bullets.slice(0,2).join(" "));
  }
  paragraphs.push("Thank you for considering my application. I would welcome the opportunity to discuss my experience and the role.");
  return {...resume,architecture:"cover-source-facts-v1",document:{greeting:"Dear Hiring Manager,",paragraphs,closing:"Sincerely,",signature:profile.name}};
}

export function buildExternalChatPrompt(requestedKind,profile,target){
  const kind=requestedKind==="both"?"both":requestedKind==="coverLetter"?"coverLetter":"resume";
  // Identity/contact stay device-local. The external writer only receives the
  // verified evidence needed to draft application content.
  const promptProfile={
    skills:structuredClone(profile.skills||[]),
    education:structuredClone(profile.education||[]),
    experience:structuredClone(profile.experience||[]),
    transferable_facts:structuredClone(profile.transferable_facts||[]),
    shipped_titles:structuredClone(profile.shipped_titles||[]),
    resume_required_experience_ids:structuredClone(profile.resume_required_experience_ids||[])
  };
  // Keep the external prompt's evidence single-sourced. Previously the full
  // experience facts appeared in promptProfile and again in evidenceCatalog,
  // with pretty-printed JSON adding further input tokens. The compact records
  // below retain every fact ID and text needed by validateDraft.
  const evidence={
    skills:(promptProfile.skills||[]).map((text,i)=>({id:"skill:"+i,text})),
    education:(promptProfile.education||[]).map((item,i)=>({id:"education:"+i,text:Object.values(item).join(" / ")})),
    shipped_titles:(promptProfile.shipped_titles||[]).map((text,i)=>({id:"title:"+i,text})),
    experience:(promptProfile.experience||[]).map(({id,role,company,dates,facts=[]})=>({
      id,role,company,dates,facts:facts.map(({id,text})=>({id,text}))
    })),
    transferable_facts:(promptProfile.transferable_facts||[]).map(({id,text})=>({id,text})),
    resume_required_experience_ids:promptProfile.resume_required_experience_ids||[]
  };
  const keywordGuidance=resumeKeywordGuidance(promptProfile,target).recommended;
  const supportedKeywords=keywordGuidance.map(entry=>entry.keyword);
  const experienceFactIds=new Set((promptProfile.experience||[]).flatMap(role=>(role.facts||[]).map(fact=>fact.id)));
  const postingMatchedFactIds=new Set(keywordGuidance.flatMap(entry=>entry.evidence_ids||[]).filter(id=>experienceFactIds.has(id)));
  const mustPreserveFactIds=[...(promptProfile.resume_required_experience_ids||[])].flatMap(experienceId=>{
    const role=promptProfile.experience.find(item=>item.id===experienceId);
    if(!role)return [];
    const matched=(role.facts||[]).filter(fact=>postingMatchedFactIds.has(fact.id));
    // Keep up to two job-matched facts for each required Games / 3D role so
    // the full chronology survives without forcing every unrelated fact.
    const selected=matched.length?matched.slice(0,2):(role.facts||[]).slice(0,1);
    return selected.map(fact=>fact.id);
  });
  const resumeShape={
    headline:{text:"Write a supported headline.",fact_ids:["supporting_fact_id"]},
    summary:{text:"Write a supported summary.",fact_ids:["supporting_fact_id"]},
    skills:["Use exact verified skill names only"],
    experience:[{experience_id:"verified_experience_id",bullets:[{text:"Supported accomplishment or responsibility.",fact_ids:["fact_id_from_this_experience"]}]}],
    additional:[{text:"Optional supported career highlight.",fact_ids:["supporting_fact_id"]}]
  };
  const coverShape={
    greeting:"Dear Hiring Manager,",
    paragraphs:[{text:"Supported cover-letter paragraph.",fact_ids:["supporting_fact_id"]},{text:"Interest-only paragraph with no candidate-history claim.",fact_ids:[]}],
    closing:"Sincerely,"
  };
  const output={raven_format:"raven-chatgpt-v1"};
  if(kind==="resume"||kind==="both")output.resume=resumeShape;
  if(kind==="coverLetter"||kind==="both")output.coverLetter=coverShape;
  const rules=[
    "Write polished material tailored to the target using only the verified candidate evidence below.",
    "Never invent employers, roles, dates, titles, tools, credentials, metrics, duties, outcomes, experience years, or motivations; job requirements are not candidate evidence.",
    "Cite every factual headline, summary, resume bullet, highlight, and cover-letter paragraph with supporting fact_ids from the evidence below. Interest-only cover-letter paragraphs may use an empty fact_ids array.",
    "Work-history bullets may cite only facts under that experience ID. Do not transfer facts between employers.",
    "Use exact verified skill names in the skills array. Do not add a skill solely because the posting mentions it.",
    "For Games / 3D, include every resume_required_experience_ids entry; exclude SoundAir unless explicitly requested. Raven restores the complete shipped_titles list.",
    "For Professional, Labor, and Wildcard, select 2-4 relevant roles; foreground transferable evidence and never claim the target profession or 17 years in it.",
    "Use confident, specific wording within the evidence. For Games / 3D, aim for 375-475 words and retain every must-preserve fact ID below at least once in a relevant bullet; combine closely related facts only when the complete claims remain clear. Give relevant roles distinct bullets when supported.",
    "Use supported posting keywords naturally; never keyword-stuff or claim unsupported qualifications.",
    "Do not include job locations in work-history entries.",
    "Return only valid JSON (no markdown or commentary), with raven_format exactly raven-chatgpt-v1. Use the exact output keys shown; do not add keys or change key spelling.",
    "Do not put candidate name, contact, employer metadata, dates, education, or shipped_titles in the resume object; Raven restores them."
  ];
  if(kind==="coverLetter"||kind==="both")rules.push("For cover letters, write a cohesive first-person letter, usually 180-300 words, connecting two or three relevant verified examples to the job. Avoid naming past employers; Raven already carries employment history in the resume.");
  return [
    "RAVEN MANUAL CHATGPT GENERATION",
    "REQUESTED OUTPUT: "+kind,
    rules.map((rule,index)=>(index+1)+". "+rule).join("\n"),
    "TARGET JOB\n"+JSON.stringify({track:target.track,title:target.title,company:target.company,description:target.description}),
    "VERIFIED EVIDENCE — each record's id is valid for fact_ids; experience facts belong only to their enclosing experience\n"+JSON.stringify(evidence),
    "SUPPORTED POSTING KEYWORDS\n"+JSON.stringify(supportedKeywords),
    "MUST-PRESERVE FACT IDS — cite each at least once; never omit or generalize away these concrete examples\n"+JSON.stringify(mustPreserveFactIds),
    "OUTPUT SHAPE\n"+JSON.stringify(output)
  ].join("\n\n");
}

const ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const TRACKS=new Set(["Professional","Labor","Wildcard","Games / 3D"]);
function field(value,max,label){
  if(value==null)return "";
  if(typeof value!=="string"||value.length>max)throw new WriterError(label+" is too long or invalid.","INVALID_INPUT",400);
  return value.trim();
}
export function createDocumentHandler(kind,{getEnv,fetchImpl=fetch,logEvidence=entry=>console.info("[raven-number-evidence] "+JSON.stringify(entry))}){
  const service=kind==="resume"?"raven-generate-v2":"raven-cover-v2";
  return async(req)=>{
    const origin=req.headers.get("origin")||"";
    const headers={"Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io",
      Vary:"Origin","Access-Control-Allow-Headers":"content-type,x-raven-client","Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Content-Type":"application/json","Cache-Control":"no-store"};
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==="OPTIONS")return new Response("ok",{headers});
    if((origin&&!ORIGINS.has(origin))||req.headers.get("x-raven-client")!=="raven-web-v1")return json({error:"Forbidden"},403);
    const freeEnv=name=>name==="RAVEN_LLM_PROVIDER_ORDER"?"cloudflare,openrouter":
      name==="RAVEN_CLOUDFLARE_MODEL"?"@cf/meta/llama-3.3-70b-instruct-fp8-fast":getEnv(name);
    const providerStatus=llmProviderStatus(freeEnv);
    const primaryProvider=providerStatus.order.find(name=>providerStatus.configured[name])||"";
    if(req.method==="GET"){
      const usage=await llmUsageStatus(getEnv,fetchImpl);
      return json({ok:true,service,architecture:WRITER_VERSION,
        provider_router:"raven-llm-router-v1",primary_provider:primaryProvider,
        configured:Boolean(primaryProvider),providers:providerStatus.configured,
        provider_order:providerStatus.order,usage,cloudflare_free:await cloudflareFreeStatus(getEnv,fetchImpl)});
    }
    if(req.method!=="POST")return json({error:"GET or POST required"},405);
    let eid=null;
    let validationDiagnostics=[];
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
      const revisionSection=field(body.revisionSection,20,"Revision section");
      if(revisionSection&&(revisionSection!=="summary"||kind!=="resume"||!instructions||!currentDocument))throw new WriterError("Invalid summary revision request.","INVALID_INPUT",400);
      const url=getEnv("SUPABASE_URL"),key=getEnv("SUPABASE_SERVICE_ROLE_KEY");
      const r=await fetchImpl(url+"/rest/v1/raven_canonical_profiles?profile_key=eq.default&select=profile&limit=1",
        {signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:"Bearer "+key}});
      if(!r.ok)throw new WriterError("Could not load your verified background.","PROFILE_UNAVAILABLE",503);
      const rows=await r.json(),profile=rows?.[0]?.profile;
      if(!profile||JSON.stringify(profile).length>150000)throw new WriterError("Verified candidate background is missing or too large.","PROFILE_UNAVAILABLE",503);

      if(body.promptOnly===true){
        const promptKind=body.promptDocumentType==="both"?"both":body.promptDocumentType==="coverLetter"?"coverLetter":kind;
        return json({ok:true,format:"raven-chatgpt-v1",prompt:buildExternalChatPrompt(promptKind,profile,target)});
      }
      if(body.manualDraft){
        const draft=body.manualDraft;
        if(typeof draft!=="object"||Array.isArray(draft))throw new WriterError("Paste the Raven JSON object returned by ChatGPT.","INVALID_INPUT",400);
        const document=validateDraft(kind,draft,profile,{target,instructions:""});
        // Contact details are restored from Raven's device-local Application
        // Profile in the browser and are never returned by this public endpoint.
        if(kind==="resume") document.contact="";
        return json({ok:true,[kind]:document,manual_import:true,ai_used:false,fallback_used:false,
          final_review:{status:"passed",factual_review:{status:"passed",reviewer:"raven-deterministic-manual-import"}}});
      }

      // Initial drafts remain usable when the free service is down. Revisions
      // must succeed explicitly; a fallback must never masquerade as a rewrite.
      const initial=!instructions;
      const fallback=(reason,detail="",error=null)=>json({ok:false,error:"Raven could not approve this draft. "+(validationDiagnostics.slice(-1)[0]||"Final factual review did not complete.")+" Your previous document is unchanged.",code:"FINAL_REVIEW_BLOCKED",cause:reason,provider_failures:(error?.providerFailures||[]).map(f=>({provider:f.provider,code:f.code,status:f.status,skipped:f.skipped})),final_review:{status:"blocked"},validation_details:validationDiagnostics,ai_used:false,fallback_used:false,retryable:true},503);

      // Cloudflare requires a verified Free plan; OpenRouter caps price at zero.
      if(!primaryProvider&&initial)return fallback("LLM_NOT_CONFIGURED");
      let budget;
      try{
        budget=await rpc("raven_request_guard",{p_kind:"generation_v2",p_scope:kind==="resume"?"resume":"cover",
          p_short_limit:12,p_short_seconds:60,p_long_limit:60,p_long_seconds:3600,
          p_failure_threshold:3,p_failure_window_seconds:300,p_circuit_seconds:600});
        if(!budget?.allowed){
          if(initial)return fallback("REQUEST_BUDGET_EXCEEDED");
          return json({error:"Generation request budget reached. Your previous document is unchanged.",code:"REQUEST_BUDGET_EXCEEDED",retryable:true,retryAfterSeconds:Number(budget?.retry_after_seconds||60)},429);
        }
        eid=Number(budget.event_id||0)||null;
        target.studioContext=await getStudioContext({company:target.company,track,getEnv,fetchImpl}).catch(()=>({status:"unavailable",sources:[]}));
        const written=await boundedGeneration(async signal=>{
          const complete=createLLMCompletion({getEnv:freeEnv,fetchImpl,signal});
          return writeDocument({kind,profile,target,instructions,currentDocument,revisionSection,complete,reviewComplete:complete,
            onDiagnostic:details=>{validationDiagnostics=details;},
            onEvidenceTrace:entry=>logEvidence({service,request_event_id:eid,...entry})});
        },55000);
        if(written.source_fact_passages>0)throw new WriterError("The draft contains source fallback passages and needs a successful AI rewrite.","FINAL_REVIEW_BLOCKED",503);
        await finish("success",200);
        return json({ok:true,provider:written.provider,model:written.model,
          provider_attempts:Number(written.provider_attempts||1),
          verification_provider:written.verification_provider||"raven",verification_model:written.verification_model||"evidence-v3",
          architecture:written.architecture,validation_errors:[],
          ...(written.revision_section?{document_patch:{section:written.revision_section,text:written.document.summary}}:{[kind]:written.document}),
          job_analysis:written.analysis,evidence_selection:written.selection,
          ai_used:true,fallback_used:false,final_review:written.final_review,
          studio_context:{status:target.studioContext.status,company:target.studioContext.company,checked_at:target.studioContext.checked_at,source_urls:target.studioContext.sources.map(s=>s.url)},
          source_fact_passages:Number(written.source_fact_passages||0),
          validation_details:written.validation_details||[],
          budget:{short_remaining:budget.short_remaining,long_remaining:budget.long_remaining}});
      }catch(error){
        if(!initial)throw error;
        // Input/profile errors remain errors; only generation/service failures
        // may be replaced with a document built from the verified profile.
        if(["INVALID_INPUT","PROFILE_MISSING"].includes(error?.code))throw error;
        await finish(requestFailureStatus(error),Number(error?.status||503),String(error?.code||"GENERATION_UNAVAILABLE")+": "+String(error?.message||"").slice(0,400)+" | "+validationDiagnostics.join(" | ").slice(0,500));
        return fallback(String(error?.code||"GENERATION_UNAVAILABLE"),error?.message,error);
      }
    }catch(error){
      const known=error instanceof WriterError;
      const status=known?error.status:503,code=known?error.code:"GENERATION_UNAVAILABLE";
      await finish(requestFailureStatus(error),status,code+(known?": "+error.message:"")+" | "+validationDiagnostics.join(" | ").slice(0,600));
      const nonRetryable=new Set(["LLM_NOT_CONFIGURED","LLM_PROVIDER_ACCOUNT_ERROR","PROVIDER_BILLING","PROVIDER_AUTH","INVALID_INPUT"]);
      return json({error:known?error.message:"Document generation is temporarily unavailable. Please try again.",code,
        provider:"raven-llm-router-v1",
        provider_attempts:Number(error?.providerAttempts||0),
        validation_details:validationDiagnostics,
        provider_failures:Array.isArray(error?.providerFailures)?error.providerFailures:[],
        retryable:status>=500&&!nonRetryable.has(code)},status);
    }
  };
}
