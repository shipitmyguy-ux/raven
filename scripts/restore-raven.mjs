import fs from "node:fs/promises";
import { TABLES, RESTORE_ORDER, chunkRows, verifyBackup } from "./raven-backup-lib.mjs";

const args=new Set(process.argv.slice(3));
const file=process.argv[2];
const apply=args.has("--apply");
const replace=args.has("--replace");
const full=args.has("--full");

if(!file) throw new Error("Usage: node scripts/restore-raven.mjs <backup.json> [--apply] [--replace] [--full]");
if(replace && !apply) throw new Error("--replace requires --apply.");
if(replace && process.env.RAVEN_RESTORE_CONFIRM!=="RESTORE_RAVEN"){
  throw new Error("Destructive replace requires RAVEN_RESTORE_CONFIRM=RESTORE_RAVEN.");
}

const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||"";
if(apply && !base) throw new Error("SUPABASE_URL is required for --apply.");
if(apply && !key) throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for --apply.");

const backup=JSON.parse(await fs.readFile(file,"utf8"));
verifyBackup(backup);

const metaByName=new Map(TABLES.map(t=>[t.name,t]));
const selected=RESTORE_ORDER.filter(name=>{
  const meta=metaByName.get(name);
  if(!backup.tables[name]||!meta?.restoreable) return false;
  if(meta.tier==="durable") return true;
  return full;
});

console.log("Backup: "+file);
console.log("Created: "+backup.createdAt);
console.log("Mode: "+(apply?(replace?"APPLY + REPLACE":"APPLY + MERGE"):"DRY RUN"));
console.log("Tables:");
for(const name of selected) console.log("  "+name+": "+backup.tables[name].length+" rows");
const skippedAudit=Object.keys(backup.tables).filter(name=>metaByName.get(name)?.restoreable===false);
if(skippedAudit.length) console.log("Audit-only tables not replayed: "+skippedAudit.join(", "));

if(!apply){
  console.log("Dry run only. Add --apply to write data.");
  process.exit(0);
}

async function request(method,table,query="",body){
  const response=await fetch(base+"/rest/v1/"+table+(query?"?"+query:""),{
    method,
    headers:{
      apikey:key,
      Accept:"application/json",
      ...(body?{"Content-Type":"application/json"}:{}),
      Prefer:"resolution=merge-duplicates,return=minimal"
    },
    body:body?JSON.stringify(body):undefined
  });
  if(!response.ok) throw new Error(method+" "+table+" failed ("+response.status+"): "+await response.text());
  return response;
}

if(replace){
  for(const name of [...selected].reverse()){
    const meta=metaByName.get(name);
    console.log("Clearing "+name+"...");
    await request("DELETE",name,new URLSearchParams({[meta.pk]:"not.is.null"}).toString());
  }
}

for(const name of selected){
  const meta=metaByName.get(name);
  const rows=backup.tables[name];
  if(!rows.length) continue;
  console.log("Restoring "+name+"...");
  for(const chunk of chunkRows(rows)){
    const q=new URLSearchParams({on_conflict:meta.onConflict}).toString();
    await request("POST",name,q,chunk);
  }
}

console.log("Restore complete.");
console.log("Run Raven production health checks and compare row counts before resuming writes.");
