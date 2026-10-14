import {createHash} from 'node:crypto';
import {open,realpath} from 'node:fs/promises';
import {basename,resolve,sep} from 'node:path';

const kinds=['resume','coverLetter'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
const hashPattern=/^[a-f0-9]{64}$/;
const MAX_PDF_BYTES=2*1024*1024;

export function createApplicationDocumentPreparer({dispatch,exportDirectory=resolve('private/exports'),readBytes=readPdfSafely}){
 if(typeof dispatch!=='function'||typeof readBytes!=='function')throw Error('APPLICATION_PREPARE_NOT_CONFIGURED');
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
   const exported=await call('export_document_pdf',{job_id,document_type:kind,document_sha256:doc.document_sha256});
   if(exported.job_id!==job_id||exported.document_type!==kind||exported.document_sha256!==doc.document_sha256||exported.file_name!==`${job_id}-${kind}-${doc.document_sha256.slice(0,12)}.pdf`)throw Error('PDF_READBACK_NOT_CONFIRMED');
   const bytes=await readBytes(exported.file_path,{exportDirectory,expectedName:exported.file_name});
   if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_PDF_BYTES||!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('PDF_EXPORT_INVALID');
   const pdf_sha256=sha(bytes);
   if(exported.pdf_sha256!==pdf_sha256)throw Error('PDF_READBACK_NOT_CONFIRMED');
   result.push({document_type:kind,document_sha256:doc.document_sha256,pdf_sha256,file_name:exported.file_name,data_url:`data:application/pdf;base64,${bytes.toString('base64')}`});
  }
  for(const kind of kinds)if((await current(job_id,kind)).document_sha256!==initial[kind].document_sha256)throw Error('VERSION_CONFLICT');
  return {job_id,documents:result};
 };
}

async function readPdfSafely(filePath,{exportDirectory,expectedName}){
 if(typeof filePath!=='string'||basename(filePath)!==expectedName||basename(expectedName)!==expectedName)throw Error('PDF_PATH_INVALID');
 const root=await realpath(exportDirectory),file=await realpath(filePath);
 if(!file.startsWith(root+sep))throw Error('PDF_PATH_INVALID');
 const handle=await open(file,'r');
 try{
  const info=await handle.stat();
  if(!info.isFile()||info.size<=0||info.size>MAX_PDF_BYTES)throw Error('PDF_EXPORT_INVALID');
  const bytes=Buffer.alloc(info.size);let offset=0;
  while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)throw Error('PDF_EXPORT_INVALID');offset+=bytesRead;}
  return bytes;
 }finally{await handle.close();}
}
