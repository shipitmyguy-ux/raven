export function driveExportTarget(raw){
  let url;
  try{url=new URL(String(raw||"").trim());}catch{throw new Error("A valid Google Drive URL is required.");}
  const host=url.hostname.toLowerCase();
  const docMatch=url.pathname.match(/^\/document\/d\/([^/]+)/);
  if(host==="docs.google.com"&&docMatch){
    return {url:"https://docs.google.com/document/d/"+encodeURIComponent(docMatch[1])+"/export?format=pdf",mimeType:"application/pdf",kind:"google-doc"};
  }
  if(host==="drive.google.com"){
    const fileMatch=url.pathname.match(/^\/file\/d\/([^/]+)/);
    const id=fileMatch?.[1]||url.searchParams.get("id")||"";
    if(!id) throw new Error("Could not find a Google Drive file ID.");
    return {url:"https://drive.usercontent.google.com/download?id="+encodeURIComponent(id)+"&export=download&confirm=t",mimeType:"",kind:"drive-file"};
  }
  throw new Error("Only Google Drive or Google Docs master-resume links are supported.");
}
