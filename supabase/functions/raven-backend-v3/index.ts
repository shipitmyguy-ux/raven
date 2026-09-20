import type { Track, Candidate } from "./types.ts";
import { CORS, TRACKS } from "./config.ts";
import { json, normalizeUrl } from "./utils.ts";
import { quickSearch, maybeStartDeep } from "./search.ts";
import { listResults, listJobs, addJob, updateJob, listTasks, enqueueTask, updateTask } from "./db.ts";

const BACKUP_URL=(Deno.env.get("SUPABASE_URL")||"")+"/functions/v1/raven-backup-v1";
function queueBackup(kind:string,payload:any){
  try{
    // @ts-ignore Supabase Edge Runtime global.
    EdgeRuntime.waitUntil(fetch(BACKUP_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=UTF-8"},
      body:JSON.stringify({kind,[kind]:payload})
    }).catch(()=>{}));
  }catch{}
}

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
      queueBackup("job",job);
      return json(job);
    }

    if(action==="updateJob"){
      const id=String(body.id||"");
      if(!id) return json({error:"ID required"},400);
      const job=await updateJob(id,body);
      queueBackup("job",job);
      return json(job);
    }

    if(action==="tasks"){
      return json({ok:true,tasks:await listTasks()});
    }

    if(action==="enqueueTask"){
      const task=await enqueueTask(body);
      queueBackup("task",task);
      return json(task);
    }

    if(action==="updateTask"){
      const taskId=String(body.task_id||body.taskId||"");
      if(!taskId) return json({error:"task_id required"},400);
      return json(await updateTask(taskId,body));
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
      const rows=await quickSearch(track);
      const deep_search=await maybeStartDeep(track);
      return json({ok:true,track,count:rows.length,results:rows,phase:"quick",deep_search});
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
