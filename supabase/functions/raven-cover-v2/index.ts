import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const TRACKS=new Set(["Professional","Labor","Wildcard","Games / 3D"]);
const MODEL=Deno.env.get("RAVEN_GEMINI_MODEL")||"gemini-3.5-flash-lite";
function cors(req:Request){const o=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(o)?o:"https://shipitmyguy-ux.github.io","Vary":"Origin","Access-Control-Allow-Headers":"content-type,x-raven-client","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};}
function json(req:Request,d:unknown,s=200){return new Response(JSON.stringify(d),{status:s,headers:cors(req)});}
function allowed(req:Request){const o=req.headers.get("origin")||"";if(o&&!ALLOWED_ORIGINS.has(o))return false;return req.headers.get("x-raven-client")==="raven-web-v1";}
function env(){const url=Deno.env.get("SUPABASE_URL")||"";const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!url||!key)throw new Error("Supabase unavailable");return {url,key};}
async function rest(path:string){const {url,key}=env();const r=await fetch(url+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)throw new Error("DB read failed");return await r.json();}
async function rpc(name:string,p:any){const {url,key}=env();const r=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(p)});if(!r.ok)throw new Error("RPC failed");const t=await r.text();return t?JSON.parse(t):null;}
async function guard(){return await rpc("raven_request_guard",{p_kind:"generation_v2",p_scope:"cover",p_short_limit:12,p_short_seconds:60,p_long_limit:60,p_long_seconds:3600,p_failure_threshold:3,p_failure_window_seconds:300,p_circuit_seconds:600});}
async function finish(id:number|null,status:string,http:number,detail?:string){if(!id)return;await rpc("raven_request_finish",{p_event_id:id,p_status:status,p_http_status:http,p_detail:detail||null}).catch(()=>{});}
function clean(v:any,n=1000){return String(v||"").trim().replace(/\s+/g," ").slice(0,n);}

const schema={
 type:"object",
 properties:{
   experience_fact_ids:{type:"array",items:{type:"string"},minItems:2,maxItems:6},
   transferable_fact_ids:{type:"array",items:{type:"string"},maxItems:5}
 },
 required:["experience_fact_ids","transferable_fact_ids"]
};
async function selectFacts(prompt:string,key:string){
  const models=[MODEL,Deno.env.get("RAVEN_GEMINI_FALLBACK_MODEL")||"gemini-3.5-flash","gemini-3.1-flash-lite"].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const bases=["https://gateway.ai.cloudflare.com/v1/0be401023d08048c03bbfbb0576fa89f/raven/google-ai-studio","https://generativelanguage.googleapis.com"];
  let last="";
  for(const model of models){
    for(const base of bases){
      const r=await fetch(base+"/v1beta/models/"+model+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:1200,responseMimeType:"application/json",responseSchema:schema}})});
      const raw=await r.json().catch(()=>({}));
      if(r.ok){const t=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";if(!t)throw new Error("Empty model output");return {data:JSON.parse(t),model};}
      last=raw?.error?.message||("Gemini failed "+r.status);
      if(r.status!==401&&r.status!==403&&r.status!==429&&r.status<500)break;
    }
  }
  throw new Error(last||"Gemini failed");
}
function sentenceList(items:string[]){
  if(items.length===1)return items[0];
  if(items.length===2)return items[0]+" and "+items[1].charAt(0).toLowerCase()+items[1].slice(1);
  return items.slice(0,-1).join(" ")+" "+items[items.length-1];
}
function build(profile:any,sel:any,track:string,title:string,company:string){
  const expFacts=new Map<string,string>();
  for(const e of profile.experience||[])for(const f of e.facts||[])expFacts.set(f.id,clean(f.text,420));
  const xfer=new Map<string,string>((profile.transferable_facts||[]).map((f:any)=>[f.id,clean(f.text,420)]));
  const chosenExp:string[]=[];
  for(const id0 of sel.experience_fact_ids||[]){const t=expFacts.get(clean(id0,100));if(t&&!chosenExp.includes(t))chosenExp.push(t);}
  const chosenX:string[]=[];
  for(const id0 of sel.transferable_fact_ids||[]){const t=xfer.get(clean(id0,100));if(t&&!chosenX.includes(t))chosenX.push(t);}
  const factual=[...chosenExp,...chosenX].slice(0,6);
  if(factual.length<2)throw new Error("Insufficient supported facts selected");

  const p1="I am interested in the "+title+" position at "+company+".";
  const p2="Examples that may transfer to this role include: "+factual.map(x=>x.replace(/[.]$/,"")).join("; ")+". ";
  const p3=track==="Games / 3D"
    ? "I would welcome the opportunity to bring that experience to "+company+" and contribute to the team's visual and production goals."
    : "I would welcome the opportunity to discuss how these transferable strengths could support "+company+" in this role.";
  return {greeting:"Dear Hiring Manager,",paragraphs:[p1,p2,p3],closing:"Sincerely,",signature:clean(profile.name,120)};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(!allowed(req))return json(req,{error:"Forbidden"},403);
  if(req.method==="GET")return json(req,{ok:true,service:"raven-cover-v2",architecture:"canonical-profile+fact-selection",model:MODEL});
  if(req.method!=="POST")return json(req,{error:"GET or POST required"},405);
  let b:any={};try{b=JSON.parse(await req.text()||"{}");}catch{return json(req,{error:"Invalid JSON"},400);}
  const track=String(b.track||"Professional"),title=clean(b.jobTitle,240),company=clean(b.company,240),desc=clean(b.jobDescription||b.description,12000);
  if(!TRACKS.has(track)||!title||!company||!desc)return json(req,{error:"Track, title, company, and description are required"},400);
  const rows=await rest("raven_canonical_profiles?profile_key=eq.default&select=profile&limit=1");const profile=rows?.[0]?.profile;if(!profile)return json(req,{error:"Canonical profile missing"},503);
  let g:any;try{g=await guard();}catch(e){return json(req,{error:"Generation budget unavailable"},503);}
  if(!g?.allowed)return json(req,{error:"Generation request budget reached.",code:"REQUEST_BUDGET_EXCEEDED",retryable:true,retryAfterSeconds:Number(g?.retry_after_seconds||60)},429);
  const eid=Number(g.event_id||0)||null;
  try{
    const catalog={experience:(profile.experience||[]).flatMap((e:any)=>(e.facts||[]).map((f:any)=>({id:f.id,text:f.text}))),transferable_facts:profile.transferable_facts||[]};
    const prompt=["Select the strongest factual evidence for a concise cover letter. Return IDs only. Do not invent or rewrite facts.","TRACK: "+track,"TARGET: "+title+" at "+company,"JOB DESCRIPTION:",desc,"FACT CATALOG:",JSON.stringify(catalog)].join("\n\n");
    const key=Deno.env.get("RAVEN_GEMINI_API_KEY")||Deno.env.get("GEMINI_API_KEY")||"";if(!key)throw new Error("Gemini not configured");
    const generated=await selectFacts(prompt,key);
    const sel=generated.data;
    const coverLetter=build(profile,sel,track,title,company);
    await finish(eid,"success",200);
    return json(req,{ok:true,provider:"gemini",model:generated.model,architecture:"canonical-profile+fact-selection",selection:sel,coverLetter});
  }catch(e){const m=e instanceof Error?e.message:String(e);await finish(eid,"failure",500,m);return json(req,{error:m},500);}
});