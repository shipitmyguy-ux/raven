import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchRequest,filePrompt} from '../resume-transfer.mjs';
import {docxFromBlocks} from '../document-download.mjs';
test('file request preserves evidence prompt and requests attachment only',()=>{
 const prompt=filePrompt('verified fact_ids','abc');
 assert.match(prompt,/verified fact_ids/);assert.match(prompt,/downloadable UTF-8 JSON file/);assert.match(prompt,/request_id/);assert.match(prompt,/only the file download link/);
});
test('automatic import binds active identity and requires all requested documents',()=>{
 const requests={abc:{jobId:'job-1',type:'both',createdAt:1000}};
 const payload={raven_format:'raven-chatgpt-v1',request_id:'abc',resume:{},coverLetter:{}};
 assert.equal(matchRequest(payload,requests,2000).jobId,'job-1');
 assert.throws(()=>matchRequest({...payload,request_id:'other'},requests,2000),/no active/);
 assert.throws(()=>matchRequest(payload,requests,86402000),/no active/);
 assert.throws(()=>matchRequest({...payload,coverLetter:null},requests,2000),/missing/);
 assert.throws(()=>matchRequest({...payload,raven_format:'other'},requests,2000),/Unsupported/);
});
test('Word download is an actual OOXML ZIP with escaped Unicode document text',async()=>{
 const blob=docxFromBlocks([{tag:'H1',text:'José & Candidate'},{tag:'LI',text:'Built <tools> with team.'}]);
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);let pos=0;const files={};
 while(view.getUint32(pos,true)===0x04034b50){
   const length=view.getUint32(pos+18,true),nameLength=view.getUint16(pos+26,true);
   const start=pos+30+nameLength;
   files[new TextDecoder().decode(bytes.slice(pos+30,start))]=new TextDecoder().decode(bytes.slice(start,start+length));pos=start+length;
 }
 assert.equal(view.getUint32(pos,true),0x02014b50);
 assert.match(files['[Content_Types].xml'],/wordprocessingml.document.main/);
 assert.match(files['word/document.xml'],/José &amp; Candidate/);
 assert.match(files['word/document.xml'],/• Built &lt;tools&gt;/);
 assert.match(files['_rels/.rels'],/word\/document.xml/);
});

test('Word export retains explicit line breaks between closing and signature',async()=>{
 const blob=docxFromBlocks([{tag:'P',text:'Sincerely,\nTest Candidate'}]);
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);let pos=0,document='';
 while(view.getUint32(pos,true)===0x04034b50){
  const length=view.getUint32(pos+18,true),nameLength=view.getUint16(pos+26,true),start=pos+30+nameLength;
  if(new TextDecoder().decode(bytes.slice(pos+30,start))==='word/document.xml')document=new TextDecoder().decode(bytes.slice(start,start+length));
  pos=start+length;
 }
 assert.match(document,/Sincerely,<\/w:t><w:br\/><w:t xml:space="preserve">Test Candidate/);
 assert.doesNotMatch(document,/Sincerely,Test Candidate/);
});
