import "../_shared/track-filter.js";
import {MAX_STUDIO_JOBS, providerEndpoint, providerRecords, normalizeStudioJobs, deduplicateStudioJobs} from "../_shared/studio-providers.mjs";
import {fetchStudioJson, enrichStudioDetails, reuseFreshStudioDescriptions} from "../_shared/studio-collector.mjs";
const {gameArtRoleAllowed,jobLocationAllowed}=(globalThis as any).RavenTrackFilter;
const base=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-raven-studio-secret","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}});
async function db(path:string,method="GET",body?:unknown){
 const r=await fetch(base+"/rest/v1/"+path,{method,headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":method==="GET"?"return=representation":"resolution=merge-duplicates,return=minimal"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error("DB "+r.status+" "+(await r.text()).slice(0,200));
 const text=await r.text();return text?JSON.parse(text):[];
}
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
async function sourceJobs(s:any,deadline:number){
 const all:any[]=[];let fetched=0;
 for(let page=0;page<10;page++){
  if(Date.now()+6000>deadline)throw Error("Source scan time budget exceeded");
  const url=providerEndpoint(s.provider,s.board_key,page*100);
  const data=await fetchStudioJson(url);
  const records=providerRecords(s.provider,data);
  if(s.provider==="bamboohr"&&(!Number.isInteger(data.meta?.totalCount)||data.meta.totalCount!==records.length))throw Error("Incomplete provider page");
  fetched+=records.length;
  all.push(...normalizeStudioJobs(s,data));
  if(all.length>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
  if(s.provider!=="smartrecruiters"){
   if(records.length>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
   return {jobs:deduplicateStudioJobs(all),fetched};
  }
  const total=Number(data.totalFound);
  if(!Number.isInteger(total)||total<0)throw Error("Unexpected provider pagination");
  if(total>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
  if((page*100)+records.length>=total)return {jobs:deduplicateStudioJobs(all),fetched};
  if(records.length!==100)throw Error("Incomplete provider page");
 }
 throw Error("Provider page limit exceeded");
}
async function check(s:any,tickDeadline:number){
 const start=Date.now(),deadline=Math.min(tickDeadline,start+75000);let status="ok",error="",total=0,eligible=0,details:any={status:"not_checked",error:null};
 try{
  const collected=await sourceJobs(s,deadline);const jobs=collected.jobs;total=collected.fetched;
  const selected=jobs.filter((j:any)=>gameArtRoleAllowed(j)&&jobLocationAllowed(j));
  eligible=selected.length;
  // Reuse stored descriptions so later scans fill the next missing batch.
  for(let i=0;i<selected.length;i+=20){
   const batch=selected.slice(i,i+20),urls=batch.map((j:any)=>'"'+j.url.replace(/"/g,'\\"')+'"').join(',');
   const existing=await db("raven_search_results?select=url,snippet,studio_description_updated_at&url=in."+encodeURIComponent('('+urls+')'));
   reuseFreshStudioDescriptions(batch,existing);
  }
  details=await enrichStudioDetails(s,selected,{deadline});
  const seen=new Date().toISOString();
  for(const group of [selected.filter((j:any)=>!!j.snippet),selected.filter((j:any)=>!j.snippet)])for(let i=0;i<group.length;i+=35)await db("raven_search_results?on_conflict=url","POST",group.slice(i,i+35).map((j:any)=>({
   track:"Games / 3D",title:j.title,company:j.company,location:j.location,remote:j.remote,
   url:j.url,...(j.snippet?{snippet:j.snippet,studio_description_updated_at:j.studio_description_updated_at||seen}:{}),source:"Studio:"+s.provider,score:12,status:"Discovered",last_seen:seen
  })));
 }catch(e){status="failed";error=String(e instanceof Error?e.message:e);}
 const checked=new Date().toISOString();
 await db("raven_studio_sources?id=eq."+s.id,"PATCH",{
  last_checked_at:checked,...(status==="ok"?{last_success_at:checked}:{}),
  next_check_at:new Date(Date.now()+Math.max(status==="ok"?6:12,s.interval_hours)*3600000).toISOString(),
  last_status:status,last_error:error||null,...(status==="ok"?{last_job_count:eligible}:{}),updated_at:checked,
  consecutive_failures:status==="ok"?0:Number(s.consecutive_failures||0)+1,
  health_status:status==="ok"?(details.status==="partial"||details.status==="failed"?"degraded":"healthy"):(Number(s.consecutive_failures||0)+1>=3?"broken":"failing"),
  detail_health_status:details.status,detail_error:details.error
 });
 await db("raven_studio_checks","POST",{source_id:s.id,status,fetched:total,eligible,duration_ms:Date.now()-start,error:error||null,detail_attempted:details.attempted||0,detail_completed:details.completed||0,detail_deferred:details.deferred||0,detail_error:details.error});
 return {studio:s.studio_name,status,fetched:total,eligible,details,error:error||undefined};
}
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  if(!base||!key)return json({error:"Backend credentials missing"},503);
  if(request.method==="GET"){
   const studios=await db("raven_studio_sources?select=studio_name,slug,provider,job_scope,verification_status,verification_note,source_verified_at,careers_url,priority,enabled,next_check_at,interval_hours,last_status,last_checked_at,last_success_at,last_job_count,last_error,consecutive_failures,health_status,detail_health_status,detail_error&order=priority.desc,studio_name.asc&limit=500");
   return json({ok:true,count:studios.length,studios});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  if(!await auth(request))return json({error:"Unauthorized"},401);
  const due=await db("raven_studio_sources?select=id,studio_name,slug,provider,board_key,interval_hours,job_scope,consecutive_failures&enabled=eq.true&provider=neq.pending&next_check_at=lte."+encodeURIComponent(new Date().toISOString())+"&order=priority.desc,next_check_at.asc&limit=6");
  const results=[],tickDeadline=Date.now()+140000;for(let i=0;i<due.length;i+=2){if(Date.now()+8000>tickDeadline)break;results.push(...await Promise.all(due.slice(i,i+2).map((s:any)=>check(s,tickDeadline))));}
  return json({ok:true,checked:results.length,results});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},500);}
});
