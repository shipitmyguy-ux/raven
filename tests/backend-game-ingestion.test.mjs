import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {planStudioIngestion} from '../supabase/functions/_shared/studio-ingest-dedup.mjs';
import {usStudioScopeAllowed} from '../supabase/functions/_shared/studio-us-eligibility.mjs';

function harness(existing=[],saved=[]){
 const writes=[],reads=[];
 const fetch=async(url,opts={})=>{
  assert.ok(String(url).startsWith('https://db.example/rest/v1/'));
  const path=String(url).split('/rest/v1/')[1];
  if(opts.method==='GET'){
   reads.push(path);
   if(path.startsWith('raven_search_results'))return Response.json(existing);
   if(path.startsWith('raven_jobs'))return Response.json(saved);
   throw Error('Unexpected discovery read '+path);
  }
  writes.push({path,method:opts.method,body:JSON.parse(opts.body),prefer:new Headers(opts.headers).get('Prefer')});
  return new Response(null,{status:204});
 };
 let source=fs.readFileSync('supabase/functions/raven-backend-v3/db.ts','utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 source=stripTypeScriptTypes(source);
 const globals={
  fetch,Response,Headers,URL,AbortSignal,TextEncoder,TextDecoder,
  Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://db.example':'test-key'}},
  planStudioIngestion,usStudioScopeAllowed,
  candidateAllowedForTrack:()=>true,validAtsRow:()=>true,
  deduplicateStudioResults:rows=>rows,
  deduplicateJobs:rows=>rows,
  sameJob:(a,b)=>a.url===b.url,
  findExistingJob:()=>null
 };
 vm.runInNewContext(source+'\nglobalThis.dbExports={upsertResults};',globals);
 return {...globals,upsertResults:globals.dbExports.upsertResults,writes,reads};
}
const job=(extra={})=>({track:'Games / 3D',title:'Senior Environment Artist',company:'Studio A',location:'USA',remote:true,url:'https://example.org/new',source:'ATS:Greenhouse',score:10,snippet:'',...extra});

test('broad ATS rejects geographic mismatches and holds ambiguous cross-board matches privately',async()=>{
 const prior=job({location:'United States',url:'https://example.org/old',source:'Studio:ashby',status:'Discovered'});
 const harnessed=harness([prior]);
 await harnessed.upsertResults([job(),job({title:'Lead Prop Artist',company:'Studio B',url:'https://example.org/new-b'}),job({title:'3D Artist',company:'Studio C',location:'Canada',url:'https://example.org/ca'})]);
 const inserted=harnessed.writes.find(w=>w.path.startsWith('raven_search_results?on_conflict'));
 const reviewed=harnessed.writes.find(w=>w.path.startsWith('raven_job_duplicate_reviews'));
 assert.equal(inserted.body.length,1);
 assert.equal(inserted.body[0].company,'Studio B');
 assert.equal(reviewed.body.length,1);
 assert.equal(reviewed.body[0].candidate_url,'https://example.org/new');
 assert.match(reviewed.prefer,/ignore-duplicates/);
 assert.ok(harnessed.reads.some(x=>x.startsWith('raven_jobs')));
 assert.equal(prior.status,'Discovered');
});
test('saved application is never overwritten by new broad ATS discovery',async()=>{
 const saved=job({url:'https://example.org/saved',source:'Saved application',status:'Interview'});
 const h=harness([],[saved]);
 await h.upsertResults([job({url:'https://example.org/saved'})]);
 assert.equal(h.writes.some(w=>w.path.startsWith('raven_search_results?on_conflict')),false);
 assert.equal(saved.status,'Interview');
});
test('Professional ingestion does not invoke game-only privacy and dedup reads',async()=>{
 const h=harness();
 await h.upsertResults([{track:'Professional',title:'Implementation Manager',company:'Example',location:'Remote US',remote:true,url:'https://example.org/pro',source:'RemoteOK',score:8}]);
 assert.equal(h.reads.length,0);
 assert.equal(h.writes.filter(w=>w.path.startsWith('raven_search_results')).length,1);
});

test('previously geo-reviewed discovery cannot be reactivated by another provider',async()=>{
 const held=job({url:'https://example.org/restricted',source:'Tim Ploeger Remote Games Sheet',status:'GeoReview',listing_state:'geo_ineligible'});
 const h=harness([held]);
 await h.upsertResults([job({url:'https://example.org/restricted',source:'ATS:Greenhouse'})]);
 assert.equal(h.writes.some(w=>w.path.startsWith('raven_search_results?on_conflict')),false);
 assert.equal(held.status,'GeoReview');
});
