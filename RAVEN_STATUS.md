# Raven Status

Last normalized: 2026-09-23

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
- `raven-backend-v3`: ACTIVE v39
- `raven-enrich-v1`: ACTIVE v6
- `raven-commute-v1`: ACTIVE v5
- `raven-generate-v1`: ACTIVE v18
- `raven-generate-v2`: ACTIVE v8
- `raven-cover-v2`: ACTIVE v7
- `raven-control-v1`: ACTIVE v2
- `raven-bookmark-v1`: ACTIVE v2

## Verified production baseline
- GitHub `main` is canonical source.
- Supabase is the single live Raven data source.
- Saved-job read/add/update and search use `raven-backend-v3`.
- Tabs are filters; refresh searches all four tracks through one shared path.
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
1. Human-visible live Raven UI generation -> review -> browser refresh on a real saved job, confirming the freshly generated documents remain attached to the intended job.
2. Real employer-site Application Assistant/extension verification, including file inputs and completion detection.
3. Decide whether Google Drive persistence for generated documents is desired; current Raven document persistence does not require Drive.

Everything else still listed in `TASKS.md` is either a continuing quality improvement or future product expansion rather than a current runtime/merge blocker.
