import assert from "node:assert/strict";
import fs from "node:fs";

const control=fs.readFileSync("supabase/functions/raven-control-v1/index.ts","utf8");
const api=fs.readFileSync("raven-api.js","utf8");
const html=fs.readFileSync("index.html","utf8");

assert.ok(control.includes("ALLOWED_ORIGINS"));
assert.ok(!control.includes('"Access-Control-Allow-Origin": "*"'));
assert.ok(control.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!control.includes('SUPABASE_ANON_KEY'));
assert.ok(control.includes('JSON.stringify({action,status,detail})'));
assert.ok(control.includes('backend("search",{track})'));
assert.ok(control.includes('backend("runAtsDiagnostics",{track})'));
assert.ok(control.includes('backend("repairDescriptions",{track,limit,offset})'));
assert.ok(control.includes('backend("smokeAts",{track})'));
assert.ok(control.includes('Origin not allowed'));
assert.ok(control.includes('Policy/config writes require authenticated admin access'));
assert.ok(control.includes('Employer submission is not a supported control-plane action'));

for(const method of ["controlHealth","getControlConfig","getControlEvents","refreshAllControl","runSourceDiagnostics","repairDescriptionsControl","smokeAts"]){
  assert.ok(api.includes(method+"("),method+" must exist in RavenAPI");
}
assert.ok(api.includes('"x-raven-client": "raven-web-v1"'));
assert.ok(html.includes('data-options-panel="control-panel"'));
assert.ok(!html.match(/submitApplication|employerSubmit/i));

console.log("control-plane safeguards passed");
