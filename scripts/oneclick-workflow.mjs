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
export function createOneClickWorkflow({dispatch,rest,generateDraft,uploadPdf,verifyUpload,config,receiptStore}){
 if(![dispatch,rest,generateDraft,uploadPdf,verifyUpload].every(value=>typeof value==='function')||!idPattern.test(config?.driveFolderId||''))throw Error('ONE_CLICK_NOT_CONFIGURED');
 const receipts=new Map();
 const call=(name,args)=>invokePrivateTool(dispatch,name,args);
 return async function run({jobId,documentType='resume'},onProgress=()=>{}){
  if(!idPattern.test(jobId||'')||!['resume','coverLetter','both'].includes(documentType))throw Error('INVALID_ARGUMENTS');
  const documents=[];
  const progress=(stage,kind)=>onProgress({job_id:jobId,stage,document_type:kind,documents:[...documents]});
  const read=(kind)=>call('get_document',{job_id:jobId,document_type:kind});
  const assertDoc=(doc,kind)=>{
   if(doc.job_id!==jobId||doc.document_type!==kind||!doc.document_url||digest(doc.document_url)!==doc.document_sha256)throw Error('DOCUMENT_READBACK_NOT_CONFIRMED');
   return doc;
  };
  try{
   progress('queued');
   for(const kind of documentType==='both'?['resume','coverLetter']:[documentType]){
    let current;
    let namingJob;
    try{current=assertDoc(await read(kind),kind);}catch(error){if(error.message!=='DOCUMENT_UNAVAILABLE')throw error;}
    const reusedExisting=Boolean(current);
    if(!current){
     const {job,writing_prompt}=await call('get_job',{job_id:jobId});
     namingJob=job;
     const {profile}=await call('get_verified_profile');
     if(job?.id!==jobId||!job.expected_version||!job.description||!writing_prompt||!profile)throw Error('GENERATION_CONTEXT_INCOMPLETE');
     progress('writing',kind);
     let draft=await generateDraft({job,profile,writingPrompt:writing_prompt,documentType:kind});
     let saved;
     for(let attempt=0;attempt<2;attempt++){
      progress('saving',kind);
      try{saved=await call('save_generated_document',{job_id:jobId,document_type:kind,expected_version:job.expected_version,document:draft});break;}
      catch(error){
       if(attempt||!['INVALID_DOCUMENT','FACTUAL_REVIEW_BLOCKED'].includes(error.message))throw error;
       progress('writing',kind);
       draft=await generateDraft({job,profile,writingPrompt:writing_prompt,documentType:kind,repair:{error:error.message,previousDraft:draft}});
      }
     }
     current=assertDoc(await read(kind),kind);
     if(!saved?.saved||saved.document_url!==current.document_url||saved.expected_version!==current.expected_version)throw Error('DOCUMENT_READBACK_NOT_CONFIRMED');
    }
    const key=[jobId,kind,current.document_sha256,config.driveFolderId].join('|');
    const path='raven_job_events?job_id=eq.'+encodeURIComponent(jobId)+'&event_type=eq.document_drive_export&metadata->>document_type=eq.'+kind+'&metadata->>document_sha256=eq.'+current.document_sha256+'&metadata->>folder_id=eq.'+encodeURIComponent(config.driveFolderId)+'&select=metadata&limit=20';
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
     if(assertDoc(await read(kind),kind).document_sha256!==current.document_sha256)throw Error('VERSION_CONFLICT');
     progress('recording',kind);
     const recorded=await call('record_drive_export',{job_id:jobId,document_type:kind,document_sha256:current.document_sha256,pdf_sha256:pdf.pdf_sha256,file_id:receipt.file_id,folder_id:config.driveFolderId,file_name:receipt.file_name});
     if(!recorded.recorded||recorded.drive_url!==receipt.drive_url)throw Error('EXPORT_RECORD_NOT_CONFIRMED');
     const persisted=await rest(path);
     if(!persisted?.some(row=>row.metadata?.file_id===receipt.file_id&&row.metadata.document_sha256===current.document_sha256))throw Error('EXPORT_RECORD_NOT_CONFIRMED');
    }
    if(assertDoc(await read(kind),kind).document_sha256!==current.document_sha256)throw Error('VERSION_CONFLICT');
    documents.push({document_type:kind,document_url:current.document_url,document_sha256:current.document_sha256,drive_url:receipt.drive_url,file_id:receipt.file_id,reused_existing:reusedExisting});
   }
   progress('complete');
   return {job_id:jobId,stage:'complete',documents};
  }catch(error){progress('failed');error.partial_documents=documents;throw error;}
 };
}
