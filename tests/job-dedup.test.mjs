import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import '../supabase/functions/_shared/job-dedup.js';
const {sameJob,deduplicateJobs,findExistingJob,atsKey}=globalThis.RavenJobDedup;
const old={id:'existing',track:'Games / 3D',company:'Smile-Break',title:'Senior Environment Artist',location:'Remote',remote:true,status:'Applied',resume:'original-resume',cover_letter:'original-cover',applied_date:'2026-10-07',url:'https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job',source:'Remote Game Jobs',notes:'old summary'};
const incoming={...old,id:'new',company:'Smile Break',status:'Saved',resume:'',cover_letter:'',applied_date:null,source:'Studio:artstation',location:'Asia; Europe; North America',url:'https://www.artstation.com/jobs/QKn9',notes:'Full verified posting'};
for(const rows of [[old,incoming],[incoming,old]])assert.deepEqual(deduplicateJobs(rows),[old]);
assert.equal(findExistingJob(incoming,[old]),old);
assert.equal(sameJob(old,{...incoming,url:incoming.url+'/?utm_source=newsletter#top'}),true);
assert.equal(sameJob(old,{...incoming,title:'Lead Environment Artist'}),false);
assert.equal(sameJob(old,{...incoming,company:'Other Studio'}),false);
assert.equal(sameJob(old,{...incoming,track:'Professional'}),false);
assert.equal(sameJob(old,{...incoming,url:'https://www.artstation.com/jobs/unverified'}),false);
assert.equal(atsKey('https://jobs.ashbyhq.com.evil.test/studio/5470c42c-1502-42aa-a3de-3ce213fb62d8'),'');
assert.equal(atsKey('https://user:secret@www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13'),'');
const link='https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13';
assert.equal(sameJob(old,{...incoming,url:'https://example.com/new-board',notes:'How to apply: '+link}),true);
assert.equal(sameJob(old,{...incoming,url:link+'/apply?source=board'}),true);
assert.equal(sameJob(old,{...incoming,url:'https://example.com/new-board',notes:'Other jobs: '+link}),false);
assert.equal(sameJob(old,{...incoming,url:link.replace('6ab429f63bd186aa38742a13','6ab429f63bd186aa38742a14')}),false);
const discovered={...incoming,id:'DISC-new',status:'Discovered',_discovered:true};
assert.deepEqual(deduplicateJobs([discovered,{...old,status:'Ignored',resume:'',cover_letter:'',applied_date:null}]).map(x=>x.status),['Ignored']);
const exact={...incoming,id:'new-official',url:link,status:'Discovered'};
assert.deepEqual(deduplicateJobs([old,exact]),[old]);
// A newer, different requisition with the same title must remain visible.
assert.equal(deduplicateJobs([old,{...exact,url:link.replace(/13$/,'14')}]).length,2);
const weak={company:'Actual Studio',title:'Environment Artist',remote:true,location:'Remote US',source:'Studio:hitmarker',url:'https://example.com/one',snippet:'We need modular environment artwork and realistic assets. '.repeat(20),status:'Discovered'};
const weak2={...weak,source:'Studio:artstation',url:'https://example.com/two'};
assert.equal(deduplicateJobs([weak,weak2]).length,1);
for(const patch of [{location:'Remote Canada'},{title:'Senior Environment Artist'},{company:'Unknown employer'},{source:'Studio:hitmarker'},{snippet:'brief summary'}])assert.equal(deduplicateJobs([weak,{...weak2,...patch}]).length,2);
// Matching is pure and retains exact document URLs/IDs and submitted history.
Object.freeze(old);Object.freeze(incoming);assert.equal(deduplicateJobs([incoming,old])[0],old);
// Browser's real combinedJobs path also collapses saved vs saved and saved vs discovery.
const app=fs.readFileSync('app.js','utf8');
const combined=app.slice(app.indexOf('  function preferredDescription('),app.indexOf('  function filteredJobs('));
const ctx={window:{RavenJobDedup:globalThis.RavenJobDedup,RavenTrackFilter:{gameArtRoleAllowed:()=>true,jobLocationAllowed:()=>true}},state:{activeTrack:'Games / 3D',jobs:[old,incoming],discovered:{'Games / 3D':[discovered]}},normalizeComparableUrl:globalThis.RavenJobDedup.canonicalUrl,parseBool:v=>Boolean(v)};
vm.runInNewContext(combined+';globalThis.results=combinedJobs();',ctx);
assert.equal(ctx.results.length,1);assert.equal(ctx.results[0].id,old.id);assert.equal(ctx.results[0].resume,old.resume);
// Exercise actual backend lookup/import and discovery paths with a REST double.
const db=stripTypeScriptTypes(fs.readFileSync('supabase/functions/raven-backend-v3/db.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,''));
let posts=0;
const backend={...globalThis.RavenJobDedup,Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://db.example':'test-key'}},Headers,URL,Response,Set,candidateAllowedForTrack:()=>true,validAtsRow:()=>true,fetch:async(url,opts)=>{
 if(opts.method==='POST'){posts++;return Response.json([{...JSON.parse(opts.body)}]);}
 if(url.includes('raven_jobs?select=*&url='))return Response.json([]);
 if(url.includes('raven_jobs?'))return Response.json([old]);
 return Response.json([{...incoming,status:'Discovered',snippet:incoming.notes}]);
}};
vm.runInNewContext(db+';globalThis.api={addJob,listResults};',backend);
const result=await backend.api.addJob(incoming);
assert.equal(result.id,old.id);assert.equal(result.duplicate,true);assert.equal(result.resume,old.resume);assert.equal(posts,0);
assert.equal((await backend.api.listResults('Games / 3D')).length,0,'saved identity suppresses rediscovery');
console.log('Job dedup: saved/applied preservation, imports, browser combination, exact ATS identity, repost guards and discovery suppression passed');
