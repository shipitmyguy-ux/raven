# Raven execution handoff

Latest task: Smile-Break resume and manual ChatGPT generation speed (2026-10-06).

## Prompt optimization
- `supabase/functions/_shared/document-handler.mjs` now sends candidate evidence once in compact, minified JSON instead of repeating all experience facts in both a background object and evidence catalog. The prompt includes only posting-matched supported keywords and lists up to two matched must-preserve fact IDs for each required Games / 3D experience. It requires every role, forbids unsupported claims/schema changes, and guides a 375–475 word output.
- `docs/DOCUMENT_WRITING.md`, `RAVEN_STATUS.md`, and `TASKS.md` record the change and verification limits.
- `node --check supabase/functions/_shared/document-handler.mjs` and `git diff --check` pass. No tests were run. Code and prompt-size savings are not deployed or measured against the live endpoint.

## Smile-Break attempt and timing
- Target job: Smile-Break Senior Environment Artist. Current saved record has only a short description in Raven; the public listing was reviewed and used to tailor the one-off prompt. Existing saved resume/status were preserved.
- Clicking Raven's “Create ChatGPT prompt” returned in about 0.42 seconds but the prompt request failed with browser `Failed to fetch`, before ChatGPT opened. Supabase shows the Raven generator functions ACTIVE (proxy v25, downstream v128); logs query returned a backend error, so POST/CORS reachability remains unknown.
- A one-off ChatGPT prompt with verified profile evidence completed in approximately 10 seconds. Its response included malformed output keys and unsupported summary claims. It was not imported or persisted.
- A corrected Raven-format JSON draft is in `Smile-Break-Senior-Environment-Artist.json`. It remains an untracked local artifact and is not verified by Raven or linked to the job. The canonical profile and current saved resume were not changed.
- ChatGPT's public browser session is signed out; the anonymous prompt worked. No credentials were entered. The measured model time is a single run, not an under-10-second guarantee.

## Delivery state
- The current Git checkout is `codex/resume-download-json`; no Git remote is configured in this workspace. Prompt/docs changes were committed as `af4c1db` and pushed directly to `https://github.com/shipitmyguy-ux/raven.git` on that branch, updating PR #55. The user previously authorized pushing updates but not merging/deploying. Keep the local resume JSON out of GitHub; do not merge/deploy without its separate authorization.
- Next useful step: check/repair the deployed generator POST path from the Raven origin, then regenerate from the compact must-preserve prompt, run deterministic manual-import checks, and confirm the saved document survives a fresh Raven read. Do not claim the 10-second goal or Raven persistence until that succeeds.
