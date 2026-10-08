const encoder=new TextEncoder();
const xml=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Uncompressed ZIP: small documents need no dependency or remote conversion.
export function zipFiles(files){
  const chunks=[],central=[];let offset=0;
  for(const [path,text] of Object.entries(files)){
    const name=encoder.encode(path),data=encoder.encode(text),crc=crc32(data);
    const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
    const record=new Uint8Array(46+name.length),r=new DataView(record.buffer);
    r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint32(16,crc,true);r.setUint32(20,data.length,true);r.setUint32(24,data.length,true);r.setUint16(28,name.length,true);r.setUint32(42,offset,true);record.set(name,46);
    chunks.push(local,data);central.push(record);offset+=local.length+data.length;
  }
  const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
export function docxFromBlocks(blocks){
  if(!blocks.length)throw new Error("No document text is available to download.");
  const body=blocks.map(({text,tag})=>{
    const heading=/^H[1-3]$/.test(tag),size=tag==="H1"?"44":heading?"24":"21";
    return '<w:p><w:pPr><w:spacing w:after="100"/>'+(heading?'<w:keepNext/>':'')+'</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="'+size+'"/>'+(heading?'<w:b/>':'')+'</w:rPr><w:t xml:space="preserve">'+((tag==="LI"?"• ":"")+text).split(/\r?\n/).map(xml).join('</w:t><w:br/><w:t xml:space="preserve">')+'</w:t></w:r></w:p>';
  }).join("");
  return zipFiles({
    "[Content_Types].xml":'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml":'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="750" w:right="835" w:bottom="750" w:left="835"/></w:sectPr></w:body></w:document>'
  });
}
export function blocksFromHtml(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  const selector="h1,h2,h3,p,li,.resume-job-head,.resume-education";
  return [...doc.body.querySelectorAll(selector)].filter(el=>!el.parentElement?.closest(selector)).map(el=>{
    // textContent drops <br>, joining the cover-letter closing to its signature.
    // Preserve explicit breaks in a clone so the preview/source stays unchanged.
    const copy=el.cloneNode(true);
    copy.querySelectorAll("br").forEach(br=>br.replaceWith(doc.createTextNode("\n")));
    const text=copy.matches(".resume-job-head,.resume-education")
      ? [...copy.querySelectorAll("strong,span")].map(x=>x.textContent).join(" | ")
      : copy.textContent;
    return {tag:el.tagName,text:text.split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).join("\n").trim()};
  }).filter(x=>x.text);
}
