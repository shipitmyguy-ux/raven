# Source-confirmed listing closure — 2026-10-08

## Behavior
Availability is stored independently of application status in existing saved/search rows. A confirmed closed search row becomes Expired and disappears from the backend's existing Discovered results. Saved records are retained: closed unapplied jobs appear under the existing archive/ignored grouping, with closure reason tooltip and source check time. Applied, Interview, Offer and Rejected records keep their stage and applied date. Existing saved resume/cover letter review remains accessible; no documents or history are deleted. No Closed tab or recurring schedule is added.

Existing Refresh all jobs and control refresh perform at most five sequential source checks per invocation, skipping checks younger than six hours and known closures. Generation description enrichment also records closure evidence. Transport timeout, blocked/429/5xx, generic 404/410 and missing text remain unconfirmed. Evidence is an explicit job closure notice, matching JobPosting inactive status/past validThrough, or a recognized direct Lever/Greenhouse posting API's explicit not-found response. Unrelated JobPosting expiry does not close the requested job. Source URL/reason/check time/HTTP code are retained; failed rechecks and ingestion cannot erase confirmed closure.

## Verification
- Six Node tests: classification, failed reads, date boundary, ATS endpoint allowlist, preservation-only PATCH bodies, JSON-LD matching and actual enrichment propagation.
- Existing complete core regression suite, syntax, repository secret scan and whitespace checks passed.
- Migration executed against an isolated PGlite PostgreSQL fixture: saved Interview status, applied date, resume and letter survived; search row retained Expired and source reason after ingestion tried to reset it to Discovered; active result query returned zero. This is a real database fixture, not production persistence acceptance.
- Live Supabase schema read confirms target columns/tables; no production schema/data mutations.
- Browser tests cover refresh/reload preservation, closed interview stage and unconfirmed checks. CI acceptance pending when initially published.
- PR62 exports and PR63 containment both have successful core and browser CI. Export visual QA used real DOCX generation plus LibreOffice rendering and WeasyPrint PDF rendering, not native Microsoft Word or browser print acceptance.

## Rollout and integration
Apply migration `20261008_listing_availability.sql` before deploying raven-enrich-v1 and frontend. No deployment performed or independently authorized here. After authorized rollout, confirm a source-closed fixture persists after refresh and the saved document/history UI remains accessible. Legacy Expired rows without evidence are not rewritten en masse. A confirmed closure is retained; reopening is deliberately left to a future explicit source-confirmed mechanism.

Other worker's MCP/plugin checkout was untouched. This branch starts from main, separate from PR62/63. Frontend overlap is limited to app.js/version counters and project docs; reconcile these with other worker changes before merging. Preserve `document-download.mjs?v=2`, applied icon markup and final cache versions when integrating.
