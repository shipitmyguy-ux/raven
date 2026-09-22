import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const TRACKS=new Set(["Professional","Labor","Wildcard","Games / 3D"]);
const GEMINI_MODEL=Deno.env.get("RAVEN_GEMINI_MODEL")||"gemini-3.5-flash-lite";

function cors(req:Request){const origin=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io","Vary":"Origin","Access-Control-Allow-Headers":"content-type,x-raven-client","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});}
function allowed(req:Request){const origin=req.headers.get("origin")||"";if(origin&&!ALLOWED_ORIGINS.has(origin))return false;return req.headers.get("x-raven-client")==="raven-web-v1"||req.method==="GET";}
function env(){const url=Deno.env.get("SUPABASE_URL")||"";const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!url||!key)throw new Error("Supabase environment unavailable");return {url,key};}
async function rest(path:string){const {url,key}=env();const r=await fetch(url+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)throw new Error("Database read failed ("+r.status+")");return await r.json();}
async function rpc(name:string,payload:any){const {url,key}=env();const r=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(payload)});if(!r.ok)throw new Error("RPC failed ("+r.status+")");const t=await r.text();return t?JSON.parse(t):null;}
async function guard(){return await rpc("raven_request_guard",{p_kind:"generation_v2",p_scope:"resume",p_short_limit:12,p_short_seconds:60,p_long_limit:60,p_long_seconds:3600,p_failure_threshold:3,p_failure_window_seconds:300,p_circuit_seconds:600});}
async function finish(id:number|null,status:string,http:number,detail?:string){if(!id)return;await rpc("raven_request_finish",{p_event_id:id,p_status:status,p_http_status:http,p_detail:detail||null}).catch(()=>{});}
function clean(v:any,n=1000){return String(v||"").trim().replace(/\s+/g," ").slice(0,n);}

const selectionSchema={
 type:"object",
 properties:{
   positioning:{type:"string"},
   skills:{type:"array",items:{type:"string"},maxItems:16},
   experiences:{type:"array",maxItems:6,items:{
     type:"object",
     properties:{experience_id:{type:"string"},fact_ids:{type:"array",items:{type:"string"},minItems:1,maxItems:4}},
     required:["experience_id","fact_ids"]
   }},
   additional:{type:"array",items:{type:"string"},maxItems:7}
 },
 required:["positioning","skills","experiences","additional"]
};

async function callGemini(prompt:string,key:string){
  const bases=["https://gateway.ai.cloudflare.com/v1/0be401023d08048c03bbfbb0576fa89f/raven/google-ai-studio","https://generativelanguage.googleapis.com"];
  let last="";
  for(const base of bases){
    const r=await fetch(base+"/v1beta/models/"+GEMINI_MODEL+":generateContent",{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:2200,responseMimeType:"application/json",responseSchema:selectionSchema}})
    });
    const raw=await r.json().catch(()=>({}));
    if(r.ok){
      const text=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
      if(!text)throw new Error("Gemini returned empty output");
      return JSON.parse(text);
    }
    last=raw?.error?.message||("Gemini request failed ("+r.status+")");
    if(r.status!==401&&r.status!==403)break;
  }
  throw new Error(last||"Gemini request failed");
}

function templates(track:string){
  if(track==="Games / 3D") return {
    headline:"Senior Environment Artist",
    summary:"Senior Environment Artist with 17 years of professional game-development experience spanning world building, level development, asset creation, PBR workflows, visual-quality ownership, mentoring, and cross-functional collaboration with design and engineering teams."
  };
  if(track==="Labor") return {
    headline:"Maintenance & Operations Professional",
    summary:"Maintenance and operations professional with hands-on teardown and repair experience on coffee makers used on Boeing 747 and 737 aircraft, backed by extensive experience troubleshooting production issues, improving workflows, collaborating across technical teams, and delivering reliable work on schedule."
  };
  if(track==="Professional") return {
    headline:"Project, Implementation & Operations Professional",
    summary:"Project, implementation, and operations professional with 17 years of experience delivering complex work in cross-functional production environments. Background includes team leadership, mentoring and onboarding, project management, workflow development, troubleshooting, intermediate Excel, automation scripting, and database metadata, reporting, and query experience."
  };
  return {
    headline:"Implementation, Operations & Training Professional",
    summary:"Cross-functional professional with experience leading teams, mentoring and onboarding, managing projects, improving workflows, troubleshooting technical issues, delivering work on schedule, building automation modules, and working with production databases and reporting."
  };
}

function build(profile:any,selection:any,track:string){
  const expMap=new Map<string,any>();
  const expFactMap=new Map<string,Map<string,string>>();
  for(const e of profile.experience||[]){
    expMap.set(e.id,e);
    expFactMap.set(e.id,new Map((e.facts||[]).map((f:any)=>[f.id,clean(f.text,420)])));
  }
  const skillMap=new Map((profile.skills||[]).map((s:string)=>[s.toLowerCase(),s]));
  const skills:string[]=[];
  for(const s0 of selection.skills||[]){const s=skillMap.get(clean(s0,100).toLowerCase());if(s&&!skills.includes(s))skills.push(s);}
  const experience:any[]=[];
  const seen=new Set<string>();
  for(const x of selection.experiences||[]){
    const id=clean(x.experience_id,100);const e=expMap.get(id);const fm=expFactMap.get(id);if(!e||!fm||seen.has(id))continue;
    const bullets:string[]=[];
    for(const fid0 of x.fact_ids||[]){const b=fm.get(clean(fid0,100));if(b&&!bullets.includes(b))bullets.push(b);if(bullets.length>=4)break;}
    if(!bullets.length)continue;
    experience.push({role:e.role,company:e.company,dates:e.dates,bullets});seen.add(id);if(experience.length>=6)break;
  }
  const addMap=new Map((profile.shipped_titles||[]).map((s:string)=>[s.toLowerCase(),s]));
  const additional:string[]=[];
  for(const a0 of selection.additional||[]){const a=addMap.get(clean(a0,180).toLowerCase());if(a&&!additional.includes(a))additional.push(a);}
  const t=templates(track);
  return {
    name:clean(profile.name,120),
    contact:clean(profile.contact,300),
    headline:t.headline,
    summary:t.summary,
    skills:skills.slice(0,16),
    experience,
    education:(profile.education||[]).slice(0,3).map((e:any)=>({degree:clean(e.degree,180),school:clean(e.school,180),location:clean(e.location,120),dates:clean(e.dates,100)})),
    additional:additional.slice(0,7)
  };
}

function validate(resume:any,profile:any,track:string){
  const errs:string[]=[];
  if(resume.name!==clean(profile.name,120))errs.push("name");
  if(resume.contact!==clean(profile.contact,300))errs.push("contact");
  const pe=(profile.education||[])[0],re=(resume.education||[])[0];
  if(pe&&re&&(re.school!==clean(pe.school,180)||re.degree!==clean(pe.degree,180)||re.dates!==clean(pe.dates,100)||re.location!==clean(pe.location,120)))errs.push("education");
  if(track!=="Games / 3D"&&/environment artist/i.test(resume.headline))errs.push("headline");
  if(!resume.experience.length)errs.push("experience");
  if(!resume.skills.length)errs.push("skills");
  return errs;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(!allowed(req))return json(req,{error:"Forbidden"},403);
  if(req.method==="GET")return json(req,{ok:true,service:"raven-generate-v2",version:2,architecture:"canonical-profile+fact-selection",model:GEMINI_MODEL});
  if(req.method!=="POST")return json(req,{error:"GET or POST required"},405);
  let body:any={};try{body=JSON.parse(await req.text()||"{}");}catch{return json(req,{error:"Invalid JSON"},400);}
  const track=String(body.track||"Professional");if(!TRACKS.has(track))return json(req,{error:"Invalid track"},400);
  const title=clean(body.jobTitle,240),company=clean(body.company,240),desc=clean(body.jobDescription||body.description,12000);
  if(!title||!desc)return json(req,{error:"Job title and description are required."},400);

  const rows=await rest("raven_canonical_profiles?profile_key=eq.default&select=profile&limit=1");const profile=rows?.[0]?.profile;if(!profile)return json(req,{error:"Canonical profile missing"},503);
  let b:any;try{b=await guard();}catch(e){return json(req,{error:"Generation safety budget unavailable",detail:String(e)},503);}
  if(!b?.allowed)return json(req,{error:"Generation request budget reached.",code:"REQUEST_BUDGET_EXCEEDED",retryable:true,retryAfterSeconds:Number(b?.retry_after_seconds||60)},429);
  const eid=Number(b.event_id||0)||null;
  const guidance:any={
    "Games / 3D":"Select environment-art, world-building, engine, PBR, visual-quality, mentoring, and shipped-game facts relevant to the posting.",
    "Labor":"Lead with SoundAir maintenance and repair facts. Then select only technical troubleshooting, workflow, teamwork, and reliable-delivery facts that genuinely transfer. Do not make game-art facts sound like mechanical work.",
    "Professional":"Select leadership, project-management, onboarding/training, cross-functional delivery, workflow, troubleshooting, Excel, automation, database/reporting, and relevant technical-collaboration evidence. De-emphasize narrow art-production details.",
    "Wildcard":"Select the strongest factual bridge to this target role: operations, training, onboarding, project coordination, troubleshooting, collaboration, automation, and delivery. Do not imply direct customer-success, account-management, SaaS, or implementation experience unless an explicit canonical fact supports it."
  };
  const compactProfile={
    skills:profile.skills,
    experience:(profile.experience||[]).map((e:any)=>({id:e.id,role:e.role,company:e.company,dates:e.dates,facts:e.facts})),
    transferable_facts:profile.transferable_facts,
    shipped_titles:profile.shipped_titles
  };
  const prompt=[
    "Select the most relevant canonical resume facts for the target job. Do not rewrite facts and do not invent anything.",
    "Return only IDs and exact allowed skill/additional strings using the schema.",
    "TRACK: "+track,
    "GUIDANCE: "+guidance[track],
    "TARGET: "+title+" at "+company,
    "JOB DESCRIPTION:",desc,
    "CANONICAL FACT CATALOG:",JSON.stringify(compactProfile)
  ].join("\n\n");
  try{
    const key=Deno.env.get("RAVEN_GEMINI_API_KEY")||Deno.env.get("GEMINI_API_KEY")||"";if(!key)throw new Error("Gemini not configured");
    const selection=await callGemini(prompt,key);
    const resume=build(profile,selection,track);
    const errors=validate(resume,profile,track);
    if(errors.length){await finish(eid,"failure",502,errors.join(","));return json(req,{error:"Deterministic validation failed",validation_errors:errors},502);}
    await finish(eid,"success",200);
    return json(req,{ok:true,provider:"gemini",model:GEMINI_MODEL,architecture:"canonical-profile+fact-selection",selection,validation_errors:[],budget:{short_remaining:b.short_remaining,long_remaining:b.long_remaining},resume});
  }catch(e){const m=e instanceof Error?e.message:String(e);await finish(eid,"failure",500,m);return json(req,{error:m},500);}
});