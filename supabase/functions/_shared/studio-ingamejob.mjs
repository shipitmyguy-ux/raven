// First-party public art category, not whole-board coverage. No application requests.
const HOST='https://ingamejob.com',CATEGORY=HOST+'/en/jobs/art-and-animation',MAX=4000000,PER_PAGE=30,MAX_PAGES=10;
function board(source){if(source?.provider!=='ingamejob'||source.board_key!=='ingamejob')throw Error('Unverified InGameJob board');}
function bounded(html){if(typeof html!=='string'||html.length>MAX)throw Error('Invalid InGameJob response size');}
const entity=s=>String(s??'').replace(/&(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash);|&#(?:x[0-9a-f]+|\d+);/gi,e=>{const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&ndash;':'–','&mdash;':'—'};if(named[e.toLowerCase()])return named[e.toLowerCase()];const n=e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):parseInt(e.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
const clean=s=>entity(entity(s)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<\/(?:p|li|div|h[1-6])>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/[ \t\r]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
const attr=(tag,name)=>entity(new RegExp('\\b'+name+'=["\']([^"\']+)["\']','i').exec(tag)?.[1]||'');
function safeDetail(url){try{const u=new URL(url);return u.origin===HOST&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/en\/job\/[a-z0-9][a-z0-9-]{0,200}$/.test(u.pathname);}catch{return false;}}
function safeCompany(url){try{const u=new URL(url);return u.origin===HOST&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/en\/company\/[a-z0-9][a-z0-9-]{0,200}$/.test(u.pathname);}catch{return false;}}
function divContents(html,start){
 const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;const first=tags.exec(html);if(!first||first.index!==start||/^<\//.test(first[0]))throw Error('InGameJob container missing');
 const contentStart=tags.lastIndex;let depth=1;
 for(let tag;(tag=tags.exec(html));){depth+=/^<\//.test(tag[0])?-1:1;if(depth===0)return {html:html.slice(contentStart,tag.index),end:tags.lastIndex};}
 throw Error('InGameJob unbalanced description container');
}
function canonical(html){const tag=/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i.exec(html)?.[0];return attr(tag||'','href');}
export function ingamejobEndpoint(source,page=1){board(source);if(!Number.isInteger(page)||page<1||page>MAX_PAGES)throw Error('Invalid InGameJob page');return CATEGORY+(page===1?'':'?page='+page);}
export function parseIngamejobPage(source,html,page=1){
 ingamejobEndpoint(source,page);bounded(html);if(canonical(html)!==CATEGORY)throw Error('InGameJob category identity missing');
 const count=/Found\s*<strong>\s*(\d+)\s*<\/strong>\s*jobs/i.exec(html)?.[1],total=count===undefined?NaN:Number(count),pages=Math.max(1,Math.ceil(total/PER_PAGE));
 if(!Number.isInteger(total)||total<0||pages>MAX_PAGES)throw Error('InGameJob total missing or excessive');
 const container=html.slice(html.indexOf('<div class="employer-job-listing my-4">'));
 if(!html.includes('<div class="employer-job-listing my-4">'))throw Error('InGameJob list container missing');
 const records=container.split(/<div class="employer-job-listing-single\b/).slice(1),expected=Math.min(PER_PAGE,Math.max(0,total-(page-1)*PER_PAGE));
 if(records.length!==expected||page>pages)throw Error('InGameJob page incomplete');
 const pager=/<ul class="pagination"[^>]*>([\s\S]*?)<\/ul>/i.exec(container)?.[1];
 if(pages>1){if(!pager||Number(/aria-current="page"><span class="page-link">(\d+)<\/span>/.exec(pager)?.[1])!==page)throw Error('InGameJob current page mismatch');
  for(const m of pager.matchAll(/<a\b[^>]*href="([^"]+)"/g)){const u=new URL(entity(m[1]));const p=Number(u.searchParams.get('page'));if(u.origin!==HOST||u.pathname!=='/en/jobs/art-and-animation'||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>k!=='page')||u.searchParams.getAll('page').length!==1||!Number.isInteger(p)||p<1||p>pages)throw Error('InGameJob unsafe pagination');}
 }
 const nextTag=pager?/<a\b(?=[^>]*\brel="next")[^>]*>/i.exec(pager)?.[0]:null;
 if(page<pages&&attr(nextTag||'','href')!==ingamejobEndpoint(source,page+1)||page===pages&&nextTag)throw Error('InGameJob pagination incomplete');
 const jobs=records.map(block=>{const titleLink=/<h5>\s*<a href="([^"]+)">([\s\S]*?)<\/a>/.exec(block);if(!titleLink||!safeDetail(entity(titleLink[1])))throw Error('InGameJob card URL missing or unsafe');const title=clean(titleLink[2]),company=clean(/la-building-o"><\/i>\s*([^<]+)/.exec(block)?.[1]),location=clean(/la-map-marker"><\/i>\s*([^<]+)/.exec(block)?.[1]);if(!title||!company||title.length>500||company.length>300||location.length>1000)throw Error('InGameJob card identity missing');return {provider_job_id:new URL(titleLink[1]).pathname.split('/').pop(),url:entity(titleLink[1]),title,company,location,remote:false,snippet:''};});
 if(new Set(jobs.map(j=>j.url)).size!==jobs.length)throw Error('InGameJob duplicate cards');return {jobs,total,next:page<pages?page+1:null};
}
export function parseIngamejobDetail(source,job,html,now=Date.now()){
 board(source);bounded(html);if(!safeDetail(job.url)||canonical(html)!==job.url)throw Error('InGameJob canonical mismatch');
 const header=/<div class="job-view-lead-position-box col-sm-8">([\s\S]*?)<div class="container job-view-body">/.exec(html)?.[1];
 if(!header)throw Error('InGameJob vacancy header missing');
 const title=clean(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(header)?.[1]),companyLink=/<a class="job-view-lead-position-box" href="([^"]+)">([\s\S]*?)<\/a>/.exec(header);
 if(title!==job.title||!companyLink||clean(companyLink[2])!==job.company||!safeCompany(companyLink[1]))throw Error('InGameJob title or employer mismatch');
 if(/Vacancy archived|\b(?:vacancy|position|job)\s+(?:(?:has|is)\s+(?:been\s+)?)?(?:closed|expired|filled)|no longer accepting applications/i.test(clean(header)))return {excluded:true};
 // Fresh Apply UI establishes advertised active status; it does not authorize following its login/application endpoint.
 if(!/<a\b[^>]*class="[^"]*btn-success[^>]*>[\s\S]*?\bApply\b[\s\S]*?<\/a>/.test(header))throw Error('InGameJob activity unverified');
 const location=clean(/la-map-marker"><\/i>\s*([^<]+)/.exec(header)?.[1]);if(location!==job.location)throw Error('InGameJob location mismatch');
 const container=/<div class="job-view-container[^>]*>/g.exec(html);if(!container)throw Error('InGameJob description container missing');const raw=divContents(html,container.index).html;
 const sections=[],sectionTags=/<div class="job-view-single-section[^>]*>/g;
 for(let tag;(tag=sectionTags.exec(raw));){const section=divContents(raw,tag.index);sectionTags.lastIndex=section.end;if(!/<a\b[^>]*class="[^"]*btn-success/.test(section.html))sections.push(section.html);}
 const snippet=sections.map(clean).filter(Boolean).join('\n');if(snippet.length<100||snippet.length>20000||!sections.some(s=>/responsibilities|professional are we looking for/i.test(clean(s))))throw Error('InGameJob description incomplete');
 if(/\b(?:talent[ -]?(?:pool|pipeline)|open application|general application|speculative application|evergreen|closed|expired|filled)\b/i.test(title)||/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|equity[ -]only|no (?:pay|compensation)|zero compensation)\b/i.test(snippet))return {excluded:true};
 if(/\b2[ -]?d\b/i.test(title)&&!/\b3[ -]?d\b/i.test(title))return {excluded:true};
 const workConditions=snippet.replace(/\bhybrid[ -]casual\b/gi,'').replace(/\bfully remote(?: work)?[,; ]+(?:or|with optional)[^.\n]{0,140}\b(?:on[ -]?site|hybrid)\b[^.\n]*/gi,'');
 const onsite=/\bhybrid\b|must work (?:from|in|at) (?:our |the )?(?:office|studio)|\b(?:initially remote|remote (?:initially|until))\b|\b(?:must|required|expected|mandatory)[^.\n]{0,100}\b(?:relocat|office|on[ -]?site)|\b(?:relocat|office|on[ -]?site)[^.\n]{0,100}\b(?:required|mandatory)\b/i.test(workConditions);
 const descriptionRemote=/\bfully remote (?:collaboration|work|role|position|opportunity)\b/i.test(snippet);
 const remote=(/\bRemote\b/.test(location)||descriptionRemote)&&!onsite;
 const restrictions=snippet.split(/\n|(?<=[.!?])\s+/).filter(s=>/\b(?:only|based|timezone|time zone|core hours|B2B|Kazakhstan|English|Russian|Ukrainian|Polish|relocat\w*|hybrid|on[ -]?site)\b/i.test(s)).slice(0,5).map(s=>s.slice(0,350));
 const recruiting=/Company type:\s*Recruiting/i.test(clean(html.slice(html.indexOf('<div class="col-md-4">'))));
 return {snippet,company:recruiting?job.company+' (undisclosed client)':job.company,remote,location:[location||descriptionRemote&&'Remote (explicit description)'||'',...restrictions,...(onsite?['Hybrid / onsite condition stated in description']:[])].filter(Boolean).join('; '),studio_description_updated_at:new Date(now).toISOString()};
}
export async function collectIngamejob(source,{fetchText,deadline=Date.now()+110000,jobAllowed=()=>true,detailAllowed=jobAllowed,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const jobs=[],seen=new Set();let total=null,page=1,lastRequest=0;
 async function get(url){const delay=Math.max(0,5000-(Date.now()-lastRequest));if(Date.now()+delay+6000>deadline)throw Error('InGameJob deadline reached');if(delay)await wait(delay);lastRequest=Date.now();return fetchText(url);}
 while(page){const result=parseIngamejobPage(source,await get(ingamejobEndpoint(source,page)),page);if(total===null)total=result.total;else if(total!==result.total)throw Error('InGameJob total changed');for(const job of result.jobs){if(seen.has(job.url))throw Error('InGameJob pagination duplicate');seen.add(job.url);jobs.push(job);}page=result.next;}
 if(jobs.length!==total)throw Error('InGameJob pagination incomplete');
 const candidates=jobs.filter(detailAllowed),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=candidates.length?cursor%candidates.length:0,selected=[...candidates.slice(start),...candidates.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;
 for(const job of selected){if(Date.now()+11000>deadline)break;attempted++;try{const detail=parseIngamejobDetail(source,job,await get(job.url));if(detail.excluded){job.excluded=true;excluded++;}else{Object.assign(job,detail);completed++;}}catch{job.detail_failed=true;}}
 const missing=candidates.length-completed-excluded,deferred=candidates.length-attempted;
 return {jobs:candidates.filter(j=>j.snippet&&!j.excluded&&(j.remote||!/\bremote\b/i.test(j.location))&&jobAllowed(j)),fetched:jobs.length,detail_cursor_next:candidates.length?(start+attempted)%candidates.length:0,details:{status:missing?'partial':'complete',attempted,completed,deferred,error:missing?`${missing} InGameJob descriptions unverified; ${deferred} deferred`:null}};
}
export {collectIngamejob as collectInGameJob};
