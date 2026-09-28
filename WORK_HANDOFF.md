# Raven execution handoff

Updated: 2026-09-28 UTC

User asked to fix the remaining document issues. Existing authorization covers real candidate/job data through Cloudflare and free OpenRouter. Do not overwrite saved user documents or submit applications.


## Summary-only repair (2026-09-28 UTC)
- Resume v104, cover v77, and gateway v24 deployed with the grounded-llm-v4 writer. Frontend app.js v62 recognizes summary edits and applies only a validated summary patch to saved HTML.
- Every byte outside the summary content is preserved. Existing saved resume formatting and text need no migration; malformed legacy documents fail clearly without a full rewrite. Whole-document revisions remain supported.
- Local core regression files (19) and secret scan pass. New tests cover narrow output schemas, grounded repair, unsupported claims, exact HTML preservation, mismatched responses, approval invalidation and save/reload.
- First live formal summary revision returned a grounded patch via the free OpenRouter route in 16.0 seconds. Saved user documents remain unchanged. Browser CI, further live output checks, isolated persistence and PDF layout verification are still underway.

Next: check CI on this source commit, finish isolated production persistence and PDF checks, then record exact results. The local Chrome process is blocked by socket permissions; CI provides browser execution. No rate guard, provider circuit, free-plan check, or zero-price cap was disabled.
