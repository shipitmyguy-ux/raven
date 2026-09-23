import assert from "node:assert/strict";
import fs from "node:fs";

const enrich=fs.readFileSync("supabase/functions/raven-backend-v3/enrich.ts","utf8");
const db=fs.readFileSync("supabase/functions/raven-backend-v3/db.ts","utf8");
const search=fs.readFileSync("supabase/functions/raven-backend-v3/search.ts","utf8");
const sources=fs.readFileSync("supabase/functions/raven-backend-v3/sources.ts","utf8");

assert.match(enrich,/api(?:\.eu)?\.lever\.co/,"Lever enrichment must use the public postings API");
assert.match(enrich,/descriptionPlain/,"Lever enrichment must consume posting description text");
assert.match(enrich,/lists\.map/,"Lever enrichment must include structured requirement/benefit lists");
assert.match(db,/closeStaleRuns/,"search runs need stale-run recovery");
assert.match(db,/stale background search automatically closed/,"stale run closure must be explicit");
assert.match(search,/linkedinDeep\(track,4\)/,"deep LinkedIn work must be tightly bounded");
assert.match(search,/jobicy\(track,3\)/,"deep Jobicy work must be tightly bounded");
assert.match(sources,/maxLines=quick \? 2200 : 3500/,"deep ATS lines must remain bounded");
assert.match(sources,/maxBytes=quick \? 2\*1024\*1024 : 4\*1024\*1024/,"deep ATS bytes must remain bounded");
console.log("final closeout tests passed");
