import { createHash } from "node:crypto";

export const BACKUP_FORMAT="raven-supabase-backup";
export const BACKUP_VERSION=1;

export const TABLES=[
  {name:"raven_jobs",pk:"id",tier:"durable",restoreable:true,onConflict:"id"},
  {name:"raven_bookmark_keys",pk:"key_hash",tier:"durable",restoreable:true,onConflict:"key_hash"},
  {name:"raven_bookmark_urls",pk:"url",tier:"durable",restoreable:true,onConflict:"url"},
  {name:"raven_commute_cache",pk:"location_key",tier:"operational",restoreable:true,onConflict:"location_key"},
  {name:"raven_search_results",pk:"id",tier:"operational",restoreable:true,onConflict:"id"},
  {name:"raven_search_runs",pk:"id",tier:"operational",restoreable:true,onConflict:"id"},
  {name:"raven_tasks",pk:"task_id",tier:"legacy",restoreable:true,onConflict:"task_id"},
  {name:"raven_source_diagnostics",pk:"id",tier:"audit",restoreable:false,onConflict:null},
  {name:"raven_request_events",pk:"id",tier:"audit",restoreable:false,onConflict:null}
];

export const RESTORE_ORDER=[
  "raven_jobs",
  "raven_bookmark_keys",
  "raven_bookmark_urls",
  "raven_commute_cache",
  "raven_search_results",
  "raven_search_runs",
  "raven_tasks"
];

export function tablesForScope(scope="core"){
  if(scope==="core") return TABLES.filter(t=>t.tier==="durable");
  if(scope==="full") return TABLES.slice();
  throw new Error("scope must be core or full");
}

export function sha256(value){
  const text=typeof value==="string"?value:JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

export function buildBackup({createdAt,projectRef,scope,tables}){
  const manifestTables={};
  let totalRows=0;
  for(const [name,rows] of Object.entries(tables)){
    manifestTables[name]={rows:rows.length,sha256:sha256(rows)};
    totalRows+=rows.length;
  }
  const payload={
    format:BACKUP_FORMAT,
    version:BACKUP_VERSION,
    createdAt,
    projectRef,
    scope,
    tables
  };
  return {
    ...payload,
    manifest:{
      totalRows,
      tables:manifestTables,
      payloadSha256:sha256(payload)
    }
  };
}

export function verifyBackup(backup){
  if(!backup||backup.format!==BACKUP_FORMAT) throw new Error("Not a Raven backup.");
  if(backup.version!==BACKUP_VERSION) throw new Error("Unsupported Raven backup version: "+backup.version);
  if(!backup.tables||typeof backup.tables!=="object") throw new Error("Backup tables are missing.");
  const payload={
    format:backup.format,
    version:backup.version,
    createdAt:backup.createdAt,
    projectRef:backup.projectRef,
    scope:backup.scope,
    tables:backup.tables
  };
  const expected=sha256(payload);
  if(backup.manifest?.payloadSha256!==expected) throw new Error("Backup payload checksum mismatch.");
  for(const [name,meta] of Object.entries(backup.manifest?.tables||{})){
    const rows=backup.tables[name];
    if(!Array.isArray(rows)) throw new Error("Backup table missing: "+name);
    if(rows.length!==meta.rows) throw new Error("Row-count mismatch for "+name);
    if(sha256(rows)!==meta.sha256) throw new Error("Checksum mismatch for "+name);
  }
  return true;
}

export function chunkRows(rows,maxBytes=3_500_000,maxRows=250){
  const chunks=[];
  let current=[];
  let bytes=2;
  for(const row of rows){
    const rowBytes=Buffer.byteLength(JSON.stringify(row),"utf8")+1;
    if(current.length && (current.length>=maxRows || bytes+rowBytes>maxBytes)){
      chunks.push(current);
      current=[];
      bytes=2;
    }
    current.push(row);
    bytes+=rowBytes;
  }
  if(current.length) chunks.push(current);
  return chunks;
}
