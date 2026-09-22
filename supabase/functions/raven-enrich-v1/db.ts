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
    status:"Discovered",
    last_seen:new Date().toISOString()
  };
  const r=await rest("raven_search_results?url=eq."+encodeURIComponent(url),{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error("Description save failed ("+r.status+")");
}

export async function markExpired(url:string,httpStatus:number){
  const r=await rest("raven_search_results?url=eq."+encodeURIComponent(url),{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status:"Expired"})
  });
  if(!r.ok) throw new Error("Expired status save failed ("+r.status+")");
}
