import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveApplicationDestination} from '../scripts/application-destination.mjs';
const job={id:'JT-fixture',url:'https://hitmarker.net/jobs/example-1234567',title:'Environment Artist',company:'Example Studio'};
const target='https://example.breezy.hr/p/123456abcdef-environment-artist';
function fetcher(board,detail='Example Studio Environment Artist'){
 const calls=[];return {calls,fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response(url===job.url?board:detail,{headers:{'Content-Type':'text/html'}});}};
}
test('different board listings resolve their unique explicit employer Apply link without changing job identity',async()=>{
 const f=fetcher(`<h1>Environment Artist</h1>Example Studio<a href="${target}"><span>Apply for this role</span></a>`);
 assert.deepEqual(await resolveApplicationDestination(job,f),{job_id:job.id,source_url:job.url,destination_url:target,resolved:true});
 assert.deepEqual(f.calls,[job.url,target]);
});
test('client-rendered explicit application URL fields are supported',async()=>{
 const f=fetcher('Example Studio Environment Artist<div data-value="{&quot;sprig:variables[url]&quot;:&quot;'+'a'.repeat(64)+target.replaceAll('/','\\/')+'&quot;}"></div>');
 assert.equal((await resolveApplicationDestination(job,f)).destination_url,target);
});
test('ambiguous, absent, mismatched and unsafe destinations fail before applicant data is accessed',async()=>{
 for(const links of ['',`<a href="https://127.0.0.1/private">Apply</a>`,`<a href="https://example.breezy.hr.evil.test/p/x">Apply</a>`,`<a href="https://user:pass@example.breezy.hr/p/x">Apply</a>`,`<a href="${target}">Apply</a><a href="https://other.breezy.hr/p/another">Apply</a>`]){
  const f=fetcher('Example Studio Environment Artist'+links);await assert.rejects(resolveApplicationDestination(job,f));assert.equal(f.calls.length,1);
 }
 await assert.rejects(resolveApplicationDestination(job,fetcher(`Example Studio Environment Artist<a href="${target}">Apply</a>`,'Other employer Other job')));
});
test('direct employer destinations do not require a board fetch; redirects and oversized responses are rejected',async()=>{
 const direct={...job,url:target};assert.equal((await resolveApplicationDestination(direct,{fetchImpl:()=>{throw Error('must not fetch');}})).destination_url,target);
 await assert.rejects(resolveApplicationDestination(job,{fetchImpl:async()=>new Response('',{status:302,headers:{Location:'http://127.0.0.1/'}})}));
 await assert.rejects(resolveApplicationDestination(job,{fetchImpl:async()=>new Response('x'.repeat(4000001),{headers:{'Content-Type':'text/html'}})}));
});
