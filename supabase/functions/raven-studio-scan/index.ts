import "../_shared/track-filter.js";
const {gameArtRoleAllowed,jobLocationAllowed}=(globalThis as any).RavenTrackFilter;
const base=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-raven-studio-secret","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}});
async function db(path:string,method="GET",body?:unknown){
 const r=await fetch(base+"/rest/v1/"+path,{method,headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":method==="GET"?"return=representation":"resolution=merge-duplicates,return=minimal"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error("DB "+r.status+" "+(await r.text()).slice(0,200));
 return r.status===204?[]:await r.json();
}
const clean=(s:any)=>String(s||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,5000);
function uri(raw:any){try{const u=new URL(raw);if(u.protocol!=="https:")return "";u.hash="";for(const k of [...u.searchParams.keys()])if(/^utm_/.test(k))u.searchParams.delete(k);return u.toString();}catch{return "";}}
async function auth(request:Request){
 const secret=request.headers.get("x-raven-studio-secret")||"";
 if(!/^[0-9a-f]{64}$/.test(secret))return false;
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
 const hash=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const records=await db("raven_studio_cron_auth?select=token_hash&id=eq.1");
 const expected=String(records[0]?.token_hash||"");
 if(hash.length!==expected.length)return false;
 let diff=0;for(let i=0;i<hash.length;i++)diff|=hash.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
async function sourceJobs(s:any){
 const k=String(s.board_key||"");
 if(!/^[a-zA-Z0-9_-]{2,90}$/.test(k))throw Error("Bad board ID");
 let url="";
 if(s.provider==="ashby")url="https://api.ashbyhq.com/posting-api/job-board/"+k;
 if(s.provider==="greenhouse")url="https://boards-api.greenhouse.io/v1/boards/"+k+"/jobs?content=true";
 if(s.provider==="lever")url="https://api.lever.co/v0/postings/"+k+"?mode=json";
 if(!url)throw Error("Unsupported provider");
 const res=await fetch(url,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(6000)});
 if(!res.ok)throw Error("Provider HTTP "+res.status);
 const data=await res.json();
 let jobs:any[]=s.provider==="lever"?data:data.jobs;
 if(!Array.isArray(jobs))throw Error("Unexpected provider response");
 return jobs.slice(0,250).map((x:any)=>{
  const title=String(x.title||x.text||"");
  const location=String(typeof x.location==="string"?x.location:x.location?.name||x.categories?.location||"");
  const remote=x.isRemote===true||/remote/i.test(String(x.workplaceType||""))||/\bremote\b/i.test(location);
  const url=uri(x.jobUrl||x.absolute_url||x.hostedUrl);
  return {title,company:s.studio_name,location,remote,url,snippet:clean(x.descriptionPlain||x.descriptionHtml||x.content||x.description),posted_at:String(x.publishedAt||x.updated_at||"")};
 }).filter((j:any)=>j.title&&j.url);
}
async function check(s:any){
 const start=Date.now();let status="ok",error="",total=0,eligible=0;
 try{
  const jobs=await sourceJobs(s);total=jobs.length;
  const selected=jobs.filter((j:any)=>gameArtRoleAllowed(j)&&jobLocationAllowed(j));
  eligible=selected.length;
  const seen=new Date().toISOString();
  for(let i=0;i<selected.length;i+=35)await db("raven_search_results?on_conflict=url","POST",selected.slice(i,i+35).map((j:any)=>({
   track:"Games / 3D",title:j.title,company:j.company,location:j.location,remote:j.remote,
   url:j.url,snippet:j.snippet,source:"Studio:"+s.provider,score:12,status:"Discovered",last_seen:seen
  })));
 }catch(e){status="failed";error=String(e instanceof Error?e.message:e);}
 const checked=new Date().toISOString();
 await db("raven_studio_sources?id=eq."+s.id,"PATCH",{
  last_checked_at:checked,...(status==="ok"?{last_success_at:checked}:{}),
  next_check_at:new Date(Date.now()+Math.max(status==="ok"?6:12,s.interval_hours)*3600000).toISOString(),
  last_status:status,last_error:error||null,last_job_count:eligible,updated_at:checked
 });
 await db("raven_studio_checks","POST",{source_id:s.id,status,fetched:total,eligible,duration_ms:Date.now()-start,error:error||null});
 return {studio:s.studio_name,status,fetched:total,eligible,error:error||undefined};
}
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  if(!base||!key)return json({error:"Backend credentials missing"},503);
  if(request.method==="GET"){
   const studios=await db("raven_studio_sources?select=studio_name,slug,provider,careers_url,priority,last_status,last_checked_at,last_success_at,last_job_count,last_error&order=priority.desc,studio_name.asc&limit=500");
   return json({ok:true,count:studios.length,studios});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  if(!await auth(request))return json({error:"Unauthorized"},401);
  const due=await db("raven_studio_sources?select=id,studio_name,slug,provider,board_key,interval_hours&enabled=eq.true&provider=neq.pending&next_check_at=lte."+encodeURIComponent(new Date().toISOString())+"&order=priority.desc,next_check_at.asc&limit=6");
  const results=[];for(let i=0;i<due.length;i+=2)results.push(...await Promise.all(due.slice(i,i+2).map(check)));
  return json({ok:true,checked:results.length,results});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},500);}
});
