const stages=new Set(['queued','persisting','document_complete','document_failed','context','verifying','confirming','checking_saved_state','checking_drive_receipts','writing','saving','pdf','uploading','recording','complete','failed']);
const runPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createOneClickClient({baseUrl='http://127.0.0.1:8766',fetchImpl=globalThis.fetch,pollMs=1500,maxWaitMs=600000}={}){
  const url=new URL(baseUrl);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid Raven helper address.');
  let token;
  async function request(path,body,retryAuth=true,timeoutMs=15000){
    let response;
    try{response=await fetchImpl(url.origin+path,{method:body===undefined?'GET':'POST',headers:{'X-Raven-Local-Client':'raven-web-v1',...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),referrerPolicy:'unsafe-url',signal:AbortSignal.timeout(timeoutMs)});}
    catch(error){if(error?.name==='TimeoutError'||error?.name==='AbortError')throw error;throw Error('Start the Raven one-click helper on this computer, then try again. Allow local network access if your browser asks.');}
    const payload=await response.json().catch(()=>({}));
    if(response.status===401&&path!=='/session'&&retryAuth){
      token=undefined;
      const session=await request('/session',{},false);
      if(typeof session.token!=='string'||!session.token)throw Error('Raven helper session was not established.');
      token=session.token;
      return request(path,body,false,timeoutMs);
    }
    if(!response.ok)throw Error(payload.error||'Raven helper request failed ('+response.status+').');
    return payload;
  }
  async function ensureApplicationPreparation(){
    const health=await request('/health');
    if(health.application_prepare_supported!==true)throw Error('This Raven writer does not support preparing application documents yet. Update and restart the writer, then try again.');
    return health;
  }
  async function pollRun(input,run,onStage){
    if(!runPattern.test(run?.run_id||'')||(run.job_id&&String(run.job_id)!==String(input.job_id))||(run.document_type&&run.document_type!==input.document_type))throw Error('Raven helper returned an invalid run.');
    const runId=run.run_id,deadline=Date.now()+maxWaitMs;
    for(;;){
      if(!stages.has(run.stage)||run.run_id!==runId||(run.job_id&&String(run.job_id)!==String(input.job_id))||(run.document_type&&run.document_type!==input.document_type))throw Error('Raven helper returned an invalid status.');
      onStage(run.stage,run);
      if(run.stage==='failed'){
        const error=Error((run.error||'Document generation failed. Your saved documents remain available.')+' [Request '+runId+(stages.has(run.failed_stage)?' · '+run.failed_stage:'')+']');
        error.run_id=runId;error.failed_stage=run.failed_stage;error.error_code=run.error_code;throw error;
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
  }
  function validateRunInput(input){if(!['resume','coverLetter','both'].includes(input?.document_type)||!String(input?.job_id||''))throw Error('Invalid document request.');}
  async function session(){if(!token){const result=await request('/session',{});if(typeof result.token!=='string'||!result.token)throw Error('Raven helper session was not established.');token=result.token;}}
  function validatePower(value){
    if(typeof value.supported!=='boolean'||!Number.isInteger(value.active_tasks)||value.active_tasks<0||!['idle','starting','awake','stopped','unavailable'].includes(value.state))throw Error('Update and restart the Raven writer to use keep-awake controls.');
    return value;
  }
  return {async resolveApplicationDestination(job){
    await session();
    const result=await request('/application-destination',{job_id:String(job.id)});
    if(result?.job_id!==String(job.id)||result.source_url!==job.url||typeof result.destination_url!=='string')throw Error('The employer destination changed. Review the saved listing.');
    const url=new URL(result.destination_url);if(url.protocol!=='https:'||url.port||url.username||url.password)throw Error('Invalid employer destination.');
    return result.destination_url;
  },async getPowerStatus(){await session();return validatePower(await request('/power'));},async stopKeepingAwake(){await session();return validatePower(await request('/power/stop',{}));},async ensureApplicationPreparation(){return ensureApplicationPreparation();},async verifyApplicationReceipts(input){
    if(!String(input?.job_id||'')||!Array.isArray(input.documents)||input.documents.length!==2||new Set(input.documents.map(d=>d?.document_type)).size!==2||input.documents.some(d=>!['resume','coverLetter'].includes(d?.document_type)||! /^[a-f0-9]{64}$/.test(d?.document_sha256||'')||! /^[A-Za-z0-9_-]{10,160}$/.test(d?.file_id||'')||d.drive_url!==`https://drive.google.com/file/d/${d.file_id}/view`))throw Error('Both exact application receipts are required.');
    const health=await ensureApplicationPreparation();
    if(health.application_receipts_supported!==true)throw Error('This Raven writer cannot recheck saved Drive receipts. Update and restart the writer before resuming.');
    await session();
    const verified=await request('/application-receipts',input,true,120000);
    if(verified.job_id!==input.job_id||!Array.isArray(verified.documents)||verified.documents.length!==2||!input.documents.every(source=>verified.documents.some(doc=>doc.document_type===source.document_type&&doc.document_sha256===source.document_sha256&&doc.file_id===source.file_id&&doc.drive_url===source.drive_url)))throw Error('The writer returned mismatched application receipts.');
    return verified;
  },async prepareApplicationDocuments(input){
    if(!String(input?.job_id||'')||!Array.isArray(input.documents)||input.documents.length!==2)throw Error('Both saved application documents are required.');
    const kinds=new Set(input.documents.map(d=>d?.document_type));
    if(!kinds.has('resume')||!kinds.has('coverLetter')||input.documents.some(d=>! /^[a-f0-9]{64}$/i.test(d?.document_sha256||'')))throw Error('Both saved application documents must have verified SHA256 hashes.');
    await ensureApplicationPreparation();
    if(!token){const session=await request('/session',{});if(typeof session.token!=='string'||!session.token)throw Error('Raven helper session was not established.');token=session.token;}
    let output;
    try{output=await request('/application-documents',{job_id:String(input.job_id),documents:input.documents.map(({document_type,document_sha256})=>({document_type,document_sha256}))},true,120000);}
    catch(error){if(error?.name==='TimeoutError'||error?.name==='AbortError')throw Error('The prepared PDFs are taking longer than expected. Check the writer before retrying.');throw error;}
    if(String(output.job_id)!==String(input.job_id)||!Array.isArray(output.documents)||output.documents.length!==2)throw Error('The writer returned an invalid prepared application packet.');
    const byType=new Map(input.documents.map(d=>[d.document_type,d]));
    const outputKinds=new Set(output.documents.map(doc=>doc?.document_type));
    if(outputKinds.size!==2||!outputKinds.has('resume')||!outputKinds.has('coverLetter'))throw Error('The writer did not return exactly one PDF for each application document.');
    for(const doc of output.documents){
      const source=byType.get(doc.document_type),match=/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(doc.data_url||'');
      if((match?.[1]?.length||0)>Math.ceil(2*1024*1024*4/3)+4)throw Error('A prepared PDF exceeds the 2 MiB limit.');
      if(!source||source.document_sha256!==doc.document_sha256||! /^[a-f0-9]{64}$/i.test(doc.pdf_sha256||'')||typeof doc.file_name!=='string'||!doc.file_name.trim()||!match)throw Error('The writer returned an invalid prepared PDF.');
      let bytes;
      try{const raw=atob(match[1]);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}catch{throw Error('The writer returned an unreadable prepared PDF.');}
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest.toLowerCase()!==doc.pdf_sha256.toLowerCase()||bytes.length<5||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('A prepared PDF failed its byte and digest check.');
    }
    return output;
  },async run(input,onStage=()=>{},{onAccepted}={}){
    validateRunInput(input);
    await session();
    let run=await request('/runs',input);
    if(!runPattern.test(run?.run_id||'')||(run.job_id&&String(run.job_id)!==String(input.job_id))||(run.document_type&&run.document_type!==input.document_type))throw Error('Raven helper returned an invalid run.');
    if(onAccepted)await onAccepted(run);
    return pollRun(input,run,onStage);
  },async resumeRun(input,runId,onStage=()=>{}){
    validateRunInput(input);
    if(!runPattern.test(runId||''))throw Error('Invalid saved writer run ID.');
    await session();
    let run;
    try{run=await request('/runs/'+runId);}catch(error){if(/Request not found/i.test(error.message))throw Error('The saved writer run is unavailable. Review the saved documents and start again explicitly.');throw error;}
    return pollRun(input,run,onStage);
  }};
}
