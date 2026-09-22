# Raven Status

Last normalized: 2026-09-22

## Scope
Raven is a web-based job application tracker and application-assistant project.
iOS and Android work are currently excluded.
Final employer submission remains manual and requires user review.

## Canonical systems
- Code/project state: GitHub `shipitmyguy-ux/raven`
- Live application/job data: Supabase
- Public UI/runtime defaults: `runtime-config.json`
- Job-search defaults: `job-search-config.json`
- Portable backup/recovery: private checksum-verified JSON snapshots via `scripts/export-raven.mjs` / `scripts/restore-raven.mjs`
- Google Sheets: retired

## Verified production baseline
- GitHub `main` is canonical source.
- Supabase is the single live Raven data source.
- Saved-job read/add/update and search all use `raven-backend-v3`.
- `raven-backend-v3` is ACTIVE at version 33.
- `raven-enrich-v1` is ACTIVE at version 5.
- `raven-commute-v1` is ACTIVE at version 4.
- `raven-generate-v1` is ACTIVE at version 15.
- Legacy data/search/queue/Sheets endpoints are retired or inert.
- Tabs are view filters; Refresh all jobs refreshes every category through one shared search/parse pipeline.
- Request budgets and circuit breakers protect search and Gemini.
- Portable backup/restore tooling is committed and covered by checksum, tamper, dry-run, and destructive-restore guard tests.

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

The malformed ATS rows were subsequently cleaned from production; current malformed ATS job/search-result counts are zero, and persistence guards prevent recurrence.

## Highest-priority unfinished work
1. Run real-site Application Assistant tests on Greenhouse, Lever, and Ashby, then Workday/iCIMS/Taleo where practical.
2. Verify approved document upload on employer file inputs without changing the approved version.
3. Run full frontend/generation/persistence/application-assistant smoke tests.
4. Audit job-description completeness and canonical-source resolution across every Raven tab.
5. Verify quick/deep search persistence, deduplication, and source health end to end.
6. Review repository for accidentally committed secrets.
7. Define recovery for device-local master resumes/profile/answer-memory data if those must survive device loss.

## Backup / recovery
- `npm run backup:raven` creates a core durable-data snapshot.
- `npm run backup:raven -- --scope=full` captures operational/audit history as well.
- Exports include per-table and whole-payload SHA-256 checksums.
- Restore defaults to dry-run.
- Destructive replace requires both `--apply --replace` and `RAVEN_RESTORE_CONFIRM=RESTORE_RAVEN`.
- Audit identity tables are exported for reference but intentionally not replayed.
- Full procedure: `docs/BACKUP_RESTORE.md`.

## Important verification boundary
A feature is not considered complete merely because code is deployed or a request is queued.
For document generation, successful verification still requires a real generated output attached to the correct job and surviving refresh.
For employer application assistance, final submission is never automated.
