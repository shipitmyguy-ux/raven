import type { Candidate, Track } from "./types.ts";
import { TRACKS } from "./config.ts";
import { rankCandidates, score, within } from "./utils.ts";
import { linkedinQuick, linkedinDeep, remotive, remoteOk, arbeitnow, jobicy, himalayas, atsWide, gameStudioAshby } from "./sources.ts";
import { upsertResults, listResults, createRun, finishRun, deepSearchRunning, deepSearchCooldown } from "./db.ts";

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
  const [ats,studio]=await Promise.all([within(atsWide(track,true),6500,[] as Candidate[]),within(gameStudioAshby(track),6000,[] as Candidate[])]);
  const rows=rankCandidates(track,[...li,...rem,...rok,...arb,...jcy,...him,...ats,...studio],40);
  if(!rows.length){
    // A transient provider drought must not wipe a tab that already has valid
    // persisted discovery results. Return the current cache and let deep search
    // replenish it asynchronously.
    return await listResults(track).catch(()=>[] as Candidate[]);
  }
  await upsertResults(rows);
  // Games / 3D must display canonical persisted results, not discarded
  // duplicates or candidates held for geographic/identity review.
  return track==="Games / 3D"?await listResults(track):rows;
}

export async function deepSearch(track:Track){
  const runId=await createRun(track,TRACKS[track].terms.length);
  try{
    // Use the same staged workload for every category so one category with a
    // larger term list cannot exceed the Edge Runtime resource budget.
    const [li,rem,rok,arb]=await Promise.all([
      linkedinDeep(track,4),
      remotive(track),
      remoteOk(track),
      arbeitnow(track)
    ]);
    const [jcy,him]=await Promise.all([
      jobicy(track,3),
      himalayas(track,3)
    ]);
    const [ats,studio]=await Promise.all([atsWide(track),gameStudioAshby(track)]);
    const ranked=rankCandidates(track,[...li,...rem,...rok,...arb,...jcy,...him,...ats,...studio],100);
    const rows=ranked
      .map(c=>({...c,score:score(track,c)}))
      .sort((a,b)=>(b.score||0)-(a.score||0));
    await upsertResults(rows);
    // Deep discovery must finish within the Edge Runtime lifecycle. Description
    // enrichment happens when a job is saved (and through repairDescriptions),
    // so it must not keep a background search run alive for dozens of page fetches.
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
