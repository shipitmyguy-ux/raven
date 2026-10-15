import test from 'node:test';
import assert from 'node:assert/strict';
import {breezyEndpoint,parseBreezyList,parseBreezyDetail,collectBreezy} from '../supabase/functions/_shared/studio-breezy.mjs';
const source={provider:'breezy',board_key:'playdead',studio_name:'Playdead'};
const row=(id='a235c228566a01')=>({id,friendly_id:id+'-3d-environment-artist',name:'3D Environment Artist',url:`https://playdead.breezy.hr/p/${id}-3d-environment-artist`,company:{name:'Playdead',friendly_id:'playdead'},location:{name:'Copenhagen, DK',is_remote:false},published_date:'2026-04-09T13:37:28.170Z'});
const detail=j=>`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',url:j.url+'?source=GoogleJobs',title:j.title,hiringOrganization:{name:'Playdead'},description:'<p>Full onsite description &amp; requirements</p>',datePosted:'2026-04-08'})}</script>`;
test('verified fixed board; list identity and authoritative location',()=>{assert.equal(breezyEndpoint(source),'https://playdead.breezy.hr/json');assert.throws(()=>breezyEndpoint({...source,board_key:'localhost'}));const [j]=parseBreezyList(source,[row()]);assert.equal(j.remote,false);assert.equal(j.location,'Copenhagen, DK');assert.equal(parseBreezyDetail(source,j,detail(j)).snippet,'Full onsite description & requirements');});
test('unknown templates, pagination, foreign URLs, duplicate and employer mismatch fail',()=>{for(const d of [{jobs:[]},[row(),row()],[{...row(),url:'http://localhost/p/a235c228566a01-x'}],[{...row(),company:{name:'Other',friendly_id:'playdead'}}]])assert.throws(()=>parseBreezyList(source,d));const [j]=parseBreezyList(source,[row()]);assert.throws(()=>parseBreezyDetail(source,j,detail({...j,title:'Wrong'})));assert.throws(()=>parseBreezyDetail(source,j,'<html>blocked</html>'));});
test('cache before fetch, 12 detail cap, concurrency 2 and cursor progression',async()=>{const data=Array.from({length:16},(_,i)=>row((i+10000000).toString(16).padStart(14,'0')));let active=0,max=0,calls=0;const r=await collectBreezy(source,{fetchJson:async()=>data,prepareDetails:async jobs=>{jobs[0].snippet='cached';},fetchText:async url=>{calls++;max=Math.max(max,++active);await new Promise(r=>setTimeout(r,1));active--;return detail(parseBreezyList(source,data).find(j=>j.url===url));}});assert.equal(calls,12);assert.equal(max,2);assert.equal(r.jobs[0].snippet,'cached');assert.equal(r.details.deferred,3);assert.equal(r.detail_cursor_next,12);});
test('budget defers without silently complete descriptions; empty verified feed completes',async()=>{const r=await collectBreezy(source,{fetchJson:async()=>[row()],fetchText:async()=>{throw Error('not called');},deadline:Date.now()+3000});assert.equal(r.details.status,'failed');assert.equal(r.details.attempted,0);assert.equal(r.details.deferred,1);const e=await collectBreezy(source,{fetchJson:async()=>[],fetchText:async()=>'<title>Openings at Playdead</title><div class="no-positions-container"></div>'});assert.equal(e.fetched,0);assert.equal(e.details.status,'complete');});

test("unconfirmed empty feed fails closed",async()=>{await assert.rejects(collectBreezy(source,{fetchJson:async()=>[],fetchText:async()=>"<html>blocked</html>"}),/empty feed unconfirmed/);});

test('IllFonic officially linked US-remote Breezy board is pinned to correct host and employer',()=>{
 const studio={provider:'breezy',board_key:'illfonic',studio_name:'IllFonic'};
 assert.equal(breezyEndpoint(studio),'https://illfonic.breezy.hr/json');
 const id='5c1600aa06b4';
 const [job]=parseBreezyList(studio,[{
  id,friendly_id:id+'-principal-environment-artist',name:'Principal Environment Artist',
  url:'https://illfonic.breezy.hr/p/'+id+'-principal-environment-artist',
  published_date:'2026-09-29T19:23:21.730Z',
  company:{name:'IllFonic',friendly_id:'illfonic'},
  location:{name:'United States',is_remote:true}
 }]);
 assert.equal(job.remote,true);assert.equal(job.location,'United States');
 assert.throws(()=>parseBreezyList(studio,[{
  id,friendly_id:id+'-principal-environment-artist',name:'Principal Environment Artist',
  url:'https://foreign.breezy.hr/p/'+id+'-principal-environment-artist',
  company:{name:'IllFonic',friendly_id:'illfonic'},
  location:{name:'United States',is_remote:true}
 }]),/Invalid Breezy job URL/);
});
