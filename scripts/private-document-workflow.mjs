import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const workflowTools=[
 {name:'export_document_pdf',description:'Render the exact saved Raven document as PDF. Returns its local path and base64 bytes for a file tool to materialize before connected Google Drive upload. No document changes.',inputSchema:{type:'object',properties:{job_id:{type:'string'},document_type:{enum:['resume','coverLetter']},document_sha256:{type:'string'}},required:['job_id','document_type','document_sha256'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'record_drive_export',description:'Record a Google Drive PDF copy in Raven activity ONLY after connected Drive metadata readback confirms the PDF and configured parent folder. This records connector-reported verification; Raven cannot independently authenticate to Drive.',inputSchema:{type:'object',properties:{job_id:{type:'string'},document_type:{enum:['resume','coverLetter']},document_sha256:{type:'string'},pdf_sha256:{type:'string'},file_id:{type:'string'},folder_id:{type:'string'},file_name:{type:'string'}},required:['job_id','document_type','document_sha256','pdf_sha256','file_id','folder_id','file_name'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false}}
];
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function renderSavedPdf({documentUrl,outputDir,fileName}){
 if(!documentUrl.startsWith('data:text/html;charset=utf-8,'))throw Error('UNSUPPORTED_DOCUMENT');
 const html=decodeURIComponent(documentUrl.slice(documentUrl.indexOf(',')+1));
 if(html.length>1000000)throw Error('DOCUMENT_TOO_LARGE');
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({javaScriptEnabled:false});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  await page.setContent(html,{waitUntil:'load',timeout:15000});
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({format:'Letter',printBackground:true,preferCSSPageSize:true});
  if(pdf.length>2000000||!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('PDF_EXPORT_FAILED');
  await mkdir(outputDir,{recursive:true});
  const path=resolve(outputDir,fileName);
  await writeFile(path,pdf);
  return {file_path:path,file_name:fileName,mime_type:'application/pdf',pdf_sha256:hash(pdf),pdf_base64:pdf.toString('base64')};
 }finally{await browser.close();}
}
export function createDocumentWorkflow({config,readDocument,rest,renderPdf=renderSavedPdf}){
 return async(name,args)=>{
  const tool=workflowTools.find(t=>t.name===name);
  if(!tool||!args||Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k))||tool.inputSchema.required.some(k=>typeof args[k]!=='string'))throw Error('INVALID_ARGUMENTS');
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(args.job_id)||!['resume','coverLetter'].includes(args.document_type)||!/^[a-f0-9]{64}$/.test(args.document_sha256))throw Error('INVALID_ARGUMENTS');
  const doc=await readDocument(args);
  if(doc.document_sha256!==args.document_sha256)throw Error('VERSION_CONFLICT');
  if(name==='export_document_pdf'){
   const fileName=`${args.job_id}-${args.document_type}-${args.document_sha256.slice(0,12)}.pdf`;
   return {...await renderPdf({documentUrl:doc.document_url,outputDir:resolve('private/exports'),fileName}),job_id:args.job_id,document_type:args.document_type,document_sha256:doc.document_sha256};
  }
  if(!config.driveFolderId||args.folder_id!==config.driveFolderId||!/^[A-Za-z0-9_-]{10,160}$/.test(args.file_id)||!/^[a-f0-9]{64}$/.test(args.pdf_sha256)||args.file_name.length>200||!args.file_name.endsWith('.pdf'))throw Error('INVALID_DRIVE_EXPORT');
  const digest=hash([args.job_id,args.document_type,args.document_sha256,args.file_id].join('|'));
  const id=[digest.slice(0,8),digest.slice(8,12),digest.slice(12,16),digest.slice(16,20),digest.slice(20,32)].join('-');
  const metadata={...args,verification:'connected-drive-metadata-readback',drive_url:`https://drive.google.com/file/d/${args.file_id}/view`};
  await rest('raven_job_events?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({id,job_id:args.job_id,event_type:'document_drive_export',source:'chatgpt-private',summary:`${args.document_type==='resume'?'Resume':'Cover letter'} PDF copied to Google Drive`,metadata})});
  const rows=await rest('raven_job_events?id=eq.'+id+'&select=id,metadata&limit=1');
  if(rows?.[0]?.metadata?.document_sha256!==args.document_sha256||rows[0].metadata.file_id!==args.file_id)throw Error('EXPORT_RECORD_NOT_CONFIRMED');
  return {recorded:true,job_id:args.job_id,drive_url:metadata.drive_url,verification:metadata.verification};
 };
}
