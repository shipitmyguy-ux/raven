import test from 'node:test';
import assert from 'node:assert/strict';
import {avatureEndpoint,parseAvatureList,parseAvatureDetail,collectAvature} from '../supabase/functions/_shared/studio-avature.mjs';
const source={provider:'avature',board_key:'8376',studio_name:'Motive Studios'};
const department='EA Studios - Motive Montreal';
const row=(dept=department,url='https://jobs.ea.com/en_US/careers/JobDetail/Artist/123')=>`<article class="article article--result article--non-toggle"><a class="link link_result" href="${url}">Environment &amp; Artist</a><span class="list-item-location">Montreal, Canada</span><span class="list-item-department">${dept}</span></article>`;
const page=(rows,count=(rows.match(/<article\b/g)||[]).length)=>`<select name="4538[]" id="4538"><option value="8376" selected="1">${department}</option></select><div class="list-controls__text__legend" aria-label="${count} results">${count} results</div><div class="section__content__results">${rows}</div>`;
const detail=(dept=department,model='Hybrid')=>`<link rel="canonical" href="https://jobs.ea.com/en_US/careers/JobDetail/Artist/123"><div class="article__content__view__field__label">Studio/Department</div><div class="article__content__view__field__value">${dept}</div><div class="article__content__view__field__label">Work Model</div><div class="article__content__view__field__value">${model}</div><article class="article article--details"><h3>Description &amp; Requirements</h3><div>${'Create environments and collaborate with artists. '.repeat(10)}</div></article>`;
test('fixed-host numeric verified taxonomy only',()=>{assert.match(avatureEndpoint(source),/^https:\/\/jobs.ea.com\/en_US\/careers\/Home/);for(const id of ['evil.com','8376/../8370','1234',''])assert.throws(()=>avatureEndpoint({...source,board_key:id}));});
test('exact selected filter and individual studio attribution',()=>{const jobs=parseAvatureList(source,page(row()));assert.equal(jobs[0].title,'Environment & Artist');assert.equal(jobs[0].remote,false);assert.throws(()=>parseAvatureList(source,page(row('EA Studios - DICE Stockholm'))));assert.throws(()=>parseAvatureList(source,page(row()).replace('selected="1"','')));});
test('untrusted targets and unknown response schema fail closed',()=>{for(const url of ['https://evil.example/en_US/careers/JobDetail/Artist/123','https://jobs.ea.com/en_US/careers/JobDetail/Artist/123?evil=1'])assert.throws(()=>parseAvatureList(source,page(row(department,url))));assert.throws(()=>parseAvatureList(source,'Access denied'));assert.throws(()=>parseAvatureList(source,page('')));assert.equal(parseAvatureList(source,page('No results found')).length,0);});
test('unverified pagination fails instead of truncating',()=>assert.throws(()=>parseAvatureList(source,page(row().repeat(20))),/pagination/));
test('full descriptions require matching metadata and explicit remote model',()=>{const job=parseAvatureList(source,page(row()))[0];assert.ok(parseAvatureDetail(source,job,detail()).snippet.length>100);assert.equal(parseAvatureDetail(source,job,detail()).remote,false);assert.equal(parseAvatureDetail(source,job,detail(department,'Remote')).remote,true);assert.throws(()=>parseAvatureDetail(source,job,detail('EA Studios - DICE Stockholm')));assert.throws(()=>parseAvatureDetail(source,job,detail().replace('/123','/999')));});
test('collector only fetches eligible details and reports failures',async()=>{const calls=[];const result=await collectAvature(source,{fetchText:async url=>{calls.push(url);return calls.length===1?page(row()):detail();},jobAllowed:()=>true});assert.equal(result.fetched,1);assert.equal(result.details.completed,1);assert.equal(result.details.status,'complete');const rejected=await collectAvature(source,{fetchText:async()=>page(row()),jobAllowed:()=>false});assert.equal(rejected.details.attempted,0);const failed=await collectAvature(source,{fetchText:async url=>url.includes('/Home')?page(row()):'Access denied'});assert.equal(failed.details.status,'failed');assert.equal(failed.jobs[0].snippet,'');});

test('unparsed live vacancy cannot be hidden by unrelated script empty marker',()=>{
 const changed=page(row().replace('article--result','renamed-result'))+"<script>const emptyLabel='No results found';</script>";
 assert.throws(()=>parseAvatureList(source,changed),/unparsed|total/);
 assert.throws(()=>parseAvatureList(source,page('<script>No results found</script>')),/empty/);
 assert.throws(()=>parseAvatureList(source,page(row(),2)),/total/);
 assert.throws(()=>parseAvatureList(source,page('')+'<p>No results found</p>'),/empty/);
});
test('detail art eligibility discovers explicit remote despite list geography rejection',async()=>{
 const result=await collectAvature(source,{fetchText:async url=>url.includes('/Home')?page(row()):detail(department,'Remote'),jobAllowed:j=>j.remote,detailAllowed:j=>/Artist/.test(j.title)});
 assert.equal(result.details.completed,1);assert.equal(result.jobs[0].remote,true);
 assert.deepEqual(Object.keys(result.details).sort(),['status','attempted','completed','deferred','error'].sort());
});
test('cache restores before queue and successive cursors rotate bounded requests',async()=>{
 const rows=Array.from({length:19},(_,i)=>row(department,`https://jobs.ea.com/en_US/careers/JobDetail/Artist/${100+i}`)).join('');
 const batches=[];let restored=false;
 const run=async cursor=>{const calls=[];const result=await collectAvature({...source,detail_cursor:cursor},{fetchText:async url=>{if(url.includes('/Home'))return page(rows);calls.push(url.split('/').pop());return detail().replaceAll('/123','/'+url.split('/').pop());},prepareDetails:async candidates=>{assert.equal(candidates.length,19);restored=true;}});batches.push(calls);return result;};
 const first=await run(0),second=await run(first.detail_cursor_next);
 assert.equal(restored,true);assert.equal(first.details.attempted,12);assert.equal(first.details.deferred,7);assert.equal(first.detail_cursor_next,12);assert.equal(second.details.attempted,12);assert.equal(new Set(batches.flat()).size,19);
 const cached=await collectAvature(source,{fetchText:async()=>page(row()),prepareDetails:async jobs=>{jobs[0].snippet='cached description';jobs[0].remote=true;}});
 assert.equal(cached.details.attempted,0);assert.equal(cached.jobs[0].remote,true);
});
