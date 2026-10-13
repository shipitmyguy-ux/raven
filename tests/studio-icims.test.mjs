import test from 'node:test';
import assert from 'node:assert/strict';
import {collectIcims,parseIcimsDirectory,parseIcimsDetail,icimsJobUrl} from '../supabase/functions/_shared/studio-icims.mjs';
const url='https://careers-zenimax.icims.com/jobs/3477/senior-environment-artist/job';
const source={board_key:'zenimax',studio_name:'MachineGames',job_scope:{field:'company',values:['MachineGames']}};
const record={id:3477,title:'Senior Environment Artist',link:url,department_name:'Art',location:{name:'MachineGames ',formatted_name:'Uppsala, SE'},additionalLocations:[]};
const list=rows=>`<job-filter :raw-data="${JSON.stringify({jobs:rows}).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></job-filter>`;
const detail=(overrides={})=>`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',url,title:record.title,description:'<h2>Responsibilities</h2><p>Build materials &amp; environments.</p>',datePosted:'2026-10-12',...overrides})}</script>`;
test('parses observed embedded directory markup and full structured detail',()=>{
 assert.equal(parseIcimsDirectory(list([record]))[0].location.name,'MachineGames ');
 assert.equal(parseIcimsDetail(detail(),url).datePosted,'2026-10-12');
});
test('scopes by employer name, never same geography or publisher hiringOrganization',async()=>{
 const other={...record,id:3523,link:url.replace('3477','3523'),location:{name:'ZeniMax Media, Inc.',formatted_name:'Uppsala, SE'}};
 const result=await collectIcims(source,{fetchText:async u=>u.includes('/jobs/3477/')?detail({hiringOrganization:{name:'ZeniMax Media Inc.'}}):list([record,other])});
 assert.equal(result.fetched,2);assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].company,'MachineGames');
 assert.match(result.jobs[0].snippet,/Responsibilities Build materials & environments/);assert.equal(result.details.status,'complete');
});
test('validates fixed board, mandatory exact scope, host and job identity',async()=>{
 for(const bad of ['https://evil.example/jobs/3477/a/job','https://careers-zenimax.icims.com.evil.test/jobs/3477/a/job','http://careers-zenimax.icims.com/jobs/3477/a/job','https://user@careers-zenimax.icims.com/jobs/3477/a/job'])assert.throws(()=>icimsJobUrl(bad,3477));
 assert.throws(()=>parseIcimsDetail(detail({url:url.replace('3477','1234')}),url),/mismatch/);
 await assert.rejects(collectIcims({...source,board_key:'other'},{fetchText:async()=>''}),/board/);
 await assert.rejects(collectIcims({...source,job_scope:null},{fetchText:async()=>''}),/scope/);
});
test('fails closed on blocked markup and oversized directory, not empty checked',()=>{
 assert.throws(()=>parseIcimsDirectory('<html>Access denied</html>'),/missing/);
 assert.throws(()=>parseIcimsDirectory('a'.repeat(4000001)),/large/);
 assert.throws(()=>parseIcimsDirectory(list(Array.from({length:1001},()=>record))),/Unexpected/);
});
test('bounds details to twelve, and does not enrich geographically ineligible jobs',async()=>{
 let details=0;const rows=Array.from({length:15},(_,i)=>({...record,id:3477+i,link:url.replace('3477',String(3477+i))}));
 const result=await collectIcims(source,{fetchText:async u=>{if(u==='https://jobs.zenimax.com/jobs')return list(rows);details++;return detail({url:u.split('?')[0]});}});
 assert.equal(details,12);assert.equal(result.details.deferred,3);assert.equal(result.details.status,'partial');
 const skipped=await collectIcims(source,{fetchText:async()=>list(rows),jobAllowed:()=>false});
 assert.equal(skipped.details.attempted,0);assert.equal(skipped.jobs.length,15);
});
test('deadline and detail failures preserve discoverable jobs with health errors',async()=>{
 await assert.rejects(collectIcims(source,{fetchText:async()=>list([record]),deadline:Date.now()}),/budget/);
 const result=await collectIcims(source,{fetchText:async u=>u==='https://jobs.zenimax.com/jobs'?list([record]):'<html>closed</html>'});
 assert.equal(result.jobs.length,1);assert.equal(result.details.status,'failed');assert.match(result.details.error,/missing/);
});
test('detail eligibility reveals remote even when list geography is excluded',async()=>{
 const result=await collectIcims(source,{jobAllowed:()=>false,detailAllowed:job=>/Artist/.test(job.title),fetchText:async u=>u==='https://jobs.zenimax.com/jobs'?list([record]):detail({jobLocationType:'TELECOMMUTE'})});
 assert.equal(result.details.attempted,1);assert.equal(result.jobs[0].remote,true);
});
test('prepared fresh descriptions skip detail fetching',async()=>{
 let calls=0;
 const result=await collectIcims(source,{prepareDetails:async jobs=>{jobs[0].snippet='Fresh cached description';jobs[0].remote=true;},fetchText:async()=>{calls++;return list([record]);}});
 assert.equal(calls,1);assert.equal(result.details.attempted,0);assert.equal(result.details.status,'complete');assert.equal(result.jobs[0].snippet,'Fresh cached description');
});
test('cursor rotates subsequent scans through jobs beyond the first twelve',async()=>{
 const rows=Array.from({length:15},(_,i)=>({...record,id:3477+i,link:url.replace('3477',String(3477+i))}));
 const fetched=[];
 const fetchText=async u=>{if(u==='https://jobs.zenimax.com/jobs')return list(rows);fetched.push(u.split('/')[4]);return detail({url:u.split('?')[0]});};
 const first=await collectIcims(source,{fetchText});assert.equal(first.detail_cursor_next,12);
 const second=await collectIcims({...source,detail_cursor:first.detail_cursor_next},{fetchText});
 assert.deepEqual(fetched.slice(12,15),['3489','3490','3491']);assert.equal(second.detail_cursor_next,9);
 await assert.rejects(collectIcims({...source,detail_cursor:-1},{fetchText}),/cursor/);
});
