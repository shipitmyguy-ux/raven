import fs from "node:fs/promises";
import { verifyBackup } from "./raven-backup-lib.mjs";

const file=process.argv[2];
if(!file) throw new Error("Usage: node scripts/verify-raven-backup.mjs <backup.json>");
const backup=JSON.parse(await fs.readFile(file,"utf8"));
verifyBackup(backup);
console.log("Valid Raven backup");
console.log("Created: "+backup.createdAt);
console.log("Scope: "+backup.scope);
console.log("Rows: "+backup.manifest.totalRows);
console.log("SHA-256: "+backup.manifest.payloadSha256);
