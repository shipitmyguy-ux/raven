// Jobylon's public company widget contains literal data; never execute its scripts.
const MAX_HTML=4000000, MAX_JOBS=1000;
const clean=(s,n=20000)=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,n);
function board(source){
 if(source.provider!=='jobylon'||! /^[1-9][0-9]{0,9}$/.test(String(source.board_key)))throw Error('Invalid Jobylon board');
 // Company linkage is independently verified, rather than inferred from a board label.
 if(String(source.board_key)!=='2986'||source.studio_name!=='Remedy Entertainment')throw Error('Unverified Jobylon company');
 return String(source.board_key);
}
export function jobylonEndpoint(source){return `https://cdn.jobylon.com/jobs/companies/${board(source)}/embed/v2/?target=jobylon-jobs-widget&page_size=1000`;}
function bounded(html){if(typeof html!=='string'||html.length>MAX_HTML)throw Error('Invalid Jobylon response size');return html;}
function literal(raw){
 // The observed server uses Django escapejs: unicode escapes, with single quoted strings.
 if(/\\(?!u[0-9a-fA-F]{4}|[\\'"/bfnrt])/.test(raw))throw Error('Invalid Jobylon string');
 return JSON.parse('"'+raw.replace(/\\'/g,"'").replace(/(?<!\\)"/g,'\\"')+'"');
}
function field(block,key){const m=new RegExp('\\b'+key+":\\s*'((?:\\\\.|[^'\\\\])*)'").exec(block);return m?literal(m[1]):'';}
function date(raw){
 const human=/^([A-Za-z]+)\.? (\d{1,2}), (\d{4})$/.exec(raw);
 const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 let normalized=raw;
 if(human){const month=months.indexOf(human[1].slice(0,3).toLowerCase());if(month<0)return '';normalized=`${human[3]}-${String(month+1).padStart(2,'0')}-${human[2].padStart(2,'0')}`;}
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(normalized))return '';
 const stamp=Date.parse(normalized);return Number.isFinite(stamp)?new Date(stamp).toISOString():'';
}
export function parseJobylonWidget(source,html){
 const id=board(source);bounded(html);
 const m=/JBL\.embed_v2\['jobs'\]\s*=\s*\[([\s\S]*?)\];/.exec(html);
 if(!m)throw Error('Jobylon jobs data missing');
 const records=m[1].split(/(?=\{\s*id:\s*')/).filter(v=>/^\{\s*id:/.test(v.trim()));
 if(!records.length&&m[1].trim())throw Error('Unexpected Jobylon jobs data');
 if(records.length>MAX_JOBS)throw Error('Jobylon job limit exceeded');
 const jobs=[],seen=new Set();
 for(const record of records){
  if(field(record,'company_id')!==id||field(record,'company')!==source.studio_name)throw Error('Jobylon company mismatch');
  const jobId=field(record,'id'),path=field(record,'url'),title=clean(field(record,'title'),5000);
  if(!/^[1-9][0-9]{0,15}$/.test(jobId)||!new RegExp('^/jobs/'+jobId+'-[a-zA-Z0-9_-]+/$').test(path)||!title)throw Error('Invalid Jobylon job identity');
  if(/\bis_internal:\s*true\b/.test(record))continue;
  const locations=/\blocations:\s*\[([^\]]*)\]/.exec(record)?.[1]||'';
  const location=[...locations.matchAll(/'((?:\\.|[^'\\])*)'/g)].map(v=>literal(v[1])).join('; ')||field(record,'locations_text');
  const workspace=field(record,'workspace');
  const job={provider_job_id:jobId,title,company:source.studio_name,location:clean(location,1000),remote:/^(remote|fully remote)$/i.test(workspace),url:`https://emp.jobylon.com${path}`,snippet:'',posted_at:date(field(record,'published_date'))};
  if(!seen.has(job.url)){seen.add(job.url);jobs.push(job);}
 }
 return {jobs,fetched:records.length};
}
export function parseJobylonDetail(source,job,html){
 board(source);bounded(html);
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  const candidates=Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data];
  for(const item of candidates){
   if(item?.['@type']!=='JobPosting')continue;
   if(item.hiringOrganization?.name!==source.studio_name||clean(item.title,5000)!==job.title)throw Error('Jobylon detail identity mismatch');
   if(item.url&&item.url!==job.url)throw Error('Jobylon detail URL mismatch');
   const snippet=clean(item.description);if(!snippet)throw Error('Jobylon description missing');
   return {snippet,posted_at:date(String(item.datePosted||'')),remote:item.jobLocationType==='TELECOMMUTE'?true:undefined};
  }
 }
 throw Error('Jobylon JobPosting missing');
}
export async function collectJobylon(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const result=parseJobylonWidget(source,await fetchText(jobylonEndpoint(source)));
 const candidates=result.jobs.filter(detailAllowed);
 if(prepareDetails)await prepareDetails(candidates);
 const pending=candidates.filter(j=>!j.snippet);
 const cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0;
 const start=pending.length?cursor%pending.length:0;
 const selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0;const errors=[];
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;
  await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{
   const detail=parseJobylonDetail(source,job,await fetchText(job.url));job.snippet=detail.snippet;if(detail.remote===true)job.remote=true;if(detail.posted_at)job.posted_at=detail.posted_at;job.studio_description_updated_at=new Date().toISOString();completed++;
  }catch{errors.push('Jobylon posting description unavailable');}}));
 }
 const deferred=pending.length-attempted,missing=pending.length-completed;
 return {...result,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?(completed||candidates.some(j=>j.snippet)?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?[...new Set(errors),...(deferred?[`${deferred} descriptions deferred by scan budget`]:[])].join('; '):null}};
}
