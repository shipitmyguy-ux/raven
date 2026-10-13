import fs from "node:fs";

const assert=(condition,message)=>{if(!condition) throw new Error(message);};

const config=fs.readFileSync(new URL("../config.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../raven-api.js",import.meta.url),"utf8");
const backend=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/index.ts",import.meta.url),"utf8");
const backendConfig=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/config.ts",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../runtime-config.json",import.meta.url),"utf8");
const enrichDb=fs.readFileSync(new URL("../supabase/functions/raven-enrich-v1/db.ts",import.meta.url),"utf8");
const enrichConfig=fs.readFileSync(new URL("../supabase/functions/raven-enrich-v1/config.ts",import.meta.url),"utf8");
const commuteDb=fs.readFileSync(new URL("../supabase/functions/raven-commute-v1/db.ts",import.meta.url),"utf8");

assert(!config.includes("dataApiUrl"),"Browser config must not expose a second saved-job endpoint.");
assert(!config.includes("raven-data-v1"),"Browser config must not reference raven-data-v1.");
assert(api.includes('read(config.searchApiUrl, "jobs")'),"Saved-job reads must use raven-backend-v3.");
assert(api.includes('write(config.searchApiUrl, "addJob"'),"Saved-job creates must use raven-backend-v3.");
assert(api.includes('write(config.searchApiUrl, "updateJob"'),"Saved-job updates must use raven-backend-v3.");
assert(!api.includes("dataApiUrl"),"Raven API adapter must not contain legacy data endpoint logic.");

assert(!backend.includes("queueBackup"),"Canonical backend must not mirror writes to a legacy backup.");
assert(!backend.includes("raven-backup-v1"),"Canonical backend must not call the retired Sheets backup function.");
assert(!backendConfig.includes("script.google.com"),"Canonical backend must not contain an Apps Script gateway.");
assert(!runtime.includes("Google Sheet"),"Runtime metadata must not describe Sheets as persistence.");
for(const [name,source] of [["enrichDb",enrichDb],["enrichConfig",enrichConfig],["commuteDb",commuteDb]]){
  for(const legacy of ["script.google.com","enqueueTask","queueBackup","raven_tasks","upsertJobsFromCandidates"]){
    assert(!source.includes(legacy),name+" must not carry legacy persistence/task code: "+legacy);
  }
}

for(const name of ["raven-data-v1","raven-backup-v1","raven-search","raven-search-v2","raven-tasks-v1"]){
  const source=fs.readFileSync(new URL("../supabase/functions/"+name+"/index.ts",import.meta.url),"utf8");
  assert(source.includes("retired"),name+" must remain an explicit retired stub.");
}

console.log("Single-source-of-truth regression tests passed");
