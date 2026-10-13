import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as providers from '../supabase/functions/_shared/studio-providers.mjs';
import * as collector from '../supabase/functions/_shared/studio-collector.mjs';
import * as schedule from '../supabase/functions/_shared/studio-schedule.mjs';
import '../supabase/functions/_shared/track-filter.js';
const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/raven-studio-scan/index.ts','utf8').replace(/^import .*;\n/gm,''));
const token='c'.repeat(64),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
const due=['icims','avature','jobylon','breezy','recruitee','remotegamejobs','blenderartists','epicforum','artstation','hitmarker','eightbit','skillsearch','gamesjobsdirect'].map((provider,i)=>({id:String(i),provider,studio_name:'Studio '+provider,board_key:provider==='avature'?'8370':provider==='jobylon'?'2986':'zenimax',interval_hours:24,enabled:true,verification_status:'verified',next_check_at:'2026-10-01T00:00:00Z',priority:2,detail_cursor:2}));
const writes=[],calls=[];let handler;
const fakeFetch=async(url,opts={})=>{
 assert.match(url,/^https:\/\/db.example\/rest\/v1\//,'adapters receive transport but do not cause accidental external mock calls');
 const path=url.split('/rest/v1/')[1];
 if(opts.method!=='GET'){writes.push({path,body:JSON.parse(opts.body)});return new Response(null,{status:204});}
 return Response.json(path.startsWith('raven_studio_cron_auth')?[{token_hash:hash}]:path.includes('enabled=eq.true')?due.filter(row=>!writes.some(w=>w.path==='raven_studio_sources?id=eq.'+row.id)):[]);
};
const adapter=async(source,options)=>{
 calls.push(source.provider);
 assert.equal(typeof options.fetchText,'function');assert.equal(typeof options.fetchJson,'function');
 assert.ok(options.deadline>Date.now());
 assert.equal(options.detailAllowed({title:'Environment Artist',location:'London, UK',remote:false}),true,'remote status may be revealed by details');
 assert.equal(options.jobAllowed({title:'Environment Artist',location:'London, UK',remote:false}),false,'final location policy remains');
 await options.prepareDetails([{title:'Environment Artist',url:'https://example.com/'+source.provider}]);
 return {fetched:2,detail_cursor_next:7,jobs:[{title:'Environment Artist',company:source.studio_name,location:'Remote',remote:true,url:'https://example.com/'+source.provider,snippet:'FULL '+ 'x'.repeat(10000)},{title:'Character Artist',company:source.studio_name,location:'Remote',remote:true,url:'https://example.com/character-'+source.provider,snippet:'excluded'}],details:{status:'complete',attempted:1,completed:1,deferred:0,error:null}};
};
vm.runInNewContext(code,{...providers,...collector,...schedule,collectGamesJobsDirect:adapter,collectEightBit:adapter,collectSkillsearchSnapshot:adapter,collectHitmarker:adapter,collectArtStation:adapter,collectEpicForum:adapter,collectBlenderArtists:adapter,collectBreezy:adapter,collectRecruitee:adapter,collectRemoteGameJobs:adapter,collectIcims:adapter,collectAvature:adapter,collectJobylon:adapter,globalThis:{RavenTrackFilter:globalThis.RavenTrackFilter},Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://db.example':'test-key'},serve:fn=>handler=fn},fetch:fakeFetch,crypto,Response,TextEncoder,TextDecoder,Uint8Array,AbortSignal,URL});
const firstResponse=await handler(new Request('https://collector.example',{method:'POST',headers:{'x-raven-studio-secret':token}}));
assert.equal(firstResponse.status,200);assert.equal((await firstResponse.json()).checked,12,'first tick retains production source cap');
const secondResponse=await handler(new Request('https://collector.example',{method:'POST',headers:{'x-raven-studio-secret':token}}));
assert.equal(secondResponse.status,200);assert.equal((await secondResponse.json()).checked,1,'unprocessed due source advances on next tick');
assert.deepEqual(calls.sort(),['artstation','avature','blenderartists','breezy','eightbit','epicforum','gamesjobsdirect','hitmarker','icims','jobylon','recruitee','remotegamejobs','skillsearch']);
const inserts=writes.filter(w=>w.path.startsWith('raven_search_results'));assert.equal(inserts.length,13);
assert.ok(inserts.every(w=>w.body.length===1&&w.body[0].snippet.length===10005),'full details persist and exclusions still apply');
const health=writes.filter(w=>w.path.startsWith('raven_studio_sources'));assert.ok(health.every(w=>w.body.detail_cursor===7&&w.body.health_status==='healthy'));
const checks=writes.filter(w=>w.path==='raven_studio_checks');assert.ok(checks.every(w=>w.body.detail_completed===1&&w.body.detail_deferred===0));
console.log('portal dispatch, remote-detail eligibility, cursor and description telemetry passed');
