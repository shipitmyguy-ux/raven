import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createJobActivity,createWindowsJobActivity} from '../scripts/oneclick-power.mjs';

test('overlapping jobs retain one hold until the final job succeeds or fails',async()=>{
 const events=[];let finishA,finishB;
 const activity=createJobActivity({startHold(){events.push('awake');return ()=>events.push('released');}});
 assert.equal(activity.active,0);assert.deepEqual(events,[]);
 const a=activity.run(()=>new Promise(r=>finishA=r));
 const b=activity.run(()=>new Promise((_,r)=>finishB=r));
 assert.equal(activity.active,2);assert.deepEqual(events,['awake']);
 finishA();await a;assert.equal(activity.active,1);assert.deepEqual(events,['awake']);
 finishB(Error('writer failed'));await assert.rejects(b,/writer failed/);
 assert.equal(activity.active,0);assert.deepEqual(events,['awake','released']);
 await assert.rejects(activity.run(()=>{throw Error('sync failure');}),/sync failure/);
 assert.deepEqual(events,['awake','released','awake','released']);
});

test('Windows request uses a hidden pipe-owned process and closes only after all jobs',async()=>{
 let ended=0,finish;const child=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>ended++;
 const calls=[];const activity=createWindowsJobActivity({platform:'win32',spawnProcess:(...args)=>{calls.push(args);return child;},onError:()=>assert.fail('unexpected power failure')});
 const pending=activity.run(()=>new Promise(r=>finish=r));
 await activity.run(async()=>{});
 assert.equal(calls.length,1);assert.equal(calls[0][2].windowsHide,true);assert.equal(ended,0);
 finish();await pending;assert.equal(ended,1);child.emit('exit',0);
});

test('non-Windows jobs do not launch a power process',async()=>{
 const activity=createWindowsJobActivity({platform:'linux',spawnProcess:()=>assert.fail('unexpected spawn')});
 assert.equal(await activity.run(async()=>42),42);assert.equal(activity.active,0);
});

test('manual Stop retains running jobs and only a new batch reacquires the hold',async()=>{
 let finish;const events=[];
 const activity=createJobActivity({startHold(){events.push('hold');return ()=>events.push('release');}});
 const job=activity.run(()=>new Promise(r=>finish=r));
 assert.equal(activity.status().state,'awake');
 assert.deepEqual(activity.stop(),{supported:true,active_tasks:1,state:'stopped'});
 await activity.run(async()=>{});assert.deepEqual(events,['hold','release']);
 finish();await job;assert.equal(activity.status().state,'idle');
 await activity.run(async()=>{});assert.deepEqual(events,['hold','release','hold','release']);
});

test('Windows native hold starts and releases on pipe closure',{skip:process.platform!=='win32',timeout:15000},async()=>{
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/oneclick-awake.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{clearInterval(poll);reject(Error('No native sleep hold confirmation: '+errors));},10000);
   const poll=setInterval(()=>{if(output.includes('sleep hold active')){clearTimeout(timer);clearInterval(poll);resolve();}},25);
  });
  child.stdin.end();assert.equal(await exited,0,errors);
 }finally{if(child.exitCode===null)child.kill();}
});

test('owner control reports and gracefully stops a real Windows hold',{skip:process.platform!=='win32',timeout:15000},async()=>{
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/oneclick-awake.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 const control=action=>new Promise((resolve,reject)=>{
  const proc=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/control-oneclick-awake.ps1',import.meta.url)),'-Action',action],{windowsHide:true});let output='';
  proc.stdout.on('data',chunk=>output+=chunk);proc.once('error',reject);proc.once('exit',code=>code===0?resolve(output):reject(Error('Control failed')));
 });
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.stderr.once('data',chunk=>reject(Error(String(chunk))));});
  assert.match(await control('Status'),/keeping the laptop awake while jobs run/);
  assert.match(await control('Stop'),/keep-awake stopped/);
  assert.equal(await exited,0);child.stdin.end();
  assert.match(await control('Status'),/not keeping the laptop awake/);
 }finally{if(child.exitCode===null)child.kill();}
});
