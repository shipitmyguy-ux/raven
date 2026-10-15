// Resolve public board Apply links without sending applicant data or following
// arbitrary URLs. The saved job and its document identity never change.
const boards=new Set(['hitmarker.net','www.workwithindies.com','remotegamejobs.com','www.artstation.com','www.gamesjobsdirect.com','ingamejob.com']);
const ats=new Set(['jobs.lever.co','jobs.ashbyhq.com','job-boards.greenhouse.io','boards.greenhouse.io','apply.workable.com','jobs.smartrecruiters.com']);
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const key=s=>clean(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function safe(value){const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password)throw Error('Unsafe application destination');return u;}
function employerUrl(value){try{const u=safe(value);return (ats.has(u.hostname)||/^[a-z0-9-]+\.(?:breezy\.hr|bamboohr\.com|recruitee\.com|teamtailor\.com)$/.test(u.hostname))&&u.pathname!=='/';}catch{return false;}}
export function isApplicationBoardUrl(value){try{return boards.has(safe(value).hostname);}catch{return false;}}
async function publicHtml(url,fetchImpl){
 const r=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
 if(!r.ok||!/^text\/html\b/i.test(r.headers.get('content-type')||''))throw Error('Application page could not be verified');
 let size=0,chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>4000000)throw Error('Application page too large');chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function resolveApplicationDestination(job,{fetchImpl=fetch}={}){
 const source=safe(job.url);
 if(!boards.has(source.hostname))return {job_id:String(job.id),source_url:job.url,destination_url:job.url,resolved:false};
 const html=await publicHtml(source.href,fetchImpl),visible=key(html);
 if(!key(job.title)||!key(job.company)||!visible.includes(key(job.title))||!visible.includes(key(job.company)))throw Error('Board job identity could not be verified');
 const candidates=new Set();
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
  if(!href||!/^apply(?:\s|$)/i.test(clean(m[2])))continue;
  let target;try{target=new URL(href.replace(/&amp;/g,'&'),source).href;}catch{continue;}
  if(employerUrl(target))candidates.add(target);
 }
 // Some boards render Apply from a data attribute rather than an SSR anchor.
 // Read only explicit application URL fields, never arbitrary URLs in prose.
 const data=html.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replaceAll('\\/','/');
 for(const m of data.matchAll(/"(?:applyUrl|applicationUrl|apply_url|application_url|sprig:variables\[url\])"\s*:\s*"(?:[a-f0-9]{64})?(https:\/\/[^"\s<>]+)"/g)){
  if(employerUrl(m[1]))candidates.add(m[1]);
 }
 if(candidates.size!==1)throw Error('No unique verified employer Apply link. Open the listing for manual review.');
 const target=[...candidates][0],detail=key(await publicHtml(target,fetchImpl));
 if(!detail.includes(key(job.title))||!detail.includes(key(job.company)))throw Error('Employer posting does not match the saved job');
 return {job_id:String(job.id),source_url:job.url,destination_url:target,resolved:true};
}
