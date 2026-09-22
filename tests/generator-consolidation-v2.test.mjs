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
assert.match(resume,/r\.status!==429&&r\.status<500/,"Resume generator must fall through to the alternate provider endpoint on 429/5xx.");
assert.match(cover,/r\.status!==429&&r\.status<500/,"Cover generator must fall through to the alternate provider endpoint on 429/5xx.");
assert.match(resume,/RAVEN_GEMINI_FALLBACK_MODEL/,"Resume generator must support a fallback Gemini model.");
assert.match(cover,/RAVEN_GEMINI_FALLBACK_MODEL/,"Cover generator must support a fallback Gemini model.");
assert.match(resume,/model:generated\.model/,"Resume response must report the model actually used.");
assert.match(cover,/model:generated\.model/,"Cover response must report the model actually used.");
for(const src of [resume,cover]){
  assert.match(src,/x-raven-client/,"Generator routes must require the Raven client header.");
  assert.doesNotMatch(src,/\|\|req\.method===[\"']GET[\"']/,"GET health routes must not bypass client authentication.");
}
assert.doesNotMatch(resume,/headline:"[^"]*Customer Success/i);
assert.doesNotMatch(resume,/HVAC|facility maintenance|mechanical upkeep/i);
assert.doesNotMatch(cover,/HVAC|facility maintenance|mechanical upkeep/i);
assert.doesNotMatch(resume,/17 years of professional game-development experience|coffee makers used on Boeing 747 and 737 aircraft/,"Resume summaries must not hard-code candidate facts outside canonical selection.");
assert.match(resume,/location:clean\(e\.location/);
assert.match(resume,/Do not imply direct customer-success, account-management, SaaS, or implementation experience/);
assert.doesNotMatch(cover,/My background (?:is centered|combines)/,"Cover-letter narrative must not hard-code candidate claims outside selected canonical facts.");

for(const src of [resume,cover]){
  assert.doesNotMatch(src,/FACT-(?:REQ|RES|EXP|EDU)-/);
}

console.log("generator consolidation v2 tests passed");
