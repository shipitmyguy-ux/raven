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
  properties:{greeting:{type:"string"},paragraphs:{type:"array",items:{type:"string"}},closing:{type:"string"},signature:{type:"string"}},
  required:["greeting","paragraphs","closing","signature"]
};
const resumeSchema={
  type:"object",
  properties:{
    name:{type:"string"},
    contact:{type:"string"},
    headline:{type:"string"},
    summary:{type:"string"},
    skills:{type:"array",items:{type:"string"}},
    experience:{
      type:"array",
      items:{
        type:"object",
        properties:{
          role:{type:"string"},
          company:{type:"string"},
          dates:{type:"string"},
          bullets:{type:"array",items:{type:"string"}}
        },
        required:["role","company","dates","bullets"]
      }
    },
    education:{
      type:"array",
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
    additional:{type:"array",items:{type:"string"}}
  },
  required:["name","contact","headline","summary","skills","experience","education","additional"]
};

function validString(value:unknown){return typeof value==="string"&&value.trim().length>0;}
function validateDocument(type:string,doc:any){
  if(!doc||typeof doc!=="object") return "AI returned no structured document.";
  if(type==="coverLetter"){
    if(!validString(doc.greeting)||!Array.isArray(doc.paragraphs)||doc.paragraphs.length<2||doc.paragraphs.length>4||doc.paragraphs.some((p:any)=>!validString(p))||!validString(doc.closing)||!validString(doc.signature)) return "AI returned an incomplete cover letter.";
    return "";
  }
  if(!validString(doc.name)||!validString(doc.summary)||!Array.isArray(doc.skills)||!Array.isArray(doc.experience)||!doc.experience.length||!Array.isArray(doc.education)||!Array.isArray(doc.additional)) return "AI returned an incomplete resume.";
  if(doc.skills.length>20) return "AI returned too many skills.";
  if(doc.experience.some((x:any)=>!x||!validString(x.role)||!validString(x.company)||!validString(x.dates)||!Array.isArray(x.bullets)||!x.bullets.length)) return "AI returned malformed experience history.";
  return "";
}
function retryableProviderStatus(status:number){return status===408||status===429||status>=500;}
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
  const masterMime=String(body.masterResume?.mimeType||"application/pdf").trim()||"application/pdf";
  if(!jobDescription) return json(req,{error:"Job description is required."},400);
  if(!masterDataUrl) return json(req,{error:"Master resume file is required."},400);
  const dataMatch=masterDataUrl.match(/^data:([^;,]+)?;base64,(.+)$/s);
  if(!dataMatch) return json(req,{error:"Master resume must be provided as a base64 data URL."},400);
  const masterBase64=dataMatch[2];

  const documentType=body.documentType==="coverLetter"?"coverLetter":"resume";
  const instructions=String(body.instructions||"").trim();
  const prompt=documentType==="coverLetter" ? [
    "Create a concise, professional tailored cover letter using ONLY facts contained in the MASTER RESUME.",
    "Never invent or infer employers, titles, dates, tools, certifications, metrics, education, achievements, or responsibilities.",
    "Use terminology from the JOB DESCRIPTION only where supported by the MASTER RESUME.",
    "Return a greeting, 2-3 short paragraphs, a closing, and signature text. Do not include a subject line.",
    instructions ? "REVISION INSTRUCTIONS: "+instructions : "",
    "TARGET JOB TITLE: "+String(body.jobTitle||""),
    "TARGET COMPANY: "+String(body.company||""),
    "JOB DESCRIPTION:", jobDescription,
    "MASTER RESUME is attached as the factual source of truth."
  ].filter(Boolean).join("\\n") : [
    "Create a tailored, ATS-friendly resume for the target job using ONLY facts contained in the MASTER RESUME.",
    "Never invent or infer employers, titles, dates, tools, certifications, metrics, education, achievements, or responsibilities.",
    "PRESERVE FACTUAL IDENTITY FIELDS EXACTLY as written in the MASTER RESUME: candidate name, contact information, employer names, official job titles, employment dates, school names, degree names, and education dates. Never rewrite, generalize, modernize, or optimize those fields.",
    "You may tailor the headline, summary, skills, and experience bullet wording only when the MASTER RESUME supports the wording.",
    "Mirror important terminology from the JOB DESCRIPTION only when the MASTER RESUME supports that wording.",
    "Optimize for ATS and AI-assisted screening without keyword stuffing.",
    "Use conventional sections and concise accomplishment-oriented bullets.",
    "Do not include location for any work-experience entry. Omit city, state, country, remote location, and office location from employment history.",
    "The rendered resume must fit within TWO US letter pages with normal professional readability.",
    "Keep at most 16 core skills, at most 5 experience entries, and normally 3-4 bullets per recent/relevant role.",
    "Prefer the most relevant and recent material; omit lower-value content rather than shrinking readability.",
    "Do not use tables, columns, graphics, icons, or unusual section names.",
    "Preserve contact information from the master resume when present.",
    "",
    "TARGET JOB TITLE: "+String(body.jobTitle||""),
    "TARGET COMPANY: "+String(body.company||""),
    "TRACK: "+String(body.track||""),
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "PRECOMPUTED JOB KEYWORDS (deterministic; use only as prioritization hints):",
    Array.isArray(body.jobAnalysis?.keywords) ? body.jobAnalysis.keywords.slice(0,24).join(", ") : "",
    "",
    "MASTER RESUME is attached as the factual source of truth. Read it completely before drafting."
  ].join("\\n");

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
      return json(req,{error:message,code:retryable?"AI_PROVIDER_TEMPORARY":"AI_PROVIDER_ERROR",provider:"gemini",retryable,upstreamStatus:r.status},retryable?503:502);
    }
    const text=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
    if(!text) return json(req,{error:"Gemini returned an empty response."},502);
    let document:any;
    try{document=JSON.parse(text);}catch{return json(req,{error:"Gemini returned invalid structured output.",code:"AI_OUTPUT_INVALID",provider:"gemini",retryable:true},502);}
    const validationError=validateDocument(documentType,document);
    if(validationError) return json(req,{error:validationError,code:"AI_OUTPUT_INVALID",provider:"gemini",retryable:true},502);
    return json(req,{ok:true,provider:"gemini",route,model:GEMINI_MODEL,[documentType==="coverLetter"?"coverLetter":"resume"]:document});
  }catch(e){
    return json(req,{error:e instanceof Error?e.message:String(e)},500);
  }
});