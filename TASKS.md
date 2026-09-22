# Raven Tasks

Legend: [ ] open, [x] complete, [~] in progress, [!] blocked / needs verification

## P0 - Core reliability
- [x] Add user-facing Options/Settings panel using existing runtime-config settings.
- [ ] Audit job descriptions across every Raven tab.
- [ ] Fix LinkedIn and other source extraction failures/truncation.
- [ ] Verify source -> parser -> Supabase -> UI ingestion path.
- [ ] Verify "Search jobs now" uses the backend path only.
- [ ] Verify quick/deep search persistence and deduplication.
- [ ] Verify status changes persist after refresh.

## P0 - Documents
- [!] Verify live end-to-end resume generation on a real job, correct job association, and persistence after refresh.
- [!] Verify live end-to-end cover-letter generation on a real job, correct job association, and persistence after refresh.
- [ ] Verify generated files attach to the correct job.
- [ ] Verify generated-file links survive refresh.
- [ ] Add/fix failure, timeout, retry, and stuck-task handling.
- [ ] Ensure generated content uses only verified qualifications.

## P1 - Efficiency
- [~] Replace unnecessary model polling with event/on-demand processing. Frontend timer polling removed; return-to-app refresh now syncs saved jobs only instead of re-running discovery. Backend/automation polling still needs audit.
- [x] Cache reusable inputs/results where practical. Resume generation, CandidateProfile extraction, and deterministic JobAnalysis are merged; generation invalidation has browser regression coverage.
- [~] Keep deterministic processing out of AI paths. Canonical job normalization/fingerprinting moved into `raven-core.js`; continue migration after verification.
- [ ] Review/remove obsolete five-minute polling if no longer needed.

## P1 - Import/search/extension
- [ ] Verify Chrome extension import on LinkedIn, Indeed, Glassdoor, Monster, and similar sites.
- [ ] Improve title/company extraction fallbacks.
- [ ] Prevent duplicate extension/share imports.
- [ ] Ensure imported jobs appear without manual recovery.
- [ ] Preserve source provenance and original URL.

## P1 - Data/backup
- [x] Confirm Supabase remains the single live source of truth.
- [x] Retire Google Sheets as a live write target; any future backup is export-only.
- [ ] Document/verify restore procedure.
- [ ] Verify clean export of Raven data.

## P1 - Drive/doc organization
- [ ] Verify intended Google Drive destination for generated documents.
- [ ] Verify Drive links remain associated with the correct job.

## P2 - UX/testing/operations
- [ ] Audit empty states, counts, filters, sorting, and card/detail layout.
- [ ] Verify desktop layouts at common sizes.
- [ ] Verify dialogs/panels do not break navigation.
- [ ] Add useful backend/frontend error reporting.
- [ ] Add deployment regression checklist.
- [x] Add basic health/status view and Raven Web Control Panel in Options.
- [x] Commit deployed raven-control-v1 source to canonical GitHub repository.
- [x] Remove dead legacy backend/queue/Sheets paths. Keep localStorage only for cache, offline pending sync, application profile/answer memory, and device-local master resumes.
- [ ] Review repository for accidentally committed secrets.

## Production acceptance test
- [ ] Find job
- [ ] Import job
- [ ] Parse full description
- [ ] Persist to Supabase
- [ ] Change application status
- [ ] Generate resume
- [ ] Generate cover letter
- [ ] Review generated docs
- [ ] Refresh
- [ ] Confirm all job/status/document data persists

## P1 - Application automation / safety
- [~] Define structured CandidateProfile schema with source/provenance for verified facts. Local reusable profile extraction exists; provenance/claim validation remains.
- [~] Add ApplicationAnswerVault. Local editable Answer Memory exists for reusable non-sensitive answers; approved AI-drafted open-ended answer workflow remains.
- [ ] Add generated-claim provenance/anti-fabrication validation against CandidateProfile.
- [ ] Preserve immutable original job-posting snapshots separately from enriched descriptions.
- [ ] Improve duplicate detection across LinkedIn/Indeed/employer ATS copies of the same role.
- [~] Application Assistant ATS adapters exist for Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, plus generic fallback; verify against real employer forms and current variants.
- [x] Keep final application Submit behind explicit user action.
- [ ] Define privacy/storage boundaries for personal application data before adding autofill/email features.
- [x] Add browser regression proving document regeneration/revision invalidates exact-document approval.
- [!] Verify approved resume/cover-letter attachment on real employer file inputs; do not mark complete from mocked tests alone.
- [!] Verify conservative application-completion detection on real ATS confirmation pages without false positives.

## P2 - Outcomes / intelligence
- [ ] Add Contact, Interview, and FollowUp entities related to Job/Application.
- [ ] Add optional email-driven application status classification/matching with user-visible corrections.
- [ ] Add outcome analytics by source, role family, resume variant, tailoring, and interview/offer conversion.
- [ ] Replace opaque ATS-style scores with supported-requirement coverage, unsupported requirements, and missing-evidence reporting.

## P1 - ATS-first job acquisition
- [x] Make shared ATS CSV ingestion safe for quoted multiline records and reject malformed ATS rows with non-HTTP(S) URLs.
- [!] Clean legacy malformed ATS rows from Supabase storage; frontend filtering is active and new malformed rows are blocked.
- [ ] Evaluate established ATS adapters/libraries before building additional board-specific scrapers; prototype reuse of ats-scrapers patterns where licensing/dependencies fit Raven.
- [ ] Add direct ATS adapters for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, iCIMS, Oracle, SuccessFactors, ADP, BambooHR, Personio, Recruitee, Breezy, and Teamtailor, prioritized by coverage and reliability.
- [ ] Add generic schema.org/JobPosting JSON-LD extraction for unsupported employer career pages.
- [ ] Treat LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs, Monster, Dice, and niche boards primarily as discovery/provenance sources when a canonical employer/ATS posting is available.
- [ ] Resolve discovered aggregator jobs to canonical employer/ATS postings and enrich missing/truncated metadata from that canonical source.
- [ ] Add browser-extension extraction fallback for job pages the user can view when server-side metadata is incomplete; avoid CAPTCHA/access-control bypass techniques.
- [ ] Add rendered-page extraction only as a final compatibility fallback after structured/API/browser-extension paths fail.
- [ ] Build an employer -> ATS identifier registry so Raven can query employer career systems directly instead of relying only on aggregator search ranking.
- [x] Add source health/coverage telemetry: successful fetches, missing descriptions, stale postings, adapter failures, and canonical-source resolution rate.
- [ ] Extend cross-source dedupe to merge aggregator and ATS copies while retaining every source URL/provenance record.
