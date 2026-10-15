import test from 'node:test';
import assert from 'node:assert/strict';
import {planStudioIngestion} from '../supabase/functions/_shared/studio-ingest-dedup.mjs';
const row=(props={})=>({company:'Example Games',title:'Senior Environment Artist',location:'United States',remote:true,url:'https://jobs.ashbyhq.com/example/123',source:'Studio:ashby',status:'Discovered',...props});
test('same-source exact vacancy refreshes but does not create another listing',()=>{
 const prior=row();
 const result=planStudioIngestion([row()], [prior], 'Studio:ashby');
 assert.equal(result.inserts.length,0);
 assert.equal(result.updates.length,1);
 assert.equal(result.skippedExact,1);
 assert.equal(result.reviews.length,0);
});
test('different-source exact canonical URL keeps existing record and status',()=>{
 const saved=row({source:'Studio:greenhouse',status:'Applied'});
 const result=planStudioIngestion([row({url:'https://jobs.ashbyhq.com/example/123?utm_source=sheet'})],[saved],'Tim Ploeger Remote Games Sheet',{isSheet:true});
 assert.equal(result.inserts.length,0);
 assert.equal(result.refresh.length,0);
 assert.equal(saved.status,'Applied');
});
test('geography aliases produce review, never automatic merge',()=>{
 const result=planStudioIngestion([row({url:'https://example.org/jobs/new',location:'USA'})],[row({url:'https://example.org/jobs/old',location:'United States'})],'Studio:greenhouse');
 assert.equal(result.inserts.length,0);
 assert.equal(result.reviews.length,1);
 assert.equal(result.reviews[0].reason,'same-employer-title-and-compatible-scope');
});
test('nearly identical long descriptions with alternate titles are only queued for review',()=>{
 const snippet='Sculpt environmental props and optimize models for multiplayer levels. Collaborate with artists and engineers to create lighting passes, texture atlases, shaders, modular pieces, UV maps, LODs, collision meshes and blueprints. Work with Unreal Engine and Substance Painter using scene profiling to hit performance goals. Review project briefs, document art workflows, present asset iterations and participate in sprint planning.';
 const existing=row({title:'World Artist',url:'https://example.org/a',snippet,source:'Studio:greenhouse'});
 const next=row({title:'Environment Artist',url:'https://example.org/b',snippet});
 const result=planStudioIngestion([next],[existing],'Studio:ashby');
 assert.equal(result.inserts.length,0);assert.equal(result.reviews.length,1);
 assert.equal(result.reviews[0].reason,'near-identical-description');
 assert.ok(result.reviews[0].similarity>=0.95);
});
test('different countries and seniority levels remain distinct',()=>{
 const prior=row();
 for(const props of [
  {location:'Canada',url:'https://example.org/new-ca'},
  {title:'Junior Environment Artist',url:'https://example.org/new-junior'},
  {company:'Other Developer',url:'https://example.org/new-company'}
 ]){
  const result=planStudioIngestion([row(props)],[prior],'Studio:greenhouse');
  assert.equal(result.inserts.length,1,JSON.stringify(props));
 }
});
test('generic careers page for two job titles is held, not overwritten',()=>{
 const prior=row({title:'World Artist',url:'https://example.org/careers'});
 const next=row({title:'Prop Artist',url:'https://example.org/careers'});
 const result=planStudioIngestion([next],[prior],'Studio:greenhouse');
 assert.equal(result.inserts.length,0);
 assert.equal(result.reviews[0].reason,'shared-application-url');
});
test('saved job identity suppresses rediscovery without editing lifecycle status',()=>{
 const saved=row({status:'Interview',source:'Imported'});
 const result=planStudioIngestion([row()],[saved],'Studio:ashby');
 assert.equal(result.inserts.length,0);assert.equal(result.updates.length,0);
 assert.equal(saved.status,'Interview');
});
test('two distinct vacant studio roles from one response survive',()=>{
 const result=planStudioIngestion([row({url:'https://example.org/a'}),row({title:'Lead Environment Artist',url:'https://example.org/b'})],[],'Studio:greenhouse');
 assert.equal(result.inserts.length,2);
});

test('distinct ATS vacancy IDs on one verified provider are not collapsed',()=>{
 const first=row({source:'Studio:greenhouse',url:'https://job-boards.greenhouse.io/example/jobs/1000001'});
 const second=row({source:'Studio:greenhouse',url:'https://job-boards.greenhouse.io/example/jobs/1000002'});
 const result=planStudioIngestion([first,second],[],'Studio:greenhouse');
 assert.equal(result.inserts.length,2);
 assert.equal(result.heldForReview,0);
});
test('unknown-employer job board matches cannot establish cross-source identity',()=>{
 const prior=row({company:'Unknown employer',url:'https://example.com/posting-one'});
 const next=row({company:'Unknown employer',url:'https://example.com/posting-two'});
 const result=planStudioIngestion([next],[prior],'Studio:ashby');
 assert.equal(result.inserts.length,1);
});

test('exact alternate URL retains canonical job ID and records both sources',()=>{
 const existing=row({url:'https://jobs.ashbyhq.com/example/3ef83988-cada-403f-ac1d-96e81f6b62b7',source:'Studio:ashby',status:'Interview'});
 const second=row({url:'https://jobs.ashbyhq.com/example/3ef83988-cada-403f-ac1d-96e81f6b62b7?utm_source=other'});
 const result=planStudioIngestion([second],[existing],'Tim Ploeger Remote Games Sheet',{isSheet:true});
 assert.equal(result.inserts.length,0);
 assert.deepEqual(result.sourceLinks,[{
  source_name:'Tim Ploeger Remote Games Sheet',
  observed_url:second.url,canonical_url:existing.url
 }]);
 assert.equal(existing.status,'Interview');
});
test('new job records origin; held near-match does not assert canonical identity',()=>{
 const prior=row({url:'https://example.org/old'});
 const candidate=row({url:'https://example.org/new'});
 const uncertain=planStudioIngestion([candidate],[prior],'Studio:greenhouse');
 assert.equal(uncertain.sourceLinks.length,0);
 const fresh=planStudioIngestion([candidate],[],'Studio:greenhouse');
 assert.deepEqual(fresh.sourceLinks,[{
  source_name:'Studio:greenhouse',
  observed_url:candidate.url,
  canonical_url:candidate.url
 }]);
});
