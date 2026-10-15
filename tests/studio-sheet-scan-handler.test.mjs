import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as collector from '../supabase/functions/_shared/studio-collector.mjs';
import * as schedule from '../supabase/functions/_shared/studio-schedule.mjs';
import * as providers from '../supabase/functions/_shared/studio-providers.mjs';
import * as sheet from '../supabase/functions/_shared/studio-sheet-feed.mjs';
import * as evidence from '../supabase/functions/_shared/job-duplicate-evidence.mjs';
import {planStudioIngestion} from '../supabase/functions/_shared/studio-ingest-dedup.mjs';
import {sameJob} from '../supabase/functions/_shared/studio-result-dedup.mjs';
import '../supabase/functions/_shared/track-filter.js';
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/raven-studio-scan/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
const token='a'.repeat(64);
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
const due={id:'sheet-id',studio_name:'Tim Plöger Remote Games Sheet',provider:'remotegamessheet',board_key:sheet.REMOTE_GAME_SHEET_KEY,enabled:true,verification_status:'verified',next_check_at:'2026-10-01T00:00:00Z',interval_hours:24,priority:2};
const existing=[
 {title:'Environment Artist',company:'Studio A',location:'USA',remote:true,url:'https://jobs.ashbyhq.com/studio-a/same-job',source:'Tim Ploeger Remote Games Sheet',track:'Games / 3D',status:'Discovered'},
 {title:'Lead Environment Artist',company:'Studio B',location:'USA',remote:true,url:'https://example.org/another-board',source:'Studio:ashby',track:'Games / 3D',status:'Discovered'}
];
const collected=[
 {title:'Environment Artist',company:'Studio A',location:'USA',remote:true,url:'https://jobs.ashbyhq.com/studio-a/same-job',snippet:''},
 {title:'Lead Environment Artist',company:'Studio B',location:'USA',remote:true,url:'https://example.org/same-role',snippet:''},
 {title:'Senior Environment Artist',company:'Studio C',location:'Worldwide',remote:true,url:'https://example.org/fresh-role',snippet:''}
];
const writes=[];
const fakeFetch=async(url,opts={})=>{
 if(!String(url).startsWith('https://db.example/rest/v1/'))throw Error('Collector must not request another host');
 const path=String(url).split('/rest/v1/')[1];
 if(opts.method==='GET'){
  if(path.startsWith('raven_studio_cron_auth'))return Response.json([{token_hash:hash}]);
  if(path.includes('enabled=eq.true'))return Response.json([due]);
  if(path.startsWith('raven_search_results'))return Response.json(existing);
  if(path.startsWith('raven_jobs'))return Response.json([]);
  throw Error('Unexpected lookup '+path);
 }
 writes.push({path,body:JSON.parse(opts.body),method:opts.method});
 return new Response(null,{status:204});
};
let handler;
vm.runInNewContext(source,{...providers,...collector,...schedule,...sheet,collectRemoteGameSheet:async()=>({jobs:collected,fetched:656,details:{status:'not_needed',error:null,attempted:0,completed:0,deferred:0}}),...evidence,sameJob,planStudioIngestion,
 fetch:fakeFetch,globalThis:{RavenTrackFilter:globalThis.RavenTrackFilter},
 Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://db.example':'local-test-key'},serve:fn=>{handler=fn;}},
 crypto,Response,TextEncoder,TextDecoder,Uint8Array,AbortSignal,URL});
const request=new Request('https://scanner.example',{method:'POST',headers:{'x-raven-studio-secret':token}});
test('authenticated scanner imports new jobs once and preserves exact and ambiguous existing records',async()=>{
 const result=await (await handler(request)).json();
 assert.equal(result.ok,true);
 assert.equal(result.results[0].fetched,656);
 assert.equal(result.results[0].eligible,3);
 assert.equal(result.results[0].details.imported,1);
 assert.equal(result.results[0].details.skipped_exact,1);
 assert.equal(result.results[0].details.held_for_review,1);
 const insert=writes.find(w=>w.path.startsWith('raven_search_results?on_conflict=url'));
 assert.equal(insert.body.length,1);
 assert.equal(insert.body[0].company,'Studio C');
 assert.equal(insert.body[0].source,'Tim Ploeger Remote Games Sheet');
 const touch=writes.find(w=>w.path.includes('source=eq.')&&w.method==='PATCH');
 assert.ok(touch,'previous sheet discovery refreshed without title/status overwrite');
 assert.deepEqual(Object.keys(touch.body),['last_seen']);
 const check=writes.find(w=>w.path==='raven_studio_checks');
 assert.equal(check.body.status,'ok');
});
