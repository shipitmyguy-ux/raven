// Public hiring leads, not verified studio employment. Job seekers category 77 is forbidden.
const HOST='https://forums.unrealengine.com',PATH='/c/community/got-skills-looking-for-talent/job-offerings/76',CATEGORY=76,AGE=90*86400000;
const COMPANY='Undisclosed employer (Epic forums)',QUALIFIER='Forum hiring lead; employer identity has not been verified. ';
const clean=(s,n=20000)=>String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[e.toLowerCase()]).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/\s+/g,' ').trim().slice(0,n);
const stamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s)?Date.parse(s):NaN;
const closed=s=>/\[(?:closed|filled|solved)\]|\b(?:position|role|vacancy|job) (?:is |has been )?(?:filled|closed)|\b(?:no longer hiring|no longer available|already found|hiring closed)\b/i.test(s);
const seeker=s=>/\b(?:for hire|available for work|seeking (?:work|employment)|looking for (?:work|a job)|LFW|services available|offering (?:my )?services|open for commissions)\b/i.test(s);
function board(s){if(s?.provider!=='epicforum'||s.board_key!=='job-offerings-76')throw Error('Unverified Epic forum board');}
function bounded(p){if(!p||typeof p!=='object'||Array.isArray(p)||JSON.stringify(p).length>4000000)throw Error('Invalid Epic forum response');}
function eligibleText(title,text){
 if(seeker(title+' '+text)||closed(title+' '+text)||/\b(?:closed|filled)\b/i.test(title)||/\b(?:unpaid|volunteer|no (?:pay|compensation|funding|funds|budget)|not (?:paid|funded)|equity[ -]only|rev(?:enue)?[ -]?share[ -]only)\b/i.test(title+' '+text))return false;
 if(/\b(?:no|zero|without|do not have a)\s+(?:cash\s+)?budget\b|\bbudget\s*(?:is|:)\s*(?:zero|0)\b/i.test(text))return false;
 if(!/\bremote\s*(?:contract|role|work|position|job|opportunit|artist|generalist|team)|(?:work|role|position|job|contract|team|opportunit(?:y|ies))[^.]{0,40}\bremote\b(?!\s*(?:control|desktop|server|network))|work from (?:home|anywhere)|fully distributed team/i.test(text)||/\b(?:not (?:a |a fully |fully )?remote(?: position| role| job)?|no remote|on[ -]site only)\b/i.test(text))return false;
 const cash=/[$€£]\s*[1-9]\d*|\b[1-9]\d*\s*(?:USD|EUR|GBP)\b|\b(?:guaranteed|fixed|hourly|daily|monthly) (?:pay|rate|salary|payment)\b/i.test(text);
 if(/\brev(?:enue)?[ -]?share\b/i.test(title+' '+text)&&!(cash&&/\b(?:hour|hourly|salary|paid|compensation|upfront|guaranteed)\b/i.test(text)))return false;
 return /\bpaid\b|\bcompensation\b|\bsalary\b/i.test(title+' '+text)||cash;
}
function expiredDeadline(text,now){
 for(const m of text.matchAll(/\b(?:application deadline|closing date|apply by|deadline\s*:)\s*:?\s*([^.;\n]{1,80})/gi)){
  const raw=m[1].trim(),match=raw.match(/^\d{4}-\d{2}-\d{2}/)||raw.match(/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/i)||raw.match(/^\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,?\s+\d{4})?/i);
  if(!match)throw Error('Epic forum application deadline unverified');
  let date=match[0].replace(/(\d)(?:st|nd|rd|th)/gi,'$1');if(!/\d{4}/.test(date))date+=' '+new Date(now).getUTCFullYear();
  const expiry=Date.parse(/^\d{4}-/.test(date)?date+'T23:59:59Z':date+' 23:59:59 UTC');
  if(!Number.isFinite(expiry))throw Error('Epic forum application deadline invalid');if(expiry<now)return true;
 }
 return false;
}
function locationScope(text){
 const sentences=text.split(/[.!?]\s+/).filter(v=>/\b(?:UK|United Kingdom|U\.S\.|USA|United States|EU|European Union|Europe|Canada|Australia|Germany|France|Poland|residents?|residency|time[ -]?zones?|work authorization|countries|country)\b/i.test(v));
 return sentences.length?clean('Remote — review restrictions: '+sentences.join('; '),1000):'Remote — restrictions not stated; review forum post';
}
export function epicForumEndpoint(s){board(s);return HOST+PATH+'.json';}
export function parseEpicForumList(s,p,now=Date.now()){
 board(s);bounded(p);const l=p.topic_list;
 if(!l||!Array.isArray(l.topics)||l.topics.length>100||l.filter!=='latest')throw Error('Unknown Epic forum category template');
 if(l.more_topics_url!=null&&typeof l.more_topics_url!=='string')throw Error('Invalid Epic forum pagination');
 const seen=new Set(),jobs=[];let previous=Infinity;
 for(const t of l.topics){
  const created=stamp(t.created_at),bumped=stamp(t.bumped_at),last=stamp(t.last_posted_at);
  if(!Number.isSafeInteger(t.id)||t.id<=0||t.category_id!==CATEGORY||typeof t.title!=='string'||!t.title.trim()||t.title.length>5000||typeof t.slug!=='string'||!/^[a-z0-9][a-z0-9-]{0,350}$/.test(t.slug)||typeof t.pinned!=='boolean'||typeof t.closed!=='boolean'||typeof t.archived!=='boolean'||![created,bumped,last].every(Number.isFinite)||created>bumped||created>last)throw Error('Epic forum topic identity missing');
  if(seen.has(t.id))throw Error('Duplicate Epic forum topic');seen.add(t.id);
  if(!t.pinned){if(bumped>previous)throw Error('Epic forum ordering changed');previous=bumped;}
  if(t.pinned||t.closed||t.archived||closed(t.title)||seeker(t.title)||created<now-AGE||created>now)continue;
  jobs.push({provider_job_id:String(t.id),title:clean(t.title,5000),company:COMPANY,location:'Not stated',remote:false,url:HOST+`/t/${t.slug}/${t.id}`,snippet:'',posted_at:new Date(created).toISOString()});
 }
 const nonpinned=l.topics.filter(t=>!t.pinned);
 return {jobs,fetched:l.topics.length,next:l.more_topics_url??null,topics:l.topics,oldWindow:nonpinned.length>0&&nonpinned.every(t=>stamp(t.bumped_at)<now-AGE&&stamp(t.last_posted_at)<now-AGE)};
}
export function parseEpicForumDetail(s,j,p,now=Date.now()){
 board(s);bounded(p);const created=stamp(p.created_at);
 if(String(p.id)!==j.provider_job_id||p.category_id!==CATEGORY||clean(p.title,5000)!==j.title||p.slug!==new URL(j.url).pathname.split('/')[2]||j.url!==HOST+`/t/${p.slug}/${p.id}`||typeof p.closed!=='boolean'||typeof p.archived!=='boolean'||!Number.isFinite(created)||new Date(created).toISOString()!==j.posted_at)throw Error('Epic forum detail identity mismatch');
 if(p.closed||p.archived||closed(p.title)||created<now-AGE||created>now)return {excluded:true};
 const posts=p.post_stream?.posts;if(!Array.isArray(posts))throw Error('Epic forum first post missing');
 const first=posts.find(x=>x.post_number===1),original=stamp(first?.created_at);
 if(!first||String(first.topic_id)!==j.provider_job_id||first.topic_slug!==p.slug||typeof first.cooked!=='string'||!Number.isFinite(original)||Math.abs(original-created)>300000)throw Error('Epic forum first post identity mismatch');
 if(first.hidden===true||first.deleted_at!=null||first.user_deleted===true||original<now-AGE||original>now)return {excluded:true};
 const text=clean(first.cooked,40000);if(!text)throw Error('Epic forum description missing');
 if(expiredDeadline(text,now))return {excluded:true};
 if(!eligibleText(p.title,text))return {excluded:true};
 return {snippet:(QUALIFIER+text).slice(0,20000),remote:true,company:COMPANY,location:locationScope(text),posted_at:new Date(original).toISOString()};
}
export async function collectEpicForum(s,{fetchJson,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const now=Date.now(),endpoint=epicForumEndpoint(s),jobs=[],seen=new Set();let fetched=0,url=endpoint,previous=Infinity;
 for(let page=0;page<10;page++){
  if(Date.now()+1000>deadline)throw Error('Epic forum pagination deadline');
  const r=parseEpicForumList(s,await fetchJson(url),now);fetched+=r.fetched;
  for(const t of r.topics){if(seen.has(t.id))throw Error('Epic forum duplicate pagination');seen.add(t.id);if(!t.pinned){const bump=stamp(t.bumped_at);if(bump>previous)throw Error('Epic forum pagination ordering changed');previous=bump;}}
  jobs.push(...r.jobs);
  if(r.next&&r.next!==PATH+`?page=${page+1}`)throw Error('Unverified Epic forum pagination');
  if(!r.next||r.oldWindow)break;
  if(page===9)throw Error('Epic forum pagination limit');url=endpoint+`?page=${page+1}`;
 }
 const candidates=jobs.filter(detailAllowed),originals=candidates.map(j=>({id:j.provider_job_id,title:j.title,url:j.url,posted:j.posted_at}));
 if(prepareDetails)await prepareDetails(candidates);
 candidates.forEach((j,i)=>{
  const o=originals[i];if(j.provider_job_id!==o.id||j.title!==o.title||j.url!==o.url)throw Error('Epic forum cached identity mismatch');
  // Forum content is mutable: even a fresh cached lead must revalidate its original post.
  j.snippet='';j.remote=false;j.location='Not stated';j.company=COMPANY;j.posted_at=o.posted;delete j.excluded;
 });
 const pending=candidates.filter(j=>!j.snippet),cursor=Number.isInteger(s.detail_cursor)&&s.detail_cursor>=0?s.detail_cursor:0,start=pending.length?cursor%pending.length:0,selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async j=>{attempted++;try{const d=parseEpicForumDetail(s,j,await fetchJson(HOST+`/t/${j.provider_job_id}.json`),now);if(d.excluded){j.excluded=true;excluded++;}else{Object.assign(j,d,{studio_description_updated_at:new Date().toISOString()});completed++;}}catch{}}));}
 const missing=pending.length-completed-excluded,deferred=pending.length-attempted;
 const accepted=candidates.filter(j=>j.snippet&&j.remote&&!j.excluded);
 return {jobs:accepted,fetched,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?(accepted.length?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?`${missing} Epic forum descriptions unavailable; ${deferred} deferred by scan budget`:null}};
}
