import type { Candidate, Track } from "./types.ts";
import { TRACKS } from "./config.ts";
import { rankCandidates, score, within } from "./utils.ts";
import { linkedinQuick, linkedinDeep, remotive, remoteOk, arbeitnow, jobicy, himalayas, atsWide } from "./sources.ts";
import { upsertResults, createRun, finishRun, deepSearchRunning, deepSearchCooldown } from "./db.ts";
import { enrichCandidate } from "./enrich.ts";

export async function quickSearch(track:Track){
  // Keep peak memory below the Edge Runtime limit by using staged quick-search
  // phases. Deep search still runs the full source breadth afterwards.
  const [li,rem,rok,arb]=await Promise.all([
    within(linkedinQuick(track),6000,[] as Candidate[]),
    within(remotive(track),5500,[] as Candidate[]),
    within(remoteOk(track),5500,[] as Candidate[]),
    within(arbeitnow(track),5500,[] as Candidate[])
  ]);
  const [jcy,him]=await Promise.all([
    within(jobicy(track,3),6500,[] as Candidate[]),
    within(himalayas(track,3),6500,[] as Candidate[])
  ]);
  const ats=await within(atsWide(track,true),9000,[] as Candidate[]);
  const rows=rankCandidates(track,[...li,...rem,...rok,...arb,...jcy,...him,...ats],40);
  await upsertResults(rows);
  return rows;
}

async function enrichRows(rows:Candidate[]){
  const enriched:Candidate[]=[];
  for(let i=0;i<rows.length;i+=10){
    const batch=rows.slice(i,i+10);
    const values=await Promise.all(batch.map(async(candidate)=>{
      if(String(candidate.snippet||"").trim().length>=180) return candidate;
      try{return await enrichCandidate(candidate);}catch{return candidate;}
    }));
    enriched.push(...values);
  }
  return enriched;
}

export async function deepSearch(track:Track){
  const runId=await createRun(track,TRACKS[track].terms.length);
  try{
    // Use the same staged workload for every category so one category with a
    // larger term list cannot exceed the Edge Runtime resource budget.
    const [li,rem,rok,arb]=await Promise.all([
      linkedinDeep(track,12),
      remotive(track),
      remoteOk(track),
      arbeitnow(track)
    ]);
    const [jcy,him]=await Promise.all([
      jobicy(track,6),
      himalayas(track,6)
    ]);
    const ats=await atsWide(track);
    const ranked=rankCandidates(track,[...li,...rem,...rok,...arb,...jcy,...him,...ats],100);
    const rows=ranked
      .map(c=>({...c,score:score(track,c)}))
      .sort((a,b)=>(b.score||0)-(a.score||0));
    await upsertResults(rows);
    const enriched=await enrichRows(rows);
    await upsertResults(enriched);
    await finishRun(runId,"completed",rows.length);
  }catch(e){
    await finishRun(runId,"failed",0,e instanceof Error?e.message:String(e));
  }
}

export async function maybeStartDeep(track:Track){
  if(await deepSearchRunning(track)) return "already-running";
  if(await deepSearchCooldown(track,60)) return "cooldown";
  try{
    // @ts-ignore Supabase Edge Runtime global.
    EdgeRuntime.waitUntil(deepSearch(track));
    return "started";
  }catch{
    return "not-started";
  }
}
