import type { Candidate } from "./types.ts";
import { decodeHtml } from "./utils.ts";

function linkedInId(url:string){
  return (url.match(/(?:-|\/)(\d{7,})(?:\?|$|\/)/)||[])[1]||"";
}
function extractLinkedIn(html:string){
  const patterns=[
    /<div[^>]+class=["'][^"']*show-more-less-html__markup[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*description__text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]+class=["'][^"']*show-more-less-html[^"']*["'][^>]*>([\s\S]*?)<\/section>/i
  ];
  for(const p of patterns){
    const m=html.match(p);
    if(m?.[1]){
      const t=decodeHtml(m[1]);
      if(t.length>120) return t;
    }
  }
  return "";
}
function extractMeta(html:string){
  const m=html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i);
  return m?.[1]?decodeHtml(m[1]):"";
}
function extractVisible(html:string){
  const patterns=[
    /<div[^>]+class=["'][^"']*(?:job-description|jobDescription|description|posting-description|job-details)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]+class=["'][^"']*(?:job-description|description|posting-description|job-details)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i
  ];
  for(const p of patterns){
    const m=html.match(p);
    if(m?.[1]){
      const t=decodeHtml(m[1]);
      if(t.length>180) return t;
    }
  }
  return "";
}
function findPosting(v:any):any{
  if(!v) return null;
  if(Array.isArray(v)){for(const x of v){const f=findPosting(x);if(f)return f;}return null;}
  if(typeof v==="object"){
    const t=v["@type"];
    if(t==="JobPosting"||(Array.isArray(t)&&t.includes("JobPosting"))) return v;
    if(v["@graph"]){const f=findPosting(v["@graph"]);if(f)return f;}
  }
  return null;
}

function leverParts(rawUrl:string){
  try{
    const u=new URL(rawUrl);
    if(!/(^|\.)jobs(?:\.eu)?\.lever\.co$/i.test(u.hostname)) return null;
    const parts=u.pathname.split("/").filter(Boolean);
    if(parts.length<2) return null;
    return {site:decodeURIComponent(parts[0]),postingId:decodeURIComponent(parts[1]),eu:/jobs\.eu\.lever\.co$/i.test(u.hostname)};
  }catch{return null;}
}
async function leverPosting(c:Candidate):Promise<Candidate|null>{
  const parts=leverParts(c.url);
  if(!parts) return null;
  const base=parts.eu?"https://api.eu.lever.co":"https://api.lever.co";
  try{
    const r=await fetch(base+"/v0/postings/"+encodeURIComponent(parts.site)+"/"+encodeURIComponent(parts.postingId),{
      headers:{"Accept":"application/json","User-Agent":"RavenJobSearch/3.6"},
      signal:AbortSignal.timeout(6500)
    });
    if(!r.ok) return null;
    const j=await r.json();
    const listText=Array.isArray(j?.lists)?j.lists.map((x:any)=>[x?.text,decodeHtml(x?.content||"")].filter(Boolean).join("\n")).filter(Boolean).join("\n\n"):"";
    const description=[j?.descriptionPlain||decodeHtml(j?.description||""),listText,j?.additionalPlain||decodeHtml(j?.additional||"")].filter(Boolean).join("\n\n").trim();
    const location=String(j?.categories?.location||c.location||"");
    const workplace=String(j?.workplaceType||"").toLowerCase();
    let salary=String(c.salary_text||"");
    if(!salary&&j?.salaryRange){
      const s=j.salaryRange;
      const range=[s.min,s.max].filter((v:any)=>v!==undefined&&v!==null&&v!=="").join("–");
      salary=[s.currency,range,s.interval].filter(Boolean).join(" ");
    }
    return {
      ...c,
      title:String(j?.text||c.title||""),
      location,
      remote:workplace==="remote"||Boolean(c.remote),
      salary_text:salary,
      snippet:(description||c.snippet||"").slice(0,10000)
    };
  }catch{return null;}
}

async function linkedinDescription(url:string){
  const id=linkedInId(url);
  if(!id) return "";
  try{
    const r=await fetch("https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/"+id,{
      headers:{"User-Agent":"Mozilla/5.0 RavenJobSearch/3.0"},
      signal:AbortSignal.timeout(7000)
    });
    if(!r.ok) return "";
    const html=await r.text();
    return extractLinkedIn(html)||extractVisible(html)||extractMeta(html);
  }catch{return "";}
}

export async function enrichCandidate(c:Candidate):Promise<Candidate>{
  let current={...c};
  const isLinkedIn=current.source==="LinkedIn"||/linkedin\.com\/jobs\/view\//i.test(current.url);
  const isLever=/jobs(?:\.eu)?\.lever\.co\//i.test(current.url)||/^ATS:lever$/i.test(String(current.source||""));
  if(isLever && (!current.snippet||current.snippet.length<180)){
    const lever=await leverPosting(current);
    if(lever&&String(lever.snippet||"").length>=180) return lever;
  }
  if(isLinkedIn && (!current.snippet||current.snippet.length<180)){
    const d=await linkedinDescription(current.url);
    if(d) return {...current,snippet:d.slice(0,10000)};
  }

  try{
    const r=await fetch(current.url,{
      headers:{"User-Agent":"Mozilla/5.0 RavenJobSearch/3.0"},
      redirect:"follow",
      signal:AbortSignal.timeout(7000)
    });
    if(!r.ok) return current;
    const html=await r.text();

    for(const s of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
      try{
        const job=findPosting(JSON.parse(s[1].trim()));
        if(!job) continue;
        const org=job.hiringOrganization?.name||job.hiringOrganization||"";
        const jl=job.jobLocation;
        let loc="";
        if(Array.isArray(jl)&&jl[0]) loc=[jl[0]?.address?.addressLocality,jl[0]?.address?.addressRegion].filter(Boolean).join(", ");
        else if(jl) loc=[jl?.address?.addressLocality,jl?.address?.addressRegion].filter(Boolean).join(", ");
        const remote=String(job.jobLocationType||"").toUpperCase().includes("TELECOMMUTE")||Boolean(current.remote);
        let salary=current.salary_text||"";
        const bs=job.baseSalary;
        if(!salary&&bs?.value){
          const v=bs.value;
          salary=[v.minValue,v.maxValue].filter(Boolean).join("–");
          if(salary&&bs.currency) salary=bs.currency+" "+salary;
        }
        const description=decodeHtml(job.description||"");
        return {
          ...current,
          title:job.title||current.title,
          company:typeof org==="string"&&org?org:current.company,
          location:loc||current.location,
          remote,
          salary_text:salary,
          snippet:(description||current.snippet||"").slice(0,10000)
        };
      }catch{}
    }

    const fallback=(isLinkedIn?extractLinkedIn(html):"")||extractVisible(html)||extractMeta(html)||current.snippet||"";
    return {...current,snippet:fallback.slice(0,10000)};
  }catch{
    return current;
  }
}
