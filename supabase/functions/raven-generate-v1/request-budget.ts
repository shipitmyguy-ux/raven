type GuardOptions={
  shortLimit:number;
  shortSeconds:number;
  longLimit:number;
  longSeconds:number;
  failureThreshold:number;
  failureWindowSeconds:number;
  circuitSeconds:number;
};

function env(){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) throw new Error("Supabase request budget service unavailable");
  return {url,key};
}

async function rpc(name:string,payload:Record<string,unknown>){
  const {url,key}=env();
  const response=await fetch(url+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{
      "apikey":key,
      "Authorization":"Bearer "+key,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  });
  if(!response.ok) throw new Error("Request budget RPC failed ("+response.status+")");
  const text=await response.text();
  return text?JSON.parse(text):null;
}

export async function requestGuard(kind:string,scope:string,options:GuardOptions){
  return await rpc("raven_request_guard",{
    p_kind:kind,
    p_scope:scope||"global",
    p_short_limit:options.shortLimit,
    p_short_seconds:options.shortSeconds,
    p_long_limit:options.longLimit,
    p_long_seconds:options.longSeconds,
    p_failure_threshold:options.failureThreshold,
    p_failure_window_seconds:options.failureWindowSeconds,
    p_circuit_seconds:options.circuitSeconds
  });
}

export async function requestFinish(eventId:number|null|undefined,status:"success"|"failure"|"rejected",httpStatus?:number|null,detail?:string){
  if(!eventId) return;
  await rpc("raven_request_finish",{
    p_event_id:eventId,
    p_status:status,
    p_http_status:httpStatus??null,
    p_detail:detail||null
  });
}
