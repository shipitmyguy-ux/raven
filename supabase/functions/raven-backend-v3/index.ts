import type { Track, Candidate } from "./types.ts";
import { CORS, TRACKS } from "./config.ts";
import { json, normalizeUrl, recoverCompanyFromUrl, analyzeCanonicalIdentity } from "./utils.ts";
import { quickSearch, maybeStartDeep } from "./search.ts";
import { listResults, listJobs, addJob, updateJob } from "./db.ts";
import { requestGuard, requestFinish } from "./request-budget.ts";
import { enrichCandidate } from "./enrich.ts";

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
      const existingDescription=String(body.notes||body.snippet||"").trim();
      let company = String(body.company || "").trim();
      if(!company){
        company = recoverCompanyFromUrl(url);
      }
      let saveBody={...body,url,company,notes:existingDescription};
      if(existingDescription.length<180){
        try{
          const candidate:Candidate={
            track:(String(body.track||"Professional")) as Track,
            title:String(body.title||""),company:String(body.company||""),location:String(body.location||""),
            remote:Boolean(body.remote),salary_text:String(body.salary_text||body.salaryText||""),
            url,source:String(body.source||"Web"),snippet:existingDescription
          };
          const enriched=await enrichCandidate(candidate);
          saveBody={...saveBody,
            title:enriched.title||saveBody.title,
            company:enriched.company||saveBody.company,
            location:enriched.location||saveBody.location,
            remote:Boolean(enriched.remote),
            salary_text:enriched.salary_text||saveBody.salary_text||saveBody.salaryText||"",
            notes:String(enriched.snippet||existingDescription).trim()
          };
        }catch{}
      }
      const job=await addJob(saveBody);
      return json(job);
    }

    if(action==="diagnoseCanonicalIdentity"){
      const jobs = await listJobs();
      const diagnostics = analyzeCanonicalIdentity(jobs);
      return json({ok:true, ...diagnostics});
    }

    if(action==="recoverMissingCompanies"){
      const requested = Math.max(1, Math.min(100, Number(body.limit || u.searchParams.get("limit") || 50)));
      const jobs = await listJobs();
      const missing = jobs.filter((j: any) => !j.company || String(j.company).trim() === "").slice(0, requested);
      const updatedRows: any[] = [];
      const ambiguousRows: any[] = [];

      for (const job of missing) {
        // Persistent recovery is intentionally deterministic. Generic enrichment can
        // produce plausible company names without authoritative provenance, so it must
        // never be used to mutate canonical Raven job data.
        const recovered = recoverCompanyFromUrl(job.url);

        if (recovered) {
          await updateJob(job.id, { company: recovered });
          updatedRows.push({ id: job.id, title: job.title, url: job.url, recoveredCompany: recovered });
        } else {
          ambiguousRows.push({ id: job.id, title: job.title, url: job.url });
        }
      }

      return json({
        ok: true,
        checked: missing.length,
        recovered: updatedRows.length,
        updatedRows,
        ambiguousRows
      });
    }

    if(action==="updateJob"){
      const id=String(body.id||"");
      if(!id) return json({error:"ID required"},400);
      const job=await updateJob(id,body);
      return json(job);
    }

    if(action==="repairDescriptions"){
      const track=String(body.track||u.searchParams.get("track")||"") as Track;
      if(track && !TRACKS[track]) return json({error:"Invalid track"},400);
      const requested=Math.max(1,Math.min(8,Number(body.limit||u.searchParams.get("limit")||6)));
      const offset=Math.max(0,Math.min(1000,Number(body.offset||u.searchParams.get("offset")||0)));
      const jobs=(await listJobs()).filter((job:any)=>{
        if(track && job.track!==track) return false;
        return String(job.notes||"").trim().length<180 && /^https?:\/\//i.test(String(job.url||""));
      }).slice(offset,offset+requested);
      const repaired:any[]=[];
      for(const job of jobs){
        try{
          const enriched=await enrichCandidate({
            track:(job.track||"Professional") as Track,title:job.title||"",company:job.company||"",location:job.location||"",
            remote:Boolean(job.remote),salary_text:job.salary_text||"",url:job.url||"",source:job.source||"Web",snippet:job.notes||""
          });
          const description=String(enriched.snippet||"").trim();
          if(description.length>=180){
            await updateJob(job.id,{
              title:enriched.title||job.title,company:enriched.company||job.company,location:enriched.location||job.location,
              remote:Boolean(enriched.remote),salary_text:enriched.salary_text||job.salary_text||"",notes:description
            });
            repaired.push({id:job.id,url:job.url,description_chars:description.length});
          }
        }catch{}
      }
      return json({ok:true,track:track||"all",offset,checked:jobs.length,repaired:repaired.length,rows:repaired});
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
