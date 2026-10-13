import {collectSkillsearch} from './studio-skillsearch.mjs';
export const SKILLSEARCH_SNAPSHOT_URL='https://raw.githubusercontent.com/shipitmyguy-ux/raven/skillsearch-feed/skillsearch-snapshot.json';
const CATEGORY='https://www.skillsearch.com/search?groups=1',MAX_BYTES=4000000;
const bytes=s=>new TextEncoder().encode(s).length;
function timestamp(value,now,label){const n=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(n)||n<now-36*3600000||n>now+5*60000)throw Error(`Skillsearch snapshot ${label} stale or invalid`);return n;}
function allowedURL(value){if(typeof value!=='string')return false;if(value===CATEGORY)return true;if(/^https:\/\/www\.skillsearch\.com\/search\?groups=1&page=(?:[2-9]|1\d|20)$/.test(value))return true;return /^https:\/\/www\.skillsearch\.com\/vacancy\/[a-z0-9][a-z0-9-]*-\d+$/.test(value)&&value.length<550;}
export function parseSkillsearchSnapshot(text,now=Date.now()){
 if(typeof text!=='string'||bytes(text)>MAX_BYTES)throw Error('Skillsearch snapshot payload invalid or oversized');let data;try{data=JSON.parse(text);}catch{throw Error('Skillsearch snapshot JSON invalid');}
 if(data?.schema!==1||data.provider!=='skillsearch'||data.board_key!=='skillsearch'||data.category_url!==CATEGORY)throw Error('Skillsearch snapshot identity invalid');
 if(data.provenance?.repository!=='shipitmyguy-ux/raven'||!/^\d+$/.test(data.provenance?.run_id??'')||typeof data.provenance.run_id!=='string'||! /^[a-f0-9]{40}$/i.test(data.provenance?.commit??''))throw Error('Skillsearch snapshot provenance invalid');
 const collected=timestamp(data.collected_at,now,'collection');if(!Number.isInteger(data.detail_cursor)||data.detail_cursor<0)throw Error('Skillsearch snapshot detail cursor invalid');
 if(!Array.isArray(data.pages)||data.pages.length<1||data.pages.length>32)throw Error('Skillsearch snapshot page count invalid');const pages=new Map();
 for(const page of data.pages){if(!allowedURL(page?.url)||page.status!==200||typeof page.html!=='string'||!page.html||pages.has(page.url))throw Error('Skillsearch snapshot page identity invalid');const checked=timestamp(page.checked_at,now,'page');if(checked>collected||collected-checked>15*60000)throw Error('Skillsearch snapshot page collection mismatch');pages.set(page.url,page);}
 if(!pages.has(CATEGORY))throw Error('Skillsearch snapshot category missing');return {data,pages};
}
export async function collectSkillsearchSnapshot(source,options={}){
 if(source.provider!=='skillsearch'||source.board_key!=='skillsearch')throw Error('Invalid Skillsearch snapshot board');
 const {data,pages}=parseSkillsearchSnapshot(await options.fetchText(SKILLSEARCH_SNAPSHOT_URL));
 const result=await collectSkillsearch({...source,detail_cursor:data.detail_cursor},{...options,detailAllowed:()=>true,fetchText:async url=>{const page=pages.get(url);if(!page)throw Error('Skillsearch snapshot requested page missing');return page.html;}});
 for(const job of result.jobs)job.studio_description_updated_at=new Date(Date.parse(pages.get(job.url).checked_at)).toISOString();
 return result;
}
