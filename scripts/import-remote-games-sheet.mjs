// Idempotent live import. Requires server-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Never expose the service key in a browser or commit it to Git.
import fs from 'node:fs/promises';
import {canonicalJobUrl,duplicateEvidence,normalizeIdentity} from '../supabase/functions/_shared/job-duplicate-evidence.mjs';
const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key)throw Error('Missing secure Supabase import configuration');
const source='Tim Ploeger Remote Games Sheet';
const data=JSON.parse(await fs.readFile('data/remote-games-sheet-jobs.json','utf8'));
const role=/environment artist|world artist|level artist|prop artist|3d artist|world build|material artist|texture artist|hard.surface|asset artist|lighting artist/i;
const geo=/worldwide|usa|united states|north america|canada|pacific time|americas/i;
async function request(path,options={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Database request failed '+r.status+': '+(await r.text()).slice(0,300));const t=await r.text();return t?JSON.parse(t):[];}
const existing=[];for(let offset=0;;offset+=500){const page=await request('raven_search_results?select=url,title,company,location,snippet,source,track&limit=500&offset='+offset);existing.push(...page);if(page.length<500)break;}
const urlMap=new Map(existing.map(j=>[canonicalJobUrl(j.url),j]));
const identityMap=new Map();for(const j of existing){const k=[normalizeIdentity(j.company),normalizeIdentity(j.title),normalizeIdentity(j.location)].join('|');if(!identityMap.has(k))identityMap.set(k,[]);identityMap.get(k).push(j);}
const inserts=[];let duplicateUrl=0,duplicateIdentity=0,review=0,invalid=0;
for(const job of data.jobs||[]){
 if(!role.test(job.title)||!geo.test(job.remote_scope))continue;
 const url=canonicalJobUrl(job.url);if(!url){invalid++;continue;}
 if(urlMap.has(url)){duplicateUrl++;continue;}
 const keyId=[normalizeIdentity(job.company),normalizeIdentity(job.title),normalizeIdentity(job.remote_scope)].join('|');
 if(identityMap.has(keyId)){duplicateIdentity++;continue;}
 // Similarity only creates a review flag; spreadsheet does not contain full descriptions.
 const sameCompany=existing.filter(x=>normalizeIdentity(x.company)===normalizeIdentity(job.company));
 if(sameCompany.some(x=>duplicateEvidence({...job,location:job.remote_scope},x).decision==='review')){review++;continue;}
 const row={track:'Games / 3D',title:job.title,company:job.company,location:job.remote_scope,remote:true,url:job.url,source,snippet:'Spreadsheet listing; verify opening and location eligibility before applying.',score:8,status:'Discovered',last_seen:new Date().toISOString()};
 inserts.push(row);urlMap.set(url,row);existing.push(row);identityMap.set(keyId,[row]);
}
if(process.env.DRY_RUN==='1'){console.log(JSON.stringify({dry_run:true,insert_candidates:inserts.length,duplicateUrl,duplicateIdentity,review,invalid}));process.exit(0);}
for(let i=0;i<inserts.length;i+=25)await request('raven_search_results?on_conflict=url',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(inserts.slice(i,i+25))});
console.log(JSON.stringify({import_candidates:inserts.length,duplicateUrl,duplicateIdentity,review,invalid}));
