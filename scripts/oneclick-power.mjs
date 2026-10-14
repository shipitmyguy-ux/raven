import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// One pipe-owned Windows sleep request for all overlapping jobs. Closing the
// pipe (including a helper crash) releases it; idle polling never acquires it.
export function createJobActivity({startHold=()=>()=>{}}={}){
 let count=0,release;
 return {
  get active(){return count;},
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
 return createJobActivity({startHold(){
  if(platform!=='win32')return ()=>{};
  const child=spawnProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./oneclick-awake.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','ignore','ignore']});
  let stopping=false;
  child.on('error',onError);
  child.stdin.on('error',()=>{});
  child.on('exit',code=>{if(!stopping&&code!==0)onError();});
  return ()=>{stopping=true;child.stdin.end();};
 }});
}
