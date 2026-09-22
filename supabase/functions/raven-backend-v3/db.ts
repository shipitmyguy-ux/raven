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
  const q="raven_search_results?select=id,track,title,company,location,remote,salary_text,url,source,snippet,score,status,created_at,last_seen&track=eq."+encodeURIComponent(track)+"&order=score.desc,last_seen.desc&limit=100";
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

export async function createRun(track:Track,queryCount:number){
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
  const url=String(input.url||"");
  const existing=await getJobByUrl(url);
  if(existing) return {...existing,duplicate:true,ok:true};
  const now=new Date().toISOString();
  const row={
    id:String(input.id||("JT-"+Date.now())),added:input.added||now,track:String(input.track||""),title:String(input.title||""),
    company:String(input.company||""),location:String(input.location||""),remote:Boolean(input.remote),
    salary_min:input.salary_min===undefined||input.salary_min===null||input.salary_min===""?null:Number(input.salary_min),
    salary_max:input.salary_max===undefined||input.salary_max===null||input.salary_max===""?null:Number(input.salary_max),
    salary_text:String(input.salary_text||""),url,source:String(input.source||""),status:String(input.status||"Saved"),
    viewed:Boolean(input.viewed),applied_date:input.applied_date||null,follow_up:input.follow_up||null,
    resume:String(input.resume||""),cover_letter:String(input.cover_letter||""),notes:String(input.notes||""),last_updated:now
  };
  const r=await rest("raven_jobs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  if(!r.ok) throw new Error("Job save failed ("+r.status+")");
  const rows=await r.json();
  return {...rows[0],ok:true};
}
export async function updateJob(id:string,patch:any){
  const allowed=["track","title","company","location","remote","salary_min","salary_max","salary_text","url","source","status","viewed","applied_date","follow_up","resume","cover_letter","notes"];
  const body:any={last_updated:new Date().toISOString()};
  for(const k of allowed) if(Object.prototype.hasOwnProperty.call(patch,k)) body[k]=patch[k];
  const r=await rest("raven_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
  if(!r.ok) throw new Error("Job update failed ("+r.status+")");
  const rows=await r.json();
  return {...(rows?.[0]||{}),ok:true};
}
export async function upsertJobsFromCandidates(rows:Candidate[]){
  const now=new Date().toISOString();
  const seen=new Set<string>();
  const body=rows.filter(c=>{const url=String(c.url||"");if(!isPersistableCandidate(c)||seen.has(url))return false;seen.add(url);return true;}).slice(0,100).map((c,i)=>({
    id:"DISC-"+Date.now()+"-"+i,added:now,track:c.track||"Professional",title:c.title||"",company:c.company||"",location:c.location||"",remote:Boolean(c.remote),
    salary_min:null,salary_max:null,salary_text:c.salary_text||"",url:c.url,source:c.source||"",status:"Saved",viewed:false,applied_date:null,follow_up:null,
    resume:"",cover_letter:"",notes:c.snippet||"",last_updated:now
  }));
  if(!body.length) return;
  const r=await rest("raven_jobs?on_conflict=url",{
    method:"POST",
    headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(body)
  });
  if(!r.ok){const detail=await r.text().catch(()=>"");throw new Error("Bulk job upsert failed ("+r.status+"): "+detail.slice(0,1200));}
}
export async function listTasks(){
  const r=await rest("raven_tasks?select=*&order=created.asc&limit=1000",{method:"GET"});
  if(!r.ok) throw new Error("Tasks read failed ("+r.status+")");
  return await r.json();
}
export async function enqueueTask(input:any){
  const jobId=String(input.job_id||input.jobId||"");
  const type=String(input.type||"");
  if(!jobId||!type) throw new Error("job_id and type are required");
  const key=String(input.idempotency_key||input.idempotencyKey||`${jobId}:${type}:v1`);
  const existingResp=await rest("raven_tasks?select=*&idempotency_key=eq."+encodeURIComponent(key)+"&limit=1",{method:"GET"});
  if(existingResp.ok){
    const existing=await existingResp.json();
    if(existing?.[0]) return {...existing[0],duplicate:true,ok:true};
  }
  const row={task_id:String(input.task_id||input.taskId||("TASK-"+Date.now())),job_id:jobId,type,status:"PENDING",idempotency_key:key,attempts:0,max_attempts:Number(input.max_attempts||input.maxAttempts||(type==="assisted_application"?1:3)),created:new Date().toISOString(),available_after:input.available_after||null,input_json:input.input_json||input.input||{},output_json:{},updated:new Date().toISOString(),cancel_requested:false};
  const r=await rest("raven_tasks",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  if(!r.ok) throw new Error("Task enqueue failed ("+r.status+")");
  const rows=await r.json();
  return {...rows[0],ok:true};
}
export async function updateTask(taskId:string,patch:any){
  const allowed=["status","attempts","max_attempts","available_after","claimed_by","lease_until","last_error","input_json","output_json","cancel_requested"];
  const body:any={updated:new Date().toISOString()};
  for(const k of allowed) if(Object.prototype.hasOwnProperty.call(patch,k)) body[k]=patch[k];
  const r=await rest("raven_tasks?task_id=eq."+encodeURIComponent(taskId),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
  if(!r.ok) throw new Error("Task update failed ("+r.status+")");
  const rows=await r.json();
  return {...(rows?.[0]||{}),ok:true};
}

export async function saveDiagnostics(rows:any[]){
  if(!rows.length) return;
  const r=await rest("raven_source_diagnostics",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(rows)});
  if(!r.ok) throw new Error("Diagnostics write failed ("+r.status+")");
}
