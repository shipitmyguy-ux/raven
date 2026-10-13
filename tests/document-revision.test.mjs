import {test} from "node:test";
import assert from "node:assert/strict";
import {revisionSection,summaryRange,applySummaryRevision} from "../document-revision.mjs";

test("summary requests use a narrow scope while multi-section and whole edits remain whole",()=>{
  for(const request of ["Rewrite only the summary in a cat voice.","Only edit my professional summary to emphasize leadership experience.","Make the summary shorter.","Summary only: make it formal. Keep all bullets unchanged.","Make the summary punchy; don't change skills or experience."])
    assert.equal(revisionSection("resume",request),"summary",request);
  for(const request of ["Make the whole resume punchy, especially the summary.","Rewrite the summary and experience.","Update skills.","Don't change the summary. Rewrite the bullets.","Change not just the summary but skills too.","Make it formal."])
    assert.equal(revisionSection("resume",request),"",request);
  assert.equal(revisionSection("coverLetter","Rewrite only the summary"),"");
});
test("summary patch preserves every byte outside its content, including legacy formatting and contact links",()=>{
  const before='<!doctype html><html><head><style>.summary{color:blue}</style></head><body><h1>Name</h1><a href="https://example.com">Portfolio</a><p class="summary">Old <em>summary</em>.</p><ul><li>Exact existing bullet.</li></ul></body></html>';
  const range=summaryRange(before),text='New & grounded "summary".';
  const after=applySummaryRevision(before,text);
  assert.equal(after,before.slice(0,range.start)+'New &amp; grounded &quot;summary&quot;.'+before.slice(range.end));
  assert.throws(()=>applySummaryRevision(before,""),/incomplete/);
  assert.throws(()=>applySummaryRevision(before,"x".repeat(1601)),/incomplete/);
  assert.throws(()=>applySummaryRevision('<p>No summary here.</p>',text),/no unique/);
  assert.throws(()=>applySummaryRevision(before+'<p class="summary">Duplicate</p>',text),/no unique/);
});
