// EA's public Avature HTML portal. Only independently verified studio taxonomy is enabled.
export const EA_STUDIOS = Object.freeze({'8376':'EA Studios - Motive Montreal','8370':'EA Studios - DICE Stockholm'});
const decode = s => String(s || '').replace(/&#(x[\da-f]+|\d+);/gi, (_,v) => String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v))).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'");
const visible = s => String(s || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
const clean = s => decode(String(s || '').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function label(source) {const value=EA_STUDIOS[source.board_key]; if (!value) throw Error('Unverified EA studio board'); return value;}
export function avatureEndpoint(source) {label(source);return `https://jobs.ea.com/en_US/careers/Home/?4538=%5B${source.board_key}%5D&4538_format=3021&listFilterMode=1&jobRecordsPerPage=20`;}
function jobUrl(raw) {try {const u=new URL(decode(raw),'https://jobs.ea.com');if(u.origin!=='https://jobs.ea.com'||u.username||u.password||!/^\/en_US\/careers\/JobDetail\/[^/]+\/\d+$/.test(u.pathname)||u.search||u.hash) return '';return u.href;}catch{return '';}}
export function parseAvatureList(source,html) {
 html=visible(html);
 const expected=label(source);
 const selected=html.match(/<select\b[^>]*\bid="4538"[^>]*>([\s\S]*?)<\/select>/i)?.[1];
 const option=selected?.match(new RegExp(`<option\\b[^>]*value="${source.board_key}"[^>]*selected[^>]*>([\\s\\S]*?)<\\/option>`,'i'));
 if(!option||clean(option[1])!==expected||!html.includes('section__content__results')) throw Error('EA studio filter or results schema mismatch');
 const container=html.match(/<div\b[^>]*class="section__content__results"[^>]*>/i);
 let depth=1,end=container.index+container[0].length;
 const tail=html.slice(end); const tags=/<\/?div\b[^>]*>/gi; let tag;
 while((tag=tags.exec(tail))&&depth){depth+=/^<\//.test(tag[0])?-1:1;if(!depth)end+=tag.index;}
 if(depth)throw Error('EA results container malformed');
 const results=html.slice(container.index+container[0].length,end);
 const totals=[...html.matchAll(/<div\b[^>]*class="[^"]*list-controls__text__legend[^"]*"[^>]*aria-label="(\d+)\s+results?"/gi)].map(m=>Number(m[1]));
 if(!totals.length||totals.some(n=>n!==totals[0]))throw Error('EA result total schema mismatch');
 const jobs=[];
 for(const match of results.matchAll(/<article\b[^>]*class="[^"]*article--result[^\"]*"[^>]*>([\s\S]*?)<\/article>/gi)) {
  const block=match[1], link=block.match(/<a\b[^>]*class="[^"]*\blink_result\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const department=clean(block.match(/<span\b[^>]*class="list-item-department"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  if(department!==expected) throw Error('EA studio result scope mismatch');
  const url=jobUrl(link?.[1]); if(!url||!clean(link?.[2])) throw Error('EA result schema mismatch');
  const location=clean(block.match(/<span\b[^>]*class="list-item-location"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  jobs.push({provider_job_id:url.split('/').pop(),title:clean(link[2]),company:source.studio_name,location,remote:/\bremote\b/i.test(location),url,snippet:'',posted_at:''});
 }
 // A full page might conceal additional vacancies: fail instead of falsely reporting complete coverage.
 if(jobs.length>=20) throw Error('EA pagination requires further verification');
 const recognized=new Set(jobs.map(j=>j.url));
 for(const link of results.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {const target=decode(link[1]);if(target.includes('/JobDetail/')&&!recognized.has(jobUrl(target)))throw Error('EA unparsed job result');}
 if(totals[0]!==jobs.length)throw Error('EA result total or pagination mismatch');
 if(!jobs.length&&!/\bno (?:jobs|results)(?: found)?\b/i.test(clean(results))) throw Error('EA empty result schema unrecognized');
 return jobs;
}
export function parseAvatureDetail(source,job,html) {
 const fields=new Map();
 for(const m of html.matchAll(/<div\b[^>]*class="article__content__view__field__label"[^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class="article__content__view__field__value"[^>]*>([\s\S]*?)<\/div>/gi)) fields.set(clean(m[1]),clean(m[2]));
 if(fields.get('Studio/Department')!==label(source)) throw Error('EA detail studio mismatch');
 const canonical=html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
 if(jobUrl(canonical)!==job.url) throw Error('EA detail job mismatch');
 const article=[...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(m=>m[1]).find(s=>/Description\s*&amp;\s*Requirements/.test(s));
 const snippet=clean(article?.replace(/^[\s\S]*?<\/h3>/i,'')); if(snippet.length<100) throw Error('EA description unavailable');
 return {...job,snippet:snippet.slice(0,20000),remote:fields.get('Work Model')==='Remote'};
}
export async function collectAvature(source,{fetchText,deadline=Infinity,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}) {
 const jobs=parseAvatureList(source,await fetchText(avatureEndpoint(source)));
 const candidates=jobs.filter(detailAllowed);
 await prepareDetails?.(candidates);
 const pending=candidates.filter(j=>!j.snippet);
 const cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0;
 const start=pending.length?cursor%pending.length:0;
 const queue=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);
 let attempted=0,completed=0;const errors=[];
 await Promise.all([0,1].map(async()=>{while(queue.length&&Date.now()+6000<deadline){const job=queue.shift();attempted++;try {Object.assign(job,parseAvatureDetail(source,job,await fetchText(job.url)),{studio_description_updated_at:new Date().toISOString()});completed++;}catch(e){errors.push(String(e.message||e));}}}));
 const deferred=pending.length-attempted;
 return {jobs,fetched:jobs.length,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:!pending.length?'not_needed':completed===pending.length?'complete':completed?'partial':'failed',attempted,completed,deferred,error:completed===pending.length?null:[...new Set(errors),...(deferred?[`${deferred} descriptions deferred by scan budget`]:[])].join('; ').slice(0,1000)}};
}
