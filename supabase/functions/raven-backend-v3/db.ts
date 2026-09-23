import type { Candidate, Track } from "./types.ts";
import { validAtsRow } from "./csv-records.mjs";

function isPersistableCandidate(c:Candidate){
  const title=String(c?.title||"").trim();
  const url=String(c?.url||"").trim();
  const source=String(c?.source||"");
  if(!title) return false;
  let parsed:URL;
  try{ parsed=new URL(url); }catch{ return false; }
  if(parsed.protocol!=="http:"&&parsed.protocol!=="https:") return false;
  if(/^ATS:/i.test(source) && !validAtsRow(title,url)) return false;
  return true;
}

function env(){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) throw new Error("Supabase server environment is unavailable");
  return {url,key};
}

async function rest(path:string,init:RequestInit={}){
  const {url,key}=env();
  const headers=new Headers(init.headers||{});
  headers.set("apikey",key);
  headers.set("Authorization","Bearer "+key);
  if(init.body && !headers.has("Content-Type")) headers.set("Content-Type","application/json");
  const r=await fetch(url+"/rest/v1/"+path,{...init,headers});
  return r;
}

export async function upsertResults(rows:Candidate[]){
  const validRows=rows.filter(isPersistableCandidate);
  if(!validRows.length) return;
  const now=new Date().toISOString();
  const body=validRows.map(c=>({
    track:c.track||"Professional",
    title:c.title||"",
    company:c.company||null,
    location:c.location||null,
    remote:Boolean(c.remote),
    salary_text:c.salary_text||null,
    url:c.url||"",
    source:c.source||null,
    snippet:c.snippet||null,
    score:Number.isFinite(Number(c.score))?Number(c.score):0,
    status:"Discovered",
    last_seen:now
  }));
  const r=await rest("raven_search_results?on_conflict=url",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const detail=await r.text().catch(()=>"");
    throw new Error("Database write failed ("+r.status+"): "+detail.slice(0,1200));
  }
}

export async function listResults(track:Track){
  // Discovered results are ephemeral. Hide entries not seen by any source in
  // the last 30 days; saved/bookmarked/applied jobs live in raven_jobs and are
  // never removed by this freshness filter.
  const cutoff=new Date(Date.now()-30*86400000).toISOString();
  const q="raven_search_results?select=id,track,title,company,location,remote,salary_text,url,source,snippet,score,status,created_at,last_seen&track=eq."+encodeURIComponent(track)+"&status=eq.Discovered&last_seen=gte."+encodeURIComponent(cutoff)+"&order=score.desc,last_seen.desc&limit=100";
  const r=await rest(q,{method:"GET"});
  if(!r.ok) throw new Error("Database read failed ("+r.status+")");
  return await r.json();
}

export async function updateDescription(url:string,c:Candidate){
  const body={
    snippet:c.snippet||null,
    company:c.company||null,
    location:c.location||null,
    remote:Boolean(c.remote),
    salary_text:c.salary_text||null,
    last_seen:new Date().toISOString()
  };
  const r=await rest("raven_search_results?url=eq."+encodeURIComponent(url),{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error("Description save failed ("+r.status+")");
}

async function closeStaleRuns(track:Track){
  const cutoff=new Date(Date.now()-3*60*1000).toISOString();
  await rest("raven_search_runs?track=eq."+encodeURIComponent(track)+"&status=eq.running&created_at=lt."+encodeURIComponent(cutoff),{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status:"failed",result_count:0,error:"stale background search automatically closed"})
  }).catch(()=>{});
}

export async function createRun(track:Track,queryCount:number){
  await closeStaleRuns(track);
  const r=await rest("raven_search_runs",{
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify({track,status:"running",query_count:queryCount,result_count:0})
  });
  if(!r.ok) return null;
  const rows=await r.json();
  return rows?.[0]?.id||null;
}

export async function finishRun(id:string|null,status:string,resultCount:number,error?:string){
  if(!id) return;
  await rest("raven_search_runs?id=eq."+encodeURIComponent(id),{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status,result_count:resultCount,error:error||null})
  }).catch(()=>{});
}

export async function deepSearchCooldown(track:Track,seconds=60){
  const cutoff=new Date(Date.now()-seconds*1000).toISOString();
  const r=await rest("raven_search_runs?select=id&track=eq."+encodeURIComponent(track)+"&created_at=gte."+encodeURIComponent(cutoff)+"&limit=1",{method:"GET"});
  if(!r.ok) return false;
  const rows=await r.json();
  return Array.isArray(rows)&&rows.length>0;
}

export async function deepSearchRunning(track:Track){
  const cutoff=new Date(Date.now()-2*60*1000).toISOString();
  const r=await rest("raven_search_runs?select=id&track=eq."+encodeURIComponent(track)+"&status=eq.running&created_at=gte."+encodeURIComponent(cutoff)+"&limit=1",{method:"GET"});
  if(!r.ok) return false;
  const rows=await r.json();
  return Array.isArray(rows)&&rows.length>0;
}

export async function getCommute(key:string){
  const r=await rest("raven_commute_cache?select=minutes,updated_at&location_key=eq."+encodeURIComponent(key)+"&limit=1",{method:"GET"});
  if(!r.ok) return null;
  const rows=await r.json();
  return rows?.[0]||null;
}

export async function putCommute(location_key:string,location_text:string,minutes:number){
  await rest("raven_commute_cache?on_conflict=location_key",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({location_key,location_text,minutes,updated_at:new Date().toISOString()})
  });
}


export type RavenJob = {
  id:string; added:string; track:string; title:string; company:string; location:string; remote:boolean;
  salary_min:number|null; salary_max:number|null; salary_text:string; url:string; source:string; status:string;
  viewed:boolean; applied_date:string|null; follow_up:string|null; resume:string; cover_letter:string; notes:string; last_updated:string;
};

export async function listJobs(){
  const r=await rest("raven_jobs?select=*&order=last_updated.desc&limit=1000",{method:"GET"});
  if(!r.ok) throw new Error("Jobs read failed ("+r.status+")");
  return await r.json();
}
export async function getJobByUrl(url:string){
  const r=await rest("raven_jobs?select=*&url=eq."+encodeURIComponent(url)+"&limit=1",{method:"GET"});
  if(!r.ok) throw new Error("Job lookup failed ("+r.status+")");
  const rows=await r.json();
  return rows?.[0]||null;
}
export async function addJob(input:any){
  const url=String(input.url||"").trim();
  const existing=await getJobByUrl(url);
  if(existing) return {...existing,duplicate:true,ok:true};
  const now=new Date().toISOString();
  const row={
    id:String(input.id||("JT-"+Date.now())),added:input.added||now,track:String(input.track||""),title:String(input.title||""),
    company:String(input.company||""),location:String(input.location||""),remote:Boolean(input.remote),
    salary_min:input.salary_min===undefined||input.salary_min===null||input.salary_min===""?(input.salaryMin===undefined||input.salaryMin===null||input.salaryMin===""?null:Number(input.salaryMin)):Number(input.salary_min),
    salary_max:input.salary_max===undefined||input.salary_max===null||input.salary_max===""?(input.salaryMax===undefined||input.salaryMax===null||input.salaryMax===""?null:Number(input.salaryMax)):Number(input.salary_max),
    salary_text:String(input.salary_text||input.salaryText||""),url,source:String(input.source||""),status:String(input.status||"Saved"),
    viewed:Boolean(input.viewed),applied_date:input.applied_date||input.appliedDate||null,follow_up:input.follow_up||input.followUp||null,
    resume:String(input.resume||""),cover_letter:String(input.cover_letter||input.coverLetter||""),notes:String(input.notes||""),last_updated:now
  };
  const r=await rest("raven_jobs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  if(!r.ok) throw new Error("Job save failed ("+r.status+")");
  const rows=await r.json();
  return {...rows[0],ok:true};
}
export async function updateJob(id:string,patch:any){
  const allowed=["track","title","company","location","remote","salary_min","salary_max","salary_text","url","source","status","viewed","applied_date","follow_up","resume","cover_letter","notes"];
  const aliases:any={salaryMin:"salary_min",salaryMax:"salary_max",salaryText:"salary_text",appliedDate:"applied_date",followUp:"follow_up",coverLetter:"cover_letter"};
  const body:any={last_updated:new Date().toISOString()};
  for(const k of allowed) if(Object.prototype.hasOwnProperty.call(patch,k)) body[k]=patch[k];
  for(const [from,to] of Object.entries(aliases)) if(Object.prototype.hasOwnProperty.call(patch,from)) body[to as string]=patch[from];
  const r=await rest("raven_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
  if(!r.ok) throw new Error("Job update failed ("+r.status+")");
  const rows=await r.json();
  return {...(rows?.[0]||{}),ok:true};
}
export async function saveDiagnostics(rows:any[]){
  if(!rows.length) return;
  const r=await rest("raven_source_diagnostics",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(rows)});
  if(!r.ok) throw new Error("Diagnostics write failed ("+r.status+")");
}

export async function listTasksForHealth(){
  const r=await rest("raven_tasks?select=task_id,job_id,type,status,created,updated,last_error,input_json&order=updated.desc&limit=200",{method:"GET"});
  if(!r.ok) throw new Error("Task health read failed ("+r.status+")");
  return await r.json();
}
