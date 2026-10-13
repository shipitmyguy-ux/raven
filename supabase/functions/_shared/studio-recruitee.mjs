// Anonymous public careers feeds only; verified board/employer bindings in docs.
const BOARDS=Object.freeze({
 '11bitstudios':{studio:'11 bit studios',employer:'11 bit studios'},
 'lucidgames':{studio:'Lucid Games',employer:'Lucid Games'},
 'companiongroupltd':{studio:'Companion Group',employer:'Companion Group Ltd'},
});
const MAX_OFFERS=300;
function board(source){
 const b=Object.hasOwn(BOARDS,source?.board_key)?BOARDS[source.board_key]:null;
 if(source?.provider!=='recruitee'||!b||b.studio!==source.studio_name)throw Error('Unverified Recruitee board');
 return b;
}
function clean(value,max=20000){
 if(typeof value!=='string')throw Error('Invalid Recruitee text');
 return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
 .replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,e=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
  if(named[e.toLowerCase()])return named[e.toLowerCase()];
  const n=e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):parseInt(e.slice(2,-1),10);
  return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
 }).replace(/\s+/g,' ').trim().slice(0,max);
}
function date(raw){
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(raw))return '';
 const stamp=Date.parse(raw.replace(' ','T').replace(' UTC','Z'));return Number.isFinite(stamp)?new Date(stamp).toISOString():'';
}
export function recruiteeEndpoint(source){board(source);return `https://${source.board_key}.recruitee.com/api/offers`;}
export function parseRecruiteeOffers(source,payload){
 const b=board(source);
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.offers))throw Error('Recruitee offers structure missing');
 if(Object.keys(payload).some(k=>k!=='offers'))throw Error('Unsupported Recruitee response template/pagination');
 if(JSON.stringify(payload).length>4000000)throw Error('Recruitee response size exceeded');
 if(payload.offers.length>MAX_OFFERS)throw Error('Recruitee offer limit exceeded');
 const seen=new Set(),jobs=[];
 for(const offer of payload.offers){
  if(!offer||typeof offer!=='object'||offer.company_name!==b.employer)throw Error('Recruitee employer mismatch');
  if(offer.status!=='published')throw Error('Recruitee published role status missing');
  if(!Number.isSafeInteger(offer.id)||offer.id<=0||typeof offer.slug!=='string'||! /^[a-z0-9][a-z0-9-]{0,250}$/.test(offer.slug))throw Error('Recruitee role identity missing');
  const url=`https://${source.board_key}.recruitee.com/o/${offer.slug}`;
  if(offer.careers_url!==url)throw Error('Recruitee role URL mismatch');
  if(typeof offer.title!=='string'||!offer.title.trim()||offer.title.length>5000)throw Error('Recruitee role title missing');
  if(typeof offer.remote!=='boolean'||typeof offer.hybrid!=='boolean'||typeof offer.on_site!=='boolean')throw Error('Recruitee work arrangement missing');
  if(!Array.isArray(offer.locations)||offer.locations.length>50)throw Error('Recruitee location structure missing');
  const location=offer.locations.map(l=>{
   if(!l||typeof l!=='object')throw Error('Recruitee location structure missing');
   return [...new Set(['city','state','country'].map(k=>l[k]).filter(v=>typeof v==='string'&&v.trim()))].map(v=>clean(v,500)).join(', ');
  }).filter(Boolean).join('; ');
  const description=clean(offer.description),requirements=offer.requirements==null?'':clean(offer.requirements);
  const snippet=[description,requirements].filter(Boolean).join('\n\n').slice(0,20000);
  if(!description)throw Error('Recruitee full description missing');
  const id=String(offer.id);
  if(seen.has(id)||seen.has(url))throw Error('Duplicate Recruitee role identity');
  seen.add(id);seen.add(url);
  jobs.push({provider_job_id:id,title:clean(offer.title,5000),company:b.studio,location:location.slice(0,1000),remote:offer.remote===true&&offer.hybrid===false&&offer.on_site===false,url,snippet,posted_at:date(offer.published_at),studio_description_updated_at:new Date().toISOString()});
 }
 return {jobs,fetched:payload.offers.length};
}
export async function collectRecruitee(source,{fetchJson,deadline=Date.now()+40000,jobAllowed=()=>true,detailAllowed=jobAllowed,prepareDetails}={}){
 const url=recruiteeEndpoint(source);
 if(Date.now()>=deadline)throw Error('Recruitee scan deadline exceeded');
 const result=parseRecruiteeOffers(source,await fetchJson(url));
 // Public feed already contains complete role and requirement text; no detail requests or cache overwrite.
 const candidates=result.jobs.filter(detailAllowed);
 return {...result,detail_cursor_next:0,details:{status:'complete',attempted:candidates.length,completed:candidates.length,deferred:0,error:null}};
}
