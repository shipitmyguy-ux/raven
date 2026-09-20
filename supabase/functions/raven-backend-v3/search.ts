import type { Candidate, Track } from "./types.ts";
import { TRACKS } from "./config.ts";
import { rankCandidates, score, within } from "./utils.ts";
import { linkedinQuick, linkedinDeep, remotive, remoteOk, arbeitnow, jobicy, himalayas, atsWide } from "./sources.ts";
import { upsertResults, createRun, finishRun, deepSearchRunning, upsertJobsFromCandidates } from "./db.ts";
import { enrichCandidate } from "./enrich.ts";

export async function quickSearch(track:Track){
  const [li,rem,rok,arb,jcy,him,ats]=await Promise.all([
    within(linkedinQuick(track),6000,[] as Candidate[]),
    within(remotive(track),5500,[] as Candidate[]),
    within(remoteOk(track),5500,[] as Candidate[]),
    within(arbeitnow(track),5500,[] as Candidate[]),
    within(jobicy(track),7000,[] as Candidate[]),
    within(himalayas(track),7000,[] as Candidate[]),
    within(atsWide(track),10500,[] as Candidate[])
  ]);
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
    const [li,rem,rok,arb,jcy,him,ats]=await Promise.all([
      linkedinDeep(track),
      remotive(track),
      remoteOk(track),
      arbeitnow(track),
      jobicy(track),
      himalayas(track),
      atsWide(track)
    ]);
    const ranked=rankCandidates(track,[...li,...rem,...rok,...arb,...jcy,...him,...ats],100);
    const rows=ranked
      .map(c=>({...c,score:score(track,c)}))
      .sort((a,b)=>(b.score||0)-(a.score||0));
    await upsertResults(rows);
    const enriched=await enrichRows(rows);
    await upsertResults(enriched);
    await upsertJobsFromCandidates(enriched);
    await finishRun(runId,"completed",rows.length);
  }catch(e){
    await finishRun(runId,"failed",0,e instanceof Error?e.message:String(e));
  }
}

export async function maybeStartDeep(track:Track){
  if(await deepSearchRunning(track)) return "already-running";
  try{
    // @ts-ignore Supabase Edge Runtime global.
    EdgeRuntime.waitUntil(deepSearch(track));
    return "started";
  }catch{
    return "not-started";
  }
}
