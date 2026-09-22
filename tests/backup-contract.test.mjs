import assert from "node:assert/strict";
import { buildBackup, chunkRows, tablesForScope, verifyBackup } from "../scripts/raven-backup-lib.mjs";

const tables={
  raven_jobs:[{id:"a",url:"https://example.com/a"},{id:"b",url:"https://example.com/b"}],
  raven_bookmark_keys:[{key_hash:"hash"}],
  raven_bookmark_urls:[{url:"https://example.com/a",job_id:"a"}]
};
const backup=buildBackup({createdAt:"2026-09-22T00:00:00.000Z",projectRef:"test",scope:"core",tables});
assert.equal(verifyBackup(backup),true);
assert.equal(backup.manifest.totalRows,4);

const tampered=structuredClone(backup);
tampered.tables.raven_jobs[0].id="changed";
assert.throws(()=>verifyBackup(tampered),/checksum/i);

const rows=Array.from({length:601},(_,i)=>({id:i,text:"x".repeat(200)}));
const chunks=chunkRows(rows,100_000,250);
assert.equal(chunks.flat().length,rows.length);
assert.ok(chunks.every(chunk=>chunk.length<=250));

const core=tablesForScope("core").map(t=>t.name);
assert.deepEqual(core,["raven_jobs","raven_bookmark_keys","raven_bookmark_urls"]);
assert.ok(!tablesForScope("full").find(t=>t.name==="raven_request_events").restoreable);

console.log("Raven backup contract tests passed");
