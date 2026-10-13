// Official public API advertised by ArtStation's jobs application. No outbound apply requests.
const HOST='https://www.artstation.com',PER=50,MAX_PAGES=20,MAX=4000000;
const entity=s=>String(s??'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(lt|gt|amp|quot|apos|nbsp|rsquo|lsquo|ndash|mdash);/gi,(_,v)=>({lt:'<',gt:'>',amp:'&',quot:'"',apos:"'",nbsp:' ',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—'}[v.toLowerCase()]));
const clean=(s,n=20000)=>entity(entity(s)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function board(s){if(s.provider!=='artstation'||s.board_key!=='artstation')throw Error('Invalid ArtStation board');}
export function artStationEndpoint(source,page=1){board(source);if(!Number.isInteger(page)||page<1||page>MAX_PAGES)throw Error('Invalid ArtStation page');return `${HOST}/api/v2/jobs/public/jobs.json?page=${page}&per_page=${PER}`;}
export function parseArtStationPage(source,data,page=1){
 board(source);artStationEndpoint(source,page);
 if(!data||!Number.isInteger(data.total_count)||data.total_count<0||data.total_count>PER*MAX_PAGES||!Array.isArray(data.data)||JSON.stringify(data).length>MAX)throw Error('ArtStation response/total invalid');
 const expected=Math.min(PER,Math.max(0,data.total_count-(page-1)*PER));
 if(data.data.length!==expected)throw Error('ArtStation page incomplete');
 const ids=new Set();for(const j of data.data){if(!j||!Number.isInteger(j.id)||j.id<1||typeof j.hash_id!=='string'||!/^[A-Za-z0-9]{4,20}$/.test(j.hash_id)||ids.has(j.id))throw Error('ArtStation listing identity invalid');ids.add(j.id);}
 return {total:data.total_count,rows:data.data};
}
export function normalizeArtStationJob(row,now=Date.now()){
 if(!row||!Number.isInteger(row.id)||row.id<1||typeof row.hash_id!=='string'||!/^[A-Za-z0-9]{4,20}$/.test(row.hash_id))throw Error('ArtStation listing identity invalid');
 const title=clean(row.title,5000),company=clean(row.company_name,1000);
 if(!title||!company||!Number.isInteger(row.recruitment_company_id)||row.recruitment_company_id<1||!row.recruitment_company||clean(row.recruitment_company.name,1000)!==company||row.recruitment_company.id!==row.recruitment_company_id)throw Error('ArtStation employer identity mismatch');
 const placement=row.listing_placement;
 if(row.job_state!=='approved'||row.deleted_at||placement?.displaced_at)return null;
 if(!Number.isFinite(Date.parse(placement?.expired_at)))throw Error('ArtStation expiry missing');
 if(Date.parse(placement.expired_at)<now)return null;
 if(!Number.isFinite(Date.parse(placement.posted_at)))throw Error('ArtStation posting date missing');
 if(Date.parse(placement.posted_at)>now||Date.parse(placement.expired_at)<=Date.parse(placement.posted_at))return null;
 const description=clean(row.description),skills=clean(row.skills),about=clean(row.about),how=clean(row.how_to_apply);
 if(!description)throw Error('ArtStation description missing');
 const snippet=[description,skills&&'Skills and requirements: '+skills,about&&'About studio: '+about,how&&'How to apply: '+how].filter(Boolean).join('\n\n').slice(0,20000);
 if(/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|no (?:pay|compensation)|equity[ -]only)\b/i.test(snippet))return null;
 const localities=row.recruitment_localities;if(!Array.isArray(localities))throw Error('ArtStation location metadata missing');
 const locations=[...new Set(localities.map(x=>clean(x?.locality?.formatted_name,1000)).filter(Boolean))];
 if(typeof row.work_remotely!=='boolean')throw Error('ArtStation remote metadata missing');
 const restrictions=[...new Set((description+' '+skills).split(/(?<=[.!?])\s+|[\r\n]+/).filter(s=>/\b(?:only|must be based|eligible to work|work authorization|timezone|time zone|core hours|hybrid|on-site|onsite)\b/i.test(s)&&/\b(?:remote|based|location|country|countries|UK|US|USA|United|Europe|Canada|Australia|GMT|UTC|hours|office|studio)\b/i.test(s)).map(s=>s.slice(0,400)))].slice(0,3);
 const hybrid=/\bhybrid\b|on[ -]?site (?:a few|\d+|days|days? (?:per|a))|(?:required|mandatory) (?:office|onsite|on-site)|must (?:work|attend|be based) (?:from|in|at) (?:our |the )?(?:office|studio)/i.test(description+' '+skills);
 return {provider_job_id:row.hash_id,title,company,url:HOST+'/jobs/'+row.hash_id,location:[...locations,...restrictions,...(hybrid?['Hybrid / onsite attendance stated in description']:[])].join('; ')||(row.work_remotely?'Remote; geographic scope not specified':''),remote:row.work_remotely&&!hybrid,snippet,posted_at:new Date(placement.posted_at).toISOString(),studio_description_updated_at:new Date(now).toISOString()};
}
export async function collectArtStation(source,{fetchJson,deadline=Date.now()+40000,jobAllowed=()=>true}={}){
 const rows=[],seen=new Set();let total=null;
 for(let page=1;page<=MAX_PAGES;page++){
  if(Date.now()+3000>deadline)throw Error('ArtStation pagination deferred by scan budget');
  const result=parseArtStationPage(source,await fetchJson(artStationEndpoint(source,page)),page);
  if(total===null)total=result.total;else if(total!==result.total)throw Error('ArtStation total changed during pagination');
  for(const row of result.rows){if(seen.has(row.id))throw Error('ArtStation duplicate pagination');seen.add(row.id);rows.push(row);}
  if(rows.length===total)break;
 }
 if(rows.length!==total)throw Error('ArtStation pagination incomplete');
 const jobs=rows.map(row=>normalizeArtStationJob(row)).filter(Boolean).filter(jobAllowed);
 return {jobs,fetched:rows.length,detail_cursor_next:0,details:{status:'complete',attempted:0,completed:jobs.length,deferred:0,error:null}};
}
