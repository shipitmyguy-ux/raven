// Official server HTML only. Never fetch outbound applications or claim indie ownership.
const HOST='https://remotegamejobs.com',MAX=4000000;
const entity=s=>String(s??'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(lt|gt|amp|quot|apos|nbsp|rsquo|lsquo|ndash|mdash);/gi,(_,v)=>({lt:'<',gt:'>',amp:'&',quot:'"',apos:"'",nbsp:' ',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—'}[v.toLowerCase()]));
const clean=(s,n=20000)=>entity(entity(s)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function bounded(s){if(typeof s!=='string'||s.length>MAX)throw Error('Invalid RemoteGameJobs response size');return s;}
function board(source){if(source.provider!=='remotegamejobs'||source.board_key!=='remotegamejobs')throw Error('Invalid RemoteGameJobs board');}
function safeURL(s){try{const u=new URL(s);return u.origin===HOST&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname)&&u.pathname.length<=400;}catch{return false;}}
const unpaid=s=>/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|no (?:pay|compensation)|equity[ -]only|equity only)\b/i.test(s);
export function remoteGameJobsEndpoint(source){board(source);return HOST+'/';}
export function parseRemoteGameJobs(source,html){
 board(source);bounded(html);
 const frame=/<turbo-frame\b[^>]*\bid="jobs"[^>]*>([\s\S]*?)<\/turbo-frame>/i.exec(html)?.[1];
 if(!frame)throw Error('RemoteGameJobs listing container missing');
 const total=Number(/<h2>\s*(\d+) remote game jobs\s*<\/h2>/i.exec(frame)?.[1]);
 if(!Number.isInteger(total)||total<0||total>1000)throw Error('RemoteGameJobs total unknown');
 if(/(?:\brel=["']next|\bclass=["'][^"']*pagination|[?&]page=|<turbo-frame[^>]*\bsrc=|load.more)/i.test(frame))throw Error('RemoteGameJobs pagination requires verification');
 const jobs=[],seen=new Set();
 for(const m of frame.matchAll(/<a\b([^>]*\bclass="card"[^>]*)>([\s\S]*?)<\/a>/g)){
  const url=entity(/\bhref="([^"]+)"/.exec(m[1])?.[1]);if(!safeURL(url))throw Error('Invalid RemoteGameJobs listing URL');
  const title=clean(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[2])?.[1],5000),company=clean(/class="sub"[^>]*>\s*<b>([\s\S]*?)<\/b>/.exec(m[2])?.[1],1000);
  if(!title||!company)throw Error('RemoteGameJobs listing identity missing');if(seen.has(url))continue;seen.add(url);
  jobs.push({provider_job_id:new URL(url).pathname.slice(6),title,company,location:clean(/class="scope"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/.exec(m[2])?.[1],2000),remote:false,url,snippet:''});
 }
 if(jobs.length!==total)throw Error('RemoteGameJobs listing incomplete');
 return {jobs,fetched:jobs.length};
}
export function parseRemoteGameJobsDetail(source,job,html,now=Date.now()){
 board(source);bounded(html);if(!safeURL(job.url))throw Error('Invalid RemoteGameJobs detail URL');
 if(/(?:position|job|listing) (?:has (?:been )?)?(?:closed|expired)|no longer accepting applications/i.test(clean(html)))return {excluded:true};
 const facts=/<div class="facts">([\s\S]*?)<div class="prose content">/.exec(html)?.[1];
 if(!facts||!html.includes('Listing ends in')||!(html.includes('/goto/'+new URL(job.url).pathname.slice(6))||html.includes('data-apply-beacon="/click_apply/'+new URL(job.url).pathname.slice(6)+'"')))throw Error('RemoteGameJobs active listing state missing');
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(m[1]);}catch{continue;}
  for(const item of Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data]){
   if(item?.['@type']!=='JobPosting')continue;
   if(item.url!==job.url||clean(item.title,5000)!==job.title||clean(item.hiringOrganization?.name,1000)!==job.company)throw Error('RemoteGameJobs detail identity mismatch');
   if(!Number.isFinite(Date.parse(item.validThrough)))throw Error('RemoteGameJobs expiration missing');
   if(Date.parse(item.validThrough)<now)return {excluded:true};
   const snippet=clean(item.description);if(!snippet)throw Error('RemoteGameJobs description missing');
   if(unpaid(snippet+' '+clean(facts)))return {excluded:true};
   if(item.jobLocationType!=='TELECOMMUTE')throw Error('RemoteGameJobs remote status missing');
   const scope=clean(/Remote scope<\/span>\s*<span class="scope"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/.exec(facts)?.[1],2000);
   if(!scope||scope!==job.location)throw Error('RemoteGameJobs scope mismatch');
   // Board structured country lists can enumerate every country despite preferred timezones.
   // Retain the advertised human scope plus full description instead of calling it worldwide.
   return {snippet,remote:true,location:scope,posted_at:Number.isFinite(Date.parse(item.datePosted))?new Date(item.datePosted).toISOString():''};
  }
 }
 throw Error('RemoteGameJobs JobPosting missing');
}
export async function collectRemoteGameJobs(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const result=parseRemoteGameJobs(source,await fetchText(remoteGameJobsEndpoint(source))),candidates=result.jobs.filter(detailAllowed);
 if(prepareDetails)await prepareDetails(candidates);
 const pending=candidates.filter(j=>!j.snippet),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=pending.length?cursor%pending.length:0;
 const selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;const errors=[];
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{const detail=parseRemoteGameJobsDetail(source,job,await fetchText(job.url));if(detail.excluded){job.excluded=true;excluded++;return;}Object.assign(job,detail,{studio_description_updated_at:new Date().toISOString()});completed++;}catch{errors.push('RemoteGameJobs listing description unavailable');}}));}
 const jobs=candidates.filter(j=>j.snippet&&j.remote&&!j.excluded&&!unpaid(j.snippet)),deferred=pending.length-attempted,missing=pending.length-completed-excluded;
 return {jobs,fetched:result.fetched,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?(jobs.length?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?[...new Set(errors),...(deferred?[`${deferred} descriptions deferred by scan budget`]:[])].join('; '):null}};
}
