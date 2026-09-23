import type { Candidate, Track } from "./types.ts";
import { TRACKS, ATS_SOURCES } from "./config.ts";
import { decodeHtml, normalizeUrl, within } from "./utils.ts";
import { csvCells, splitCsvRecords, validAtsRow } from "./csv-records.mjs";

async function linkedin(term:string,track:Track,remote:boolean,timeout=7000):Promise<Candidate[]>{
  const params=new URLSearchParams({
    keywords:term,
    location:remote?"United States":"Fort Collins, Colorado, United States",
    f_TPR:"r2592000",
    start:"0"
  });
  if(remote) params.set("f_WT","2"); else params.set("distance","25");
  try{
    const r=await fetch("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?"+params.toString(),{
      headers:{"User-Agent":"Mozilla/5.0 RavenJobSearch/3.0"},
      signal:AbortSignal.timeout(timeout)
    });
    if(!r.ok) return [];
    const html=await r.text();
    const out:Candidate[]=[];
    for(const m of html.matchAll(/<li>([\s\S]*?)<\/li>/gi)){
      const b=m[1];
      const href=(b.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i)||[])[1];
      const title=decodeHtml((b.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)||[])[1]||"");
      const company=decodeHtml((b.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)||[])[1]||"");
      const location=decodeHtml((b.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)||[])[1]||"");
      const posted=(b.match(/<time[^>]+datetime="([^"]+)"/i)||[])[1]||"";
      if(!href||!title) continue;
      const url=normalizeUrl(href);
      if(!/linkedin\.com\/jobs\/view\//i.test(url)) continue;
      out.push({track,title,company,location,remote,posted_at:posted,url,source:"LinkedIn",snippet:""});
    }
    return out;
  }catch{return [];}
}

export async function linkedinQuick(track:Track){
  const calls:Promise<Candidate[]>[]=[];
  for(const term of TRACKS[track].terms.slice(0,4)){
    calls.push(within(linkedin(term,track,false,5500),5500,[]));
    calls.push(within(linkedin(term,track,true,5500),5500,[]));
  }
  const groups=await Promise.all(calls);
  return groups.flat();
}

export async function linkedinDeep(track:Track, termLimit=12){
  const cfg=TRACKS[track], out:Candidate[]=[];
  const terms=cfg.terms.slice(0,termLimit);
  for(let i=0;i<terms.length;i+=4){
    const batch=terms.slice(i,i+4);
    const calls:Promise<Candidate[]>[]=[];
    for(const term of batch){
      calls.push(linkedin(term,track,false));
      calls.push(linkedin(term,track,true));
    }
    const groups=await Promise.all(calls);
    for(const g of groups) out.push(...g);
    await new Promise(r=>setTimeout(r,120));
  }
  return out;
}

export async function remotive(track:Track):Promise<Candidate[]>{
  try{
    const r=await fetch("https://remotive.com/api/remote-jobs?limit=100",{headers:{"User-Agent":"RavenJobSearch/3.0"},signal:AbortSignal.timeout(6500)});
    if(!r.ok) return [];
    const j=await r.json();
    return (j.jobs||[]).map((x:any)=>({
      track,title:x.title||"",company:x.company_name||"",location:x.candidate_required_location||"Remote",
      remote:true,salary_text:x.salary||"",url:normalizeUrl(x.url||""),source:"Remotive",
      snippet:decodeHtml(x.description||"").slice(0,6000),posted_at:x.publication_date||""
    })).filter((x:Candidate)=>x.title&&x.url);
  }catch{return [];}
}

export async function remoteOk(track:Track):Promise<Candidate[]>{
  try{
    const r=await fetch("https://remoteok.com/api",{headers:{"User-Agent":"RavenJobSearch/3.0"},signal:AbortSignal.timeout(6500)});
    if(!r.ok) return [];
    const j=await r.json();
    if(!Array.isArray(j)) return [];
    return j.slice(1,101).map((x:any)=>({
      track,title:x.position||"",company:x.company||"",location:x.location||"Remote",remote:true,
      salary_text:(x.salary_min||x.salary_max)?[x.salary_min,x.salary_max].filter(Boolean).join("–"):"",
      url:normalizeUrl(x.url||x.apply_url||""),source:"RemoteOK",
      snippet:decodeHtml(x.description||"").slice(0,6000),posted_at:x.date||""
    })).filter((x:Candidate)=>x.title&&x.url);
  }catch{return [];}
}

export async function arbeitnow(track:Track):Promise<Candidate[]>{
  try{
    const r=await fetch("https://www.arbeitnow.com/api/job-board-api",{headers:{"User-Agent":"RavenJobSearch/3.0"},signal:AbortSignal.timeout(6500)});
    if(!r.ok) return [];
    const j=await r.json();
    return (j.data||[]).slice(0,100).map((x:any)=>({
      track,title:x.title||"",company:x.company_name||"",location:x.location||"",remote:Boolean(x.remote),
      salary_text:"",url:normalizeUrl(x.url||""),source:"Arbeitnow",
      snippet:decodeHtml(x.description||"").slice(0,6000),
      posted_at:x.created_at?new Date(Number(x.created_at)*1000).toISOString():""
    })).filter((x:Candidate)=>x.title&&x.url);
  }catch{return [];}
}


export async function jobicy(track:Track, termLimit=6):Promise<Candidate[]>{
  try{
    const terms=TRACKS[track].terms.slice(0,termLimit);
    const calls=terms.map(async term=>{
      const u=new URL("https://jobicy.com/api/v2/remote-jobs");
      u.searchParams.set("count","50"); u.searchParams.set("geo","usa"); u.searchParams.set("tag",term);
      const r=await fetch(u,{headers:{"User-Agent":"RavenJobSearch/3.1"},signal:AbortSignal.timeout(6500)});
      if(!r.ok) return [] as Candidate[];
      const j=await r.json();
      return (j.jobs||[]).map((x:any)=>({
        track,title:x.jobTitle||"",company:x.companyName||"",location:x.jobGeo||"Remote",remote:true,
        salary_text:(x.salaryMin||x.salaryMax)?[x.salaryCurrency||"USD",[x.salaryMin,x.salaryMax].filter(Boolean).join("–"),x.salaryPeriod||""].filter(Boolean).join(" "):"",
        url:normalizeUrl(x.url||""),source:"Jobicy",snippet:decodeHtml(x.jobDescription||"").slice(0,6000),
        posted_at:x.pubDate||""
      } as Candidate)).filter((x:Candidate)=>x.title&&x.url);
    });
    return (await Promise.all(calls.map(p=>within(p,6500,[] as Candidate[])))).flat();
  }catch{return [];}
}

export async function himalayas(track:Track, termLimit=6):Promise<Candidate[]>{
  try{
    const terms=TRACKS[track].terms.slice(0,termLimit);
    const calls=terms.map(async term=>{
      const u=new URL("https://himalayas.app/jobs/api/search");
      u.searchParams.set("q",term); u.searchParams.set("country","US"); u.searchParams.set("sort","recent");
      const r=await fetch(u,{headers:{"User-Agent":"RavenJobSearch/3.1"},signal:AbortSignal.timeout(6500)});
      if(!r.ok) return [] as Candidate[];
      const j=await r.json();
      return (j.jobs||[]).map((x:any)=>({
        track,title:x.title||"",company:x.companyName||"",location:(x.locationRestrictions||[]).join(", ")||"Remote",remote:true,
        salary_text:(x.minSalary||x.maxSalary)?[x.currency||"USD",[x.minSalary,x.maxSalary].filter(Boolean).join("–"),x.salaryPeriod||""].filter(Boolean).join(" "):"",
        url:normalizeUrl(x.applicationLink||x.url||""),source:"Himalayas",snippet:decodeHtml(x.description||x.excerpt||"").slice(0,6000),
        posted_at:x.pubDate?new Date(Number(x.pubDate)).toISOString():""
      } as Candidate)).filter((x:Candidate)=>x.title&&x.url);
    });
    return (await Promise.all(calls.map(p=>within(p,6500,[] as Candidate[])))).flat();
  }catch{return [];}
}


type AtsManifestEntry={csv?:string;parquet?:string;rows?:number};
const ATS_MANIFEST="https://storage.stapply.ai/jobhive/v1/manifest.json";
let atsManifestCache:any=null;
async function atsManifest(){
  if(atsManifestCache) return atsManifestCache;
  try{
    const r=await fetch(ATS_MANIFEST,{headers:{"User-Agent":"RavenJobSearch/3.2"},signal:AbortSignal.timeout(5000)});
    if(!r.ok) return null;
    atsManifestCache=await r.json(); return atsManifestCache;
  }catch{return null;}
}
async function atsSlice(source:string,track:Track,quick=false){
  try{
    const m=await atsManifest(), entry=m?.by_ats?.[source];
    if(!entry?.csv) return [];
    const r=await fetch(entry.csv,{headers:{"User-Agent":"RavenJobSearch/3.5"},signal:AbortSignal.timeout(9000)});
    if(!r.ok||!r.body) return [];
    const reader=r.body.getReader(), dec=new TextDecoder();
    let buf="", header:string[]|null=null, idx:any=null, bytes=0, lines=0;
    const out:Candidate[]=[];
    const maxLines=quick ? 2200 : 7000;
    const maxBytes=quick ? 2*1024*1024 : 7*1024*1024;
    const maxRows=quick ? 40 : 80;
    while(out.length<maxRows && lines<maxLines){
      const {done,value}=await reader.read();
      if(value){
        bytes+=value.byteLength;
        if(bytes>maxBytes) break;
        buf+=dec.decode(value,{stream:true});
      }
      if(done) buf+=dec.decode();
      const parsed=splitCsvRecords(buf,done); buf=parsed.remainder;
      for(const record of parsed.records){
        if(!record) continue;
        if(!header){
          header=csvCells(record).map((x:string)=>x.trim());
          const pick=(...n:string[])=>n.map(x=>header!.indexOf(x)).find(x=>x>=0)??-1;
          idx={title:pick("title"),company:pick("company","company_name"),location:pick("location"),url:pick("url","job_url","apply_url"),description:pick("description","description_text"),remote:pick("is_remote","remote"),posted:pick("posted_at","date_posted"),salaryMin:pick("salary_min"),salaryMax:pick("salary_max")};
          continue;
        }
        lines++;
        const c=csvCells(record), title=String(c[idx.title]||"").trim(), desc=idx.description>=0?(c[idx.description]||""):"";
        const hay=(title+" "+desc).toLowerCase();
        const cfg=TRACKS[track];
        const matched=cfg.include.some((q:string)=>hay.includes(q.toLowerCase()));
        if(!matched) continue;
        if(cfg.exclude.some((q:string)=>hay.includes(q.toLowerCase()))) continue;
        const location=idx.location>=0?(c[idx.location]||""):"";
        const url=idx.url>=0?normalizeUrl(c[idx.url]||""):""; if(!validAtsRow(title,url)) continue;
        out.push({track,title,company:idx.company>=0?(c[idx.company]||source):source,location,url,snippet:desc.slice(0,6000),remote:idx.remote>=0?/true|1|yes/i.test(c[idx.remote]||""): /remote/i.test(location),posted_at:idx.posted>=0?(c[idx.posted]||""):"",source:"ATS:"+source} as Candidate);
        if(out.length>=maxRows) break;
      }
      if(done) break;
    }
    try{await reader.cancel();}catch{}
    return out;
  }catch{return [];}
}

export async function atsWide(track:Track,quick=false){
  const out:Candidate[]=[];
  // Quick refresh favors the broadest ATS providers and stays tightly bounded;
  // deep search can cover the full configured ATS set afterward.
  const sources=quick ? ATS_SOURCES.slice(0,4) : ATS_SOURCES;
  const maxRows=quick ? 100 : 240;
  for(const source of sources){
    const rows=await atsSlice(source,track,quick);
    out.push(...rows);
    if(out.length>=maxRows) break;
  }
  return out.slice(0,maxRows);
}

export async function atsDiagnostics(track:Track){
  const runId="ATS-"+Date.now(), results:any[]=[];
  for(const source of ATS_SOURCES){
    const start=Date.now(); let status="FAIL",http_status:number|null=null,jobs_parsed=0,error:string|null=null;
    try{
      const manifest=await atsManifest(), entry=manifest?.by_ats?.[source];
      if(!entry?.csv) throw new Error("CSV slice missing from manifest");
      const r=await fetch(entry.csv,{headers:{"User-Agent":"RavenJobSearch/3.3"},signal:AbortSignal.timeout(12000)});
      http_status=r.status;
      if(!r.ok) throw new Error("HTTP "+r.status);
      const text=await r.text(), parsed=splitCsvRecords(text);
      const records=[...parsed.records];
      if(parsed.remainder.trim()) records.push(parsed.remainder);
      if(records.length<2) throw new Error("CSV slice contained no jobs");
      const headers=csvCells(records[0]).map((x:string)=>x.trim());
      if(!headers.includes("title")||!headers.some((x:string)=>["url","job_url","apply_url"].includes(x))) throw new Error("Required columns missing: "+headers.slice(0,12).join(","));
      jobs_parsed=records.length-1; status="PASS";
    }catch(e){error=e instanceof Error?e.message:String(e);}
    results.push({run_id:runId,source,status,http_status,jobs_parsed,elapsed_ms:Date.now()-start,error});
  }
  return {runId,results};
}

export async function atsDiagnosticOne(source:string, track:Track){
  const start=Date.now(); const runId="ATS1-"+Date.now();
  let status="FAIL",http_status:number|null=null,jobs_parsed=0,error:string|null=null;
  try{
    if(!ATS_SOURCES.includes(source)) throw new Error("Unknown ATS source");
    const manifest=await atsManifest(), entry=manifest?.by_ats?.[source];
    if(!entry?.csv) throw new Error("CSV slice missing from manifest");
    const r=await fetch(entry.csv,{headers:{"User-Agent":"RavenJobSearch/3.4"},signal:AbortSignal.timeout(12000)});
    http_status=r.status;
    if(!r.ok) throw new Error("HTTP "+r.status);
    const reader=r.body?.getReader(); if(!reader) throw new Error("No response body");
    const dec=new TextDecoder(); let buf="", bytes=0, lines=0, header:string[]|null=null, stop=false;
    while(!stop){
      const {done,value}=await reader.read();
      if(value){
        bytes+=value.byteLength;
        if(bytes>8*1024*1024){
          if(header&&lines>0){try{await reader.cancel();}catch{};break;}
          throw new Error("Slice exceeds safe 8MB diagnostic limit before a complete job row");
        }
        buf+=dec.decode(value,{stream:true});
      }
      if(done) buf+=dec.decode();
      const parsed=splitCsvRecords(buf,done); buf=parsed.remainder;
      for(const record of parsed.records){
        if(!record) continue;
        if(!header) header=csvCells(record).map((x:string)=>x.trim());
        else lines++;
        if(lines>=100){stop=true;try{await reader.cancel();}catch{};break;}
      }
      if(done) break;
    }
    if(!header) throw new Error("CSV header missing");
    if(!header.includes("title")||!header.some(x=>["url","job_url","apply_url"].includes(x))) throw new Error("Required columns missing: "+header.slice(0,12).join(","));
    if(lines<1) throw new Error("CSV slice contained no complete job rows");
    jobs_parsed=lines; status="PASS";
  }catch(e){error=e instanceof Error?e.message:String(e);}
  return {run_id:runId,source,status,http_status,jobs_parsed,elapsed_ms:Date.now()-start,error};
}
