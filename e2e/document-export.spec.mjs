import {test,expect} from '@playwright/test';
test('Word export preserves cover-letter breaks and every resume block once',async({page})=>{
 await page.goto('/document-download.mjs');
 const result=await page.evaluate(async()=>{
  const {blocksFromHtml,docxFromBlocks}=await import('/document-download.mjs');
  const html='<html><body><h1>Test Candidate</h1><p>Summary &amp; experience.</p><div class="resume-job-head"><div><strong>Artist</strong><span>Example Studio</span></div><span>2020–2025</span></div><ul><li>Built environments.</li></ul><div class="resume-education"><strong>BFA · College</strong><span>2008</span></div><p class="closing">Sincerely,<br>Test Candidate</p></body></html>';
  const blocks=blocksFromHtml(html),bytes=new Uint8Array(await docxFromBlocks(blocks).arrayBuffer());
  const v=new DataView(bytes.buffer);let pos=0,document='';
  while(v.getUint32(pos,true)===0x04034b50){
   const length=v.getUint32(pos+18,true),nameLength=v.getUint16(pos+26,true),start=pos+30+nameLength;
   if(new TextDecoder().decode(bytes.slice(pos+30,start))==='word/document.xml')document=new TextDecoder().decode(bytes.slice(start,start+length));
   pos=start+length;
  }
  return {blocks,document};
 });
 expect(result.blocks).toHaveLength(6);
 expect(result.blocks[2].text).toBe('Artist | Example Studio | 2020–2025');
 expect(result.blocks.at(-1).text).toBe('Sincerely,\nTest Candidate');
 expect(result.document).toContain('Sincerely,</w:t><w:br/><w:t xml:space="preserve">Test Candidate');
 expect(result.document.match(/Built environments\./g)).toHaveLength(1);
 expect(result.document).toContain('Summary &amp; experience.');
});
