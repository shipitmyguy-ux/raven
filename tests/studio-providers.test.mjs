import assert from 'node:assert/strict';
import {canonicalStudioUrl, providerEndpoint, providerRecords, normalizeStudioJobs} from '../supabase/functions/_shared/studio-providers.mjs';
const source = provider => ({provider, board_key: 'example-studio', studio_name: 'Example Studio'});
const fixtures = [
 ['ashby', {jobs: [{title:'Environment Artist',location:'Remote - US',isRemote:true,jobUrl:'https://jobs.ashbyhq.com/example/a?utm_source=test',descriptionPlain:'Build worlds'}]}],
 ['greenhouse', {jobs: [{title:'Environment Artist',location:{name:'Austin, TX'},absolute_url:'https://boards.greenhouse.io/example/jobs/1',content:'<p>Build <b>worlds</b></p>'}]}],
 ['lever', [{text:'Environment Artist',categories:{location:'Remote - US'},hostedUrl:'https://jobs.lever.co/example/a',descriptionPlain:'Build worlds'}]],
 ['workable', {jobs: [{title:'Environment Artist',city:'Austin',state:'Texas',country:'United States',telecommuting:true,shortlink:'https://apply.workable.com/j/ABC/',description:'<p>Build worlds</p>'}]}],
 ['smartrecruiters', {content: [{id:'1234',name:'Environment Artist',location:{city:'Austin',region:'Texas',country:'US',remote:true},releasedDate:'2026-10-12',jobAd:{sections:{jobDescription:{text:'<p>Build worlds</p>'}}}}]}],
];
for(const [provider, payload] of fixtures){
 const [job] = normalizeStudioJobs(source(provider), payload);
 assert.equal(job.title,'Environment Artist',provider);
 assert.equal(job.company,'Example Studio',provider);
 assert.equal(job.snippet,'Build worlds',provider);
 assert.match(job.url,/^https:\/\//,provider);
 assert.ok(job.location,provider);
 assert.equal(job.remote,provider!=='greenhouse',provider);
}
assert.equal(normalizeStudioJobs(source('smartrecruiters'),fixtures[4][1])[0].url,'https://jobs.smartrecruiters.com/example-studio/1234');
assert.equal(normalizeStudioJobs(source('workable'),{jobs:[{title:'Artist',url:'https://apply.workable.com/j/A',locations:[{city:'London',country:'UK'},{city:'Austin',country:'US'}]}]})[0].location,'London, UK; Austin, US');
assert.deepEqual(normalizeStudioJobs(source('ashby'),{jobs:[null,{}, {title:'Unsafe',jobUrl:'javascript:alert(1)'}]}),[]);
assert.throws(()=>providerRecords('ashby',{}),/Unexpected/);
assert.throws(()=>providerEndpoint('ashby','../../localhost'),/Bad board/);
assert.throws(()=>providerEndpoint('pending','example'),/Unsupported/);
assert.throws(()=>providerEndpoint('smartrecruiters','example',-1),/Bad page/);
assert.match(providerEndpoint('workable','example'),/^https:\/\/apply.workable.com\/api\/v1\/widget\/accounts\/example\?details=true$/);
assert.match(providerEndpoint('smartrecruiters','example',100),/limit=100&offset=100$/);
assert.equal(canonicalStudioUrl('https://example.com/job?utm_source=a&token=b#top'),'https://example.com/job?token=b');
assert.equal(canonicalStudioUrl('https://user:pass@example.com/'),'');
assert.equal(canonicalStudioUrl('http://example.com/'),'');
const duplicates=normalizeStudioJobs(source('workable'),{jobs:[{title:'Environment Artist',url:'https://apply.workable.com/j/A',locations:[{city:'Oxford',region:'England',country:'United Kingdom'}]},{title:'Environment Artist',url:'https://apply.workable.com/j/A',locations:[{city:'Warwick',region:'England',country:'United Kingdom'}]}]});
assert.equal(duplicates.length,1);assert.equal(duplicates[0].location,'Oxford, England, United Kingdom; Warwick, England, United Kingdom');
assert.equal(normalizeStudioJobs(source('smartrecruiters'),{content:[{id:'123',name:'Artist',location:{city:'Bordeaux',country:'fr',fullLocation:'Bordeaux, France'}}]})[0].location,'Bordeaux, France');
console.log('studio provider normalization checks passed');
