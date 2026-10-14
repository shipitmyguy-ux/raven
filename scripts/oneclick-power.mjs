import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// One pipe-owned Windows sleep request for all overlapping jobs. Closing the
// pipe (including a helper crash) releases it; idle polling never acquires it.
export function createJobActivity({startHold=()=>()=>{},supported=true}={}){
 let count=0,release;
 return {
  get active(){return count;},
  status(){return {supported,active_tasks:count,state:!supported?'unavailable':count===0?'idle':release?(release.state||'awake'):'stopped'};},
  stop(){const stop=release;release=undefined;stop?.();return this.status();},
  async run(work){
   if(count++===0){
    try{release=startHold();}catch(error){count--;throw error;}
   }
   try{return await work();}
   finally{if(--count===0){const stop=release;release=undefined;stop?.();}}
  }
 };
}

export function createWindowsJobActivity({platform=process.platform,spawnProcess=spawn,onError=()=>process.stderr.write('Raven could not prevent idle sleep during this job.\n')}={}){
 return createJobActivity({supported:platform==='win32',startHold(){
  if(platform!=='win32')return ()=>{};
  const child=spawnProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./oneclick-awake.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore']});
  let stopping=false,state='starting';
  child.stdout?.on('data',()=>{if(!stopping)state='awake';});
  child.on('error',()=>{state='unavailable';onError();});
  child.stdin.on('error',()=>{});
  child.on('exit',code=>{state=code===0?'stopped':'unavailable';if(!stopping&&code!==0)onError();});
  const stop=()=>{stopping=true;state='stopped';child.stdin.end();};
  Object.defineProperty(stop,'state',{get:()=>state});
  return stop;
 }});
}
