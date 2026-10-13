import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  "https://shipitmyguy-ux.github.io",
  "http://localhost:3000",
  "http://localhost:5173"
]);
const TRACKS = ["Professional","Labor","Wildcard","Games / 3D"] as const;

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allowed=ALLOWED_ORIGINS.has(origin) ? origin : "https://shipitmyguy-ux.github.io";
  return {
    "Access-Control-Allow-Origin":allowed,
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"content-type,x-raven-client",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store"
  };
}
function json(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:cors(req)});
}
function env(){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) throw new Error("Supabase environment unavailable");
  return {url,key};
}
async function rest(path:string){
  const {url,key}=env();
  const r=await fetch(url+"/rest/v1/"+path,{
    headers:{apikey:key,Authorization:"Bearer "+key}
  });
  if(!r.ok) throw new Error("DB read failed "+r.status);
  return await r.json();
}
async function insertEvent(action:string,status:string,detail:any={}){
  try{
    const {url,key}=env();
    await fetch(url+"/rest/v1/raven_control_events",{
      method:"POST",
      headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({action,status,detail})
    });
  }catch{}
}
async function backend(action:string,payload:any={}){
  const {url}=env();
  const r=await fetch(url+"/functions/v1/raven-backend-v3",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,...payload})
  });
  const text=await r.text();
  let body:any={};
  try{body=text?JSON.parse(text):{};}catch{body={error:text.slice(0,500)};}
  if(!r.ok) throw new Error(body?.error||("Backend action failed "+r.status));
  return body;
}
async function getHealth(){
  const [jobs,taskHealth,identity,diag,events]=await Promise.all([
    rest("raven_jobs?select=id,company,source,track,url,remote,location,notes"),
    rest("raven_task_health?select=health_class,counts_as_current_failure"),
    rest("raven_job_identity_diagnostics?select=identity_class"),
    rest("raven_source_diagnostics?select=source,status,http_status,jobs_parsed,elapsed_ms,error,checked_at&order=checked_at.desc&limit=50"),
    rest("raven_control_events?select=id,action,status,detail,created_at&order=created_at.desc&limit=20")
  ]);
  const count=(rows:any[],key:string,val:any)=>rows.filter(x=>x?.[key]===val).length;
  return {
    ok:true,
    service:"raven-control-v1",
    generated_at:new Date().toISOString(),
    jobs:{
      total:jobs.length,
      missing_company:jobs.filter((x:any)=>!String(x.company||"").trim()).length,
      missing_source:jobs.filter((x:any)=>!String(x.source||"").trim()).length,
      blank_track:jobs.filter((x:any)=>!String(x.track||"").trim()).length,
      short_descriptions:jobs.filter((x:any)=>String(x.notes||"").trim().length<180).length
    },
    tasks:{
      current_failures:taskHealth.filter((x:any)=>x.counts_as_current_failure).length,
      active:count(taskHealth,"health_class","active"),
      expected_manual_review:count(taskHealth,"health_class","expected_manual_review"),
      legacy_tooling:count(taskHealth,"health_class","legacy_tooling"),
      integration_test:count(taskHealth,"health_class","integration_test")
    },
    identity:{
      unique:count(identity,"identity_class","unique"),
      probable_reposts:count(identity,"identity_class","probable_repost_or_cross_source_duplicate"),
      distinct_same_title_company:count(identity,"identity_class","same_title_company_distinct_posting"),
      canonical_duplicates:count(identity,"identity_class","exact_or_canonical_duplicate")
    },
    latest_diagnostics:diag,
    recent_control_events:events
  };
}
async function getConfig(){
  const [generation,sourcePolicy,flags]=await Promise.all([
    rest("raven_generation_policy?select=key,value,enabled,updated_at&order=key"),
    rest("raven_source_policy?select=source,enabled,priority,config,updated_at&order=priority.desc,source"),
    rest("raven_feature_flags?select=key,enabled,value,updated_at&order=key")
  ]);
  return {
    ok:true,
    generation_policy:generation,
    source_policy:sourcePolicy,
    feature_flags:flags,
    writable_from_browser:false
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors(req)});
  if(!["GET","POST"].includes(req.method)) return json(req,{error:"GET or POST required"},405);
  const origin=req.headers.get("origin")||"";
  if(origin && !ALLOWED_ORIGINS.has(origin)) return json(req,{error:"Origin not allowed"},403);
  try{
    const u=new URL(req.url);
    let body:any={};
    if(req.method==="POST"){
      try{body=JSON.parse(await req.text()||"{}");}catch{return json(req,{error:"Invalid JSON"},400);}
    }
    const action=String(body.action||u.searchParams.get("action")||"health");

    if(action==="health") return json(req,await getHealth());
    if(action==="getConfig") return json(req,await getConfig());

    if(action==="recent"){
      const rows=await rest("raven_control_events?select=id,action,status,detail,created_at&order=created_at.desc&limit=50");
      return json(req,{ok:true,events:rows});
    }

    if(action==="refreshAll"){
      const results:any[]=[];
      await insertEvent(action,"running",{tracks:[...TRACKS]});
      for(const track of TRACKS){
        try{
          const r=await backend("search",{track});
          results.push({track,ok:true,count:Number(r?.count||0),phase:r?.phase||null,deep_search:r?.deep_search||null});
        }catch(e){
          results.push({track,ok:false,error:e instanceof Error?e.message:String(e)});
        }
      }
      const ok=results.every(x=>x.ok);
      await insertEvent(action,ok?"success":"partial",{results});
      return json(req,{ok,results},ok?200:207);
    }

    if(action==="runSourceDiagnostics"){
      const requested=String(body.track||"Professional");
      const tracks=requested==="all" ? [...TRACKS] : TRACKS.includes(requested as any) ? [requested] : [];
      if(!tracks.length) return json(req,{error:"Invalid track"},400);
      const results:any[]=[];
      await insertEvent(action,"running",{tracks});
      for(const track of tracks){
        try{
          const r=await backend("runAtsDiagnostics",{track});
          results.push({track,ok:true,run_id:r?.run_id||null,results:r?.results||[]});
        }catch(e){
          results.push({track,ok:false,error:e instanceof Error?e.message:String(e)});
        }
      }
      const ok=results.every(x=>x.ok);
      await insertEvent(action,ok?"success":"partial",{tracks,summary:results.map(x=>({track:x.track,ok:x.ok}))});
      return json(req,{ok,results},ok?200:207);
    }

    if(action==="repairDescriptions"){
      const limit=Math.max(1,Math.min(8,Number(body.limit||6)));
      const offset=Math.max(0,Math.min(1000,Number(body.offset||0)));
      const track=String(body.track||"");
      if(track && !TRACKS.includes(track as any)) return json(req,{error:"Invalid track"},400);
      await insertEvent(action,"running",{track:track||"all",limit,offset});
      const r=await backend("repairDescriptions",{track,limit,offset});
      await insertEvent(action,"success",{track:track||"all",checked:r?.checked||0,repaired:r?.repaired||0});
      return json(req,r);
    }

    if(action==="smokeAts"){
      const track=String(body.track||"Professional");
      if(!TRACKS.includes(track as any)) return json(req,{error:"Invalid track"},400);
      await insertEvent(action,"running",{track});
      const r=await backend("smokeAts",{track});
      await insertEvent(action,"success",{track,count:r?.count||0,sources:r?.sources||[]});
      return json(req,r);
    }

    // Browser policy/config writes are intentionally disabled until Raven has authenticated admin users.
    if(["updateGenerationPolicy","updateSourcePolicy","setFeatureFlag"].includes(action)){
      await insertEvent(action,"blocked",{reason:"authenticated admin required"});
      return json(req,{error:"Policy/config writes require authenticated admin access and are not exposed to the browser."},403);
    }

    if(/submit|apply|finalize/i.test(action)){
      await insertEvent(action,"blocked",{reason:"employer submission prohibited"});
      return json(req,{error:"Employer submission is not a supported control-plane action."},403);
    }

    return json(req,{error:"Unsupported action"},400);
  }catch(e){
    return json(req,{error:e instanceof Error?e.message:String(e)},500);
  }
});