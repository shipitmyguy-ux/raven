import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
const handler=source.slice(source.indexOf('            expanded.querySelectorAll("[data-resume-apply]")'),source.indexOf('            expanded.querySelectorAll("[data-approved-apply]")'));
const generate=source.slice(source.indexOf('  async function generateForJob('),source.indexOf('  function generatedCoverLetterHtml('));
function harness(job,writer){
 let click;const scheduled=[],statuses=[],activeGeneration=new Map(),generationErrors=new Map();let writes=0,reviews=0;
 const context={job,expanded:{querySelectorAll:()=>[{addEventListener:(name,fn)=>{click=fn;}}]},setTimeout:fn=>scheduled.push(fn),setStatus:s=>statuses.push(s),console:{error(){}},Date,state:{selectedId:job.id},activeGeneration,generationErrors,generationKey:j=>String(j.id),generationSession:j=>activeGeneration.get(String(j.id)),documentApprovalKey:(j,t)=>j.id+t,setGenerationButton(){},render(){},documentLabel:()=>"Resume",openDocumentReview:()=>reviews++,generateDocumentForJob:async(j,t,instructions,options)=>{writes++;assert.equal(t,'resume');assert.equal(options.refreshDescription,true);await writer?.(j);j.resume='data:text/html,saved';}};
 vm.createContext(context);vm.runInContext(generate+handler,context);
 return {click:()=>click({stopPropagation(){},preventDefault(){throw Error('Native navigation blocked');}}),scheduled,statuses,activeGeneration,generationErrors,writes:()=>writes,reviews:()=>reviews,flush:()=>scheduled.shift()?.()};
}
test('native activation is preserved and generation starts after link activation',async()=>{
 const h=harness({id:'a',resume:''});h.click();assert.equal(h.writes(),0);assert.equal(h.scheduled.length,1);h.flush();await new Promise(r=>setImmediate(r));assert.equal(h.writes(),1);assert.equal(h.reviews(),0);
});
test('repeated clicks share a generation and completed resume is preserved',async()=>{
 let release;const waiting=new Promise(r=>release=r),job={id:'a',resume:''},h=harness(job,()=>waiting);
 h.click();h.flush();h.click();h.flush();assert.equal(h.writes(),1);release();await new Promise(r=>setImmediate(r));
 h.click();h.flush();assert.equal(h.writes(),1);assert.match(h.statuses.at(-1),/existing resume preserved/);
});
test('existing resume is not generated or altered',()=>{const job={id:'a',resume:'approved bytes'},h=harness(job);h.click();h.flush();assert.equal(h.writes(),0);assert.equal(job.resume,'approved bytes');});
test('generation failure is visible and does not save a resume',async()=>{const job={id:'a',resume:''},h=harness(job,()=>{throw Error('Listing unavailable');});h.click();h.flush();await new Promise(r=>setImmediate(r));assert.equal(job.resume,'');assert.match(h.statuses.at(-1),/Listing unavailable/);assert.equal(h.activeGeneration.size,0);});
const preparation=source.slice(source.indexOf('  const generationPreparation='),source.indexOf('  async function generateBothForJob('));
test('apply refresh uses source listing and persists its description before writing',async()=>{
 const job={id:'a',notes:'old summary',url:'https://example.test/job'},calls=[],context={job,navigator:{onLine:true},window:{RavenAPI:{describeJob:async()=>{calls.push('describe');return {description:'Actual full source description'};},updateJob:async(id,patch)=>{calls.push('persist');assert.equal(id,'a');assert.equal(patch.notes,'Actual full source description');}}},state:{jobs:[job]},setStatus(){},writeCache(){},CACHE_JOBS_KEY:'jobs',WeakMap};
 vm.createContext(context);vm.runInContext(preparation,context);await context.prepareJobForGeneration(job,{refreshDescription:true});assert.deepEqual(calls,['describe','persist']);assert.equal(job.notes,'Actual full source description');
});
test('unavailable listing is rejected and old summary is not treated as full source',async()=>{
 const job={id:'a',notes:'old summary'},context={navigator:{onLine:true},window:{RavenAPI:{describeJob:async()=>({description:''}),updateJob:()=>{throw Error('Unexpected save');}}},state:{jobs:[job]},setStatus(){},WeakMap};vm.createContext(context);vm.runInContext(preparation,context);await assert.rejects(context.prepareJobForGeneration(job,{refreshDescription:true}),/did not provide a job description/);assert.equal(job.notes,'old summary');
});
