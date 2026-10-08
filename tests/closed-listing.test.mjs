import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listingEvidence,checkListing} from '../supabase/functions/raven-enrich-v1/availability.mjs';
import {saveListingCheck} from '../supabase/functions/raven-enrich-v1/db.ts';
import fs from 'node:fs';
import vm from 'node:vm';
const url='https://careers.example.com/jobs/123';
test('explicit closure notices across source wording',()=>{
 for(const notice of ['This job is closed','This position has been filled','The listing has expired','No longer accepting applications','This job is no longer posted'])
  assert.equal(listingEvidence({url,html:'<h1>Artist</h1><p>'+notice+'</p>'}).state,'closed',notice);
});
test('source failures, blocks, redirects and incidental text remain uncertain',async()=>{
 for(const status of [404,410,403,429,500]) assert.equal(listingEvidence({url,status,html:'This job is closed'}).state,'unconfirmed');
 for(const html of ['', '<p>Access denied. This job is closed</p>','<script>This job is closed</script>','<p>Manage closed accounts and filled orders.</p>'])
  assert.equal(listingEvidence({url,html}).state,'unconfirmed');
 assert.equal(listingEvidence({url,finalUrl:'https://careers.example.com/jobs',html:'This job is closed'}).state,'unconfirmed');
 assert.equal((await checkListing(url,async()=>{throw new Error('timeout');})).state,'unconfirmed');
});
test('expired structured evidence must match this listing',()=>{
 const html=job=>'<script type="application/ld+json">'+JSON.stringify(job)+'</script>';
 const job={'@type':'JobPosting',url,title:'Artist',description:'Make art',validThrough:'2020-01-01'};
 assert.equal(listingEvidence({url,html:html(job)}).state,'closed');
 assert.equal(listingEvidence({url,html:html({...job,url:'https://careers.example.com/jobs/other'})}).state,'unconfirmed');
 assert.equal(listingEvidence({url,html:html({...job,validThrough:'2099-01-01'})}).state,'open');
});
test('durable check patches only availability and preserves closure after ambiguous recheck',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://db.example':'server-test-key'}};
 const job={status:'Interview',resume:'saved resume',cover_letter:'saved letter',applied_date:'2026-01-01',listing_check:null};
 const discovery={status:'Discovered',listing_check:null};
 globalThis.fetch=async(endpoint,init)=>{
  const row=endpoint.includes('raven_jobs?')?job:discovery;
  if(init.method==='GET') return Response.json([{listing_check:row.listing_check}]);
  const patch=JSON.parse(init.body);assert.deepEqual(Object.keys(patch),['listing_check']);Object.assign(row,patch);
  return new Response(null,{status:204});
 };
 try {
  const closed={state:'closed',reason:'This position has been filled',checked_at:'2026-10-08T00:00:00Z'};
  await saveListingCheck(url,closed);
  await saveListingCheck(url,{state:'unconfirmed',reason:'HTTP 403',checked_at:'2026-10-08T01:00:00Z'});
  assert.equal(job.listing_check.state,'closed');assert.equal(job.listing_check.last_check.reason,'HTTP 403');
  assert.equal(JSON.parse(JSON.stringify(job)).listing_check.reason,closed.reason);
  assert.equal(job.status,'Interview');assert.equal(job.resume,'saved resume');assert.equal(job.cover_letter,'saved letter');
  await saveListingCheck(url,{state:'open',reason:'Current matching JobPosting',checked_at:'2026-10-08T02:00:00Z'});
  assert.equal(job.listing_check.state,'open');
 } finally {globalThis.fetch=originalFetch;delete globalThis.Deno;}
});
test('closed saved rows leave active bucket while application history keeps its stage',()=>{
 const code=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const start=code.indexOf('  function pipelineBucket(job)'),end=code.indexOf('  function lifecycleStatuses()',start);
 const context={};vm.createContext(context);vm.runInContext(code.slice(start,end),context);
 for(const status of ['Saved','Ready','Interested']) assert.equal(context.pipelineBucket({status,listingCheck:{state:'closed'}}),'Closed');
 for(const status of ['Applied','Interview','Offer','Rejected']) assert.equal(context.pipelineBucket({status,listingCheck:{state:'closed'}}),status);
});
