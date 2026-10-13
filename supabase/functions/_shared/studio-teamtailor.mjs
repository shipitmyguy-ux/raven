// Public server-rendered Teamtailor careers only. Host bindings are verified in docs.
const BOARDS=Object.freeze({
 'embark-studios':{host:'careers.embark-studios.com',studio:'Embark Studios',org:'Embark Studios'},
 'coffee-stain':{host:'jobs.coffeestain.com',studio:'Coffee Stain',org:'Coffee Stain'},
 'ghost-ship-games':{host:'jobs.ghostship.dk',studio:'Ghost Ship Games',org:'Ghost Ship Games'},
 'fatshark':{host:'jobs.fatsharkgames.com',studio:'Fatshark',org:'Fatshark'},
 'sloclap':{host:'careers.sloclap.com',studio:'Sloclap',org:'Sloclap'},
 'hazelight':{host:'careers.hazelight.se',studio:'Hazelight',org:'Hazelight'},
 'neon-giant':{host:'jobs.neongiant.se',studio:'Neon Giant',org:'Neon Giant'},
 'ironbelly-studios':{host:'careers.ironbelly.com',studio:'Ironbelly Studios',org:'Ironbelly Studios'},
 'shapefarm':{host:'careers.shapefarm.net',studio:'Shapefarm',org:'Shapefarm'},
 'tactical-adventures':{host:'tacticaladventures.teamtailor.com',studio:'Tactical Adventures',org:'Tactical Adventures'},
 'awaceb':{host:'awaceb.teamtailor.com',studio:'Awaceb',org:'Awaceb'},
 'kepler-interactive':{host:'careers.kepler-interactive.com',studio:'Kepler Interactive',org:'Kepler Interactive',childHosts:['tacticaladventures.teamtailor.com','careers.shapefarm.net','awaceb.teamtailor.com']},
 'io-interactive':{host:'apply.ioi.dk',studio:'IO Interactive',org:'IOI'},
});
const entities=s=>String(s??'').replace(/&(?:amp|lt|gt|quot|apos|nbsp|middot);|&#(?:x[0-9a-f]+|\d+);/gi,e=>{const map={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&middot;':'·'};if(map[e.toLowerCase()])return map[e.toLowerCase()];const n=e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):parseInt(e.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
const clean=(s,n=20000)=>entities(entities(s)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function board(source){const b=Object.hasOwn(BOARDS,source.board_key)?BOARDS[source.board_key]:null;if(source.provider!=='teamtailor'||!b||b.studio!==source.studio_name)throw Error('Unverified Teamtailor board');return b;}
function bounded(html){if(typeof html!=='string'||html.length>4000000)throw Error('Invalid Teamtailor response size');return html;}
export function teamtailorEndpoint(source){return `https://${board(source).host}/jobs`;}
function jobUrl(source,raw){const b=board(source),u=new URL(entities(raw),`https://${b.host}`);if(u.username||u.password||![b.host,...(b.childHosts||[])].some(host=>u.origin===`https://${host}`)||u.search||u.hash||!/^\/jobs\/[1-9][0-9]{0,15}-[a-zA-Z0-9_-]+$/.test(u.pathname))throw Error('Invalid Teamtailor job URL');return u.href;}
export function parseTeamtailorList(source,html){
 bounded(html);board(source);
 if(!/teamtailor/i.test(html)||!/<turbo-frame\b[^>]*id=["']jobs_list["']/.test(html))throw Error('Teamtailor jobs container missing');
 const frame=html.match(/<turbo-frame\b[^>]*id=["']jobs_list["'][^>]*>([\s\S]*?)<\/turbo-frame>/)?.[1];
 const list=frame?.match(/<ul\b[^>]*id=["']jobs_list_container["'][^>]*>([\s\S]*?)<\/ul>/)?.[1];
 const count=frame?.match(/<h2\b[^>]*>\s*([0-9]+) jobs?\b/)?.[1];
 if(list===undefined){if(/No open positions right now/.test(frame||''))return {jobs:[],fetched:0,total:0,next:null};throw Error('Teamtailor list markup missing');}
 if(count===undefined||Number(count)>1000)throw Error('Teamtailor count missing or excessive');
 const jobs=[];
 for(const li of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
  const a=li[1].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/);if(!a)throw Error('Teamtailor job link missing');
  const titleSpan=a[2].match(/<span\b(?=[^>]*title=["'][^"']+["'])[^>]*>([\s\S]*?)<\/span>/);
  const url=jobUrl(source,a[1]),title=clean(titleSpan?titleSpan[1]:a[2],5000);if(!title)throw Error('Teamtailor title missing');
  const location=clean(titleSpan?a[2].slice(a[2].indexOf(titleSpan[0])+titleSpan[0].length):li[1].slice(li[1].indexOf('</a>')+4),1000);
  jobs.push({provider_job_id:new URL(url).pathname.match(/\/jobs\/(\d+)/)[1],title,company:Object.values(BOARDS).find(b=>b.host===new URL(url).hostname).studio,location,remote:/\bFully remote\b/i.test(location),url,snippet:'',posted_at:''});
 }
 if(!jobs.length&&Number(count)!==0)throw Error('Teamtailor empty list count mismatch');
 const next=frame.match(/<a\b(?=[^>]*rel=["']next["'])[^>]*href=["']([^"']+)["']/)?.[1]||frame.match(/<a\b(?=[^>]*href=["']([^"']+)["'])[^>]*rel=["']next["']/)?.[1]||null;
 return {jobs,fetched:jobs.length,total:Number(count),next};
}
export function parseTeamtailorDetail(source,job,html){
 board(source);bounded(html);jobUrl(source,job.url);const b=Object.values(BOARDS).find(b=>b.host===new URL(job.url).hostname);
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let d;try{d=JSON.parse(m[1].replace(/"(?:[^"\\]|\\[\s\S])*"/g,s=>s.replace(/[\u0000-\u001f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))));}catch{continue;}
  for(const item of Array.isArray(d)?d:Array.isArray(d?.['@graph'])?d['@graph']:[d]){
   if(item?.['@type']!=='JobPosting')continue;
   if(item.hiringOrganization?.name!==b.org||String(item.identifier?.value)!==job.provider_job_id||clean(item.title,5000)!==job.title||(item.url&&jobUrl(source,item.url)!==job.url))throw Error('Teamtailor detail identity mismatch');
   const snippet=clean(item.description);if(!snippet)throw Error('Teamtailor description missing');
   const t=Date.parse(item.datePosted);return {snippet,posted_at:Number.isFinite(t)?new Date(t).toISOString():'',remote:item.jobLocationType==='TELECOMMUTE'};
  }
 }
 throw Error('Teamtailor JobPosting missing');
}
export async function collectTeamtailor(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const endpoint=teamtailorEndpoint(source),jobs=[],seen=new Set();let url=endpoint,total=null;
 for(let page=1;page<=10;page++){
  if(Date.now()+1000>deadline)throw Error('Teamtailor list deadline exceeded');
  const result=parseTeamtailorList(source,await fetchText(url));if(total===null)total=result.total;else if(total!==result.total)throw Error('Teamtailor count changed during pagination');
  for(const j of result.jobs){if(seen.has(j.url))throw Error('Teamtailor duplicate pagination job');seen.add(j.url);jobs.push(j);}
  if(!result.next){if(jobs.length!==total)throw Error('Teamtailor incomplete pagination');break;}
  const next=new URL(entities(result.next),endpoint);if(next.username||next.password||next.origin!==new URL(endpoint).origin||next.pathname!=='/jobs'||next.search!==`?page=${page+1}`||next.hash)throw Error('Unverified Teamtailor pagination URL');url=next.href;
  if(page===10)throw Error('Teamtailor pagination limit');
 }
 const candidates=jobs.filter(detailAllowed);if(prepareDetails)await prepareDetails(candidates);
 const pending=candidates.filter(j=>!j.snippet),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=pending.length?cursor%pending.length:0;
 const selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0;
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{const d=parseTeamtailorDetail(source,job,await fetchText(job.url));job.snippet=d.snippet;if(d.remote)job.remote=true;if(d.posted_at)job.posted_at=d.posted_at;job.studio_description_updated_at=new Date().toISOString();completed++;}catch{}}));}
 const missing=pending.length-completed,deferred=pending.length-attempted;
 return {jobs,fetched:jobs.length,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?(completed||candidates.some(j=>j.snippet)?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?`${missing} Teamtailor descriptions unavailable; ${deferred} deferred by scan budget`:null}};
}
