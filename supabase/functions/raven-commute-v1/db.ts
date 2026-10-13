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

export async function getCommute(key:string){
  const r=await rest("raven_commute_cache?select=minutes,updated_at&location_key=eq."+encodeURIComponent(key)+"&limit=1",{method:"GET"});
  if(!r.ok) return null;
  const rows=await r.json();
  return rows?.[0]||null;
}

export async function putCommute(location_key:string,location_text:string,minutes:number){
  const r=await rest("raven_commute_cache?on_conflict=location_key",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({location_key,location_text,minutes,updated_at:new Date().toISOString()})
  });
  if(!r.ok) throw new Error("Commute cache write failed ("+r.status+")");
}
