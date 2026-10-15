const stages=new Set(['queued','reading','context','verifying','confirming','writing','saving','pdf','uploading','recording','complete','failed']);
export function createOneClickClient({baseUrl='http://127.0.0.1:8766',fetchImpl=globalThis.fetch,pollMs=1500,maxWaitMs=600000}={}){
  const url=new URL(baseUrl);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid Raven helper address.');
  let token;
  async function request(path,body,retryAuth=true){
    let response;
    try{response=await fetchImpl(url.origin+path,{method:body===undefined?'GET':'POST',headers:{'X-Raven-Local-Client':'raven-web-v1',...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),referrerPolicy:'unsafe-url',signal:AbortSignal.timeout(15000)});}
    catch{throw Error('Start the Raven one-click helper on this computer, then try again. Allow local network access if your browser asks.');}
    const payload=await response.json().catch(()=>({}));
    if(response.status===401&&path!=='/session'&&retryAuth){
      token=undefined;
      const session=await request('/session',{},false);
      if(typeof session.token!=='string'||!session.token)throw Error('Raven helper session was not established.');
      token=session.token;
      return request(path,body,false);
    }
    if(!response.ok)throw Error(payload.error||'Raven helper request failed ('+response.status+').');
    return payload;
  }
  return {async run(input,onStage=()=>{}){
    if(!['resume','coverLetter','both'].includes(input.document_type)||!String(input.job_id||''))throw Error('Invalid document request.');
    if(!token){const session=await request('/session',{});if(typeof session.token!=='string'||!session.token)throw Error('Raven helper session was not established.');token=session.token;}
    let run=await request('/runs',input);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(run.run_id||''))throw Error('Raven helper returned an invalid run.');
    const runId=run.run_id,deadline=Date.now()+maxWaitMs;
    for(;;){
      if(!stages.has(run.stage)||run.run_id!==runId||(run.job_id&&String(run.job_id)!==String(input.job_id)))throw Error('Raven helper returned an invalid status.');
      onStage(run.stage);
      if(run.stage==='failed'){
        const error=Error((run.error||'Document generation failed. Your saved documents remain available.')+' [Request '+runId+(stages.has(run.failed_stage)?' · '+run.failed_stage:'')+']');
        error.run_id=runId;error.failed_stage=run.failed_stage;error.error_code=run.error_code;
        throw error;
      }
      if(run.stage==='complete'){
        const kinds=input.document_type==='both'?['resume','coverLetter']:[input.document_type];
        if(!kinds.every(kind=>run.documents?.some(d=>d.document_type===kind&&d.document_url&&/^[a-f0-9]{64}$/i.test(d.document_sha256||'')&&/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{10,160}\/view$/.test(d.drive_url||'')&&d.file_id)))throw Error('Raven helper has not confirmed the saved document and Drive PDF.');
        return run;
      }
      if(Date.now()>=deadline)throw Error('Generation is taking longer than expected. The helper may still be working; refresh Raven to check saved documents before retrying.');
      await new Promise(resolve=>setTimeout(resolve,Math.min(pollMs,Math.max(0,deadline-Date.now()))));
      run=await request('/runs/'+runId);
    }
  }};
}
