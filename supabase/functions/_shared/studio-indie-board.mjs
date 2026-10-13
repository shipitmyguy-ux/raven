// Public Work With Indies cards and authoritative per-listing JobPosting data.
// No third-party application URL is fetched; canonical board URLs remain honest.
const HOST='https://www.workwithindies.com',MAX=4000000;
const entity=s=>String(s??'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(lt|gt|amp|quot|apos|nbsp|rsquo|lsquo|ndash|mdash);/gi,(_,v)=>({lt:'<',gt:'>',amp:'&',quot:'"',apos:"'",nbsp:' ',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—'}[v.toLowerCase()]));
const clean=(s,n=20000)=>entity(entity(s)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
// Webflow emits literal newlines inside description strings. Escape controls only
// while inside a JSON string; observed Webflow \\_ is normalized as literal underscore.
// No script evaluation or object syntax relaxation.
function structured(raw){let out='',inside=false,escaped=false;for(const c of raw){if(inside&&c.charCodeAt(0)<32){out+='\\u'+c.charCodeAt(0).toString(16).padStart(4,'0');continue;}out+=c;if(escaped){escaped=false;continue;}if(inside&&c==='\\'){escaped=true;continue;}if(c==='"')inside=!inside;}return JSON.parse(out.replace(/\\_/g,'_'));}
function bounded(s){if(typeof s!=='string'||s.length>MAX)throw Error('Invalid indie board response size');return s;}
function board(source){if(source.provider!=='workwithindies'||source.board_key!=='workwithindies')throw Error('Invalid indie board');}
const pathOK=p=>/^\/careers\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p)&&p.length<=400;
export function indieBoardEndpoint(source){board(source);return HOST+'/';}
export function parseIndieBoard(source,html){
 board(source);bounded(html);const jobs=[],seen=new Set();
 for(const m of html.matchAll(/<a\b([^>]*\bclass="[^"]*\bjob-card\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)){
  const path=/\bhref="([^"]+)"/.exec(m[1])?.[1];if(!pathOK(path))throw Error('Invalid indie listing path');
  const body=m[2],title=clean(/class="text-block-14"[^>]*>([\s\S]*?)<\/div>/.exec(body)?.[1],5000);
  const fields=[...body.matchAll(/class="job-card-text-smol"[^>]*>([\s\S]*?)<\/div>/g)].map(m=>clean(m[1],1000));
  if(!title||!fields[0])throw Error('Indie listing identity missing');
  const url=HOST+path;if(seen.has(url))continue;seen.add(url);
  jobs.push({provider_job_id:path.slice(9),title,company:fields[0],location:fields.slice(2).join('; '),remote:false,url,snippet:''});
 }
 if(!/class="[^"]*w-pagination-wrapper/.test(html))throw Error('Indie list container missing');
 // Observed homepage has no pagination. Never silently accept an incomplete page.
 if(/class="[^"]*w-pagination-(?:next|previous)/.test(html))throw Error('Indie board pagination requires verification');
 if(!jobs.length)throw Error('Indie board cards missing');
 return {jobs,fetched:jobs.length};
}
export function parseIndieDetail(source,job,html,now=Date.now()){
 board(source);bounded(html);if(!job.url.startsWith(HOST)||!pathOK(job.url.slice(HOST.length)))throw Error('Invalid indie detail URL');
 // Closed warning exists even for active posts, hidden by Webflow condition.
 const closed=/<div\b[^>]*class="([^"]*closed-notif[^\"]*)"/.exec(html);
 if(closed&&!closed[1].includes('w-condition-invisible')&&/This position has been closed/.test(html))return {excluded:true};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=structured(m[1]);}catch{continue;}
  for(const item of (Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data])){
   if(item?.['@type']!=='JobPosting')continue;
   if(item.url!==job.url||clean(item.title,5000)!==job.title||clean(item.hiringOrganization?.name,1000)!==job.company)throw Error('Indie detail identity mismatch');
   if(item.validThrough&&Number.isFinite(Date.parse(item.validThrough))&&Date.parse(item.validThrough)<now)return {excluded:true};
   const snippet=clean(item.description);if(!snippet)throw Error('Indie description missing');
   if(/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|no (?:pay|compensation)|equity[ -]only)\b/i.test(snippet))return {excluded:true};
   const requirements=item.applicantLocationRequirements;
   const countries=(Array.isArray(requirements)?requirements:[requirements]).filter(Boolean).map(x=>clean(x.name,1000)).filter(x=>x&&!/^(null|undefined)$/i.test(x));
   return {snippet,remote:item.jobLocationType==='TELECOMMUTE',location:countries.length?[...new Set([...countries,...(job.location&&!/^anywhere$/i.test(job.location)?[job.location]:[])])].join('; '):job.location,posted_at:Number.isFinite(Date.parse(item.datePosted))?new Date(item.datePosted).toISOString():''};
  }
 }
 throw Error('Indie JobPosting missing');
}
export async function collectIndieBoard(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const result=parseIndieBoard(source,await fetchText(indieBoardEndpoint(source)));
// Cache callback must restore snippet AND authoritative remote/location with matching
 // title/company and fresh timestamp; listing cards alone do not establish remote.
 const candidates=result.jobs.filter(detailAllowed);if(prepareDetails)await prepareDetails(candidates);
 const pending=candidates.filter(j=>!j.snippet),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=pending.length?cursor%pending.length:0;
 const selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;const errors=[];
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{const detail=parseIndieDetail(source,job,await fetchText(job.url));if(detail.excluded){job.excluded=true;excluded++;return;}Object.assign(job,detail,{studio_description_updated_at:new Date().toISOString()});completed++;}catch{errors.push('Indie listing description unavailable');}}));}
 // Only reviewed descriptions can establish a paid, active listing and remote status.
 const jobs=candidates.filter(j=>j.snippet&&!j.excluded&&!/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|equity[ -]only)\b/i.test(j.snippet));
 const deferred=pending.length-attempted,missing=pending.length-completed-excluded;
 return {jobs,fetched:result.fetched,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?(jobs.length?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?[...new Set(errors),...(deferred?[`${deferred} descriptions deferred by scan budget`]:[])].join('; '):null}};
}
