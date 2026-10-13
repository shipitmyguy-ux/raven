// Public advertised sitemap + server-rendered detail only. No gated search or outbound apply.
const HOST='https://hitmarker.net',MAX=4000000,MAX_URLS=15000;
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0]==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|nbsp|quot|apos|lt|gt);/g,(_,v)=>({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>'}[v])).replace(/\s+/g,' ').trim();
function board(s){if(s.provider!=='hitmarker'||s.board_key!=='hitmarker')throw Error('Invalid Hitmarker board');}
function bound(s){if(typeof s!=='string'||s.length>MAX)throw Error('Hitmarker response invalid');return s;}
function jobURL(s){try{const u=new URL(s);return u.origin===HOST&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/jobs\/[a-z0-9][a-z0-9-]*-\d+$/.test(u.pathname)&&u.pathname.length<500;}catch{return false;}}
export function hitmarkerEndpoint(source){board(source);return HOST+'/sitemap.xml';}
export function parseHitmarkerIndex(source,xml){board(source);bound(xml);if(!/<sitemapindex\b/.test(xml)||!/<\/sitemapindex>/.test(xml))throw Error('Hitmarker sitemap index missing');const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).filter(s=>s.includes('sitemap-jobs'));
 if(!locs.length||locs.length>3||new Set(locs).size!==locs.length||locs.some((s,i)=>s!==HOST+'/sitemap-jobs.xml/p'+(i+1)))throw Error('Hitmarker sitemap pagination requires verification');return locs;}
export function parseHitmarkerSitemapEntries(xml){bound(xml);if(!/<urlset\b/.test(xml)||!/<\/urlset>/.test(xml))throw Error('Hitmarker job sitemap missing');const entries=[...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m=>{const url=/<loc>([^<]+)<\/loc>/.exec(m[1])?.[1],raw=/<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1];return {url,lastmod:Number.isFinite(Date.parse(raw))?Date.parse(raw):null};});const urls=entries.map(x=>x.url);if(urls.length>5000||new Set(urls).size!==urls.length||urls.some(u=>!jobURL(u))||[...xml.matchAll(/<loc>/g)].length!==entries.length)throw Error('Hitmarker job sitemap incomplete/invalid');return entries;}
export function parseHitmarkerSitemap(xml){return parseHitmarkerSitemapEntries(xml).map(x=>x.url);}

const candidate=u=>/(?:environment|level|prop|world|3d|game)-(?:(?:artist|art|generalist)|(?:environment|level|prop|world|game)-artist)|(?:artist|art)-.*(?:environment|level|prop|world|3d)/i.test(new URL(u).pathname);
export function parseHitmarkerDetail(source,job,html,now=Date.now()){
 board(source);bound(html);if(!jobURL(job.url))throw Error('Invalid Hitmarker detail URL');const canonical=/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1];if(canonical!==job.url)throw Error('Hitmarker canonical identity mismatch');
 const visible=clean(html);if(/(?:job|position|listing) (?:has (?:been )?)?(?:expired|closed|filled)|(?:job|position|listing) (?:is |has been )?(?:already )?filled|no longer accepting applications|(?:job|position|listing) (?:is )?no longer available/i.test(visible))return {excluded:true};
 if(!visible.includes('Still accepting applications'))throw Error('Hitmarker job activity unknown');
 const id=job.url.match(/-(\d+)$/)?.[1];
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let item;try{item=JSON.parse(m[1]);}catch{continue;}if(item?.['@type']!=='JobPosting')continue;
  if(item.url&&item.url!==job.url)throw Error('Hitmarker JobPosting URL mismatch');
  if(String(item.identifier?.value)!==id||item.identifier?.name!=='Hitmarker')throw Error('Hitmarker JobPosting identity mismatch');
  const title=clean(item.title).slice(0,5000),company=clean(item.hiringOrganization?.name).slice(0,1000),snippet=clean(item.description).slice(0,20000);if(!title||!company||!snippet)throw Error('Hitmarker description/employer missing');
  if(/\b(?:talent[ -]?(?:pool|pipeline)|open application|general (?:application|interest)|speculative (?:application|opportunit)|evergreen)\b/i.test(title))return {excluded:true};
  if(item.validThrough&&(!Number.isFinite(Date.parse(item.validThrough))||Date.parse(item.validThrough)<now))return {excluded:true};
  if(!Number.isFinite(Date.parse(item.datePosted))||Date.parse(item.datePosted)>now)throw Error('Hitmarker posting date invalid');
  if(/\b2[ -]?d\b/i.test(title)&&!/\b3[ -]?d\b/i.test(title)||/\b(?:unpaid|volunteer|rev(?:enue)?[ -]?share|equity[ -]only|no (?:pay|compensation))\b/i.test(snippet))return {excluded:true};
  const locs=(Array.isArray(item.jobLocation)?item.jobLocation:[item.jobLocation]).filter(Boolean).map(x=>[x.address?.addressLocality,x.address?.addressRegion,x.address?.addressCountry].filter(Boolean).join(', ')).filter(Boolean);
  const restrictions=snippet.split(/(?<=[.!?])\s+/).filter(s=>/\b(?:only|must be based|timezone|time zone|core hours|hybrid|on-site|onsite)\b/i.test(s)&&/\b(?:remote|based|location|country|countries|UK|US|USA|United|Europe|Canada|Australia|GMT|UTC|hours|office|studio)\b/i.test(s)).slice(0,3).map(s=>s.slice(0,400));
  const remote=(item.jobLocationType==='TELECOMMUTE'||/#LI-Remote\b/i.test(snippet))&&!/\bhybrid\b|must work (?:from|in|at) (?:our |the )?(?:office|studio)/i.test(snippet);
  return {provider_job_id:id,title,company,snippet,remote,location:[...new Set([...locs,...restrictions])].join('; ')||(remote?'Remote; geographic scope not specified':''),posted_at:new Date(item.datePosted).toISOString(),studio_description_updated_at:new Date(now).toISOString()};
 }
 throw Error('Hitmarker JobPosting missing');
}
export async function collectHitmarker(source,{fetchText,deadline=Date.now()+40000,jobAllowed=()=>true}={}){
 const pages=parseHitmarkerIndex(source,await fetchText(hitmarkerEndpoint(source))),urls=[],seen=new Set();
 for(const page of pages){if(Date.now()+6000>deadline)throw Error('Hitmarker sitemap pagination deferred');for(const entry of parseHitmarkerSitemapEntries(await fetchText(page))){const url=entry.url;if(seen.has(url))throw Error('Hitmarker sitemap duplicate paging');seen.add(url);urls.push(entry);if(urls.length>MAX_URLS)throw Error('Hitmarker sitemap cap exceeded');}}
 const candidates=urls.filter(x=>candidate(x.url)).sort((a,b)=>(b.lastmod??0)-(a.lastmod??0)||Number(b.url.match(/-(\d+)$/)[1])-Number(a.url.match(/-(\d+)$/)[1])).map(({url})=>({url,provider_job_id:url.match(/-(\d+)$/)[1],title:'',company:'',snippet:'',remote:false,location:''}));
 // Sitemap slugs cannot establish exact title/employer; always revalidate details.
 const pending=candidates.filter(j=>!j.snippet),cursor=Number.isInteger(source.detail_cursor)&&source.detail_cursor>=0?source.detail_cursor:0,start=pending.length?cursor%pending.length:0;
 const selected=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);let attempted=0,completed=0,excluded=0;
 for(let i=0;i<selected.length;i+=2){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+2).map(async job=>{attempted++;try{const detail=parseHitmarkerDetail(source,job,await fetchText(job.url));if(detail.excluded){job.excluded=true;excluded++;return;}Object.assign(job,detail);completed++;}catch{job.detail_failed=true;}}));}
 const jobs=candidates.filter(j=>j.snippet&&!j.excluded&&jobAllowed(j)),deferred=pending.length-attempted,missing=pending.length-completed-excluded;
 return {jobs,fetched:urls.length,detail_cursor_next:pending.length?(start+attempted)%pending.length:0,details:{status:missing?'partial':'complete',attempted,completed,deferred,error:missing?`${missing} targeted sitemap candidates not yet verified; ${deferred} deferred by scan budget`:null}};
}
