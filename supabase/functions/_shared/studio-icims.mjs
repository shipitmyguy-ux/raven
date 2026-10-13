// ZeniMax's official directory embeds the complete public feed, including
// company names. iCIMS search redirects back to that directory.
const LIST = 'https://jobs.zenimax.com/jobs';
const HOST = 'careers-zenimax.icims.com';
const LIMIT = 1000;
function entities(value) {
 return String(value).replace(/&(quot|apos|amp|lt|gt|nbsp);|&#(\d+);|&#x([a-f0-9]+);/gi,(m,n,d,h)=>n?({quot:'"',apos:"'",amp:'&',lt:'<',gt:'>',nbsp:' '})[n.toLowerCase()]:String.fromCodePoint(Number.parseInt(d||h,d?10:16)));
}
const clean = value => entities(String(value??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,20000);
export function icimsJobUrl(raw,id) {
 let u;try{u=new URL(raw);}catch{throw Error('Invalid iCIMS job URL');}
 if(u.protocol!=='https:'||u.hostname!==HOST||u.port||u.username||u.password||!new RegExp(`^/jobs/${id}/[^/]+/job$`).test(u.pathname)||!/^\d{1,12}$/.test(String(id)))throw Error('Invalid iCIMS job URL');
 u.search='';u.hash='';return u.toString();
}
function scope(source) {
 if(source.board_key!=='zenimax')throw Error('Unsupported iCIMS board');
 const s=source.job_scope;
 if(!s||!['company','department'].includes(s.field)||!Array.isArray(s.values)||!s.values.length||s.values.length>20||s.values.some(v=>typeof v!=='string'||!v.trim()||v.length>200))throw Error('Exact iCIMS studio scope required');
 return s;
}
export function parseIcimsDirectory(html) {
 if(typeof html!=='string'||new TextEncoder().encode(html).length>4000000)throw Error('iCIMS response too large');
 const match=html.match(/<job-filter\b[^>]*\s:raw-data="([^"]+)"/i);
 if(!match)throw Error('Official ZeniMax job feed missing');
 const data=JSON.parse(entities(match[1]));
 if(!Array.isArray(data.jobs)||data.jobs.length>LIMIT)throw Error('Unexpected ZeniMax job feed');
 return data.jobs;
}
export function parseIcimsDetail(html,url) {
 if(typeof html!=='string'||new TextEncoder().encode(html).length>4000000)throw Error('iCIMS response too large');
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  const records=Array.isArray(data)?data:data['@graph']||[data];
  for(const record of records){if(record?.['@type']!=='JobPosting')continue;
   if(record.url!==url)throw Error('iCIMS detail job mismatch');
   if(!clean(record.description))throw Error('iCIMS description missing');
   return record;
  }
 }
 throw Error('iCIMS JobPosting detail missing');
}
export async function collectIcims(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}) {
 const s=scope(source);if(typeof fetchText!=='function')throw Error('iCIMS text fetch required');
 const allowed=new Set(s.values.map(v=>v.trim().toLowerCase()));
 if(Date.now()+6000>deadline)throw Error('iCIMS scan budget exhausted');
 const records=parseIcimsDirectory(await fetchText(LIST));
 const selected=records.filter(r=>r&&allowed.has(clean(s.field==='company'?r.location?.name:r.department_name).toLowerCase()));
 const jobs=selected.map(r=>({provider_job_id:String(r.id),title:clean(r.title),company:source.studio_name,location:clean([r.location?.formatted_name,...(r.additionalLocations||[]).map(v=>v.formatted_name)].filter(Boolean).join('; ')),remote:/\bremote\b/i.test(r.location?.formatted_name||''),url:icimsJobUrl(r.link,r.id),snippet:'',posted_at:''})).filter(r=>r.title);
 // Art-title candidates must reach details before location eligibility is
 // decided: structured details can reveal TELECOMMUTE absent from the list.
 const candidates=jobs.filter(detailAllowed);
 if(prepareDetails)await prepareDetails(candidates);
 const pending=candidates.filter(job=>!job.snippet);
 const cursor=source.detail_cursor??0;
 if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('Invalid iCIMS detail cursor');
 const start=pending.length?cursor%pending.length:0;
 const rotated=pending.slice(start).concat(pending.slice(0,start));
 let attempted=0,completed=0;const errors=[];
 // Twelve details, two at a time, under the same source deadline.
 for(let i=0;i<Math.min(pending.length,12);i+=2){if(Date.now()+6000>deadline)break;
  await Promise.all(rotated.slice(i,Math.min(i+2,12)).map(async job=>{attempted++;try{
   const detail=parseIcimsDetail(await fetchText(job.url+'?in_iframe=1'),job.url);
   if(clean(detail.title)!==job.title)throw Error('iCIMS detail title mismatch');
   job.snippet=clean(detail.description);job.posted_at=String(detail.datePosted||'');
   job.remote ||= detail.jobLocationType==='TELECOMMUTE';job.studio_description_updated_at=new Date().toISOString();completed++;
  }catch(e){errors.push(String(e.message||e));}}));
 }
 const deferred=pending.length-attempted;
 return {jobs,fetched:records.length,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:completed===pending.length?'complete':completed||candidates.some(j=>j.snippet)?'partial':'failed',attempted,completed,deferred,error:completed===pending.length?null:[...new Set(errors),...(deferred?[`${deferred} descriptions deferred by scan budget`]:[])].join('; ').slice(0,1000)}};
}
