import { driveExportTarget } from "./drive-source.mjs";
import { requestGuard, requestFinish } from "./request-budget.ts";
import { fetchGenerationPolicies, extractMasterText, applyGenerationPolicies } from "./policy.js";

const ALLOWED_ORIGINS=new Set([
  "https://shipitmyguy-ux.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"content-type,x-raven-client",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
  };
}
function json(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function allowed(req:Request){
  const origin=req.headers.get("origin")||"";
  if(origin && !ALLOWED_ORIGINS.has(origin)) return false;
  return req.headers.get("x-raven-client")==="raven-web-v1" || req.method==="GET";
}

const coverLetterSchema={
  type:"object",
  properties:{
    greeting:{type:"string"},
    paragraphs:{type:"array",items:{type:"string"}},
    closing:{type:"string"},
    signature:{type:"string"}
  },
  required:["greeting","paragraphs","closing","signature"]
};

const resumeSchema={
  type:"object",
  properties:{
    name:{type:"string"},
    contact:{type:"string"},
    headline:{type:"string"},
    summary:{type:"string"},
    skills:{type:"array",maxItems:16,items:{type:"string"}},
    experience:{
      type:"array",maxItems:5,
      items:{
        type:"object",
        properties:{
          role:{type:"string"},
          company:{type:"string"},
          dates:{type:"string"},
          bullets:{type:"array",maxItems:4,items:{type:"string"}}
        },
        required:["role","company","dates","bullets"]
      }
    },
    education:{
      type:"array",maxItems:3,
      items:{
        type:"object",
        properties:{
          degree:{type:"string"},
          school:{type:"string"},
          location:{type:"string"},
          dates:{type:"string"}
        },
        required:["degree","school","location","dates"]
      }
    },
    additional:{type:"array",maxItems:6,items:{type:"string"}}
  },
  required:["name","contact","headline","summary","skills","experience","education","additional"]
};

function validString(value:unknown){return typeof value==="string"&&value.trim().length>0;}
function placeholderText(value:unknown){
  return /^(?:not provided(?: in master resume)?|n\/?a|none|available upon request)$/i.test(String(value||"").trim());
}

function normalizeGeneratedDocument(
  type: string,
  doc: any,
  policies: any = {},
  masterSource: any = null,
  jobLocation = ""
) {
  if (!doc || typeof doc !== "object") return doc;

  if (type === "coverLetter") {
    const rawDoc = {
      greeting: String(doc.greeting || "").trim(),
      paragraphs: (Array.isArray(doc.paragraphs) ? doc.paragraphs : [])
        .map((x: any) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 4),
      closing: String(doc.closing || "").trim(),
      signature: String(doc.signature || "").trim()
    };
    return applyGenerationPolicies(rawDoc, policies, masterSource, jobLocation);
  }

  const education = (Array.isArray(doc.education) ? doc.education : [])
    .map((x: any) => ({
      degree: String(x?.degree || "").trim(),
      school: String(x?.school || "").trim(),
      location: String(x?.location || "").trim(),
      dates: String(x?.dates || "").trim()
    }))
    .filter((x: any) => [x.degree, x.school, x.location, x.dates].some((v: any) => validString(v) && !placeholderText(v)))
    .slice(0, 3);

  const rawDoc = {
    name: String(doc.name || "").trim(),
    contact: placeholderText(doc.contact) ? "" : String(doc.contact || "").trim(),
    headline: String(doc.headline || "").trim(),
    summary: String(doc.summary || "").trim().slice(0, 1200),
    skills: (Array.isArray(doc.skills) ? doc.skills : []).map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 16),
    experience: (Array.isArray(doc.experience) ? doc.experience : []).slice(0, 5).map((x: any) => ({
      role: String(x?.role || "").trim(),
      company: String(x?.company || "").trim(),
      dates: String(x?.dates || "").trim(),
      bullets: (Array.isArray(x?.bullets) ? x.bullets : []).map((b: any) => String(b || "").trim()).filter(Boolean).slice(0, 4)
    })),
    education,
    additional: (Array.isArray(doc.additional) ? doc.additional : []).map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6)
  };

  return applyGenerationPolicies(rawDoc, policies, masterSource, jobLocation);
}

function validateDocument(type:string,doc:any){
  if(!doc||typeof doc!=="object") return "AI returned no structured document.";
  if(type==="coverLetter"){
    if(!validString(doc.greeting)||!Array.isArray(doc.paragraphs)||doc.paragraphs.length<2||doc.paragraphs.length>4||doc.paragraphs.some((p:any)=>!validString(p))||!validString(doc.closing)||!validString(doc.signature)) return "AI returned an incomplete cover letter.";
    return "";
  }
  if(!validString(doc.name)||!validString(doc.summary)||!Array.isArray(doc.skills)||!Array.isArray(doc.experience)||!doc.experience.length||!Array.isArray(doc.education)||!Array.isArray(doc.additional)) return "AI returned an incomplete resume.";
  if(doc.skills.length>16) return "AI returned too many skills.";
  if(doc.experience.length>5) return "AI returned too many experience entries.";
  if(doc.experience.some((x:any)=>!x||!validString(x.role)||!validString(x.company)||!validString(x.dates)||!Array.isArray(x.bullets)||!x.bullets.length||x.bullets.length>4)) return "AI returned malformed experience history.";
  if(doc.education.length>3||doc.additional.length>6) return "AI returned too much secondary content.";
  return "";
}

function retryableProviderStatus(status:number){return status===408||status===429||status>=500;}
function bytesToBase64(bytes:Uint8Array){
  let binary="";
  for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}

async function loadDriveMaster(rawUrl:string){
  const target=driveExportTarget(rawUrl);
  const response=await fetch(target.url,{redirect:"follow",headers:{"User-Agent":"RavenResumeGenerator/1.0"},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error("Google Drive master resume could not be downloaded ("+response.status+").");
  const contentType=(response.headers.get("content-type")||target.mimeType||"").split(";")[0].trim().toLowerCase();
  if(response.url.includes("accounts.google.com")||contentType==="text/html") throw new Error("Google Drive master resume is private. Allow anyone with the link to view it, or add the resume as a local file.");
  if(contentType.includes("wordprocessingml")) throw new Error("Drive-hosted DOCX is not supported directly. Use a Google Doc, PDF, or add the DOCX as a local file.");
  const size=Number(response.headers.get("content-length")||0);
  if(size>12*1024*1024) throw new Error("Google Drive master resume is larger than the 12 MB limit.");
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>12*1024*1024) throw new Error("Google Drive master resume is larger than the 12 MB limit.");
  if(!bytes.length) throw new Error("Google Drive master resume was empty.");
  return {base64:bytesToBase64(bytes),mimeType:contentType||target.mimeType||"application/pdf"};
}

function buildTrackPromptGuidance(trackRaw: string, documentType: string): string[] {
  const track = String(trackRaw || "").trim().toLowerCase();

  if (track.includes("professional")) {
    return [
      "TRACK GUIDANCE (Professional Track):",
      "- Foreground transferable project management and operations accomplishments and capabilities.",
      "- Emphasize: project delivery, team leadership, mentoring/onboarding, workflow/process improvement, cross-functional coordination, troubleshooting, internal meetings, intermediate Excel, AI/automation modules, asset database metadata/reporting/querying.",
      "- CRITICAL FACTUAL CONSTRAINT: Do NOT fabricate or alter job titles. You must preserve the candidate's exact, official employment titles from the master resume (e.g., retain 'Environment Artist' or 'Technical Artist' as the official job title). Do NOT rename roles to 'Project Manager' or 'Operations Manager' to disguise career pivots.",
      "- Explain transferable relevance cleanly through summary, bullet framing, and skill highlights."
    ];
  }

  if (track.includes("wildcard")) {
    return [
      "TRACK GUIDANCE (Wildcard Track):",
      "- Foreground implementation, onboarding, technical customer success, client support, solution adoption, account training, and cross-functional user assistance capabilities.",
      "- CRITICAL FACTUAL CONSTRAINT: Stay transparent about the candidate's actual game-industry job titles and employers. Do NOT invent customer success job titles or fake account management roles.",
      "- Frame technical experience clearly to demonstrate transferable value for client-facing, onboarding, and customer success positions."
    ];
  }

  if (track.includes("labor")) {
    return [
      "TRACK GUIDANCE (Labor Track):",
      "- Strongly prioritize SoundAir maintenance evidence when relevant to the job role (e.g., HVAC maintenance, facility maintenance, mechanical upkeep, tool handling, equipment operation, safety standards, component troubleshooting).",
      "- Highlight practical hands-on experience, physical operations, safety compliance, equipment upkeep, and mechanical reliability.",
      "- Preserve exact official job titles, companies, and employment dates."
    ];
  }

  // Default / Games / 3D track
  return [
    "TRACK GUIDANCE (Games / 3D Track):",
    "- Strongly target environment art, 3D modeling, texturing, material creation, level art, PBR workflows, asset optimization, and game engine integration (Unreal Engine / Unity).",
    "- Highlight spatial composition, modular environment kits, LODs, lighting, and art production pipelines."
  ];
}

const GEMINI_MODEL="gemini-3.5-flash-lite";
const DIRECT_GEMINI_BASE="https://generativelanguage.googleapis.com";
const GATEWAY_GEMINI_BASE="https://gateway.ai.cloudflare.com/v1/0be401023d08048c03bbfbb0576fa89f/raven/google-ai-studio";

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors(req)});
  if(!allowed(req)) return json(req,{error:"Forbidden"},403);
  const apiKey=Deno.env.get("RAVEN_GEMINI_API_KEY")||Deno.env.get("GEMINI_API_KEY")||"";
  if(req.method==="GET"){
    return json(req,{ok:true,service:"raven-generate-v1",provider:"gemini",gateway:"cloudflare-ai-gateway",model:GEMINI_MODEL,configured:Boolean(apiKey)});
  }
  if(req.method!=="POST") return json(req,{error:"GET or POST required"},405);
  if(!apiKey) return json(req,{error:"Online resume generation is not configured. Add RAVEN_GEMINI_API_KEY to Supabase Edge Function secrets."},503);
  let body:any={};
  try{body=JSON.parse(await req.text()||"{}");}catch{return json(req,{error:"Invalid JSON"},400);}
  const jobDescription=String(body.jobDescription||"").trim();
  const masterDataUrl=String(body.masterResume?.dataUrl||"").trim();
  const masterUrl=String(body.masterResume?.url||"").trim();
  let masterMime=String(body.masterResume?.mimeType||"application/pdf").trim()||"application/pdf";
  if(!jobDescription) return json(req,{error:"Job description is required."},400);
  if(!masterDataUrl&&!masterUrl) return json(req,{error:"Master resume file or Google Drive URL is required."},400);

  let budget:any;
  try{
    budget=await requestGuard("generation","gemini",{
      shortLimit:12,shortSeconds:60,
      longLimit:30,longSeconds:3600,
      failureThreshold:3,failureWindowSeconds:300,circuitSeconds:600
    });
  }catch(e){
    return json(req,{error:"Generation safety budget is temporarily unavailable.",code:"REQUEST_BUDGET_UNAVAILABLE",detail:e instanceof Error?e.message:String(e)},503);
  }
  if(!budget?.allowed){
    const circuit=budget?.reason==="circuit-open";
    return json(req,{
      error:circuit?"Gemini generation is temporarily paused after repeated provider failures.":"Generation request budget reached. Try again after the cooldown.",
      code:circuit?"AI_CIRCUIT_OPEN":"REQUEST_BUDGET_EXCEEDED",
      retryable:true,
      retryAfterSeconds:Number(budget?.retry_after_seconds||60)
    },circuit?503:429);
  }
  const budgetEventId=Number(budget.event_id||0)||null;

  // Load generation policies from Supabase raven_generation_policy
  const policies = await fetchGenerationPolicies();

  let masterBase64="";
  if(masterDataUrl){
    const dataMatch=masterDataUrl.match(/^data:([^;,]+)?;base64,(.+)$/s);
    if(!dataMatch){
      await requestFinish(budgetEventId,"rejected",400,"Invalid master resume data URL").catch(()=>{});
      return json(req,{error:"Master resume must be provided as a base64 data URL."},400);
    }
    masterMime=String(dataMatch[1]||masterMime||"application/pdf").trim()||"application/pdf";
    masterBase64=dataMatch[2];
  }else if(masterUrl){
    try{
      const loaded=await loadDriveMaster(masterUrl);
      masterBase64=loaded.base64;
      masterMime=loaded.mimeType;
    }catch(e){
      await requestFinish(budgetEventId,"rejected",400,e instanceof Error?e.message:String(e)).catch(()=>{});
      return json(req,{error:e instanceof Error?e.message:String(e),code:"MASTER_RESUME_SOURCE_ERROR"},400);
    }
  }

  const masterSource = body.masterResume || {};
  const masterSourceText = extractMasterText(masterSource);
  const jobLocation = String(body.jobLocation || body.location || "").trim();
  const trackName = String(body.track || "Professional").trim();

  const documentType=body.documentType==="coverLetter"?"coverLetter":"resume";
  const instructions=String(body.instructions||"").trim();
  const trackGuidance = buildTrackPromptGuidance(trackName, documentType);

  const prompt=documentType==="coverLetter" ? [
    "Create a concise, highly professional tailored cover letter using ONLY facts contained in the MASTER RESUME.",
    "PROSE STYLE REQUIREMENTS:",
    "- Write fluent, natural, cohesive narrative paragraphs linking the candidate's real background to the target job.",
    "- NEVER concatenate raw bullet fragments or use robotic lead-in formulas like 'Relevant experience includes Collaborated with...' or 'Selected achievements include:'.",
    "- Frame candidate accomplishments gracefully (e.g., 'During my tenure at [Company], I managed...', 'My background includes hands-on experience in...', 'I led cross-functional workflows that improved...').",
    "FACTUAL GROUNDING CONSTRAINTS:",
    "- Never invent or infer employers, titles, dates, tools, certifications, metrics, education, achievements, or responsibilities.",
    "- Preserve exact employer names, job titles, education, and dates if referenced.",
    "- Return a greeting, 2-3 well-written paragraphs, a closing, and signature text. Do not include a subject line.",
    ...trackGuidance,
    instructions ? "REVISION INSTRUCTIONS: "+instructions : "",
    "TARGET JOB TITLE: "+String(body.jobTitle||""),
    "TARGET COMPANY: "+String(body.company||""),
    "JOB DESCRIPTION:", jobDescription,
    "MASTER RESUME is attached as the factual source of truth."
  ].filter(Boolean).join("\n") : [
    "Create a tailored, ATS-friendly resume for the target job using ONLY facts contained in the MASTER RESUME.",
    "Never invent or infer employers, titles, dates, tools, certifications, metrics, education, achievements, or responsibilities.",
    "PRESERVE FACTUAL IDENTITY FIELDS EXACTLY as written in the MASTER RESUME: candidate name, contact information, employer names, official job titles, employment dates, school names, degree names, and education dates. Never rewrite, generalize, modernize, or optimize those fields.",
    "You may tailor the headline, summary, skills, and experience bullet wording only when the MASTER RESUME supports the wording.",
    "Mirror important terminology from the JOB DESCRIPTION only when the MASTER RESUME supports that wording.",
    ...trackGuidance,
    "Optimize for ATS and AI-assisted screening without keyword stuffing.",
    "Use conventional sections and concise accomplishment-oriented bullets.",
    "Do not include location for any work-experience entry. Omit city, state, country, remote location, and office location from employment history.",
    "CRITICAL EDUCATION LOCATION RULE: Do not infer, estimate, or fabricate education locations. For each education entry, set location ONLY if an explicit education location is explicitly present in the MASTER RESUME. If the MASTER RESUME does not explicitly list an education location for that institution, set location to an empty string \"\". Do NOT use the candidate's home/current location, school name, target job location, or prior knowledge as the education location.",
    "The rendered resume must fit within TWO US letter pages with normal professional readability.",
    "Keep at most 16 core skills, at most 5 experience entries, and normally 3-4 bullets per recent/relevant role.",
    "Prefer the most relevant and recent material; omit lower-value content rather than shrinking readability.",
    "Do not use tables, columns, graphics, icons, or unusual section names.",
    "Preserve contact information from the master resume when present.",
    "If contact or education information is absent from the master resume, leave contact blank and return an empty education array. Do not insert placeholders such as 'Not Provided', 'N/A', or 'Available Upon Request'.",
    "",
    "TARGET JOB TITLE: "+String(body.jobTitle||""),
    "TARGET COMPANY: "+String(body.company||""),
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "PRECOMPUTED JOB KEYWORDS (deterministic; use only as prioritization hints):",
    Array.isArray(body.jobAnalysis?.keywords) ? body.jobAnalysis.keywords.slice(0,24).join(", ") : "",
    "",
    "MASTER RESUME is attached as the factual source of truth. Read it completely before drafting."
  ].join("\n");

  try{
    let route="cloudflare-ai-gateway";
    let r=await fetch(`${GATEWAY_GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        contents:[{parts:[{text:prompt},{inlineData:{mimeType:masterMime,data:masterBase64}}]}],
        generationConfig:{
          temperature:0.25,
          maxOutputTokens:4500,
          responseMimeType:"application/json",
          responseSchema:documentType==="coverLetter"?coverLetterSchema:resumeSchema
        }
      })
    });
    if(r.status===401||r.status===403){
      route="direct-gemini";
      r=await fetch(`${DIRECT_GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`,{
        method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
        body:JSON.stringify({contents:[{parts:[{text:prompt},{inlineData:{mimeType:masterMime,data:masterBase64}}]}],generationConfig:{temperature:0.25,maxOutputTokens:4500,responseMimeType:"application/json",responseSchema:documentType==="coverLetter"?coverLetterSchema:resumeSchema}})
      });
    }
    const raw=await r.json().catch(()=>({}));
    if(!r.ok){
      const message=raw?.error?.message||("Gemini request failed ("+r.status+")");
      const retryable=retryableProviderStatus(r.status);
      await requestFinish(budgetEventId,"failure",r.status,message).catch(()=>{});
      return json(req,{error:message,code:retryable?"AI_PROVIDER_TEMPORARY":"AI_PROVIDER_ERROR",provider:"gemini",retryable,upstreamStatus:r.status},retryable?503:502);
    }
    const text=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
    if(!text){
      await requestFinish(budgetEventId,"failure",502,"Gemini returned an empty response.").catch(()=>{});
      return json(req,{error:"Gemini returned an empty response."},502);
    }
    let document:any;
    try{
      document=normalizeGeneratedDocument(documentType,JSON.parse(text),policies,masterSource,jobLocation);
    }catch{
      await requestFinish(budgetEventId,"failure",502,"Gemini returned invalid structured output.").catch(()=>{});
      return json(req,{error:"Gemini returned invalid structured output.",code:"AI_OUTPUT_INVALID",provider:"gemini",retryable:true},502);
    }
    const validationError=validateDocument(documentType,document);
    if(validationError){
      await requestFinish(budgetEventId,"failure",502,validationError).catch(()=>{});
      return json(req,{error:validationError,code:"AI_OUTPUT_INVALID",provider:"gemini",retryable:true},502);
    }
    await requestFinish(budgetEventId,"success",200).catch(()=>{});
    return json(req,{ok:true,provider:"gemini",route,model:GEMINI_MODEL,budget:{short_remaining:budget.short_remaining,long_remaining:budget.long_remaining},[documentType==="coverLetter"?"coverLetter":"resume"]:document});
  }catch(e){
    await requestFinish(budgetEventId,"failure",500,e instanceof Error?e.message:String(e)).catch(()=>{});
    return json(req,{error:e instanceof Error?e.message:String(e)},500);
  }
});
