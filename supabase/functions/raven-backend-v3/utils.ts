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

const KNOWN_COMPANY_CASING: Record<string, string> = {
  "cbiz": "CBIZ",
  "cd-projekt-red": "CD Projekt Red",
  "dealerbuilt": "DealerBuilt",
  "1840company": "1840 & Company",
  "1840-company": "1840 & Company",
  "emotainizioengage": "EmotaInizioEngage",
  "cloud-chamber": "Cloud Chamber",
  "swaybox-studios": "Swaybox Studios",
  "epic-games": "Epic Games",
  "eleventh-hour-games": "Eleventh Hour Games",
  "comploy": "Comploy",
  "icims": "iCIMS",
  "smartrecruiters": "SmartRecruiters",
  "greenhouse": "Greenhouse",
  "lever": "Lever",
  "ashby": "Ashby"
};

export function formatCompanyName(rawSlug: string): string {
  if (!rawSlug) return "";
  let cleanStr = "";
  try { cleanStr = decodeURIComponent(rawSlug); } catch { cleanStr = rawSlug; }
  cleanStr = cleanStr.trim();
  if (!cleanStr) return "";

  const rawKey = cleanStr.toLowerCase();
  if (KNOWN_COMPANY_CASING[rawKey]) return KNOWN_COMPANY_CASING[rawKey];

  const hyphenKey = rawKey.replace(/[\s_]+/g, "-");
  if (KNOWN_COMPANY_CASING[hyphenKey]) return KNOWN_COMPANY_CASING[hyphenKey];

  const noSepKey = rawKey.replace(/[^a-z0-9]+/g, "");
  if (KNOWN_COMPANY_CASING[noSepKey]) return KNOWN_COMPANY_CASING[noSepKey];

  const words = cleanStr.replace(/[-_]+/g, " ").split(/\s+/);
  const capitalized = words.map((word) => {
    if (!word) return "";
    const lower = word.toLowerCase();
    if (["and", "of", "the", "for", "in", "on", "at"].includes(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  let result = capitalized.join(" ").trim();
  if (result) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

export function recoverCompanyFromUrl(rawUrl: string): string {
  const urlStr = String(rawUrl || "").trim();
  if (!urlStr || !/^https?:\/\//i.test(urlStr)) return "";

  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    if (host.includes("linkedin.com")) {
      const viewMatch = path.match(/\/jobs\/view\/([^/?#]+)/i);
      if (viewMatch) {
        let slug = viewMatch[1];
        slug = slug.replace(/-\d{6,}$/, "");
        const atIndex = slug.lastIndexOf("-at-");
        if (atIndex !== -1) {
          const companySlug = slug.slice(atIndex + 4).trim();
          if (companySlug && !/^\d+$/.test(companySlug)) {
            return formatCompanyName(companySlug);
          }
        }
      }
      return "";
    }

    if (host.includes("greenhouse.io")) {
        const ghMatch = path.match(/\/(?:job-boards\/|boards\/)?([^\/]+)\/jobs\/[^\/?#]+/i);
      if (ghMatch && ghMatch[1] && ghMatch[1] !== "embed") {
        return formatCompanyName(ghMatch[1]);
      }
      return "";
    }

    if (host.includes("lever.co")) {
        const levMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
        if (levMatch && levMatch[1] && levMatch[1] !== "jobs") {
        return formatCompanyName(levMatch[1]);
      }
      return "";
    }

    if (host.includes("ashbyhq.com")) {
        const ashMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
      if (ashMatch && ashMatch[1]) {
        return formatCompanyName(ashMatch[1]);
      }
      return "";
    }

    if (host.includes("smartrecruiters.com")) {
      const smMatch = path.match(/\/([^\/]+)\/[^\/]+/i);
      if (smMatch && smMatch[1]) {
        return formatCompanyName(smMatch[1]);
      }
      return "";
    }

    if (host.includes("myworkdayjobs.com")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("workable.com")) {
      let companySlug = "";
      if (host.startsWith("apply.")) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length >= 1) companySlug = parts[0];
      } else {
        companySlug = host.split(".")[0];
      }
      if (companySlug && companySlug !== "apply" && companySlug !== "www") {
        return formatCompanyName(companySlug);
      }
      return "";
    }

    if (host.includes("icims.com")) {
      const companySubdomain = host.replace("-careers", "").split(".")[0];
      if (companySubdomain && companySubdomain !== "www" && companySubdomain !== "careers") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("taleo.net")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("recruitee.com")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www" && companySubdomain !== "careers") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("breezy.hr")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("bamboohr.com")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    if (host.includes("personio.com") || host.includes("personio.de")) {
      const companySubdomain = host.split(".")[0];
      if (companySubdomain && companySubdomain !== "www") {
        return formatCompanyName(companySubdomain);
      }
      return "";
    }

    return "";
  } catch {
    return "";
  }
}

export function getCanonicalIdentity(job: any) {
  const normUrl = normalizeUrl(String(job?.url || ""));
  const title = String(job?.title || "").trim();
  const company = String(job?.company || "").trim();

  let provider = "web";
  let employerSlug = "";
  let postingId = "";
  let postingKey = "";

  if (normUrl && /^https?:\/\//i.test(normUrl)) {
    try {
      const u = new URL(normUrl);
      const host = u.hostname.toLowerCase();
      const path = u.pathname;

      if (host.includes("linkedin.com")) {
        provider = "linkedin";
        const liMatch = path.match(/\/jobs\/view\/(?:[^\/]+-)?(\d{6,})/i) || path.match(/\/jobs\/view\/(\d{6,})/i) || [null, u.searchParams.get("currentJobId")];
        const id = liMatch && liMatch[1] ? liMatch[1] : "";
        if (id) {
          postingId = id;
          postingKey = `linkedin:${id}`;
        }
      } else if (host.includes("greenhouse.io")) {
        provider = "greenhouse";
        const ghMatch = path.match(/\/(?:job-boards\/|boards\/)?([^\/]+)\/jobs\/(\d+)/i);
        if (ghMatch) {
          employerSlug = ghMatch[1].toLowerCase();
          postingId = ghMatch[2];
          postingKey = `greenhouse:${employerSlug}:${postingId}`;
        }
      } else if (host.includes("lever.co")) {
        provider = "lever";
          const levMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
          if (levMatch && levMatch[1] !== "jobs") {
          employerSlug = levMatch[1].toLowerCase();
          postingId = levMatch[2];
          postingKey = `lever:${employerSlug}:${postingId}`;
        }
      } else if (host.includes("ashbyhq.com")) {
        provider = "ashby";
          const ashMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
        if (ashMatch) {
          employerSlug = ashMatch[1].toLowerCase();
          postingId = ashMatch[2];
          postingKey = `ashby:${employerSlug}:${postingId}`;
        }
      } else if (host.includes("smartrecruiters.com")) {
        provider = "smartrecruiters";
        const smMatch = path.match(/\/([^\/]+)\/([^\/]+)/i);
        if (smMatch && smMatch[2]) {
          employerSlug = smMatch[1].toLowerCase();
          postingId = smMatch[2];
          postingKey = `smartrecruiters:${employerSlug}:${postingId}`;
        }
      } else if (host.includes("myworkdayjobs.com")) {
        provider = "workday";
        employerSlug = host.split(".")[0];
        const reqMatch = path.match(/(R\d{4,}|JR\d{4,})/i) || path.match(/\/([A-Za-z0-9_-]+)$/);
        if (reqMatch) {
          postingId = reqMatch[1] || reqMatch[0];
          postingKey = `workday:${employerSlug}:${postingId.toLowerCase()}`;
        }
      } else if (host.includes("workable.com")) {
        provider = "workable";
        employerSlug = host.startsWith("apply.") ? (path.split("/")[1] || "").toLowerCase() : host.split(".")[0];
        const wkMatch = path.match(/\/j\/([A-Za-z0-9]+)/i);
        if (wkMatch) {
          postingId = wkMatch[1];
          postingKey = `workable:${employerSlug}:${postingId}`;
        }
      } else if (host.includes("icims.com")) {
        provider = "icims";
        employerSlug = host.replace("-careers", "").split(".")[0];
        const icMatch = path.match(/\/jobs\/(\d+)/i);
        if (icMatch) {
          postingId = icMatch[1];
          postingKey = `icims:${employerSlug}:${postingId}`;
        }
      }
    } catch {}
  }

  if (!postingKey && normUrl) {
    postingKey = `url:${normUrl}`;
  }

  const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normCompany = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const titleCompanyKey = (normTitle && normCompany) ? `${normCompany} | ${normTitle}` : "";

  const crossSourceKey = titleCompanyKey ? `${titleCompanyKey}${postingId ? " | req:" + postingId : ""}` : "";

  return {
    canonicalUrl: normUrl,
    postingKey: postingKey || (titleCompanyKey ? `weak:${titleCompanyKey}` : `id:${job?.id || ""}`),
    titleCompanyKey,
    crossSourceKey,
    provider,
    employerSlug,
    postingId
  };
}

export function analyzeCanonicalIdentity(rawJobs: any[]) {
  const rawList = Array.isArray(rawJobs) ? rawJobs : [];

  const exactDuplicateGroups: any[] = [];
  const crossSourceDuplicateGroups: any[] = [];
  const titleCompanyCollisionGroups: any[] = [];
  const missingCompanyRows: any[] = [];
  const recoverableCompanyRows: any[] = [];
  const ambiguousRows: any[] = [];

  const postingKeyMap = new Map<string, any[]>();
  const titleCompanyMap = new Map<string, any[]>();

  for (const rawItem of rawList) {
    const originalCompany = String(Array.isArray(rawItem) ? rawItem[4] : (rawItem?.company || "")).trim();
    const url = String(Array.isArray(rawItem) ? rawItem[10] : (rawItem?.url || "")).trim();
    const recovered = recoverCompanyFromUrl(url);

    const job = {
      id: String(rawItem?.id || ""),
      title: String(rawItem?.title || ""),
      company: originalCompany || recovered,
      url,
      source: String(rawItem?.source || "")
    };

    if (!originalCompany) {
      missingCompanyRows.push(job);
      if (recovered) {
        recoverableCompanyRows.push({
          id: job.id,
          title: job.title,
          url: job.url,
          recoveredCompany: recovered
        });
      } else {
        ambiguousRows.push(job);
      }
    }

    const identity = getCanonicalIdentity(job);

    if (identity.postingKey) {
      if (!postingKeyMap.has(identity.postingKey)) postingKeyMap.set(identity.postingKey, []);
      postingKeyMap.get(identity.postingKey)!.push(job);
    }

    if (identity.titleCompanyKey) {
      if (!titleCompanyMap.has(identity.titleCompanyKey)) titleCompanyMap.set(identity.titleCompanyKey, []);
      titleCompanyMap.get(identity.titleCompanyKey)!.push(job);
    }
  }

  for (const [key, group] of postingKeyMap.entries()) {
    if (group.length > 1) {
      exactDuplicateGroups.push({ postingKey: key, count: group.length, jobs: group });
    }
  }

  for (const [key, group] of titleCompanyMap.entries()) {
    if (group.length > 1) {
      const uniquePostingKeys = new Set(group.map((j) => getCanonicalIdentity(j).postingKey));
      const uniqueProviders = new Set(group.map((j) => getCanonicalIdentity(j).provider));

      if (uniquePostingKeys.size > 1) {
        if (uniqueProviders.size > 1) {
          crossSourceDuplicateGroups.push({ titleCompanyKey: key, count: group.length, providers: [...uniqueProviders], jobs: group });
        } else {
          titleCompanyCollisionGroups.push({ titleCompanyKey: key, count: group.length, provider: [...uniqueProviders][0], jobs: group });
        }
      }
    }
  }

  return {
    totalJobs: rawList.length,
    missingCompanyCount: missingCompanyRows.length,
    recoverableCompanyCount: recoverableCompanyRows.length,
    ambiguousCompanyCount: ambiguousRows.length,
    exactDuplicatesCount: exactDuplicateGroups.length,
    crossSourceDuplicatesCount: crossSourceDuplicateGroups.length,
    titleCompanyCollisionsCount: titleCompanyCollisionGroups.length,
    exactDuplicates: exactDuplicateGroups,
    crossSourceDuplicates: crossSourceDuplicateGroups,
    titleCompanyCollisions: titleCompanyCollisionGroups,
    recoverableCompanies: recoverableCompanyRows,
    ambiguousRows
  };
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
