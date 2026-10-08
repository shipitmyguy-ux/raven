import type { Candidate } from "./types.ts";

export async function saveListingCheck(url:string,check:any){
  const targets:any[]=[];
  for(const table of ["raven_jobs","raven_search_results"]){
    const path=table+"?url=eq."+encodeURIComponent(url);
    const read=await rest(path+"&select=listing_check",{method:"GET"});
    if(!read.ok) throw new Error("Listing check read failed ("+read.status+")");
    const rows=await read.json();
    if(!rows.length) continue;
    targets.push({path,previous:rows.find((row:any)=>row.listing_check?.state==="closed")?.listing_check});
  }
  if(!targets.length) throw new Error("This listing is no longer stored. Refresh and try again");
  const previous=targets.find(target=>target.previous)?.previous;
  const merged=check.state==="unconfirmed"&&previous?.state==="closed"
    ? {...previous,last_check:check}: {...check,last_check:check};
  for(const {path} of targets){
    const write=await rest(path,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({listing_check:merged})});
    if(!write.ok) throw new Error("Listing check save failed ("+write.status+")");
  }
  return merged;
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
  if(init.body&&!headers.has("Content-Type")) headers.set("Content-Type","application/json");
  return fetch(url+"/rest/v1/"+path,{...init,headers});
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
