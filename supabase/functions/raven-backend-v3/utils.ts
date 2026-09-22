import type { Candidate, Track } from "./types.ts";
import { TRACKS } from "./config.ts";

export function json(data:unknown,status=200,extra:Record<string,string>={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"content-type",
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Content-Type":"application/json",
      "Cache-Control":"no-store",
      ...extra
    }
  });
}

export function decodeHtml(s:string){
  return String(s||"")
    .replace(/<(?:br|\/p|\/li|\/div|\/section|\/h[1-6])\s*\/?>/gi,"\n")
    .replace(/<li[^>]*>/gi,"• ")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ")
    .replace(/<[^>]*>/g," ")
    .replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n\n").trim();
}

export function normalizeUrl(raw:string){
  try{
    const u=new URL(decodeHtml(raw));
    ["position","pageNum","refId","trackingId","trk","utm_source","utm_medium","utm_campaign","utm_term","utm_content","gh_src","source"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString().replace(/\?$/,"");
  }catch{return String(raw||"").trim();}
}

export function daysOld(date?:string){
  if(!date) return 0;
  const t=Date.parse(date);
  return Number.isFinite(t)?(Date.now()-t)/86400000:0;
}

export function score(track:Track,c:Candidate){
  const text=[c.title,c.company,c.location,c.snippet].filter(Boolean).join(" ").toLowerCase();
  const title=(c.title||"").toLowerCase();
  let n=0, titleMatch=false;
  for(const term of TRACKS[track].include){
    if(title.includes(term)){n+=5;titleMatch=true;}
    else if(text.includes(term)) n+=2;
  }
  for(const term of TRACKS[track].exclude) if(text.includes(term)) n-=10;
  if(!titleMatch) n-=4;
  if(c.remote) n+=2;
  if(/fort collins|loveland|windsor|greeley|colorado/.test(text)) n+=2;
  if(c.source==="LinkedIn") n+=1;
  if(c.posted_at && daysOld(c.posted_at)>45) n-=8;
  return n;
}

export async function within<T>(promise:Promise<T>,ms:number,fallback:T):Promise<T>{
  return await Promise.race([
    promise.catch(()=>fallback),
    new Promise<T>(resolve=>setTimeout(()=>resolve(fallback),ms))
  ]);
}

export function rankCandidates(track:Track,candidates:Candidate[],limit=40){
  const map=new Map<string,Candidate>();
  for(const c0 of candidates){
    const url=normalizeUrl(c0.url);
    if(!url) continue;
    const c={...c0,url};
    c.score=score(track,c);
    if((c.score||0)<3) continue;
    if(c.posted_at&&daysOld(c.posted_at)>60) continue;
    const old=map.get(url);
    if(!old||(c.score||0)>(old.score||0)) map.set(url,c);
  }
  return [...map.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,limit);
}
