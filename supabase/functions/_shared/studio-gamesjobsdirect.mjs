// Public Match-all keyword search: artist + remote. This is a filtered feed, not all board jobs.
const HOST='https://www.gamesjobsdirect.com',QUERY='k=artist%20remote&mt=2',PER_PAGE=10,MAX_PAGES=10,MAX=4000000,SPACING=5000;
const pipeline=s=>/\b(?:talent[ -]?(?:pool|pipeline|pipe)|open applications?|general (?:applications?|interest)|speculative (?:applications?|opportunities?|opportunity)|expressions? of interest|evergreen)\b|\bgamesim\b[^.]{0,70}\b(?:pipeline|pipe)\b/i.test(s);
const agency=s=>/\b(?:8bit|skillsearch|ingame recruitment|aardvark swift|datascope|recruitment|recruiting|staffing agency)\b/i.test(s);
function board(s){if(s?.provider!=='gamesjobsdirect'||s.board_key!=='gamesjobsdirect')throw Error('Unverified GamesJobsDirect board');}
function bounded(s){if(typeof s!=='string'||s.length>MAX)throw Error('Invalid GamesJobsDirect response size');}
const entity=s=>String(s??'').replace(/&(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash);|&#(?:x[0-9a-f]+|\d+);/gi,e=>{const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&ndash;':'–','&mdash;':'—'};if(named[e.toLowerCase()])return named[e.toLowerCase()];const n=e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):parseInt(e.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
const clean=(s,n=20000)=>entity(entity(s)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const attr=(tag,name)=>entity(new RegExp('\\b'+name+'=["\']([^"\']*)["\']','i').exec(tag)?.[1]||'');
const field=(html,name)=>clean(new RegExp('<label\\b[^>]*>\\s*'+name+'\\s*</label>\\s*<p\\b[^>]*>([\\s\\S]*?)</p>','i').exec(html)?.[1],1000);
function jobPath(raw){if(typeof raw!=='string'||!/^\/job\/[a-z0-9][a-z0-9-]{0,160}\/[a-z0-9][a-z0-9-]{0,220}\/[1-9][0-9]{0,12}$/.test(raw))throw Error('Invalid GamesJobsDirect job path');return raw;}
function date(raw,end=false){
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw Error('GamesJobsDirect date missing');
 const start=Date.parse(raw+'T00:00:00Z');if(!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==raw)throw Error('GamesJobsDirect date invalid');return start+(end?86400000-1:0);
}
// Observed publisher JSON-LD contains literal line breaks inside its description string.
// Escape string controls and repair the two observed publisher address delimiters
// only. All other malformed object syntax still fails JSON.parse; never evaluate scripts.
function structured(raw){
 raw=raw.replace(/("addressRegion"\s*:\s*"(?:\\.|[^"\\])*")\s*;/g,'$1,').replace(/("addressCountry"\s*:\s*"(?:\\.|[^"\\])*")\s*;\s*(?=})/g,'$1');
 let out='',inside=false,escaped=false;for(const c of raw){if(inside&&c.charCodeAt(0)<32){out+='\\u'+c.charCodeAt(0).toString(16).padStart(4,'0');continue;}out+=c;if(escaped){escaped=false;continue;}if(inside&&c==='\\'){escaped=true;continue;}if(c==='"')inside=!inside;}return JSON.parse(out);
}
export function gamesJobsDirectEndpoint(s,page=1){board(s);if(!Number.isInteger(page)||page<1||page>MAX_PAGES)throw Error('Invalid GamesJobsDirect page');return HOST+'/results?'+QUERY+(page>1?'&page='+page:'');}
function navigation(raw,pageCount){
 const u=new URL(entity(raw),HOST);if(u.origin!==HOST||u.pathname!=='/results'||u.hash||u.username||u.password)throw Error('Unverified GamesJobsDirect navigation');
 const p=Number(u.searchParams.get('page'));if(!Number.isInteger(p)||p<1||p>Math.max(pageCount,11)||u.searchParams.get('k')!=='artist remote'||u.searchParams.get('mt')!=='2'||[...u.searchParams.keys()].some(k=>!['k','mt','page','stack'].includes(k))||[...u.searchParams.keys()].some(k=>u.searchParams.getAll(k).length!==1))throw Error('Unverified GamesJobsDirect query scope');return p;
}
export function parseGamesJobsDirectPage(s,html,page=1){
 board(s);bounded(html);gamesJobsDirectEndpoint(s,page);
 const keyword=/<input\b(?=[^>]*\bid=["']SearchParams_Keywords["'])[^>]*>/i.exec(html)?.[0];
 const type=/<select\b(?=[^>]*\bid=["']SearchParams_MatchType["'])[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1];
 if(!keyword||attr(keyword,'value')!=='artist remote'||!/<option\b(?=[^>]*selected)(?=[^>]*value=["']2["'])[^>]*>/i.test(type||''))throw Error('GamesJobsDirect search scope missing');
 const titleOnly=/<input\b(?=[^>]*\bid=["']SearchParams_SearchJobTitlesOnly["'])[^>]*>/i.exec(html)?.[0];
 const remoteOnly=/<input\b(?=[^>]*\bid=["']SearchParams_RemoteLocation["'])[^>]*>/i.exec(html)?.[0];
 if(!titleOnly||!remoteOnly||/\bchecked\b/.test(titleOnly+remoteOnly))throw Error('GamesJobsDirect search scope changed');
 const count=/We found <strong>(\d+)<\/strong> jobs based on your search\./.exec(html)?.[1];
 const total=count===undefined?NaN:Number(count),pages=Math.max(1,Math.ceil(total/PER_PAGE));
 if(!Number.isInteger(total)||total<0||pages>MAX_PAGES)throw Error('GamesJobsDirect total missing or excessive');
 const list=/<ul\b[^>]*class=["'][^"']*\bjob-list-container\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i.exec(html)?.[1];
 if(list===undefined)throw Error('GamesJobsDirect list container missing');
 const records=[...list.matchAll(/<li\b[^>]*class=["']list-group-item job-list[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)];
 const expected=Math.min(PER_PAGE,Math.max(0,total-(page-1)*PER_PAGE));if(records.length!==expected||page>pages)throw Error('GamesJobsDirect page incomplete');
 const pager=/<ul\b[^>]*class=["']pagination["'][^>]*>([\s\S]*?)<\/ul>/i.exec(html)?.[1];
 if(total>0){
  if(pager===undefined)throw Error('GamesJobsDirect navigation missing');
  const current=/<li\b[^>]*class=["']active["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["']/i.exec(pager)?.[1];
  if(!current||navigation(current,pages)!==page)throw Error('GamesJobsDirect current page mismatch');
  for(const m of pager.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi))navigation(m[1],pages);
 }
 const jobs=[],seen=new Set();
 for(const record of records){
  const b=record[1],a=/<a\b(?=[^>]*class=["']job-title["'])[^>]*>([\s\S]*?)<\/a>/i.exec(b);
  if(!a)throw Error('GamesJobsDirect job link missing');
  const path=jobPath(attr(a[0].slice(0,a[0].indexOf('>')+1),'href')),parts=path.split('/'),title=clean(a[1],5000);
  const value=name=>clean(new RegExp('<span\\b[^>]*class=["\']'+name+'["\'][^>]*>([\\s\\S]*?)</span>','i').exec(b)?.[1],1000);
  const advertiser=value('job-company'),location=value('job-location'),logo=/employer-logo-([1-9][0-9]{0,10})\.(?:png|jpe?g|gif|webp)/i.exec(b)?.[1]||null;
  if(!title||!advertiser||!location||seen.has(parts[4]))throw Error('GamesJobsDirect listing identity missing/duplicate');seen.add(parts[4]);
  const clientUnknown=agency(advertiser),company=clientUnknown?'Undisclosed client ('+advertiser+')':advertiser;
  jobs.push({provider_job_id:parts[4],title,company,location,remote:false,url:HOST+path,snippet:'',posted_at:'',gjd_advertiser:advertiser,gjd_logo_id:logo,gjd_client_unknown:clientUnknown});
 }
 return {jobs,fetched:records.length,total,pages};
}
export function parseGamesJobsDirectDetail(s,j,html,now=Date.now()){
 board(s);bounded(html);const u=new URL(j.url);if(u.origin!==HOST||u.search||u.hash||u.username||u.password)throw Error('Invalid GamesJobsDirect detail URL');const path=jobPath(u.pathname),parts=path.split('/');if(parts[4]!==j.provider_job_id||!j.gjd_advertiser)throw Error('GamesJobsDirect role identity missing');
 const og=/<meta\b(?=[^>]*property=["']og:url["'])[^>]*>/i.exec(html)?.[0];
 if(!og||attr(og,'content')!==j.url)throw Error('GamesJobsDirect detail identity mismatch');
 if(/\b(?:closed|expired|filled)\b/i.test(j.title)||/Sorry, this job has expired|(?:job|position|listing) (?:is |has been )?(?:closed|filled)|no longer accepting applications/i.test(clean(html)))return {excluded:true};
 const visibleTitle=clean(/<h3\b[^>]*class=["']margin-b-4["'][^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1],5000);
 if(visibleTitle!==j.title)throw Error('GamesJobsDirect detail identity mismatch');
 const apply='/details/redirect/'+parts[3]+'/'+parts[4];if(![...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].some(m=>entity(m[1])===apply))throw Error('GamesJobsDirect active apply identity missing');
 const reference=field(html,'Job reference'),advertiser=field(html,'Company Name'),location=field(html,'Location'),country=field(html,'Country');
 if(!reference||!location||!country)throw Error('GamesJobsDirect detail facts missing');
 const logo=/employer-logo-([1-9][0-9]{0,10})\.(?:png|jpe?g|gif|webp)/i.exec(html)?.[1]||null;
 if(advertiser&&advertiser!==j.gjd_advertiser)throw Error('GamesJobsDirect advertiser mismatch');
 let item=null;for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=structured(m[1]);}catch{continue;}
  for(const value of Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data])if(value?.['@type']==='JobPosting'){if(item)throw Error('GamesJobsDirect ambiguous JobPosting');item=value;}
 }
 if(!item||clean(item.title,5000)!==j.title||item.url&&item.url!==j.url||item.identifier?.value&&String(item.identifier.value)!==j.provider_job_id)throw Error('GamesJobsDirect JobPosting identity missing');
 const org=clean(item.hiringOrganization?.name,1000);if(org&&org!==j.gjd_advertiser)throw Error('GamesJobsDirect structured advertiser mismatch');
 // This board sometimes blanks employer names in detail templates. Then the exact
 // list/detail advertiser logo account plus canonical role/URL are mandatory.
 if(!advertiser&&!org&&(!j.gjd_logo_id||logo!==j.gjd_logo_id))throw Error('GamesJobsDirect advertiser account unverified');
 if(j.gjd_logo_id&&logo!==j.gjd_logo_id)throw Error('GamesJobsDirect advertiser account mismatch');
 const posted=date(item.datePosted),expiry=date(item.validThrough,true);if(posted>now||expiry<now||expiry<posted)return {excluded:true};
 const text=clean(item.description,40000);if(!text)throw Error('GamesJobsDirect full description missing');
 const visibleDescription=clean(/<div\b[^>]*class=["']post-description["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1],40000);
 if(!visibleDescription||text!==visibleDescription)throw Error('GamesJobsDirect description mismatch');
 if(pipeline(j.title)||pipeline(text)||/\b2[ -]?d\b/i.test(j.title)&&!/\b3[ -]?d\b/i.test(j.title)||/\b(?:unpaid|volunteer|equity[ -]only|rev(?:enue)?[ -]?share[ -]only|no (?:pay|compensation))\b/i.test(text)||/\b(?:no|zero|without|do not have a)\s+(?:cash\s+)?budget\b|\bbudget\s*(?:is|:)\s*(?:zero|0)\b/i.test(text))return {excluded:true};
 const combined=j.title+' '+text,hybrid=/\bhybrid\b|on[ -]?site|in[ -]?office|(?:required|mandatory) office|must (?:work|attend) (?:from|in|at) (?:our |the )?(?:office|studio)|(?:initially|temporarily|temporary) remote|remote (?:initially|temporarily|until|for (?:the )?first)|must relocate|required to relocate|will (?:need to |be required to )?relocate|relocation (?:is )?required/i.test(text+' '+location);
 const explicitRemote=item.jobLocationType==='TELECOMMUTE'||/\bremote\s*(?:contract|role|work|position|job|opportunit|artist|working|team)|(?:work|role|position|job|contract|team|opportunit(?:y|ies))[^.]{0,40}\bremote\b(?!\s*(?:control|desktop|server|network))|work from (?:home|anywhere)|fully distributed team/i.test(combined)||/\bremote\b/i.test(j.title)&&/artist|art lead/i.test(j.title);
 const negative=/\b(?:not (?:a |a fully |fully )?remote|no remote|on[ -]site only)\b/i.test(text);
 const remote=explicitRemote&&!hybrid&&!negative;
 if(!remote&&!hybrid&&!negative)return {excluded:true};
 const scope=(hybrid||negative?'Hybrid / onsite attendance required; ':'')+[...new Set([location,country,...text.split(/[.!?]\s+/).filter(v=>/\b(?:only|must be based|residents?|time[ -]?zones?|work authorization|core hours|GMT|UTC|country|countries)\b/i.test(v)&&/\b(?:remote|based|UK|US|USA|United|Europe|Canada|Australia|GMT|UTC|hours|country|countries)\b/i.test(v)).map(v=>v.slice(0,500))])].join('; ');
 const prefix=(j.gjd_client_unknown?'Recruiter advert; client employer is undisclosed. Advertiser: '+j.gjd_advertiser+'. ':'')+'Job reference: '+reference+'. ';
 return {snippet:(prefix+text).slice(0,20000),remote,location:scope.slice(0,1000),posted_at:new Date(posted).toISOString(),agency_reference:reference,studio_description_updated_at:new Date(now).toISOString()};
}
export async function collectGamesJobsDirect(s,{fetchText,deadline=Date.now()+75000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails,now=()=>Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const initial=now(),stop=Math.min(deadline,initial+75000);let lastStart=-Infinity;
 async function request(url){
  const earliest=lastStart+SPACING,delay=Math.max(0,earliest-now());if(now()+delay+6000>stop)throw Error('GamesJobsDirect request deadline');
  // Timers can wake one millisecond early; recheck actual start time after waiting.
  while(now()<earliest)await wait(earliest-now());
  if(now()+6000>stop)throw Error('GamesJobsDirect request deadline');
  lastStart=now();const pending=fetchText(url);lastStart=Math.max(lastStart,now());return pending;
 }
 const first=parseGamesJobsDirectPage(s,await request(gamesJobsDirectEndpoint(s)),1),jobs=[...first.jobs],seen=new Set(first.jobs.map(j=>j.provider_job_id));let fetched=first.fetched;
 for(let page=2;page<=first.pages;page++){const r=parseGamesJobsDirectPage(s,await request(gamesJobsDirectEndpoint(s,page)),page);if(r.total!==first.total||r.pages!==first.pages)throw Error('GamesJobsDirect total changed');for(const j of r.jobs){if(seen.has(j.provider_job_id))throw Error('GamesJobsDirect duplicate paging');seen.add(j.provider_job_id);jobs.push(j);}fetched+=r.fetched;}
 if(fetched!==first.total)throw Error('GamesJobsDirect incomplete filtered feed');
 const candidates=jobs.filter(j=>!pipeline(j.title)&&!(/\b2[ -]?d\b/i.test(j.title)&&!/\b3[ -]?d\b/i.test(j.title))).filter(detailAllowed),identities=candidates.map(j=>({id:j.provider_job_id,url:j.url,title:j.title,company:j.company,advertiser:j.gjd_advertiser,logo:j.gjd_logo_id,client:j.gjd_client_unknown}));
 if(prepareDetails)await prepareDetails(candidates);
 // Mutable board expiry/closure/working mode must be rechecked; no cached intake bypass.
 candidates.forEach((j,i)=>{const o=identities[i];if(j.provider_job_id!==o.id||j.url!==o.url||j.title!==o.title)throw Error('GamesJobsDirect cached identity mismatch');Object.assign(j,{company:o.company,gjd_advertiser:o.advertiser,gjd_logo_id:o.logo,gjd_client_unknown:o.client,snippet:'',remote:false,posted_at:''});delete j.excluded;});
 const cursor=Number.isInteger(s.detail_cursor)&&s.detail_cursor>=0?s.detail_cursor:0,start=candidates.length?cursor%candidates.length:0,selected=[...candidates.slice(start),...candidates.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;
 // Same-host crawl policy is stricter than the general two-request concurrency cap.
 for(const j of selected){const delay=Math.max(0,lastStart+SPACING-now());if(now()+delay+6000>stop)break;attempted++;try{const d=parseGamesJobsDirectDetail(s,j,await request(j.url),now());if(d.excluded){j.excluded=true;excluded++;}else{Object.assign(j,d);completed++;}}catch{j.detail_failed=true;}}
 const missing=candidates.length-completed-excluded,deferred=candidates.length-attempted,accepted=candidates.filter(j=>j.snippet&&!j.excluded&&!j.detail_failed).filter(j=>j.remote||!/\bremote\b/i.test(j.location)||/hybrid|onsite/i.test(j.location)).filter(jobAllowed);
 return {jobs:accepted,fetched,detail_cursor_next:candidates.length?(start+attempted)%candidates.length:0,details:{status:missing?(completed?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?`${missing} GamesJobsDirect descriptions not verified this scan; ${deferred} deferred by deadline/detail budget`:null}};
}
