import assert from 'node:assert/strict';
import {enrichStudioDetails,fetchStudioJson,reuseFreshStudioDescriptions} from '../supabase/functions/_shared/studio-collector.mjs';
const source={studio_name:'Example',provider:'smartrecruiters',board_key:'example'};
const job=id=>({title:'Environment Artist',url:'https://jobs.smartrecruiters.com/example/'+id,provider_job_id:String(id),snippet:''});
let active=0,peak=0,calls=0;
const good=async url=>{calls++;assert.match(url,/^https:\/\/api.smartrecruiters.com\/v1\/companies\/example\/postings\/\d+$/);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return Response.json({id:url.split('/').at(-1),name:'Environment Artist',postingUrl:'https://jobs.smartrecruiters.com/example/1',jobAd:{sections:{jobDescription:{text:'<p>Create world assets</p>'}}}});};
const jobs=Array.from({length:15},(_,i)=>job(i+1));
const result=await enrichStudioDetails(source,jobs,{fetcher:good});
assert.equal(calls,12);assert.equal(peak,2);assert.equal(result.deferred,3);assert.equal(result.status,'partial');assert.equal(jobs[0].snippet,'Create world assets');assert.equal(jobs[14].snippet,'');
const cached={...job(1),snippet:'Preserved description'};
const failure=await enrichStudioDetails(source,[cached,job(2)],{fetcher:async()=>new Response('down',{status:503})});
assert.equal(cached.snippet,'Preserved description');assert.equal(failure.status,'partial');assert.match(failure.error,/503/);
const malicious=job('https://attacker.invalid');let fetched=false;
await enrichStudioDetails(source,[malicious],{fetcher:async()=>{fetched=true;return Response.json({});}});assert.equal(fetched,false);
const mismatched=await enrichStudioDetails(source,[job(1)],{fetcher:async()=>Response.json({id:'2'})});assert.match(mismatched.error,/detail/);
console.log('bounded detail retrieval, identity, fixed endpoint, cache preservation passed');

const now=Date.now(),cacheJob=job(1),oldJob=job(2),updatedJob={...job(3),posted_at:new Date(now-1000).toISOString()},legacyJob=job(4);
reuseFreshStudioDescriptions([cacheJob,oldJob,updatedJob,legacyJob],[
 {url:cacheJob.url,snippet:'Fresh cached',studio_description_updated_at:new Date(now-3600000).toISOString()},
 {url:oldJob.url,snippet:'Stale old',studio_description_updated_at:new Date(now-25*3600000).toISOString()},
 {url:updatedJob.url,snippet:'Changed requirements',studio_description_updated_at:new Date(now-3600000).toISOString()},
 {url:legacyJob.url,snippet:'No stamp'}
],now);
assert.equal(cacheJob.snippet,'Fresh cached');assert.equal(oldJob.snippet,'');assert.equal(updatedJob.snippet,'');assert.equal(legacyJob.snippet,'');
const priorCalls=calls;await enrichStudioDetails(source,[cacheJob,oldJob,updatedJob,legacyJob],{fetcher:good});assert.equal(calls-priorCalls,3);assert.ok(oldJob.studio_description_updated_at);
console.log('24-hour cache expiry and provider update invalidation passed');

const metadataJob={url:'https://example.com/job',title:'Environment Artist',company:'Example',location:'Anywhere',remote:false,snippet:''};
reuseFreshStudioDescriptions([metadataJob],[{...metadataJob,snippet:'Complete cached body',remote:true,location:'Remote US',studio_description_updated_at:new Date().toISOString()}],Date.now(),true);
assert.equal(metadataJob.remote,true);assert.equal(metadataJob.location,'Remote US');
const changed={...metadataJob,title:'Different Role',snippet:''};reuseFreshStudioDescriptions([changed],[{...metadataJob,studio_description_updated_at:new Date().toISOString()}],Date.now(),true);assert.equal(changed.snippet,'');
