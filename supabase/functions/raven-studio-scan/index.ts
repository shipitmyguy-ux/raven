import "../_shared/track-filter.js";
import {MAX_STUDIO_JOBS, providerEndpoint, providerRecords, normalizeStudioJobs, deduplicateStudioJobs} from "../_shared/studio-providers.mjs";
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
async function sourceJobs(s:any){
 const all:any[]=[];
 for(let page=0;page<10;page++){
  const url=providerEndpoint(s.provider,s.board_key,page*100);
  const res=await fetch(url,{headers:{"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(6000)});
  if(!res.ok)throw Error("Provider HTTP "+res.status);
  const length=Number(res.headers.get("content-length")||0);
  if(length>4000000)throw Error("Provider response too large");
  // Stream with a hard cap, including chunked responses without Content-Length.
  if(!res.body)throw Error("Provider response empty");
  const reader=res.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000)throw Error("Provider response too large");chunks.push(value);}}
  finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  const records=providerRecords(s.provider,data);
  all.push(...normalizeStudioJobs(s,data));
  if(all.length>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
  if(s.provider!=="smartrecruiters"){
   if(records.length>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
   return deduplicateStudioJobs(all);
  }
  const total=Number(data.totalFound);
  if(!Number.isInteger(total)||total<0)throw Error("Unexpected provider pagination");
  if(total>MAX_STUDIO_JOBS)throw Error("Provider job limit exceeded");
  if((page*100)+records.length>=total)return deduplicateStudioJobs(all);
  if(records.length!==100)throw Error("Incomplete provider page");
 }
 throw Error("Provider page limit exceeded");
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
   const studios=await db("raven_studio_sources?select=studio_name,slug,provider,careers_url,priority,enabled,next_check_at,interval_hours,last_status,last_checked_at,last_success_at,last_job_count,last_error&order=priority.desc,studio_name.asc&limit=500");
   return json({ok:true,count:studios.length,studios});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  if(!await auth(request))return json({error:"Unauthorized"},401);
  const due=await db("raven_studio_sources?select=id,studio_name,slug,provider,board_key,interval_hours&enabled=eq.true&provider=neq.pending&next_check_at=lte."+encodeURIComponent(new Date().toISOString())+"&order=priority.desc,next_check_at.asc&limit=6");
  const results=[];for(let i=0;i<due.length;i+=2)results.push(...await Promise.all(due.slice(i,i+2).map(check)));
  return json({ok:true,checked:results.length,results});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},500);}
});
