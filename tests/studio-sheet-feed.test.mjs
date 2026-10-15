import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRemoteGameSheet,parseRemoteGameSheet,usCompatibleScope,REMOTE_GAME_SHEET_KEY,REMOTE_GAME_SHEET_URL} from '../supabase/functions/_shared/studio-sheet-feed.mjs';
const source={provider:'remotegamessheet',board_key:REMOTE_GAME_SHEET_KEY};
function csvRows(n=100){
 const rows=[
  'Games Industry - Remote Job Openings,,,,,,,',
  'Author: Tim Plöger,,,,,,,',
  n+' listed remote jobs in total,,,,,,,',
  'Company,Company Category,Job Category,Job,Job Type,Remote,Link,Added'
 ];
 for(let i=0;i<n;i++)rows.push('Company '+i+',Developer,3D Art,Environment Artist '+i+',Full-Time,USA,https://example.org/jobs/'+i+',10.10.2026');
 return rows;
}
test('valid complete spreadsheet includes all jobs',()=>{
 const parsed=parseRemoteGameSheet(source,csvRows().join('\r\n'));
 assert.equal(parsed.fetched,100);assert.equal(parsed.jobs.length,100);
 assert.equal(parsed.jobs[0].location,'USA');assert.equal(parsed.jobs[0].remote,true);
});
test('truncated spreadsheet is rejected rather than removing jobs',()=>{
 const rows=csvRows();rows.pop();
 assert.throws(()=>parseRemoteGameSheet(source,rows.join('\n')),/incomplete/);
});
test('missing header and invalid source fail closed',()=>{
 const rows=csvRows();rows[3]='bad header';
 assert.throws(()=>parseRemoteGameSheet(source,rows.join('\n')),/header/);
 assert.throws(()=>parseRemoteGameSheet({...source,board_key:'other'},csvRows().join('\n')),/source/);
});
test('shared careers-home URL does not conflate separate vacancies',()=>{
 const rows=csvRows();
 rows[4]='Company,Developer,3D Art,Environment Artist,Full-Time,USA,https://example.org/jobs,10.10.2026';
 rows[5]='Company,Developer,3D Art,Prop Artist,Full-Time,USA,https://example.org/jobs,10.10.2026';
 const result=parseRemoteGameSheet(source,rows.join('\n'));
 assert.equal(result.skippedSharedUrls,2);assert.equal(result.jobs.length,98);
});
test('regional and GMT-restricted remote scope is retained unless visa required',()=>{
 for(const scope of [
  'USA / Canada','Worldwide','Within 4 hours of Pacific Time',
  'Canada (Ontario)','Europe only','Worldwide (+/- 2h from GMT+1)',
  'Worldwide (-/+ 2h from GMT+1)','Asia / Europe','UK',''
 ])assert.equal(usCompatibleScope(scope),true,scope);
 assert.equal(usCompatibleScope('Visa required for this role'),false);
 assert.equal(usCompatibleScope('Canada - no visa required'),true);
});
test('sheet parser preserves GMT and Canada job rows, still prevents shared-URL conflation',()=>{
 const rows=csvRows();
 rows[4]='Studio,Developer,3D Art,Senior Environment Artist,Full-Time,Worldwide (-/+ 2h from GMT+1),https://example.org/jobs/0,10.10.2026';
 rows[5]='Other Studio,Developer,3D Art,Prop Artist,Full-Time,Canada (Ontario),https://example.org/jobs/1,10.10.2026';
 rows[6]='Third Studio,Developer,3D Art,World Artist,Contract,Visa required,https://example.org/jobs/2,10.10.2026';
 const result=parseRemoteGameSheet(source,rows.join('\n'));
 assert.equal(result.fetched,100);
 assert.equal(result.jobs.length,99);
 assert.equal(result.jobs[0].location,'Worldwide (-/+ 2h from GMT+1)');
 assert.equal(result.jobs[1].location,'Canada (Ontario)');
 assert.equal(result.jobs.some(j=>j.url==='https://example.org/jobs/2'),false);
});
test('quoted multiline descriptions do not corrupt rows',()=>{
 const rows=csvRows();
 rows[4]='Company,Developer,3D Art,"Senior\r\n Environment Artist",Full-Time,USA,https://example.org/jobs/0,10.10.2026';
 const result=parseRemoteGameSheet(source,rows.join('\n'));
 assert.equal(result.jobs[0].title,'Senior Environment Artist');
});
test('collector only fetches the fixed public CSV endpoint',async()=>{
 let seen;
 const result=await collectRemoteGameSheet(source,{fetcher:async(url,opts)=>{seen={url,opts};return new Response(csvRows().join('\n'),{status:200});}});
 assert.equal(seen.url,REMOTE_GAME_SHEET_URL);assert.equal(seen.opts.redirect,'follow');
 assert.equal(result.fetched,100);
});
