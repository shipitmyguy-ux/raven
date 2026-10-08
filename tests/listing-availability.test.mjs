import test from 'node:test';
import assert from 'node:assert/strict';
import {listingAvailability as check,authoritativePostingEndpoint as endpoint} from '../supabase/functions/_shared/listing-availability.mjs';
const base={status:200,checkedAt:'2026-10-08T16:00:00Z',sourceUrl:'https://example.com/jobs/1'};
test('transport and missing-content failures never confirm closure',()=>{
 for(const status of [0,404,410,403,429,500,502]) assert.equal(check({...base,status}).state,'unconfirmed');
 assert.equal(check({...base,html:'<script>This job is closed</script><!-- This job is closed -->'}).state,'unconfirmed');
 assert.equal(check({...base,status:403,html:'This job is closed'}).state,'unconfirmed');
 assert.equal(check({...base,html:'Contact us if this job is closed.'}).state,'unconfirmed');
 assert.equal(check({...base,html:'<script>"<span>No longer accepting applications</span>"</script>'}).state,'unconfirmed');
});
test('source closure statements, explicit JobPosting state and expiry are evidence',()=>{
 for(const html of ['This job is closed','This position has been filled','This listing has expired','This job is no longer accepting applications'])assert.equal(check({...base,html}).state,'closed');
 assert.equal(check({...base,posting:{jobStatus:'Inactive'}}).state,'closed');
 assert.equal(check({...base,posting:{validThrough:'2026-10-07'}}).state,'closed');
 assert.equal(check({...base,posting:{validThrough:'2026-10-08'}}).state,'unconfirmed');
 assert.equal(check({...base,posting:{validThrough:'bad'}}).state,'unconfirmed');
 const evidence=check({...base,atsInactive:true,status:404});
 assert.equal(evidence.state,'closed');assert.equal(evidence.checked_at,base.checkedAt);assert.equal(evidence.source_url,base.sourceUrl);
});
test('ATS lookups are restricted to known direct posting IDs',()=>{
 assert.equal(endpoint('https://jobs.lever.co/studio/12345678-1234-1234-1234-123456789abc'),'https://api.lever.co/v0/postings/studio/12345678-1234-1234-1234-123456789abc');
 assert.equal(endpoint('https://job-boards.greenhouse.io/studio/jobs/12345'),'https://boards-api.greenhouse.io/v1/boards/studio/jobs/12345');
 assert.equal(endpoint('https://jobs.lever.co.evil.test/studio/12345678-1234-1234-1234-123456789abc'),'');
 assert.equal(endpoint('https://example.com/jobs/404'),'');
});
