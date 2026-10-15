import {createHash} from 'node:crypto';

const kinds=['resume','coverLetter'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
const hashPattern=/^[a-f0-9]{64}$/;
const MAX_PDF_BYTES=2*1024*1024;

export function createApplicationDocumentPreparer({dispatch,rest,downloadPdf,config}){
 if(![dispatch,rest,downloadPdf].every(value=>typeof value==='function')||!idPattern.test(config?.driveFolderId||''))throw Error('APPLICATION_PREPARE_NOT_CONFIGURED');
 const call=async(name,args)=>{
  const payload=JSON.parse(await dispatch(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})));
  if(payload.error||!payload.result||payload.result.isError)throw Error(payload.result?.content?.[0]?.text||'PRIVATE_TOOL_FAILED');
  const value=payload.result.structuredContent;
  if(!value||typeof value!=='object')throw Error('PRIVATE_TOOL_INVALID_RESPONSE');
  return value;
 };
 const current=async(job_id,document_type)=>{
  const doc=await call('get_document',{job_id,document_type});
  if(doc.job_id!==job_id||doc.document_type!==document_type||!hashPattern.test(doc.document_sha256||'')||!doc.document_url||sha(doc.document_url)!==doc.document_sha256)throw Error('DOCUMENT_READBACK_NOT_CONFIRMED');
  return doc;
 };
 return async({job_id,documents})=>{
  if(!idPattern.test(job_id||'')||!Array.isArray(documents)||documents.length!==2||documents.some(d=>!d||Object.keys(d).sort().join(',')!=='document_sha256,document_type'||!kinds.includes(d.document_type)||!hashPattern.test(d.document_sha256||''))||new Set(documents.map(d=>d.document_type)).size!==2)throw Error('INVALID_APPLICATION_DOCUMENTS');
  const initial={};
  for(const kind of kinds){
   initial[kind]=await current(job_id,kind);
   const requested=documents.find(d=>d.document_type===kind);
   if(initial[kind].document_sha256!==requested.document_sha256)throw Error('VERSION_CONFLICT');
  }
  const result=[];
  for(const kind of kinds){
   const doc=initial[kind];
   // Resolve canonical export history; callers cannot select URLs or local paths.
   const events=await rest('raven_job_events?job_id=eq.'+encodeURIComponent(job_id)+'&event_type=eq.document_drive_export&metadata->>document_type=eq.'+kind+'&metadata->>document_sha256=eq.'+doc.document_sha256+'&metadata->>folder_id=eq.'+encodeURIComponent(config.driveFolderId)+'&select=metadata&limit=20');
   const exported=events?.[0]?.metadata;
   if(!exported||exported.document_type!==kind||exported.document_sha256!==doc.document_sha256||exported.folder_id!==config.driveFolderId||!/^[A-Za-z0-9_-]{10,160}$/.test(exported.file_id||'')||exported.drive_url!=='https://drive.google.com/file/d/'+exported.file_id+'/view'||!hashPattern.test(exported.pdf_sha256||''))throw Error('EXPORT_RECORD_NOT_CONFIRMED');
   const bytes=await downloadPdf({fileId:exported.file_id,folderId:config.driveFolderId});
   if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_PDF_BYTES||!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('PDF_EXPORT_INVALID');
   const pdf_sha256=sha(bytes);
   if(exported.pdf_sha256!==pdf_sha256)throw Error('PDF_READBACK_NOT_CONFIRMED');
   result.push({document_type:kind,document_sha256:doc.document_sha256,pdf_sha256,file_name:`${job_id}-${kind}-${doc.document_sha256.slice(0,12)}.pdf`,data_url:`data:application/pdf;base64,${bytes.toString('base64')}`});
  }
  for(const kind of kinds)if((await current(job_id,kind)).document_sha256!==initial[kind].document_sha256)throw Error('VERSION_CONFLICT');
  return {job_id,documents:result};
 };
}
