import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrivateDispatcher,serveStdio,MAX_LINE} from '../scripts/private-mcp-stdio.mjs';
const config={supabaseUrl:'https://umvmilulnqnmeqvfoxxc.supabase.co',jobIds:['JT-fixture'],expiresAt:'2026-11-01T00:00:00Z'};
const clock=Date.parse('2026-10-09T00:00:00Z');
const rpc=(method,params={})=>JSON.stringify({jsonrpc:'2.0',id:1,method,params});
test('private discovery is noauth, needs no database, and honors fixed expiry',async()=>{
 let time=clock;
 const dispatch=await createPrivateDispatcher({config,serviceKey:'fixture-key',now:()=>time,fetchImpl:()=>{throw Error('unexpected database call');}});
 const tools=JSON.parse(await dispatch(rpc('tools/list'))).result.tools;
 assert.equal(tools.length,5);assert.ok(tools.every(t=>t.securitySchemes[0].type==='noauth'));
 assert.equal(await dispatch(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})),null);
 time=Date.parse(config.expiresAt);
 assert.equal(JSON.parse(await dispatch(rpc('tools/list'))).error.message,'UNAUTHORIZED');
});
test('private adapter denies out-of-scope jobs before database access and denies replacement',async()=>{
 let calls=0;
 const dispatch=await createPrivateDispatcher({config,serviceKey:'fixture-key',now:()=>clock,fetchImpl:async()=>{
   calls++;return Response.json([{id:'JT-fixture',track:'Professional',notes:'Stored job description. '.repeat(15),last_updated:'v1',resume:'existing'}]);
 }});
 const call=async args=>JSON.parse(await dispatch(rpc('tools/call',{name:'save_generated_document',arguments:args}))).result;
 assert.equal((await call({job_id:'JT-other'})).content[0].text,'NOT_FOUND');assert.equal(calls,0);
 assert.equal((await call({job_id:'JT-fixture',expected_version:'v1',replace:true,document:{}})).content[0].text,'FORBIDDEN');
 assert.equal(calls,1);
});
test('stdio handles split and batched lines, notifications and bounded unterminated input',async()=>{
 let result='';const output=new Writable({write(chunk,_encoding,cb){result+=chunk;cb();}});
 await serveStdio(Readable.from([Buffer.from('a'),Buffer.from('\nb\nnotify\n')]),output,async line=>line==='notify'?null:JSON.stringify({line}));
 assert.equal(result,'{"line":"a"}\n{"line":"b"}\n');
 await assert.rejects(serveStdio(Readable.from([Buffer.alloc(MAX_LINE+1,65)]),output,async()=>null),/REQUEST_TOO_LARGE/);
 await assert.rejects(serveStdio(Readable.from([Buffer.from('unfinished')]),output,async()=>null),/INCOMPLETE_REQUEST/);
});
test('configuration cannot redirect the server credential to another host',async()=>{
 await assert.rejects(createPrivateDispatcher({config:{...config,supabaseUrl:'https://other.test'},serviceKey:'fixture-key',now:()=>clock}),/NOT_CONFIGURED/);
 await assert.rejects(createPrivateDispatcher({config,serviceKey:'',now:()=>clock}),/NOT_CONFIGURED/);
});
test('real stdio process discovers Raven tools without leaking credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-stdio-'));
 try{
  const path=join(dir,'config.json');
  await writeFile(path,JSON.stringify({...config,expiresAt:new Date(Date.now()+60000).toISOString()}));
  const child=spawn(process.execPath,['scripts/private-mcp-stdio.mjs'],{env:{...process.env,RAVEN_PRIVATE_CONFIG:path,SUPABASE_SERVICE_ROLE_KEY:'fixture-secret',CONTROL_PLANE_API_KEY:'fixture-tunnel-not-for-output'},stdio:['pipe','pipe','pipe']});
  let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
  child.stdin.end(rpc('initialize',{protocolVersion:'2025-11-25'})+'\n'+rpc('tools/list')+'\n');
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  assert.equal(code,0);assert.equal(err,'');assert.doesNotMatch(out,/fixture-secret|fixture-tunnel/);
  const replies=out.trim().split('\n').map(JSON.parse);
  assert.equal(replies[0].result.serverInfo.name,'raven-mcp-bridge');assert.equal(replies[1].result.tools.length,5);
 }finally{await rm(dir,{recursive:true,force:true});}
});
