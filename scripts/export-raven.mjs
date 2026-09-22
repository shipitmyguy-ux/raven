import fs from "node:fs/promises";
import path from "node:path";
import { buildBackup, tablesForScope } from "./raven-backup-lib.mjs";

function arg(name,fallback=""){
  const prefix="--"+name+"=";
  const found=process.argv.slice(2).find(v=>v.startsWith(prefix));
  return found?found.slice(prefix.length):fallback;
}

const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const scope=arg("scope","core");
const timestamp=new Date().toISOString().replace(/[:.]/g,"-");
const output=arg("output",path.join("private","raven-backup-"+timestamp+".json"));

if(!base) throw new Error("SUPABASE_URL is required.");
if(!key) throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.");

function projectRef(){
  try{return new URL(base).hostname.split(".")[0]||"unknown";}catch{return "unknown";}
}

async function api(table,query){
  const response=await fetch(base+"/rest/v1/"+table+"?"+query,{
    headers:{apikey:key,Accept:"application/json"}
  });
  if(!response.ok) throw new Error(table+" export failed ("+response.status+"): "+await response.text());
  return response.json();
}

async function fetchTable(meta){
  const rows=[];
  const pageSize=1000;
  for(let offset=0;;offset+=pageSize){
    const q=new URLSearchParams({
      select:"*",
      order:meta.pk+".asc",
      limit:String(pageSize),
      offset:String(offset)
    });
    const page=await api(meta.name,q.toString());
    rows.push(...page);
    if(page.length<pageSize) break;
  }
  return rows;
}

const tableData={};
for(const table of tablesForScope(scope)){
  process.stdout.write("Exporting "+table.name+"... ");
  tableData[table.name]=await fetchTable(table);
  console.log(tableData[table.name].length+" rows");
}

const backup=buildBackup({
  createdAt:new Date().toISOString(),
  projectRef:projectRef(),
  scope,
  tables:tableData
});

await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(backup,null,2)+"\n",{mode:0o600});
try{await fs.chmod(output,0o600);}catch{}
console.log("Wrote "+output);
console.log("Rows: "+backup.manifest.totalRows);
console.log("SHA-256: "+backup.manifest.payloadSha256);
