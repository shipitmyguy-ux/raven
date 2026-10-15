import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
const handler=source.slice(source.indexOf('            expanded.querySelectorAll("[data-application-start]")'),source.indexOf('            expanded.querySelectorAll("[data-apply-status]")'));
const application=source.slice(source.indexOf('  function beginApplication(job){'),source.indexOf('  function previewableDocumentUrl('));
function harness(job){
 let click;const scheduled=[],statuses=[],events=[],bridge={dataset:{}};let opened="",generationCalls=0;
 const context={job,expanded:{querySelectorAll:()=>[{addEventListener:(name,fn)=>{click=fn;}}]},setTimeout:fn=>scheduled.push(fn),setStatus:s=>statuses.push(s),window:{open:url=>{opened=url;}},document:{getElementById:id=>id==="ravenExtensionBridge"?bridge:null,dispatchEvent:event=>events.push(event.type)},CustomEvent:function(type){this.type=type;},readCache:()=>({email:"candidate@example.com"}),readAnswerMemory:()=>({"work authorization":"yes"}),generateForJob:()=>generationCalls++};
 vm.createContext(context);vm.runInContext(application+handler,context);
 return {click:()=>click({stopPropagation(){},preventDefault(){throw Error('Native navigation blocked');}}),scheduled,statuses,events,bridge,opened:()=>opened,generationCalls:()=>generationCalls,flush:()=>scheduled.shift()?.()};
}
test('application opens without waiting for either document and sends autofill data',()=>{
 const job={id:'a',url:'https://example.test/apply',title:'Role',resume:'',coverLetter:''},h=harness(job);h.click();
 assert.equal(h.generationCalls(),0);assert.equal(h.scheduled.length,1);assert.deepEqual(h.events,['raven-application-packet']);
 const packet=JSON.parse(h.bridge.dataset.packet);assert.equal(packet.resume,'');assert.equal(packet.coverLetter,'');assert.equal(packet.profile.email,'candidate@example.com');
 h.flush();assert.equal(h.opened(),job.url);assert.match(h.statuses.at(-1),/Raven is filling known fields/);
});
test('application sends each available document without an approval record',()=>{
 const job={id:'b',url:'https://example.test/apply',resume:'saved resume bytes',coverLetter:''},h=harness(job);h.click();
 const packet=JSON.parse(h.bridge.dataset.packet);assert.equal(packet.resume,job.resume);assert.equal(packet.coverLetter,'');assert.equal(h.generationCalls(),0);
});
const preparation=source.slice(source.indexOf('  const generationPreparation='),source.indexOf('  async function generateBothForJob('));

test('document preparation retrieves the full source listing before generation',async()=>{
 const job={id:'a',notes:'old summary',url:'https://example.test/job'},calls=[],context={job,navigator:{onLine:true},window:{RavenAPI:{describeJob:async()=>{calls.push('describe');return {description:'Actual full source description'};},updateJob:async(id,patch)=>{calls.push('persist');assert.equal(id,'a');assert.equal(patch.notes,'Actual full source description');}}},state:{jobs:[job]},setStatus(){},writeCache(){},CACHE_JOBS_KEY:'jobs',WeakMap};
 vm.createContext(context);vm.runInContext(preparation,context);await context.prepareJobForGeneration(job,{refreshDescription:true});assert.deepEqual(calls,['describe','persist']);assert.equal(job.notes,'Actual full source description');
});
test('unavailable listing is rejected and old summary is not treated as full source',async()=>{
 const job={id:'a',notes:'old summary'},context={navigator:{onLine:true},window:{RavenAPI:{describeJob:async()=>({description:''}),updateJob:()=>{throw Error('Unexpected save');}}},state:{jobs:[job]},setStatus(){},WeakMap};vm.createContext(context);vm.runInContext(preparation,context);await assert.rejects(context.prepareJobForGeneration(job,{refreshDescription:true}),/did not provide a job description/);assert.equal(job.notes,'old summary');
});
