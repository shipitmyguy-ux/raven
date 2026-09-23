import type { Track, Candidate } from "./types.ts";
import { CORS, TRACKS } from "./config.ts";
import { json, normalizeUrl, recoverCompanyFromUrl, analyzeCanonicalIdentity } from "./utils.ts";
import { quickSearch, maybeStartDeep } from "./search.ts";
import { listResults, listJobs, addJob, updateJob, listTasksForHealth, getJobById, getJobByUrl, addJobEvent, listJobEvents, listAllJobEvents, ensureJobSnapshot, listJobSnapshots, getCanonicalProfile, listAllJobSnapshots } from "./db.ts";
import { requestGuard, requestFinish } from "./request-budget.ts";
import { classifyApplicationMessage } from "./signal-classifier.mjs";
import { enrichCandidate } from "./enrich.ts";


const LIFECYCLE_STATUSES=new Set(["Saved","Interested","Ready","Applied","Interview","Offer","Rejected","Ignored"]);
const STATUS_RANK:any={Saved:10,Interested:12,Ready:20,Applied:30,Interview:40,Offer:50,Rejected:50,Ignored:60};

function cleanSignalText(value:any){
  return String(value||"").trim().replace(/\s+/g," ").slice(0,1000);
}
function lifecycleEventType(status:string){
  return ({Applied:"applied",Interview:"interview",Offer:"offer",Rejected:"rejected",Ignored:"ignored",Interested:"bookmarked",Ready:"ready",Saved:"saved"} as any)[status]||"status_changed";
}
function followUpIso(fromValue:any,days=7){
  const start=Date.parse(String(fromValue||""));
  const date=new Date(Number.isFinite(start)?start:Date.now());
  date.setUTCDate(date.getUTCDate()+Math.max(1,Math.min(30,Number(days)||7)));
  return date.toISOString();
}
async function transitionStoredJob(jobId:string,nextStatus:string,options:any={}){
  if(!LIFECYCLE_STATUSES.has(nextStatus)) throw new Error("Unsupported lifecycle status");
  const before=await getJobById(jobId);
  if(!before) throw new Error("Job not found");
  const previous=String(before.status||"Saved");
  const occurredAt=String(options.occurredAt||new Date().toISOString());
  const patch:any={status:nextStatus,viewed:true};

  if(nextStatus==="Applied"){
    patch.appliedDate=before.applied_date||occurredAt;
    if(Object.prototype.hasOwnProperty.call(options,"followUp")) patch.followUp=options.followUp||null;
    else patch.followUp=before.follow_up||followUpIso(patch.appliedDate,options.followUpDays||7);
  }else if(["Saved","Interested","Ready"].includes(nextStatus)&&previous==="Applied"){
    patch.appliedDate=null;
    patch.followUp=null;
  }else if(["Interview","Offer","Rejected","Ignored"].includes(nextStatus)){
    patch.followUp=null;
  }

  const updated=await updateJob(jobId,patch);
  const sameStatus=previous===nextStatus;
  const followUpChanged=Object.prototype.hasOwnProperty.call(options,"followUp")&&String(before.follow_up||"")!==String(options.followUp||"");
  let event=null;
  if(!sameStatus||followUpChanged){
    event=await addJobEvent({
      jobId,
      eventType:followUpChanged&&sameStatus?"follow_up_changed":lifecycleEventType(nextStatus),
      occurredAt,
      source:options.source||"raven",
      confidence:options.confidence,
      summary:options.summary||(followUpChanged&&sameStatus?"Follow-up date updated":("Status changed from "+previous+" to "+nextStatus)),
      metadata:{from_status:previous,to_status:nextStatus,...(options.metadata||{})}
    });
  }
  let snapshot=null;
  if(nextStatus==="Applied"&&previous!=="Applied"){
    snapshot=await ensureJobSnapshot(updated,"application");
  }
  return {job:updated,event,snapshot};
}
async function matchSignalJob(body:any){
  const explicit=String(body.jobId||body.job_id||"").trim();
  if(explicit){
    const found=await getJobById(explicit);
    if(found) return found;
  }
  const url=normalizeUrl(String(body.url||body.jobUrl||""));
  if(url){
    const found=await getJobByUrl(url);
    if(found) return found;
  }
  const title=cleanSignalText(body.title).toLowerCase();
  const company=cleanSignalText(body.company).toLowerCase();
  if(title&&company){
    const jobs=await listJobs();
    const matches=jobs.filter((job:any)=>cleanSignalText(job.title).toLowerCase()===title&&cleanSignalText(job.company).toLowerCase()===company);
    if(matches.length===1) return matches[0];
  }
  return null;
}

const COVERAGE_STOPWORDS=new Set([
  "the","and","for","with","that","this","from","your","you","our","are","will","have","has","into","about","their","they","who","but","not","all","any","can","job","role","work","team","years","experience","skills","using","use","strong","ability","required","preferred","responsibilities","responsibility","qualification","qualifications","including","within","across","support","supporting","must","should","would","plus"
]);
function coverageTokens(value:any){
  return (String(value||"").toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g)||[])
    .filter((word:string)=>!COVERAGE_STOPWORDS.has(word));
}
function requirementCandidates(description:string){
  const clean=String(description||"").replace(/\r/g,"\n").replace(/[•●▪◦]/g,"\n- ");
  const parts=clean.split(/\n+|(?<=[.!?])\s+/)
    .map(x=>x.replace(/^[-*–—]\s*/,"").trim())
    .filter(x=>x.length>=24&&x.length<=420);
  const marked=parts.filter(x=>/\b(required|requirements?|must|need(?:ed)?|proficien|knowledge|ability|skills?|experience|preferred|responsib|qualif|familiar|expertise)\b/i.test(x));
  const pool=(marked.length>=4?marked:parts).slice(0,24);
  const unique:string[]=[];
  const seen=new Set<string>();
  for(const item of pool){
    const key=item.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    if(!key||seen.has(key)) continue;
    seen.add(key); unique.push(item);
    if(unique.length>=12) break;
  }
  return unique;
}
function canonicalEvidence(profile:any){
  const rows:any[]=[];
  for(const skill of profile?.skills||[]) rows.push({id:"skill:"+String(skill),text:String(skill),kind:"skill"});
  for(const fact of profile?.transferable_facts||[]) rows.push({id:String(fact.id||""),text:String(fact.text||""),kind:"transferable"});
  for(const exp of profile?.experience||[]){
    for(const fact of exp?.facts||[]) rows.push({id:String(fact.id||""),text:String(fact.text||""),kind:"experience",role:String(exp.role||""),company:String(exp.company||"")});
  }
  return rows.filter(x=>x.text);
}
function evidenceCoverage(job:any,profile:any){
  const requirements=requirementCandidates(String(job?.notes||""));
  const evidence=canonicalEvidence(profile).map((item:any)=>({...item,tokens:new Set(coverageTokens(item.text)),lower:item.text.toLowerCase()}));
  const skills=(profile?.skills||[]).map((x:any)=>String(x)).filter(Boolean);
  const analyzed=requirements.map((text:string)=>{
    const tokens=[...new Set(coverageTokens(text))];
    const lower=text.toLowerCase();
    const exactSkills=skills.filter((skill:string)=>skill.length>=3&&lower.includes(skill.toLowerCase()));
    const ranked=evidence.map((item:any)=>{
      let overlap=0;
      for(const token of tokens) if(item.tokens.has(token)) overlap++;
      const phrase=exactSkills.some((skill:string)=>item.lower.includes(skill.toLowerCase()));
      return {item,overlap,phrase,score:overlap+(phrase?3:0)};
    }).filter((x:any)=>x.score>0).sort((a:any,b:any)=>b.score-a.score).slice(0,3);
    const max=ranked[0]?.score||0;
    const state=max>=3?"supported":max===2?"partial":"missing";
    return {
      requirement:text.slice(0,360),
      status:state,
      evidence:ranked.filter((x:any)=>x.score>=2||x.phrase).map((x:any)=>({id:x.item.id,text:x.item.text,kind:x.item.kind})).slice(0,2)
    };
  });
  const supported=analyzed.filter((x:any)=>x.status==="supported").length;
  const partial=analyzed.filter((x:any)=>x.status==="partial").length;
  const missing=analyzed.filter((x:any)=>x.status==="missing").length;
  return {
    total:analyzed.length,supported,partial,missing,
    supported_ratio:analyzed.length?supported/analyzed.length:0,
    requirements:analyzed
  };
}
function contentVariant(value:any){
  const text=String(value||"");
  if(!text) return "";
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return "v-"+(hash>>>0).toString(36);
}

async function buildAnalytics(){
  const [jobs,events,snapshots]=await Promise.all([listJobs(),listAllJobEvents(),listAllJobSnapshots()]);
  const byJob=new Map<string,any[]>();
  for(const event of events){
    const id=String(event.job_id||"");
    if(!byJob.has(id)) byJob.set(id,[]);
    byJob.get(id)!.push(event);
  }
  const appliedJobs=jobs.filter((job:any)=>Boolean(job.applied_date)||["Applied","Interview","Offer","Rejected"].includes(String(job.status||"")));
  const interviewIds=new Set<string>();
  const offerIds=new Set<string>();
  const rejectedIds=new Set<string>();
  const responseDays:number[]=[];
  const source:any={};
  const track:any={};
  const resumeVariant:any={};
  const latestSnapshotByJob=new Map<string,any>();
  for(const snapshot of snapshots){
    const id=String(snapshot.job_id||"");
    if(id&&!latestSnapshotByJob.has(id)) latestSnapshotByJob.set(id,snapshot);
  }
  for(const job of appliedJobs){
    const id=String(job.id);
    const jobEvents=byJob.get(id)||[];
    const hasInterview=["Interview","Offer"].includes(String(job.status||""))||jobEvents.some((e:any)=>/interview/.test(String(e.event_type||"")));
    const hasOffer=String(job.status||"")==="Offer"||jobEvents.some((e:any)=>String(e.event_type||"")==="offer");
    const hasRejected=String(job.status||"")==="Rejected"||jobEvents.some((e:any)=>String(e.event_type||"")==="rejected");
    if(hasInterview) interviewIds.add(id);
    if(hasOffer) offerIds.add(id);
    if(hasRejected) rejectedIds.add(id);
    const sourceKey=String(job.source||"Unknown")||"Unknown";
    const trackKey=String(job.track||"Unknown")||"Unknown";
    source[sourceKey]=source[sourceKey]||{applications:0,interviews:0,offers:0,rejections:0};
    track[trackKey]=track[trackKey]||{applications:0,interviews:0,offers:0,rejections:0};
    const snapshot=latestSnapshotByJob.get(id)?.snapshot||{};
    const variant=contentVariant(snapshot.resume||job.resume||"");
    if(variant) resumeVariant[variant]=resumeVariant[variant]||{applications:0,interviews:0,offers:0,rejections:0};
    for(const bucket of [source[sourceKey],track[trackKey],variant?resumeVariant[variant]:null].filter(Boolean)){
      bucket.applications++;
      if(hasInterview) bucket.interviews++;
      if(hasOffer) bucket.offers++;
      if(hasRejected) bucket.rejections++;
    }
    const appliedAt=Date.parse(String(job.applied_date||jobEvents.find((e:any)=>e.event_type==="applied")?.occurred_at||""));
    const response=jobEvents
      .filter((e:any)=>["recruiter_contact","interview","interview_requested","interview_scheduled"].includes(String(e.event_type||"")))
      .map((e:any)=>Date.parse(String(e.occurred_at||"")))
      .filter((t:number)=>Number.isFinite(t)&&Number.isFinite(appliedAt)&&t>=appliedAt)
      .sort((a:number,b:number)=>a-b)[0];
    if(Number.isFinite(response)&&Number.isFinite(appliedAt)) responseDays.push((response-appliedAt)/86400000);
  }
  const decorate=(record:any)=>Object.fromEntries(Object.entries(record).map(([key,value]:any)=>[key,{...value,interview_rate:value.applications?value.interviews/value.applications:0,offer_rate:value.applications?value.offers/value.applications:0}]));
  return {
    applications:appliedJobs.length,
    interviews:interviewIds.size,
    offers:offerIds.size,
    rejections:rejectedIds.size,
    interview_rate:appliedJobs.length?interviewIds.size/appliedJobs.length:0,
    offer_rate:appliedJobs.length?offerIds.size/appliedJobs.length:0,
    average_response_days:responseDays.length?responseDays.reduce((a,b)=>a+b,0)/responseDays.length:null,
    by_source:decorate(source),
    by_track:decorate(track),
    by_resume_variant:decorate(resumeVariant)
  };
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
      const tasks=await listTasksForHealth();
      const now=Date.now(), windowMs=24*60*60*1000;
      const classify=(task:any)=>{
        const status=String(task?.status||"").toUpperCase();
        const type=String(task?.type||"").toLowerCase();
        const id=String(task?.task_id||"");
        const notes=String(task?.last_error||"").toLowerCase();
        const input=task?.input_json||{};
        if(Boolean(input?.is_test)||/^(test-|e2e-|playwright-)/i.test(id)||/\b(test|e2e|playwright)\b/i.test(type)) return "disposable_test";
        if(/^BLOCKED_USER/.test(status)||/^BLOCKED_MANUAL/.test(status)||["WAITING_FOR_USER","AWAITING_USER_CONFIRMATION","USER_CONFIRMATION_REQUIRED"].includes(status)) return "manual_blocked";
        if(["FAILED_FINAL","BLOCKED_TOOLING","RETIRED","ARCHIVED","EXPIRED_LEGACY"].includes(status)||/\b(drive|gdrive|sheets|legacy|queue)\b/i.test(type+" "+notes)) return "historical_legacy";
        const updated=Date.parse(String(task?.updated||task?.created||""));
        if(Number.isFinite(updated)&&now-updated>windowMs) return "historical_legacy";
        return ["FAILED","ERROR","CRASHED","SYSTEM_FAILURE"].includes(status)?"operational_failure":"operational_active";
      };
      const categories=tasks.map(classify);
      const counts={total:tasks.length,operationalActive:categories.filter(x=>x==="operational_active").length,activeFailures:categories.filter(x=>x==="operational_failure").length,manualBlocked:categories.filter(x=>x==="manual_blocked").length,historicalLegacy:categories.filter(x=>x==="historical_legacy").length,disposableTest:categories.filter(x=>x==="disposable_test").length};
      return json({ok:true,status:counts.activeFailures?"degraded":"healthy",healthy:counts.activeFailures===0,counts,service:"raven-backend-v3",version:1,features:["quick-search","deep-search","descriptions","persistence","commute","jobicy","himalayas","ats-wide","lifecycle-events","posting-snapshots","application-signals","outcome-analytics","evidence-coverage","message-classification"]});
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

    if(action==="transitionJob"){
      const id=String(body.id||body.jobId||"");
      const nextStatus=String(body.status||body.nextStatus||"");
      if(!id) return json({error:"ID required"},400);
      try{
        const result=await transitionStoredJob(id,nextStatus,{
          occurredAt:body.occurredAt,
          followUp:Object.prototype.hasOwnProperty.call(body,"followUp")?body.followUp:undefined,
          followUpDays:body.followUpDays,
          source:body.source||"raven-ui",
          confidence:body.confidence,
          summary:body.summary,
          metadata:body.metadata
        });
        return json({ok:true,...result});
      }catch(e){
        return json({error:e instanceof Error?e.message:String(e)},400);
      }
    }

    if(action==="jobEvents"){
      const id=String(body.id||body.jobId||u.searchParams.get("jobId")||"");
      if(!id) return json({error:"jobId required"},400);
      return json({ok:true,events:await listJobEvents(id)});
    }

    if(action==="addJobEvent"){
      const id=String(body.id||body.jobId||"");
      if(!id) return json({error:"jobId required"},400);
      const event=await addJobEvent({
        jobId:id,
        eventType:body.eventType||"note",
        occurredAt:body.occurredAt,
        source:body.source||"manual",
        summary:cleanSignalText(body.summary),
        confidence:body.confidence,
        metadata:body.metadata
      });
      return json({ok:true,event});
    }

    if(action==="jobSnapshots"){
      const id=String(body.id||body.jobId||u.searchParams.get("jobId")||"");
      if(!id) return json({error:"jobId required"},400);
      return json({ok:true,snapshots:await listJobSnapshots(id)});
    }

    if(action==="receiveApplicationSignal"){
      const classified=classifyApplicationMessage(String(body.messageText||body.text||body.body||""));
      const type=cleanSignalText(body.type||body.signalType||classified?.type).toLowerCase().replace(/[^a-z0-9]+/g,"_");
      const confidence=Math.max(0,Math.min(1,Number(body.confidence??classified?.confidence??0.5)));
      if(!type) return json({error:"signal type required"},400);
      const job=await matchSignalJob(body);
      if(!job) return json({ok:true,matched:false,signal:{type,confidence}});
      const target=({submitted:"Applied",application_submitted:"Applied",interview:"Interview",interview_requested:"Interview",interview_scheduled:"Interview",offer:"Offer",offer_received:"Offer",rejection:"Rejected",rejected:"Rejected"} as any)[type]||"";
      const current=String(job.status||"Saved");
      const canAdvance=target&&Number(STATUS_RANK[target]||0)>=Number(STATUS_RANK[current]||0);
      const metadata={
        signal_type:type,
        evidence:cleanSignalText(body.evidence||classified?.evidence),
        classifier_reason:classified?.reason||null,
        suggested_status:target||null,
        auto_applied:false
      };
      if(target&&confidence>=0.85&&canAdvance){
        const result=await transitionStoredJob(String(job.id),target,{
          occurredAt:body.occurredAt,
          source:body.source||"signal",
          confidence,
          summary:cleanSignalText(body.summary)||("Detected "+type.replace(/_/g," ")),
          metadata:{...metadata,auto_applied:true}
        });
        return json({ok:true,matched:true,auto_applied:true,...result});
      }
      const event=await addJobEvent({
        jobId:String(job.id),
        eventType:"signal_"+type,
        occurredAt:body.occurredAt,
        source:body.source||"signal",
        confidence,
        summary:cleanSignalText(body.summary)||("Detected "+type.replace(/_/g," ")),
        metadata
      });
      return json({ok:true,matched:true,auto_applied:false,suggested_status:target||null,job,event});
    }

    if(action==="classifyApplicationMessage"){
      const classified=classifyApplicationMessage(String(body.messageText||body.text||body.body||""));
      return json({ok:true,classification:classified});
    }

    if(action==="coverage"){
      const id=String(body.id||body.jobId||u.searchParams.get("jobId")||"");
      if(!id) return json({error:"jobId required"},400);
      const [job,profile]=await Promise.all([getJobById(id),getCanonicalProfile()]);
      if(!job) return json({error:"Job not found"},404);
      if(!profile) return json({error:"Canonical profile unavailable"},503);
      return json({ok:true,coverage:evidenceCoverage(job,profile)});
    }

    if(action==="analytics"){
      return json({ok:true,analytics:await buildAnalytics()});
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
