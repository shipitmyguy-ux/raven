import assert from "node:assert/strict";
import fs from "node:fs";

const search=fs.readFileSync("supabase/functions/raven-backend-v3/search.ts","utf8");
const sources=fs.readFileSync("supabase/functions/raven-backend-v3/sources.ts","utf8");

assert.match(search,/listResults/,"quick search must be able to preserve cached rows");
assert.match(search,/if\(!rows\.length\)/,"zero-result quick refresh must use cached discovery data");
assert.match(search,/atsWide\(track,true\),6500/,"quick ATS work must have a bounded deadline");
assert.match(search,/linkedinDeep\(track,4\)/,"deep LinkedIn work must stay bounded");
assert.match(search,/jobicy\(track,3\)/,"deep Jobicy work must stay bounded");
assert.match(search,/himalayas\(track,3\)/,"deep Himalayas work must stay bounded");
assert.ok(!/const enriched=await enrichRows\(rows\)/.test(search),"deep search must not block on per-job page enrichment");

assert.match(sources,/maxLines=quick \? 2200 : 3500/,"ATS CSV scan lines must be bounded");
assert.match(sources,/maxBytes=quick \? 2\*1024\*1024 : 4\*1024\*1024/,"ATS CSV bytes must be bounded");
assert.match(sources,/const sources=quick \? ATS_SOURCES\.slice\(0,4\) : ATS_SOURCES/,"quick ATS refresh must use a bounded provider subset");
assert.match(sources,/const maxRows=quick \? 100 : 240/,"quick ATS candidate volume must be bounded");

console.log("search resilience tests passed");
