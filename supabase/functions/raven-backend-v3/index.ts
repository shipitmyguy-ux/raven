import type { Track, Candidate } from "./types.ts";
import { CORS, TRACKS } from "./config.ts";
import { json, normalizeUrl } from "./utils.ts";
import { quickSearch, maybeStartDeep } from "./search.ts";
import { listResults, listJobs, addJob, updateJob } from "./db.ts";
import { requestGuard, requestFinish } from "./request-budget.ts";

async function runAndSaveAtsDiagnostics(track:Track="Professional"){
  const { atsDiagnostics }=await import("./sources.ts");
  const { saveDiagnostics }=await import("./db.ts");
  const diagnostic=await atsDiagnostics(track);
  await saveDiagnostics(diagnostic.results);
  return diagnostic;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(!["GET","POST"].includes(req.method)) return json({error:"GET or POST required"},405);

  try{
    const u=new URL(req.url);
    let body:any={};
    if(req.method==="POST"){
      try{body=JSON.parse(await req.text()||"{}");}catch{return json({error:"Invalid JSON"},400);}
    }
    const action=String(body.action||u.searchParams.get("action")||"");

    if(action==="health"){
      return json({
        ok:true,
        service:"raven-backend-v3",
        version:1,
        features:["quick-search","deep-search","descriptions","persistence","sheet-sync","commute","jobicy","himalayas","ats-wide"]
      });
    }

    if(action==="jobs"){
      return json({ok:true,jobs:await listJobs()});
    }

    if(action==="addJob"){
      const url=normalizeUrl(String(body.url||""));
      if(!url) return json({error:"URL required"},400);
      const job=await addJob({...body,url});
      return json(job);
    }

    if(action==="updateJob"){
      const id=String(body.id||"");
      if(!id) return json({error:"ID required"},400);
      const job=await updateJob(id,body);
      return json(job);
    }

    if(action==="diagnoseAtsSource"){
      const { atsDiagnosticOne }=await import("./sources.ts");
      const { saveDiagnostics }=await import("./db.ts");
      const track=(String(body.track||u.searchParams.get("track")||"Professional")) as Track;
      const source=String(body.source||u.searchParams.get("source")||"");
      if(!TRACKS[track]) return json({error:"Invalid track"},400);
      const row=await atsDiagnosticOne(source,track);
      await saveDiagnostics([row]);
      return json({ok:row.status==="PASS",result:row});
    }

    if(action==="runAtsDiagnostics"){
      const track=(String(body.track||u.searchParams.get("track")||"Professional")) as Track;
      if(!TRACKS[track]) return json({error:"Invalid track"},400);
      const diagnostic=await runAndSaveAtsDiagnostics(track);
      return json({ok:true,...diagnostic});
    }

    if(action==="smokeAts"){
      const { atsWide }=await import("./sources.ts");
      const track=(String(body.track||u.searchParams.get("track")||"Professional")) as Track;
      if(!TRACKS[track]) return json({error:"Invalid track"},400);
      const rows=await atsWide(track);
      return json({ok:true,track,count:rows.length,sources:[...new Set(rows.map((x:any)=>x.source))],sample:rows.slice(0,5)});
    }

    if(action==="search"){
      const track=String(body.track||u.searchParams.get("track")||"") as Track;
      if(!TRACKS[track]) return json({error:"Invalid track"},400);

      let guard:any;
      try{
        guard=await requestGuard("search",track,{
          shortLimit:8,shortSeconds:60,
          longLimit:40,longSeconds:600,
          failureThreshold:3,failureWindowSeconds:300,circuitSeconds:300
        });
      }catch(e){
        return json({error:"Search safety budget is temporarily unavailable.",detail:e instanceof Error?e.message:String(e)},503);
      }

      if(!guard?.allowed){
        const cached=await listResults(track);
        return json({
          ok:true,track,count:cached.length,results:cached,phase:"cached",
          deep_search:guard?.reason==="circuit-open"?"circuit-open":"budget-cooldown",
          budget_limited:true,retry_after_seconds:Number(guard?.retry_after_seconds||60)
        });
      }

      const eventId=Number(guard.event_id||0)||null;
      try{
        const rows=await quickSearch(track);
        const deep_search=await maybeStartDeep(track);
        await requestFinish(eventId,"success",200).catch(()=>{});
        return json({
          ok:true,track,count:rows.length,results:rows,phase:"quick",deep_search,
          budget:{short_remaining:guard.short_remaining,long_remaining:guard.long_remaining}
        });
      }catch(e){
        await requestFinish(eventId,"failure",500,e instanceof Error?e.message:String(e)).catch(()=>{});
        throw e;
      }
    }

    if(action==="listResults"){
      const track=String(body.track||u.searchParams.get("track")||"") as Track;
      if(!TRACKS[track]) return json({error:"Invalid track"},400);
      return json({ok:true,track,results:await listResults(track)});
    }

    return json({error:"Unsupported action"},400);
  }catch(e){
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
