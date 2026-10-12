import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as providers from '../supabase/functions/_shared/studio-providers.mjs';
import '../supabase/functions/_shared/track-filter.js';
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/raven-studio-scan/index.ts','utf8').replace(/^import .*;\n/gm,''));
const token='a'.repeat(64);
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
const tokenHash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
let handler; const writes=[]; let providerMode='ok';let providerCalls=0;
const due=[{id:'123',studio_name:'Example Studio',provider:'smartrecruiters',board_key:'example',interval_hours:24}];
const fakeFetch=async(url,opts={})=>{
 if(url.startsWith('https://db.example/rest/v1/')){
  const path=url.split('/rest/v1/')[1];
  if(opts.method!=='GET'){writes.push({path,body:JSON.parse(opts.body)});return new Response(null,{status:204});}
  const result=path.startsWith('raven_studio_cron_auth')?[{token_hash:tokenHash}]:path.includes('enabled=eq.true')?due:[];
  if(path.includes('enabled=eq.true')){assert.match(path,/provider=neq.pending/);assert.match(path,/next_check_at=lte\./);assert.match(path,/limit=6$/);}
  return Response.json(result);
 }
 providerCalls++;
 assert.match(url,/^https:\/\/(api.smartrecruiters.com|api.ashbyhq.com|boards-api.greenhouse.io|api.lever.co|apply.workable.com)\//);
 assert.equal(opts.redirect,'error');
 if(providerMode==='failure')return new Response('down',{status:503});
 if(providerMode==='pagination'){
  const offset=Number(new URL(url).searchParams.get('offset'));
  return Response.json({totalFound:101,content:offset===0?Array.from({length:100},(_,i)=>({id:String(i+10),name:'Character Artist',location:{city:'Remote - US',remote:true}})):[{id:'999',name:'Senior Environment Artist',location:{city:'Remote - US',remote:true}}]});
 }
 if(providerMode==='truncated')return Response.json({totalFound:101,content:[]});
 if(providerMode==='oversized')return new Response('{}',{headers:{'content-length':'4000001'}});
 if(due[0].provider==='ashby')return Response.json({jobs:[{title:'Senior Environment Artist',location:'Remote - US',isRemote:true,jobUrl:'https://jobs.ashbyhq.com/example/1'}]});
 if(due[0].provider==='greenhouse')return Response.json({jobs:[{title:'Senior Environment Artist',location:{name:'Remote - US'},absolute_url:'https://boards.greenhouse.io/example/jobs/1'}]});
 if(due[0].provider==='lever')return Response.json([{text:'Senior Environment Artist',categories:{location:'Remote - US'},hostedUrl:'https://jobs.lever.co/example/1'}]);
 if(due[0].provider==='workable')return Response.json({jobs:[{title:'Senior Environment Artist',telecommuting:true,city:'Remote - US',url:'https://apply.workable.com/j/1'}]});
 return Response.json({totalFound:3,content:[
  {id:'1',name:'Senior Environment Artist',location:{city:'Remote - US',remote:true}},
  {id:'2',name:'Character Artist',location:{city:'Remote - US',remote:true}},
  {id:'3',name:'Environment Artist',location:{city:'London',country:'UK'}},
 ]});
};
vm.runInNewContext(source,{...providers,globalThis:{RavenTrackFilter:globalThis.RavenTrackFilter},Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://db.example':'test-key'},serve:fn=>{handler=fn;}},fetch:fakeFetch,crypto,Response,TextEncoder,TextDecoder,Uint8Array,AbortSignal,URL});
const request=secret=>new Request('https://collector.example',{method:'POST',headers:secret?{'x-raven-studio-secret':secret}:{}});
assert.equal((await handler(request())).status,401);
assert.equal(providerCalls,0);
assert.equal((await handler(request('b'.repeat(64)))).status,401);
assert.equal(writes.length,0);
const response=await handler(request(token)); const result=await response.json();
assert.equal(result.results[0].fetched,3);
assert.equal(result.results[0].eligible,1);
const saved=writes.find(w=>w.path.startsWith('raven_search_results'));
assert.equal(saved.body.length,1);
assert.equal(saved.body[0].title,'Senior Environment Artist');
assert.equal(saved.body[0].source,'Studio:smartrecruiters');
assert.equal(saved.body[0].track,'Games / 3D');
assert.ok(writes.find(w=>w.path.startsWith('raven_studio_sources')).body.last_success_at);
for(const provider of ['ashby','greenhouse','lever','workable']){
 writes.length=0;due[0].provider=provider;
 const result=await (await handler(request(token))).json();
 assert.equal(result.results[0].status,'ok',provider);
 assert.equal(result.results[0].eligible,1,provider);
 assert.equal(writes.find(w=>w.path.startsWith('raven_search_results')).body[0].source,'Studio:'+provider);
}
due[0].provider='smartrecruiters';
writes.length=0;providerMode='pagination';const before=providerCalls;
const paginated=await (await handler(request(token))).json();
assert.equal(providerCalls-before,2);assert.equal(paginated.results[0].fetched,101);assert.equal(paginated.results[0].eligible,1);
for(const mode of ['failure','oversized','truncated']){
 writes.length=0;providerMode=mode;
 const failed=await (await handler(request(token))).json();
 assert.equal(failed.results[0].status,'failed');
 assert.equal(writes.some(w=>w.path.startsWith('raven_search_results')),false);
 const health=writes.find(w=>w.path.startsWith('raven_studio_sources')).body;
 assert.equal(health.last_success_at,undefined);
 assert.ok(health.last_error);
 assert.equal(writes.find(w=>w.path==='raven_studio_checks').body.status,'failed');
}
console.log('studio collector auth, filtering, persistence, and failure checks passed');
