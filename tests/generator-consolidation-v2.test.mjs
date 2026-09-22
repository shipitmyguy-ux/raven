import assert from "node:assert/strict";
import fs from "node:fs";

const router=fs.readFileSync(new URL("../supabase/functions/raven-generate-v1/index.ts",import.meta.url),"utf8");
const resume=fs.readFileSync(new URL("../supabase/functions/raven-generate-v2/index.ts",import.meta.url),"utf8");
const cover=fs.readFileSync(new URL("../supabase/functions/raven-cover-v2/index.ts",import.meta.url),"utf8");

assert.match(router,/version:17/);
assert.match(router,/raven-generate-v2/);
assert.match(router,/raven-cover-v2/);
assert.match(router,/x-raven-client/);

assert.match(resume,/raven_canonical_profiles/);
assert.match(cover,/raven_canonical_profiles/);
assert.match(resume,/p_short_limit:12/);
assert.match(cover,/p_short_limit:12/);
for(const src of [resume,cover]){
  assert.match(src,/x-raven-client/,"Generator routes must require the Raven client header.");
  assert.doesNotMatch(src,/\|\|req\.method===[\"']GET[\"']/,"GET health routes must not bypass client authentication.");
}
assert.doesNotMatch(resume,/headline:"[^"]*Customer Success/i);
assert.doesNotMatch(resume,/HVAC|facility maintenance|mechanical upkeep/i);
assert.doesNotMatch(cover,/HVAC|facility maintenance|mechanical upkeep/i);
assert.match(resume,/coffee makers used on Boeing 747 and 737 aircraft/);
assert.match(resume,/location:clean\(e\.location/);
assert.match(resume,/Do not imply direct customer-success, account-management, SaaS, or implementation experience/);

for(const src of [resume,cover]){
  assert.doesNotMatch(src,/FACT-(?:REQ|RES|EXP|EDU)-/);
}

console.log("generator consolidation v2 tests passed");
