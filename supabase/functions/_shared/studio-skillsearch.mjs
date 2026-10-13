// Official Art Jobs category and canonical vacancy pages. Recruiter is not the studio.
const HOST='https://www.skillsearch.com',MAX=4000000,MAX_PAGES=20;
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0]==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|nbsp|quot|apos|lt|gt|ndash|mdash|pound|rsquo|lsquo);/g,(_,v)=>({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',pound:'£',rsquo:"'",lsquo:"'"}[v])).replace(/\s+/g,' ').trim();
function board(s){if(s.provider!=='skillsearch'||s.board_key!=='skillsearch')throw Error('Invalid Skillsearch board');}
function bounded(s){if(typeof s!=='string'||s.length>MAX)throw Error('Invalid Skillsearch response');return s;}
function safeURL(s){try{const u=new URL(s);return u.origin===HOST&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/vacancy\/[a-z0-9][a-z0-9-]*-\d+$/.test(u.pathname)&&u.pathname.length<500;}catch{return false;}}
export function skillsearchEndpoint(source,page=1){board(source);if(!Number.isInteger(page)||page<1||page>MAX_PAGES)throw Error('Invalid Skillsearch page');return HOST+'/search?groups=1'+(page>1?'&page='+page:'');}
export function parseSkillsearchPage(source,html,page=1){board(source);bounded(html);skillsearchEndpoint(source,page);const total=Number(/class="results_count">\s*(\d+) results\s*<\/div>/.exec(html)?.[1]);if(!Number.isInteger(total)||total<0||total>1000||!html.includes('class="standard-results"'))throw Error('Skillsearch total/list container unknown');
 const jobs=[];for(const m of html.matchAll(/<div id="result-(\d+)" class="column search-result">([\s\S]*?)(?=<div id="result-|<section class="pagination"|<\/section>)/g)){
  const a=/<h3><a href="([^"]+)">([\s\S]*?)<\/a><\/h3>/.exec(m[2]);if(!a)throw Error('Skillsearch card missing');const url=HOST+a[1],title=clean(a[2]).slice(0,5000);if(!safeURL(url)||!url.endsWith('-'+m[1])||!title)throw Error('Skillsearch listing identity invalid');const location=clean(/class="search-result__location"[^>]*>([\s\S]*?)<\/a>/.exec(m[2])?.[1]);jobs.push({provider_job_id:m[1],title,company:'Skillsearch (undisclosed client)',url,location,remote:false,snippet:''});}
 if(new Set(jobs.map(j=>j.url)).size!==jobs.length||jobs.length>50||jobs.length>total)throw Error('Skillsearch page incomplete/duplicate');
 const nextTag=/<a\b([^>]*class="[^"]*pagination__link--next[^"]*"[^>]*)>/.exec(html)?.[1];let next=null;
 if(nextTag&&!nextTag.includes('pagination__link--inactive')){const href=clean(/href="([^"]+)"/.exec(nextTag)?.[1]);const expected=skillsearchEndpoint(source,page+1);if(href!==expected)throw Error('Skillsearch pagination requires verification');next=page+1;}
 if(!jobs.length&&total>0)throw Error('Skillsearch cards missing');return {jobs,total,next};}
export function parseSkillsearchDetail(source,job,html,now=Date.now()){
 board(source);bounded(html);if(!safeURL(job.url))throw Error('Invalid Skillsearch detail URL');const canonical=/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1];if(canonical!==job.url)throw Error('Skillsearch canonical identity mismatch');
 const body=/<section class="job-information">([\s\S]*?)<\/section>/.exec(html)?.[1];if(!body)throw Error('Skillsearch vacancy container missing');const visible=clean(body);
 if(/(?:job|position|vacancy) (?:has (?:been )?|is )?(?:closed|expired|filled)|no longer (?:available|accepting applications)/i.test(visible))return {excluded:true};
 if(/\b(?:closed|expired|filled)\b/i.test(job.title))return {excluded:true};
 if(!/href="#apply-form"[^>]*>[\s\S]*?Apply Now/.test(body))throw Error('Skillsearch activity unknown');
 const visibleTitle=clean(/class="job-header__title">([\s\S]*?)<\/h1>/.exec(html)?.[1]);if(visibleTitle!==job.title)throw Error('Skillsearch title mismatch');
 const reference=/class="job-information__reference">\s*Reference:\s*(\d+)/.exec(body)?.[1];if(!reference)throw Error('Skillsearch reference missing');
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let item;try{item=JSON.parse(m[1]);}catch{continue;}if(item?.['@type']!=='JobPosting')continue;
  if(clean(item.title)!==job.title||String(item.identifier?.value)!==reference||item.identifier?.name!=='Job reference'||item.hiringOrganization?.name!=='Skillsearch Limited'||item.url&&item.url!==job.url)throw Error('Skillsearch structured identity mismatch');
  if(!Number.isFinite(Date.parse(item.validThrough)))throw Error('Skillsearch expiry missing');if(Date.parse(item.validThrough)<now)return {excluded:true};
  if(!Number.isFinite(Date.parse(item.datePosted))||Date.parse(item.datePosted)>now)throw Error('Skillsearch posting date invalid');
  const snippet=clean(item.description).slice(0,20000);if(!snippet)throw Error('Skillsearch description missing');
  if(/\b(?:talent[ -]?(?:pool|pipeline)|open application|general (?:application|interest)|speculative (?:application|opportunit)|evergreen)\b/i.test(job.title)||/\b2[ -]?d\b/i.test(job.title)&&!/\b3[ -]?d\b/i.test(job.title)||/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|equity[ -]only|no (?:pay|compensation))\b/i.test(snippet))return {excluded:true};
  if(/\b(?:talent pool|talent pipeline|register (?:your )?interest|future (?:roles|opportunities|vacancies)|general application|expression of interest)\b/i.test(snippet)||/\b(?:zero compensation|no budget|no salary|uncompensated)\b|(?:\$|£|€)0\s*(?:per|\/)/i.test(snippet))return {excluded:true};
  const location=clean(/<dt class="job-information__attributes-label">Location<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/.exec(body)?.[1]);if(!location||location!==job.location)throw Error('Skillsearch location mismatch');
  const scopeText=clean(String(item.description).replace(/<\/(?:p|li|div|h[1-6])>/gi,'. '));
  const restrictions=scopeText.split(/(?<=[.!?])\s+/).filter(s=>/\b(?:only|must be based|UK[ -‑]based|US[ -‑]based|United States|timezone|time zone|core hours|hybrid|on-site|onsite)\b/i.test(s)&&/\b(?:remote|based|location|country|countries|UK|US|USA|United|Europe|Canada|Australia|GMT|UTC|hours|office|studio)\b/i.test(s)).slice(0,3).map(s=>s.slice(0,400));
  const onsite=/\bhybrid\b|must work (?:from|in|at) (?:our |the )?(?:office|studio)|\b(?:initially remote|remote (?:initially|until))\b|\b(?:must|required|expected|mandatory)[^.]{0,100}\b(?:relocat|office|on[ -]?site)|\b(?:relocat|office|on[ -]?site)[^.]{0,100}\b(?:required|mandatory)\b/i.test(snippet);
  const remote=item.jobLocationType==='TELECOMMUTE'&&!onsite;
  return {snippet,company:'Skillsearch (undisclosed client)',remote,location:[location,...restrictions,...(onsite?['Hybrid / onsite condition stated in description']:[])].join('; '),posted_at:new Date(item.datePosted).toISOString(),studio_description_updated_at:new Date(now).toISOString()};
 }
 throw Error('Skillsearch JobPosting missing');
}
export async function collectSkillsearch(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed}={}){
 const jobs=[],seen=new Set();let total=null,page=1;
 while(page){if(Date.now()+6000>deadline)throw Error('Skillsearch pagination deferred');const r=parseSkillsearchPage(source,await fetchText(skillsearchEndpoint(source,page)),page);if(total===null)total=r.total;else if(total!==r.total)throw Error('Skillsearch total changed');for(const j of r.jobs){if(seen.has(j.url))throw Error('Skillsearch duplicate pagination');seen.add(j.url);jobs.push(j);}page=r.next;}
 if(jobs.length!==total)throw Error('Skillsearch pagination incomplete');
 // Mutable recruiter descriptions require fresh active-detail validation every scan.
 const candidates=jobs.filter(detailAllowed),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=candidates.length?cursor%candidates.length:0,selected=[...candidates.slice(start),...candidates.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{const d=parseSkillsearchDetail(source,job,await fetchText(job.url));if(d.excluded){job.excluded=true;excluded++;return;}Object.assign(job,d);completed++;}catch{job.detail_failed=true;}}));}
 const missing=candidates.length-completed-excluded,deferred=candidates.length-attempted;
 return {jobs:candidates.filter(j=>j.snippet&&!j.excluded&&(j.remote||!/\bremote\b/i.test(j.location))&&jobAllowed(j)),fetched:jobs.length,detail_cursor_next:candidates.length?(start+attempted)%candidates.length:0,details:{status:missing?'partial':'complete',attempted,completed,deferred,error:missing?`${missing} recruiter role details unverified; ${deferred} deferred`:null}};
}
