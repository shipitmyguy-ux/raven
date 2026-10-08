import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMcpHandler,sha256} from '../supabase/functions/_shared/mcp-bridge.mjs';
import {generatedResumeHtml} from '../supabase/functions/_shared/mcp-resume-renderer.mjs';
const token='t'.repeat(48),clock=Date.parse('2026-10-08T15:00:00Z');
const profile={name:'Test Candidate',contact:'candidate@example.test',skills:['Mentoring'],education:[{degree:'BFA',school:'College',dates:'2008'}],experience:[{id:'art',role:'Artist',company:'Studio',dates:'2020–2025',facts:[{id:'f1',text:'Built game environments.'},{id:'f2',text:'Mentored newer artists.'}]}],transferable_facts:[],shipped_titles:['Example Game'],resume_required_experience_ids:['art']};
const claim=(text,fact_ids=['f1'])=>({text,fact_ids});
const draft={headline:claim('Environment builder'),summary:claim('Built game environments and helped newer artists develop their work.',['f1','f2']),skills:['Mentoring'],experience:[{experience_id:'art',bullets:[claim('Built game environments.'),claim('Mentored newer artists.',['f2'])]}],additional:[]};
async function fixture(options={}){
 let job={id:'JT-test',title:'Environment Artist',company:'Example',track:'Games / 3D',url:'https://example.test/job',notes:'Build and develop environments with the art team. '.repeat(6),last_updated:'2026-10-08T14:00:00+00:00',resume:'',...options.job};
 const grants=[{token_sha256:await sha256(token),subject:'owner',expires_at:'2026-10-09T00:00:00Z',scopes:['jobs:read','profile:read','documents:create'],job_ids:['JT-test'],...options.grant}];
 const env={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key',RAVEN_MCP_OWNER_SUBJECT:'owner',RAVEN_MCP_GRANTS:JSON.stringify(grants),...options.env};
 const requests=[];
 const handler=createMcpHandler({getEnv:k=>env[k],now:()=>clock,fetchImpl:async (url,init)=>{
  requests.push({url,init});const u=new URL(url);
  if(u.pathname.includes('raven_canonical_profiles'))return Response.json([{profile}]);
  if(init.method==='PATCH'){
   assert.equal(u.searchParams.get('id'),'eq.JT-test');
   assert.equal(u.searchParams.get('or'),'(resume.is.null,resume.eq.)');
   if(options.race){job.last_updated='2026-10-08T14:01:00Z';job.resume='other writer';}
   if(u.searchParams.get('last_updated')!=='eq.'+job.last_updated||job.resume)return Response.json([]);
   job={...job,...JSON.parse(init.body)};return Response.json([job]);
  }return Response.json([job]);
 }});
 const send=async(method,params={},headers={},raw=null)=>{
  const response=await handler(new Request('https://bridge.test/mcp',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json, text/event-stream',...headers},body:raw??JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));return {status:response.status,body:await response.json()};
 };
 const call=(name,args={})=>send('tools/call',{name,arguments:args});
 return {handler,call,send,requests,env,getJob:()=>job};
}
test('initialize, tool discovery, scoped job and private evidence reads',async()=>{
 const f=await fixture();assert.equal((await f.send('initialize',{protocolVersion:'2025-11-25'})).body.result.protocolVersion,'2025-11-25');
 assert.equal((await f.send('tools/list')).body.result.tools.length,3);
 const result=(await f.call('get_job',{job_id:'JT-test'})).body.result;
 assert.equal(result.structuredContent.job.expected_version,f.getJob().last_updated);
 assert.match(result.structuredContent.writing_prompt,/fact_ids/);
 const p=(await f.call('get_verified_profile')).body.result.structuredContent.profile;
 assert.ok(p.experience);assert.equal(p.contact,undefined);assert.equal(p.name,undefined);
 assert.ok(!JSON.stringify(result).includes('fixture-service-key'));
});
test('invalid, missing, expired, wrong owner and malformed grants cannot reach storage',async()=>{
 for(const options of [{grant:{expires_at:'2020-01-01'}},{grant:{subject:'other'}},{grant:{expires_at:'invalid'}},{grant:{scopes:['admin']}},{env:{RAVEN_MCP_GRANTS:'not json'}},{env:{RAVEN_MCP_OWNER_SUBJECT:''}}]){
  const f=await fixture(options),r=await f.send('tools/list');assert.ok([401,503].includes(r.status));assert.equal(f.requests.length,0);
 }
 const f=await fixture();for(const authorization of ['', 'Bearer '+'u'.repeat(48),'Bearer public-anon-key'])assert.equal((await f.send('tools/list',{}, {authorization})).status,401);
 assert.equal(f.requests.length,0);
});
test('grant revocation is checked on the next request',async()=>{
 const f=await fixture();assert.equal((await f.send('tools/list')).status,200);f.env.RAVEN_MCP_GRANTS='[]';assert.equal((await f.send('tools/list')).status,401);assert.equal(f.requests.length,0);
});
test('ungranted job IDs and public client headers never authorize access',async()=>{
 const f=await fixture();const r=await f.call('get_job',{job_id:'JT-other'});assert.equal(r.body.result.isError,true);assert.equal(r.body.result.content[0].text,'NOT_FOUND');assert.equal(f.requests.length,0);
 assert.equal((await f.send('tools/list',{}, {authorization:'','x-raven-client':'raven-web-v1'})).status,401);
});
test('read-only grants cannot save or fetch private profile indirectly',async()=>{
 const f=await fixture({grant:{scopes:['jobs:read']}});
 assert.equal((await f.send('tools/list')).body.result.tools.length,1);
 assert.equal((await f.call('get_job',{job_id:'JT-test'})).body.result.structuredContent.writing_prompt,undefined);
 assert.equal((await f.call('get_verified_profile')).body.result.isError,true);
 assert.equal((await f.call('save_generated_document',{job_id:'JT-test',expected_version:f.getJob().last_updated,document:draft})).body.result.isError,true);
 assert.equal(f.requests.filter(r=>r.init.method==='PATCH').length,0);
});
test('validated resume saves to the right job, readback persists and second save cannot overwrite',async()=>{
 const f=await fixture(),args={job_id:'JT-test',expected_version:f.getJob().last_updated,document:draft};
 const r=(await f.call('save_generated_document',args)).body.result;assert.equal(r.isError,false);assert.equal(r.structuredContent.saved,true);assert.equal(r.structuredContent.review_required,true);
 const persisted=f.getJob().resume;assert.match(persisted,/^data:text\/html;charset=utf-8,/);
 const html=decodeURIComponent(persisted.split(',').slice(1).join(','));for(const text of ['Test Candidate','Studio','BFA','Example Game','human-review-required'])assert.ok(html.includes(text));
 assert.equal((await f.call('get_job',{job_id:'JT-test'})).body.result.structuredContent.job.has_resume,true);
 assert.equal((await f.call('save_generated_document',{...args,expected_version:f.getJob().last_updated})).body.result.content[0].text,'DOCUMENT_EXISTS');assert.equal(f.getJob().resume,persisted);
});
test('stale version, race and existing document fail without overwrite',async()=>{
 for(const options of [{job:{resume:'saved approval'}},{race:true},{}]){
  const f=await fixture(options);const r=await f.call('save_generated_document',{job_id:'JT-test',expected_version:options.race||options.job?f.getJob().last_updated:'stale',document:draft});
  assert.equal(r.body.result.isError,true);assert.ok(['DOCUMENT_EXISTS','VERSION_CONFLICT'].includes(r.body.result.content[0].text));
  assert.equal(f.getJob().resume,options.race?'other writer':options.job?.resume||'');
 }
});
test('bad evidence, wrong employer, unsupported skill, missing history and placeholder rejected before write',async()=>{
 for(const document of [{...draft,summary:claim('Built 500 game environments.')},{...draft,skills:['Python']},{...draft,experience:[]},{...draft,experience:[{experience_id:'invented',bullets:[claim('Built game environments.')]}]},{...draft,summary:claim('Built game environments. TODO')}]){
  const f=await fixture();const r=await f.call('save_generated_document',{job_id:'JT-test',expected_version:f.getJob().last_updated,document});assert.equal(r.body.result.isError,true);assert.equal(f.requests.filter(r=>r.init.method==='PATCH').length,0);
 }
});
test('incomplete description fails rather than inventing job content',async()=>{
 const f=await fixture({job:{notes:'short'}});assert.equal((await f.call('get_job',{job_id:'JT-test'})).body.result.content[0].text,'DESCRIPTION_UNAVAILABLE');
});
test('strict payload, transport and origin controls reject malicious input',async()=>{
 const f=await fixture();assert.equal((await f.send('tools/list',{}, {origin:'https://evil.test'})).status,403);
 assert.equal((await f.send('tools/list',{}, {'mcp-protocol-version':'invalid'})).status,400);
 assert.equal((await f.send('tools/list',{}, {'content-type':'text/plain'})).status,415);
 assert.equal((await f.send('tools/list',{}, {},'x'.repeat(200001))).status,413);
 assert.equal((await f.send('tools/list',{}, {},'{')).body.error.code,-32700);
 assert.equal((await f.send('tools/list',{}, {},'[]')).status,400);
 assert.equal((await f.call('get_job',{job_id:'JT-test&select=*'})).body.result.isError,true);
 assert.equal((await f.call('get_job',{job_id:'JT-test',owner:'other'})).body.result.isError,true);
 assert.equal(f.requests.length,0);
});
test('notifications acknowledge without body and unsupported GET returns 405',async()=>{
 const f=await fixture();const headers={authorization:'Bearer '+token,'content-type':'application/json'};
 const r=await f.handler(new Request('https://bridge.test/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}));assert.equal(r.status,202);assert.equal(await r.text(),'');
 assert.equal((await f.handler(new Request('https://bridge.test/mcp',{headers}))).status,405);
});
test('renderer escapes all externally authored text',()=>{
 const html=generatedResumeHtml({title:'<script>bad()</script>',track:'Games / 3D'},{name:'<img src=x onerror=bad()>',summary:'A & B',skills:[],experience:[],education:[]});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('A &amp; B'));
});
