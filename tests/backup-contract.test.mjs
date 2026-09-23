import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildBackup, chunkRows, tablesForScope, verifyBackup } from "../scripts/raven-backup-lib.mjs";

const tables={
  raven_jobs:[{id:"a",url:"https://example.com/a"},{id:"b",url:"https://example.com/b"}],
  raven_job_events:[{id:"event-1",job_id:"a",event_type:"applied"}],
  raven_job_snapshots:[{id:"snapshot-1",job_id:"a",snapshot_type:"application"}],
  raven_bookmark_keys:[{key_hash:"hash"}],
  raven_bookmark_urls:[{url:"https://example.com/a",job_id:"a"}]
};
const backup=buildBackup({createdAt:"2026-09-22T00:00:00.000Z",projectRef:"test",scope:"core",tables});
assert.equal(verifyBackup(backup),true);
assert.equal(backup.manifest.totalRows,6);

const tampered=structuredClone(backup);
tampered.tables.raven_jobs[0].id="changed";
assert.throws(()=>verifyBackup(tampered),/checksum/i);

const rows=Array.from({length:601},(_,i)=>({id:i,text:"x".repeat(200)}));
const chunks=chunkRows(rows,100_000,250);
assert.equal(chunks.flat().length,rows.length);
assert.ok(chunks.every(chunk=>chunk.length<=250));

const core=tablesForScope("core").map(t=>t.name);
assert.deepEqual(core,["raven_jobs","raven_job_events","raven_job_snapshots","raven_bookmark_keys","raven_bookmark_urls"]);
assert.ok(!tablesForScope("full").find(t=>t.name==="raven_request_events").restoreable);

const dir=mkdtempSync(join(tmpdir(),"raven-backup-test-"));
const file=join(dir,"backup.json");
writeFileSync(file,JSON.stringify(backup));

const verify=spawnSync(process.execPath,["scripts/verify-raven-backup.mjs",file],{encoding:"utf8"});
assert.equal(verify.status,0,verify.stderr);
assert.match(verify.stdout,/Valid Raven backup/);

const dryRun=spawnSync(process.execPath,["scripts/restore-raven.mjs",file],{encoding:"utf8"});
assert.equal(dryRun.status,0,dryRun.stderr);
assert.match(dryRun.stdout,/DRY RUN/);
assert.match(dryRun.stdout,/Dry run only/);

const guarded=spawnSync(process.execPath,["scripts/restore-raven.mjs",file,"--apply","--replace"],{
  encoding:"utf8",
  env:{...process.env,RAVEN_RESTORE_CONFIRM:""}
});
assert.notEqual(guarded.status,0);
assert.match(guarded.stderr,/RAVEN_RESTORE_CONFIRM=RESTORE_RAVEN/);

console.log("Raven backup contract tests passed");
