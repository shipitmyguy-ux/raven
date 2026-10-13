// Read-only access evidence. This script never writes Raven runtime data.
import {mkdir, writeFile} from 'node:fs/promises';
import '../supabase/functions/_shared/track-filter.js';
import {fetchStudioText} from '../supabase/functions/_shared/studio-collector.mjs';
import {collectSkillsearch} from '../supabase/functions/_shared/studio-skillsearch.mjs';

const {gameArtRoleAllowed, jobLocationAllowed}=globalThis.RavenTrackFilter;
const source={provider:'skillsearch',board_key:'skillsearch',detail_cursor:0};
const requests=[];
const started=Date.now();
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
        return text;
      } catch(error) {
        request.error=String(error.message||error);
        throw error;
      }
    }
  });
  Object.assign(evidence,{ok:result.details.status==='complete',fetched:result.fetched,
    eligible:result.jobs.length,details:result.details,detail_cursor_next:result.detail_cursor_next,
    jobs:result.jobs});
  if(!evidence.ok)process.exitCode=1;
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
