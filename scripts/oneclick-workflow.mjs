import {createHash} from 'node:crypto';

const digest=value=>createHash('sha256').update(value).digest('hex');
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
function driveFileName(job,jobId,kind){
 const clean=value=>String(value||'').replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g,' ').replace(/\s+/g,' ').trim();
 const company=clean(job?.company),title=clean(job?.title);
 const base=company&&title?`${company} - ${title}`:jobId;
 return `${base.slice(0,165).trim()} - ${kind==='resume'?'Resume':'Cover letter'}.pdf`;
}
export async function invokePrivateTool(dispatch,name,args={}){
 const payload=JSON.parse(await dispatch(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})));
 if(payload.error||!payload.result||payload.result.isError)throw Error(payload.result?.content?.[0]?.text||'PRIVATE_TOOL_FAILED');
 const value=payload.result.structuredContent;
 if(!value||typeof value!=='object')throw Error('PRIVATE_TOOL_INVALID_RESPONSE');
 return value;
}
function verified(metadata,folderId){
 if(!metadata||!/^[A-Za-z0-9_-]{10,160}$/.test(metadata.file_id||'')||metadata.mime_type!=='application/pdf'||!Array.isArray(metadata.parent_ids)||!metadata.parent_ids.includes(folderId)||!metadata.file_name?.endsWith('.pdf'))throw Error('DRIVE_UPLOAD_NOT_VERIFIED');
 return {...metadata,drive_url:`https://drive.google.com/file/d/${metadata.file_id}/view`};
}
export function createApplicationReceiptVerifier({dispatch,rest,verifyUpload,config}){
 if(![dispatch,rest,verifyUpload].every(value=>typeof value==='function')||!idPattern.test(config?.driveFolderId||''))throw Error('ONE_CLICK_NOT_CONFIGURED');
 return async({job_id,documents})=>{
  if(!idPattern.test(job_id||'')||!Array.isArray(documents)||documents.length!==2||new Set(documents.map(d=>d?.document_type)).size!==2||documents.some(d=>!d||!['resume','coverLetter'].includes(d.document_type)||!/^[a-f0-9]{64}$/.test(d.document_sha256||'')||!/^[A-Za-z0-9_-]{10,160}$/.test(d.file_id||'')||d.drive_url!==`https://drive.google.com/file/d/${d.file_id}/view`))throw Error('INVALID_APPLICATION_RECEIPTS');
  const result=[];
  for(const source of documents){
   const current=await invokePrivateTool(dispatch,'get_document',{job_id,document_type:source.document_type});
   if(current.job_id!==job_id||current.document_type!==source.document_type||!current.document_url||digest(current.document_url)!==source.document_sha256||current.document_sha256!==source.document_sha256)throw Error('VERSION_CONFLICT');
   const path='raven_job_events?job_id=eq.'+encodeURIComponent(job_id)+'&event_type=eq.document_drive_export&metadata->>document_type=eq.'+source.document_type+'&metadata->>document_sha256=eq.'+source.document_sha256+'&metadata->>folder_id=eq.'+encodeURIComponent(config.driveFolderId)+'&select=metadata&limit=20';
   const events=await rest(path);
   if(!Array.isArray(events)||!events.some(row=>row.metadata?.file_id===source.file_id&&row.metadata?.drive_url===source.drive_url&&row.metadata?.folder_id===config.driveFolderId))throw Error('EXPORT_RECORD_NOT_CONFIRMED');
   const live=verified(await verifyUpload({fileId:source.file_id,folderId:config.driveFolderId}),config.driveFolderId);
   if(live.file_id!==source.file_id||live.drive_url!==source.drive_url)throw Error('DRIVE_UPLOAD_NOT_VERIFIED');
   result.push({document_type:source.document_type,document_sha256:source.document_sha256,file_id:source.file_id,drive_url:source.drive_url});
  }
  return {job_id,documents:result};
 };
}
export function createOneClickWorkflow({dispatch,rest,generateDraft,uploadPdf,verifyUpload,config,receiptStore,withDocumentLock=(_jobId,_kind,work)=>work()}){
 if(![dispatch,rest,generateDraft,uploadPdf,verifyUpload].every(value=>typeof value==='function')||!idPattern.test(config?.driveFolderId||''))throw Error('ONE_CLICK_NOT_CONFIGURED');
 const receipts=new Map(),saveLocks=new Map();
 const call=(name,args)=>invokePrivateTool(dispatch,name,args);
 async function withJobSaveLock(jobId,action){
  const previous=saveLocks.get(jobId)||Promise.resolve();
  let release;const done=new Promise(resolve=>release=resolve);saveLocks.set(jobId,done);
  await previous;
  try{return await action();}finally{release();if(saveLocks.get(jobId)===done)saveLocks.delete(jobId);}
 }
 return async function run({jobId,documentType='resume'},onProgress=()=>{}){
  if(!idPattern.test(jobId||'')||!['resume','coverLetter','both'].includes(documentType))throw Error('INVALID_ARGUMENTS');
  const documents=[];
  const started=Date.now(),activeStages=new Map(),timings=[];
  const progress=(stage,kind)=>{
   const now=Date.now(),key=kind||'run',previous=activeStages.get(key);
   if(previous)timings.push({stage:previous.stage,document_type:kind||null,duration_ms:Math.max(0,now-previous.started)});
   activeStages.set(key,{stage,started:now});
   const snapshot={job_id:jobId,stage,document_type:kind||documentType,stage_started_at:new Date(now).toISOString(),elapsed_ms:Math.max(0,now-started),stage_timings:[...timings],documents:[...documents]};
   onProgress(snapshot);return snapshot;
  };
  const read=(kind)=>call('get_document',{job_id:jobId,document_type:kind});
  const assertDoc=(doc,kind)=>{
   if(doc.job_id!==jobId||doc.document_type!==kind||!doc.document_url||digest(doc.document_url)!==doc.document_sha256)throw Error('DOCUMENT_READBACK_NOT_CONFIRMED');
   return doc;
  };
   const kinds=documentType==='both'?['resume','coverLetter']:[documentType];
   const processKind=kind=>withDocumentLock(jobId,kind,async()=>{
    try{
    let current;
    let namingJob;
     progress('checking_saved_state',kind);
    try{current=assertDoc(await read(kind),kind);}catch(error){if(error.message!=='DOCUMENT_UNAVAILABLE')throw error;}
    const reusedExisting=Boolean(current);
    if(!current){
     progress('context',kind);
     const {job,writing_prompt}=await call('get_job',{job_id:jobId});
     namingJob=job;
     const {profile}=await call('get_verified_profile');
     if(job?.id!==jobId||!job.expected_version||!job.description||!writing_prompt||!profile)throw Error('GENERATION_CONTEXT_INCOMPLETE');
     progress('writing',kind);
     let draft=await generateDraft({job,profile,writingPrompt:writing_prompt,documentType:kind});
     for(let attempt=0;attempt<2;attempt++){
      progress('saving',kind);
       try{
        current=await withJobSaveLock(jobId,async()=>{
         const fresh=await call('get_job',{job_id:jobId});
         const freshProfile=(await call('get_verified_profile')).profile;
         const identity=value=>JSON.stringify([value?.id,value?.title,value?.company,value?.track,value?.url,value?.description]);
         if(identity(fresh.job)!==identity(job)||fresh.writing_prompt!==writing_prompt||JSON.stringify(freshProfile)!==JSON.stringify(profile)||
            (kind==='resume'?fresh.job?.has_resume:fresh.job?.has_cover_letter))throw Error('VERSION_CONFLICT');
         try{await read(kind);throw Error('VERSION_CONFLICT');}catch(error){if(error.message!=='DOCUMENT_UNAVAILABLE')throw error;}
         const saved=await call('save_generated_document',{job_id:jobId,document_type:kind,expected_version:fresh.job.expected_version,document:draft});
         progress('confirming',kind);
         const readback=assertDoc(await read(kind),kind);
         if(!saved?.saved||saved.document_url!==readback.document_url||saved.expected_version!==readback.expected_version)throw Error('DOCUMENT_READBACK_NOT_CONFIRMED');
         return readback;
        });
        break;
       }
      catch(error){
       if(attempt||!['INVALID_DOCUMENT','FACTUAL_REVIEW_BLOCKED'].includes(error.message))throw error;
       progress('writing',kind);
       draft=await generateDraft({job,profile,writingPrompt:writing_prompt,documentType:kind,repair:{error:error.message,previousDraft:draft}});
      }
     }
    }
    const key=[jobId,kind,current.document_sha256,config.driveFolderId].join('|');
    const path='raven_job_events?job_id=eq.'+encodeURIComponent(jobId)+'&event_type=eq.document_drive_export&metadata->>document_type=eq.'+kind+'&metadata->>document_sha256=eq.'+current.document_sha256+'&metadata->>folder_id=eq.'+encodeURIComponent(config.driveFolderId)+'&select=metadata&limit=20';
    progress('checking_drive_receipts',kind);
    const existing=await rest(path);
    if(!Array.isArray(existing))throw Error('EXPORT_LOOKUP_FAILED');
    let receipt;
    if(existing.length){
     const event=existing[0].metadata;
     receipt=verified(await verifyUpload({fileId:event.file_id,folderId:config.driveFolderId}),config.driveFolderId);
     if(receipt.file_id!==event.file_id)throw Error('DRIVE_UPLOAD_NOT_VERIFIED');
    }else{
     receipt=receipts.get(key)||await receiptStore?.get(key);
     progress('pdf',kind);
     const pdf=receipt?.pdf||await call('export_document_pdf',{job_id:jobId,document_type:kind,document_sha256:current.document_sha256});
     if(pdf.document_sha256!==current.document_sha256||!/^[a-f0-9]{64}$/.test(pdf.pdf_sha256||'')||!pdf.file_path||!pdf.file_name)throw Error('PDF_READBACK_NOT_CONFIRMED');
     if(receipt){
      progress('verifying',kind);
      const observed=verified(await verifyUpload({fileId:receipt.file_id,folderId:config.driveFolderId}),config.driveFolderId);
      if(observed.file_id!==receipt.file_id)throw Error('DRIVE_UPLOAD_NOT_VERIFIED');
      receipt={...observed,pdf};
     }else{
      progress('uploading',kind);
      if(!namingJob){
       const rows=await rest('raven_jobs?id=eq.'+encodeURIComponent(jobId)+'&select=id,company,title&limit=1');
       if(rows?.[0]?.id===jobId)namingJob=rows[0];
      }
      receipt=verified(await uploadPdf({pdf,folderId:config.driveFolderId,fileName:driveFileName(namingJob,jobId,kind)}),config.driveFolderId);
      receipt={...receipt,pdf:{file_path:pdf.file_path,file_name:pdf.file_name,pdf_sha256:pdf.pdf_sha256,document_sha256:pdf.document_sha256}};
      receipts.set(key,receipt);
      await receiptStore?.set(key,receipt);
     }
     progress('confirming',kind);
     if(assertDoc(await read(kind),kind).document_sha256!==current.document_sha256)throw Error('VERSION_CONFLICT');
     progress('recording',kind);
     const recorded=await call('record_drive_export',{job_id:jobId,document_type:kind,document_sha256:current.document_sha256,pdf_sha256:pdf.pdf_sha256,file_id:receipt.file_id,folder_id:config.driveFolderId,file_name:receipt.file_name});
     if(!recorded.recorded||recorded.drive_url!==receipt.drive_url)throw Error('EXPORT_RECORD_NOT_CONFIRMED');
     const persisted=await rest(path);
     if(!persisted?.some(row=>row.metadata?.file_id===receipt.file_id&&row.metadata.document_sha256===current.document_sha256))throw Error('EXPORT_RECORD_NOT_CONFIRMED');
    }
    progress('confirming',kind);
    if(assertDoc(await read(kind),kind).document_sha256!==current.document_sha256)throw Error('VERSION_CONFLICT');
    documents.push({document_type:kind,document_url:current.document_url,document_sha256:current.document_sha256,drive_url:receipt.drive_url,file_id:receipt.file_id,reused_existing:reusedExisting});
    progress('document_complete',kind);
    }catch(error){error.failed_stage=activeStages.get(kind)?.stage;error.failed_document_type=kind;progress('document_failed',kind);throw error;}
   });
   try{
    progress('queued');
    const settled=await Promise.allSettled(kinds.map(processKind));
    const failure=settled.find(result=>result.status==='rejected');
    if(failure)throw failure.reason;
    return {...progress('complete'),documents:kinds.map(kind=>documents.find(doc=>doc.document_type===kind))};
  }catch(error){error.diagnostics=progress('failed');error.partial_documents=documents;throw error;}
 };
}
