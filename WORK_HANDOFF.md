# Raven execution handoff

Updated: 2026-09-28 UTC

User asked to fix the remaining document issues. Existing authorization covers verified candidate/job data through Cloudflare and free OpenRouter. Preserve saved documents and keep employer submissions manual.

## Summary-only repair verified (2026-09-28 UTC)
- Live code: commit 172c7bd3796415fff34b45f900a8da8723b1629c, app.js v62, resume v104, cover v77, gateway v24, grounded-llm-v4. Summary edits now return a grounded patch; frontend replaces only the saved summary content. Every byte outside it remains unchanged. No document migration is required.
- Two real summary-only revisions succeeded: formal 16.0s and playful/cat 16.4s, both through the existing free OpenRouter fallback with two provider attempts and no source-fact fallback. These two checks do not establish Cloudflare-specific summary reliability. Earlier Cloudflare initial/cover results remain historical evidence.
- 50 focused execution tests, all 19 core regression files, syntax and secret scan pass. Commit 172c7bd passed Reusable core tests (36423786232), full Browser regression (36423786231), Pages deployment (36423786064), and both Production Smoke runs (36423786307 / 36423827738).
- Real persistence: created one disposable Raven QA job, saved prior live-model resume/cover HTML, changed only its summary using the new live patch, and read both documents back through fresh backend requests. Exact revised resume and unchanged cover matched. Existing user document values were compared before/after and all were unchanged. Direct database read confirmed the patch. The exact QA row was then deleted.
- Production UI loaded the QA job and restored the revised document URL after full reload and completed backend sync. This cloud browser blocks data-URL iframe previews under its organization policy; visual browser-preview acceptance is therefore limited. CI browser preview/save/reload checks passed.
- Fresh PDF check used the production HTML renderer with the prior live-model resume/cover and new formal summary. WeasyPrint output was two resume pages and one cover page; rendered pages were visually inspected with no clipping or overlap. This checks the HTML/PDF layout, not a fresh Chrome print-dialog export. Local Chrome execution was blocked by environment socket permissions; no protection was bypassed.
- No saved user document was overwritten or approved, and no application was submitted. Free-plan validation, zero-price routing, request quotas, provider circuits and the two-call ceiling remain intact.

Current scope: narrow edits are enforced for resume summaries. Multi-section and whole-document requests continue through the full writer; other individual sections do not yet have a surgical patch path. Employer-site extension acceptance and optional future ChatGPT handoff work are separate backlog items.

## Shipped-title spelling (2026-09-28)
- User reported Darksiders rendered as Darksiers. Exact-title checking missed the typo. Shared writer now rejects one-edit near misses of distinctive single-word verified shipped titles and uses normal bounded repair.
- Regression test 23/23 passed. Published GitHub changes c631719/f96d74c through the connected GitHub app after local git push lacked credentials. Deployed Supabase resume v105 and cover v78; both bundles contain the guard and are ACTIVE. Resume health GET returned ok. Existing saved documents remain unchanged; a real-model reproduction of the typo was not run.
