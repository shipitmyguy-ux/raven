export const PAIR_KEY='raven.local-writer.device.v1';
export const QUEUE_URL='https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-local-queue';
export function createRemoteWriterClient({token,fetchImpl=globalThis.fetch,pollMs=2000,maxWaitMs=900000}={}){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Pair this device with your Raven computer first.');
 async function request(body){
  let response;try{response=await fetchImpl(QUEUE_URL,{method:'POST',headers:{'Content-Type':'application/json','x-raven-device':token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{throw Error('Cannot reach the Raven queue. Your request may still be running; refresh Raven before retrying.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'Raven queue failed.');return data;
 }
 return {async run(input,onStage=()=>{}){
  let run=await request({action:'enqueue',...input});const runId=run.run_id,deadline=Date.now()+maxWaitMs;
  if(!/^[a-f0-9-]{36}$/.test(runId||''))throw Error('Invalid Raven queue response.');
  for(;;){
   if(run.run_id!==runId||run.job_id!==input.job_id)throw Error('Raven queue returned a different request.');
   if(run.stage==='failed')throw Error(run.error||'Local writer failed.');
   if(run.stage==='complete'){
    const kinds=input.document_type==='both'?['resume','coverLetter']:[input.document_type];
    if(!kinds.every(kind=>run.documents?.some(d=>d.document_type===kind&&d.document_url&&/^[a-f0-9]{64}$/i.test(d.document_sha256||'')&&/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{10,160}\/view$/.test(d.drive_url||'')&&d.file_id)))throw Error('Saved documents and Drive PDFs were not confirmed.');
    onStage('complete');return run;
   }
   if(!['queued','running'].includes(run.stage))throw Error('Invalid Raven queue status.');
   onStage(run.online?(run.stage==='queued'?'queued':'writing'):'offline');
   if(Date.now()>=deadline)throw Error('Request remains queued or running on your computer. Open Raven later to review the saved result.');
   await new Promise(r=>setTimeout(r,pollMs));run=await request({action:'status',run_id:runId});
  }
 }};
}
