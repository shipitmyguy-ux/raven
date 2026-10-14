import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
export async function prepareRemoteWorker({rest,config,directory}){
 await mkdir(directory,{recursive:true});
 const hostPath=join(directory,'worker-id.json');let workerId;
 try{workerId=JSON.parse(await readFile(hostPath,'utf8')).id;}catch(e){if(e.code!=='ENOENT')throw e;workerId=randomUUID();await writeFile(hostPath,JSON.stringify({id:workerId}),{mode:0o600,flag:'wx'});}
 if(!/^[a-f0-9-]{36}$/.test(workerId))throw Error('INVALID_WORKER_ID');
 const heartbeat=()=>rest('raven_local_workers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:workerId,last_seen:new Date().toISOString()})});
 await heartbeat();
 // A restarted worker never automatically reruns a possibly interrupted upload.
 await rest('raven_local_queue?worker_id=eq.'+workerId+'&stage=eq.running',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({stage:'failed',error:'The computer restarted during this request. Retry to resume from saved documents and upload receipts.'})});
 return {workerId,heartbeat,async pair(){
  if(Date.parse(config.expiresAt)<=Date.now())throw Error('UNAUTHORIZED');
  const token=randomBytes(32).toString('hex');
  // Re-pairing revokes the previous phone credential for this worker.
  await rest('raven_local_devices?worker_id=eq.'+workerId+'&revoked=eq.false',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revoked:true})});
  await rest('raven_local_devices',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:randomUUID(),worker_id:workerId,token_hash:createHash('sha256').update(token).digest('hex'),expires_at:config.expiresAt})});
  return {url:'https://shipitmyguy-ux.github.io/raven/pair-writer.html#'+token,expires_at:config.expiresAt};
 }};
}
export function createRemotePump({rest,remote,submit,getRun,authorizeJob}){
 let busy=false,stopped=false;
 async function tick(){
  if(busy||stopped)return;busy=true;
  try{
   await remote.heartbeat();
   const rows=await rest('raven_local_queue?worker_id=eq.'+remote.workerId+'&stage=eq.queued&order=created_at.asc&limit=1');
   const row=rows[0];if(!row)return;
   const claim=await rest('raven_local_queue?run_id=eq.'+row.run_id+'&stage=eq.queued',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({stage:'running'})});
   if(!claim.length)return;
   const update=body=>rest('raven_local_queue?run_id=eq.'+row.run_id,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
   try{
    const devices=await rest('raven_local_devices?id=eq.'+row.device_id+'&revoked=eq.false&select=expires_at&limit=1');
    if(!devices[0]||Date.parse(devices[0].expires_at)<=Date.now())throw Error('Pairing expired. Pair this device again.');
    await authorizeJob(row.job_id);
    const run=await submit({job_id:row.job_id,document_type:row.document_type});
    for(;;){
     const state=getRun(run.run_id);
     if(['complete','failed'].includes(state.stage)){await update({stage:state.stage,error:state.error||null,documents:state.documents||[]});break;}
     await remote.heartbeat();
     await new Promise(r=>setTimeout(r,1500));
    }
   }catch{await update({stage:'failed',error:'The local writer could not finish. Check its sign-in and grant, then retry to resume safely.'});}
  }finally{busy=false;}
 }
 return {tick,stop(){stopped=true;}};
}
