import type { Candidate } from "./types.ts";

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

export async function saveAvailability(url:string,evidence:any,originalUrl=url){
  const body:any={listing_reason:evidence.reason,listing_checked_at:evidence.checked_at,listing_source_url:evidence.source_url,listing_http_status:evidence.http_status};
  if(evidence.state==="closed") body.listing_state="closed";
  // Failed checks must neither reopen closures nor overwrite their evidence.
  const condition=evidence.state==="closed"?"":"&or=(listing_state.is.null,listing_state.neq.closed)";
  for(const table of ["raven_jobs","raven_search_results"]){
    const patch={...body,...(table==="raven_search_results"&&evidence.state==="closed"?{status:"Expired"}:{})};
    const r=await rest(table+"?url=in."+encodeURIComponent("("+[...new Set([url,originalUrl])].map(value=>JSON.stringify(value)).join(",")+")")+condition,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(patch)});
    if(!r.ok) throw new Error("Availability save failed ("+r.status+")");
  }
}
