# Raven Work Handoff

Last updated: 2026-09-23

## Current handoff

Raven's core runtime/backend closeout is complete and no longer depends on ChatGPT Work. Normal operation is Raven UI -> Supabase/backend; GitHub is used for source changes. Direct tools should be preferred; do not invoke Jules unless a direct workflow cannot reasonably complete the change.

### Verified in the final closeout
- PR #41 merged search-resilience changes; `raven-backend-v3` was deployed and later advanced to v39.
- PR #42 merged complete regression/secret/deployment automation.
- PR #43 merged final closeout reliability: Lever posting-detail enrichment, stale deep-run recovery, tighter deep-search bounds, and automatic production smoke on every main push.
- Latest quick refresh returned valid results for every track.
- Latest deep pass completed: Professional 67, Labor 78, Wildcard 48, Games / 3D 9.
- Seven previously blank Lever saved-job descriptions were repaired in production.
- The obsolete `JT-TEST-001` integration-test row was removed; only Twin Atlas remains short because its public careers page has no detailed posting text.
- Disposable production QA verified add -> status/document update -> fresh jobs read persistence, then the QA row was deleted.
- Live resume/cover-letter generator acceptance passed 8/8 requests across the four tracks.
- Backend health is healthy with 0 active failures.
- Repository secret scan, core tests, targeted browser tests, main-branch tests, and automatic production smoke pass.
- Device-local backup/restore already covers profile, answer memory, preferences, approvals, viewed state, master-resume metadata, and IndexedDB master-resume files.

### What still genuinely needs outside interaction
1. Open Raven in a real browser, generate a fresh resume and cover letter on a real saved job, review them, refresh the browser, and visually confirm the same documents remain attached to that job.
2. Exercise Application Assistant/extension against live employer pages (Greenhouse/Lever/Ashby first, then Workday/iCIMS/Taleo and aggregator pages) to validate current selectors, approved-file attachment, and conservative completion detection.
3. Decide whether Raven should additionally write generated documents to Google Drive. Current Raven persistence is independent of Drive.

### Future roadmap, not closeout blockers
- Contacts/interviews/follow-ups.
- Optional email status matching.
- Outcome analytics.
- Supported-requirement coverage instead of opaque scores.
- Additional direct ATS adapters/employer registry where coverage value justifies maintenance.
- Optional immutable original-posting snapshots.

## Safety / operating rules
- Final employer submission remains manual.
- Never claim a feature is verified only because code deployed; use the production checks above.
- Keep secrets out of GitHub/frontend JavaScript.
- Prefer direct GitHub/Supabase tooling over Jules; use Jules only when absolutely necessary.
