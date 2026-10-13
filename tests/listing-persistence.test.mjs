import test from 'node:test';
import assert from 'node:assert/strict';
import {saveAvailability,updateDescription} from '../supabase/functions/raven-enrich-v1/db.ts';
test('closure patches only availability on saved rows and filters failed rechecks',async()=>{
 const previousFetch=globalThis.fetch,previousDeno=globalThis.Deno,calls=[];
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.invalid':'test-only'}};
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init.body)});return new Response(null,{status:204});};
 try{
  const evidence={state:'closed',reason:'This job is closed',checked_at:'2026-10-08T16:00:00Z',source_url:'https://example.com/job/1',http_status:200};
  await saveAvailability(evidence.source_url,evidence,evidence.source_url+'?utm_source=test');
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.listing_state,'closed');
  for(const key of ['status','resume','cover_letter','applied_date','follow_up','notes'])assert.equal(key in calls[0].body,false);
  assert.equal(calls[1].body.status,'Expired');
  assert.match(decodeURIComponent(calls[0].url),/utm_source=test/);
  calls.length=0;
  await saveAvailability(evidence.source_url,{...evidence,state:'unconfirmed'});
  assert.equal('listing_state' in calls[0].body,false);
  assert.match(calls[0].url,/listing_state.neq.closed/);
  assert.match(calls[1].url,/listing_state.neq.closed/);
  calls.length=0;
  await updateDescription(evidence.source_url,{snippet:'Full description'});
  assert.equal('status' in calls[0].body,false);
 }finally{globalThis.fetch=previousFetch;globalThis.Deno=previousDeno;}
});

test('enrichment propagates expiry evidence and keeps plain 404 unconfirmed',async()=>{
 const {enrichCandidate}=await import('../supabase/functions/raven-enrich-v1/enrich.ts');
 const oldFetch=globalThis.fetch;
 const candidate={track:'Professional',title:'Project Manager',url:'https://example.test/jobs/1'};
 try{
  globalThis.fetch=async()=>new Response('<script type="application/ld+json">{"@type":"JobPosting","title":"Project Manager","validThrough":"2020-01-01","description":"Full original job description."}</script>',{status:200});
  let result=await enrichCandidate(candidate);
  assert.equal(result._availability.state,'closed');assert.match(result._availability.reason,/validThrough/);
  globalThis.fetch=async()=>new Response('Not found',{status:404});
  result=await enrichCandidate(candidate);assert.equal(result._availability.state,'unconfirmed');
  globalThis.fetch=async()=>{throw new Error('timeout')};
  result=await enrichCandidate(candidate);assert.equal(result._availability.state,'unconfirmed');
 }finally{globalThis.fetch=oldFetch;}
});

test('related expired JobPosting cannot close the requested role',async()=>{
 const {enrichCandidate}=await import('../supabase/functions/raven-enrich-v1/enrich.ts'),oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('<script type="application/ld+json">{"@type":"JobPosting","title":"Unrelated Role","validThrough":"2020-01-01","description":"Related role description."}</script>',{status:200});
  const result=await enrichCandidate({track:'Professional',title:'Project Manager',url:'https://example.test/jobs/1'});
  assert.equal(result._availability.state,'unconfirmed');
 }finally{globalThis.fetch=oldFetch;}
});
