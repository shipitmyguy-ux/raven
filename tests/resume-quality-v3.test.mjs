import assert from "node:assert/strict";
import fs from "node:fs";
const writer=fs.readFileSync("supabase/functions/_shared/document-writer.mjs","utf8");
const app=fs.readFileSync("app.js","utf8");
const workflow=fs.readFileSync(".github/workflows/test.yml","utf8");
// Execution-level grounding, context and repair cases live in document-writer.test.mjs.
assert.match(writer,/verifiedBackground:profile/,"The writer needs the whole candidate profile, not a preselected fact subset.");
assert.doesNotMatch(writer,/supportedSummary|headlineForTrack|Examples that may transfer/,"Final prose must not use the retired sentence templates.");
assert.match(app,/RESUME_TEMPLATE_VERSION="modern-v6"/,"New writing must invalidate old generation cache.");
assert.match(app,/>Career Highlights<\/h2>/);
assert.match(workflow,/supabase\/functions\/_shared\/\*\*/);
assert.match(workflow,/node tests\/document-writer\.test\.mjs/);
console.log("Resume writing integration contract passed");
