import { driveExportTarget } from "../supabase/functions/raven-generate-v1/drive-source.mjs";

const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

let target=driveExportTarget("https://docs.google.com/document/d/abc123XYZ/edit");
assert(target.url==="https://docs.google.com/document/d/abc123XYZ/export?format=pdf","Google Docs export URL incorrect");
assert(target.mimeType==="application/pdf","Google Docs should export as PDF");

target=driveExportTarget("https://drive.google.com/file/d/fileABC123/view?usp=sharing");
assert(target.url.includes("id=fileABC123"),"Drive file ID was not extracted");
assert(target.url.startsWith("https://drive.usercontent.google.com/download?"),"Drive file should use Google download host");

target=driveExportTarget("https://drive.google.com/open?id=queryABC123");
assert(target.url.includes("id=queryABC123"),"Drive query file ID was not extracted");

let blocked=false;
try{driveExportTarget("https://example.com/resume.pdf");}catch{blocked=true;}
assert(blocked,"Non-Google master resume URL must be rejected");

console.log("Drive source regression tests passed");
