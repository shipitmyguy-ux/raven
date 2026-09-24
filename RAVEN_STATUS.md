# Raven Status

Last normalized: 2026-09-24

## Scope
Raven is a web-based job application tracker and application-assistant project. iOS and Android work are excluded. Final employer submission remains manual and requires user review.

## Canonical systems
- Code/project state: GitHub `shipitmyguy-ux/raven`
- Live application/job data: Supabase
- Public UI/runtime defaults: `runtime-config.json`
- Job-search defaults: `job-search-config.json`
- Portable backup/recovery: checksum-verified JSON via `scripts/export-raven.mjs` / `scripts/restore-raven.mjs`
- Device-local recovery: Raven Options -> Device backup
- Google Sheets: retired

## Active production services
- `raven-backend-v3`: ACTIVE v47
- `raven-enrich-v1`: ACTIVE v6
- `raven-commute-v1`: ACTIVE v5
- `raven-generate-v1`: ACTIVE v20
- `raven-generate-v2`: ACTIVE v21
- `raven-cover-v2`: ACTIVE v16
- `raven-control-v1`: ACTIVE v2
- `raven-bookmark-v1`: ACTIVE v2

## Verified production baseline
- GitHub `main` is canonical source.
- Supabase is the single live Raven data source.
- Saved-job read/add/update and search use `raven-backend-v3`.
- Tabs are filters; refresh searches all four tracks through one shared path.
- Remote classification is evidence-backed and shared across all tracks. A remote-search query is not itself remote evidence; LinkedIn roles are remote only when the posting/location explicitly says remote, while remote-only boards and structured ATS/workplace fields remain valid evidence.
- Quick refresh is resource-bounded and preserves cached results during transient provider droughts.
- Deep search is resource-bounded; stale background runs are automatically closed.
- Latest production deep pass completed on all four tracks: Professional 67, Labor 78, Wildcard 48, Games / 3D 9.
- Backend health reports healthy: 18 tracked tasks, 0 active failures, 2 expected manual blockers, 14 historical/legacy records.
- A disposable production persistence QA job verified add -> status/document update -> fresh jobs read; the QA row was removed afterward.
- Generator acceptance: resume + cover letter across all four tracks returned 8/8 HTTP 200 responses using canonical fact selection.
- Generation budget/rate-limit behavior is verified.
- The repository secret scan, core regressions, targeted browser tests, and latest production smoke all pass.
- Production smoke runs automatically on each main push and after successful Pages deployment.
- Current malformed ATS saved/search-result counts are zero.

## Description/source quality
- Saved-job description audit is complete.
- Seven previously blank Lever postings were repaired through Lever's public posting-detail API and now contain multi-thousand-character descriptions.
- One saved Twin Atlas Environment Artist row remains short because the public careers page exposes the opening and location but no detailed job description.
- LinkedIn guest-page, Lever API, schema.org/JobPosting, visible-content, and metadata enrichment paths are available.
- Source diagnostics are stored in `raven_source_diagnostics` and surfaced through the control plane.

## Application Assistant
Implemented and browser-regression tested:
- exact resume/cover-letter approval gating,
- regeneration/revision invalidates approval,
- Application Profile and reusable non-sensitive Answer Memory,
- sensitive/legal/demographic/attestation/salary/sponsorship/CAPTCHA/assessment blocking,
- host-scoped, single-use, expiring application packets,
- Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic adapter rules,
- conservative completion handoff,
- final employer submission remains manual.

Still requires real employer-site verification:
- approved resume/cover-letter attachment on current employer forms,
- adapter selectors against current live variants,
- completion detection on real confirmation pages,
- extension import on current LinkedIn/Indeed/Glassdoor/Monster and representative ATS pages.

## Post-application lifecycle
- Shared lifecycle transitions now use one frontend persistence path rather than separate bookmark/applied/ignore implementations.
- Applied jobs receive a configurable default follow-up date using the existing persisted `follow_up` field; the initial default is 7 days and can be edited from the job detail.
- Interview, Offer, Rejected, and Ignored are handled through the same lifecycle control. Rejected now has a proper pipeline bucket.
- Post-application stages suppress the old re-apply/bookmark controls that could otherwise move jobs backward accidentally.
- Strong browser-extension application completion signals route through the same lifecycle transition logic.

## Post-application platform
- `raven_job_events` is the shared timeline for lifecycle changes, recruiter contacts, follow-ups, assessments, interview activity, offers, rejections, notes, and external signals.
- `raven_job_snapshots` captures immutable application-time job/document state. Browser roles have no direct access; snapshots are service-role readable/insertable/deletable but not updateable.
- Applied jobs create an application snapshot automatically through the shared backend transition path.
- Interview mode surfaces the application snapshot, submitted documents, original posting, and activity timeline.
- Manual activity and future external adapters use the same signal/event path. High-confidence signals can advance lifecycle state; lower-confidence signals remain reviewable suggestions.
- Outcome analytics are derived from jobs + lifecycle events instead of maintained counters, with current breakdowns by source and track.
- Durable Raven backups now include lifecycle events and application snapshots.
- `raven-backend-v3` production v40 contains the shared transition, event, snapshot, signal, and analytics endpoints.

## Evidence coverage and outcome learning
- Expanded saved jobs now show deterministic verified-evidence coverage rather than a user-facing opaque fit score.
- Posting requirement candidates are compared only against the canonical skills/fact catalog and reported as supported, partial, or missing evidence; missing evidence is never rewritten into a qualification.
- Outcome analytics now include stable submitted-resume variants derived from the immutable application snapshot, in addition to source and track.
- Search ranking scores remain internal discovery signals and are not presented as candidate-quality judgments.
- Responsive regression coverage now exercises mobile, tablet, laptop, and desktop widths.
- Production `raven-backend-v3` v41 includes the evidence-coverage and resume-variant analytics endpoints.

## Backup / recovery
- `npm run backup:raven` creates the durable Supabase snapshot.
- `npm run backup:raven -- --scope=full` includes operational/audit history.
- Exports contain per-table and whole-payload SHA-256 checksums.
- Restore defaults to dry-run; destructive replace is explicitly confirmation-gated.
- `docs/BACKUP_RESTORE.md` documents the procedure.
- Device backup/restore exports/restores the relevant localStorage state plus local master-resume files stored in IndexedDB.

## Remaining closeout blockers
1. Real employer-site Application Assistant/extension verification, including file inputs and completion detection.
2. Decide whether Google Drive persistence for generated documents is desired; current Raven document persistence does not require Drive.

Everything else still listed in `TASKS.md` is either a continuing quality improvement or future product expansion rather than a current runtime/merge blocker.

## Job-card and generator repair (2026-09-23)
- Deployed 8c2dfe6 / e012c57: expanded cards expose View listing and Apply on site independently of document approvals; the assisted document-transfer action retains exact-file approval gating.
- Generation saves discovery results before invoking either generator and retrieves missing descriptions through the existing enrichment API. Concurrent preparation is shared; empty/expired descriptions produce actionable errors.
- Live browser verification: Akima Intermediate 3D Artist initially failed with missing-description errors in both generators. After deployment the job saved, its description populated, both documents generated with visible review previews, and both reopened after a full page refresh and completed backend synchronization.
- No document approval or employer submission was performed.
- Local syntax/focused execution checks passed. GitHub core regressions, targeted browser regressions (including the new discovery persistence and direct-link cases), Pages deploy, and both production smoke runs passed for e012c57.


## Natural document writing (2026-09-24)
- Replaced fact-selection/sentence-template generation with Gemini-authored prose from the complete verified candidate profile and posting, followed by a factual check and at most one repair.
- User chose the existing Gemini connection; no OpenAI API key or billing setup is required.
- Resume revisions now forward both the instructions and current document. Candidate identity/employment metadata remain canonical; failed drafts do not replace saved documents.
- Published code 538742ea9520a6a6be800d2771b38c70d806c5e2 with app.js v43 and modern-v5 document cache. All 16 mocked writer/handler tests, core/browser CI, Pages deployment and both production smoke runs passed.
- Live Akima and Campminder generation, natural-language revision, preview and saved-document reload checks passed. Final Campminder resume/cover used the source-reference gate; an invalid employer attribution was rejected without replacing the prior draft. Supabase persistence was also read back directly.
- Prior all-four-track generator acceptance above describes the previous engine. Current live prose checks cover these two real jobs; model factual review is not a guarantee, and drafts still require user review. No documents were approved or submitted.
- See docs/DOCUMENT_WRITING.md for the reuse evaluation, implementation, boundaries and acceptance procedure.
