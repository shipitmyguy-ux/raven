// Public access evidence and bounded HTML snapshot. No Raven database writes.
import {mkdir, writeFile} from 'node:fs/promises';
import '../supabase/functions/_shared/track-filter.js';
import {fetchStudioText} from '../supabase/functions/_shared/studio-collector.mjs';
import {collectSkillsearch} from '../supabase/functions/_shared/studio-skillsearch.mjs';

const {gameArtRoleAllowed, jobLocationAllowed}=globalThis.RavenTrackFilter;
const started=Date.now();
// Rotate the bounded detail window daily if the category grows past twelve roles.
const source={provider:'skillsearch',board_key:'skillsearch',detail_cursor:Math.floor(started/86400000)*12};
const requests=[];
const pages=[];
const evidence={provider:'skillsearch',checked_at:new Date(started).toISOString(),
  runtime:{node:process.version,platform:process.platform,github_actions:process.env.GITHUB_ACTIONS==='true'},
  transport:'Anonymous ordinary fetch; redirect:error; 6-second timeout; 4 MB response cap. No proxy, spoofed browser, credentials or database writes.',
  scope:'Official Art Jobs category, with Raven Games / 3D role and location filters; bounded fresh descriptions.',requests};

try {
  const result=await collectSkillsearch(source,{
    deadline:started+40000,
    jobAllowed:job=>gameArtRoleAllowed(job)&&jobLocationAllowed(job),
    // Probe all bounded category details, including roles rejected by Raven's filter.
    detailAllowed:()=>true,
    fetchText:async url=>{
      const request={url,started_at:new Date().toISOString()};
      requests.push(request);
      try {
        const text=await fetchStudioText(url,async(input,options)=>{
          const response=await fetch(input,options);
          request.status=response.status;
          return response;
        });
        request.characters=text.length;
        pages.push({url,status:200,checked_at:new Date().toISOString(),html:text});
        return text;
      } catch(error) {
        request.error=String(error.message||error);
        throw error;
      }
    }
  });
  const snapshot={schema:1,provider:'skillsearch',board_key:'skillsearch',
    category_url:'https://www.skillsearch.com/search?groups=1',
    collected_at:new Date().toISOString(),detail_cursor:source.detail_cursor,
    provenance:{repository:process.env.GITHUB_REPOSITORY||'shipitmyguy-ux/raven',
      run_id:process.env.GITHUB_RUN_ID||'0',
      commit:process.env.GITHUB_SHA||'0000000000000000000000000000000000000000'},pages};
  const serialized=JSON.stringify(snapshot)+'\n';
  if(Buffer.byteLength(serialized,'utf8')>3500000)throw Error('Skillsearch snapshot exceeds 3.5 MB');
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/skillsearch-snapshot.json',serialized);
  Object.assign(evidence,{ok:true,fetched:result.fetched,
    eligible:result.jobs.length,details:result.details,detail_cursor_next:result.detail_cursor_next,
    jobs:result.jobs});
} catch(error) {
  Object.assign(evidence,{ok:false,error:String(error.message||error)});
  process.exitCode=1;
}
evidence.elapsed_ms=Date.now()-started;
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/skillsearch-probe.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({checked_at:evidence.checked_at,runtime:evidence.runtime,
  ok:evidence.ok,fetched:evidence.fetched,eligible:evidence.eligible,
  details:evidence.details,error:evidence.error,
  requests:requests.map(({url,status,characters,error})=>({url,status,characters,error}))},null,2));
