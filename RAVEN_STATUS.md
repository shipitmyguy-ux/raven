# Raven Status

Last normalized: 2026-09-20

## Scope
Raven is a web-based job application tracker and application-assistant project.
iOS and Android work are currently excluded.
Final employer submission remains manual and requires user review.

## Canonical systems
- Code/project state: GitHub `shipitmyguy-ux/raven`
- Live application/job data: Supabase
- Public UI/runtime defaults: `runtime-config.json`
- Job-search defaults: `job-search-config.json`
- Google Sheets: backup/export role only

## Verified production baseline
- Reusable core refactor is merged to `main`.
- Application Assistant hardening is merged to `main`.
- GitHub Pages deployment and reusable-core/browser regressions passed after the latest frontend fix.
- Supabase `raven-backend-v3` is ACTIVE at version 21 after the ATS CSV parser fix.
- Search/generation paths retain bounded result/byte/time limits; the Greenhouse repair did not increase ATS scan limits.

## Application Assistant state
Implemented and browser-regression tested:
- exact resume and cover-letter approval gating,
- regeneration/revision invalidates approval,
- Application Profile contact/address fields,
- local Answer Memory UI for reusable non-sensitive answers,
- sensitive/legal/demographic/attestation/salary/sponsorship/CAPTCHA/assessment blocking,
- host-scoped, single-use, expiring application packets,
- initial Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic adapter rules,
- conservative application-completion handoff,
- final employer submission remains manual.

Still requires real employer-site verification:
- approved resume/cover-letter file attachment behavior,
- adapter selectors across current ATS variants,
- completion detection on real confirmation pages,
- full frontend -> generation -> persistence -> application-assistant smoke flow.

## ATS ingestion repair
Root cause of the Greenhouse overflow-card bug was CSV record framing: quoted multiline job descriptions were split on raw newlines before CSV quoting was respected.

Production safeguards now:
- quoted multiline ATS CSV records are parsed as one record,
- ATS candidates require a normal single-line title and HTTP(S) URL,
- the frontend rejects malformed ATS rows before rendering,
- regression coverage includes a multiline Greenhouse-style description.

Observed before the fix:
- `raven_jobs`: 81 Greenhouse rows; 68 had non-HTTP URLs and were malformed.
- `raven_search_results`: 83 Greenhouse rows; 69 had non-HTTP URLs and were malformed.
- valid Greenhouse rows were distinguishable by normal HTTP(S) job URLs.

The malformed legacy rows were not physically deleted from Supabase during this session. They are filtered out of Raven and the backend prevents the same parser failure from creating new rows.

## Highest-priority unfinished work
1. Run real-site Application Assistant tests on Greenhouse, Lever, and Ashby, then Workday/iCIMS/Taleo where practical.
2. Verify approved document upload on employer file inputs without changing the approved version.
3. Run full frontend/generation/persistence/application-assistant smoke tests.
4. Audit job-description completeness and canonical-source resolution across every Raven tab.
5. Verify quick/deep search persistence, deduplication, and source health end to end.
6. Clean legacy malformed ATS rows from storage with a narrowly scoped, verified cleanup path.
7. Add server-side request budgets/rate limits and a circuit breaker if Raven's workload grows substantially.

## Important verification boundary
A feature is not considered complete merely because code is deployed or a request is queued.
For document generation, successful verification still requires a real generated output attached to the correct job and surviving refresh.
For employer application assistance, final submission is never automated.
