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
- `raven-backend-v3`: ACTIVE v48
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
- Games / 3D uses shared hard-eligibility gating before ranking: programmer/programming/engineer/engineering/developer titles and clearly non-English postings are rejected before persistence.
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


## Generate button repair (2026-09-25)
- Reproduced on live app.js v51: a fresh browser fails immediately with "Assign a master resume to this job track first." The handler is bound, but its obsolete device-local prerequisite prevents the request to the canonical-profile service. The brief spinner disappears and the only failure message was in the page header.
- Frontend generation now uses the existing server-side verified profile for both documents, including revisions and forced regeneration. No Work dependency, new service, backend deployment, or user-data migration.
- Errors remain next to the document button; the initial render is now inside the error boundary. Discovery-to-saved ID changes retain the active generation session.
- Local validation: core regression files and secret scan passed after correcting stale assertions from earlier tailoring releases. All 46 browser cases passed across the suite and focused reruns (mocked services, not live model quality).
- Deployed faac83fdce9230b3e33ff7df638d71870694217f through Pages run 36090447165. Core run 36090447168, browser run 36090447429, and production smoke runs 36090447195 / 36090468416 all passed.
- Live v53: Accurx Implementation Analyst regeneration and Omega Junior Digital Assets Operations Analyst Generate both showed progress and produced resume previews. Both reopened with identical preview text after full reload and completed backend sync. No v53 console errors were recorded.

Concurrent main updates a93af28/d89b38f/ff23f8a were reviewed before publication. Live v52 reproduces `DataError: Failed to execute get on IDBObjectStore: No key or key range specified` at getMasterResumeFile -> generateDocumentOnline -> generateForJob. The partial fix defaulted the master to an empty object and then read IndexedDB with an undefined ID. This patch removes that obsolete generation-file read entirely and preserves the concurrent stale-session recovery and preparing status.


## Reliable free generation (2026-09-27)
- Deployed resume v93 and cover v69: initial generation falls back to source facts on provider, validation, rate-limit or budget-service failures. Free AI has a 12-second generation deadline; revisions have 25 seconds and never silently return a fallback. Database/network overhead is additional.
- Production calls use only OpenRouter with its existing zero-price cap; no paid provider fallback.
- Fixed punctuation-sensitive grounding and revision prompt words removing factual anchors; revision instructions no longer exempt invented numbers, tools or entities. Shared checks reject selected unsupported tools, credentials and responsibility/outcome claims; this is not comprehensive semantic verification.
- Four live resumes and four covers returned 8/8 HTTP 200. Five used AI; three used source-fact fallback. Observed total times 3.8–23.3 seconds including cold/network overhead.
- 49 local core tests and secret scan pass. Browser tests could not launch locally: both installed Playwright versions received invalid browser-download archives. Browser persistence/PDF checks are not newly verified.
- Frontend labels fallback output and invalidates older generation cache. Existing failed-revision preservation remains in place.
- User now wants to discuss a low-click manual ChatGPT copy/paste workflow for both documents; not implemented yet.


## Cloudflare preparation and one-button generation (2026-09-27)
- Shared route now prefers Cloudflare, then the existing zero-price OpenRouter route. Cloudflare is gated on a successful account-subscriptions read proving a Workers Free plan; unknown/paid plans send no inference request.
- Actual account check returned HTTP 403, so Cloudflare inference is NOT active or live-quality verified. Existing token needs Billing Read permission (not Write) for the documented subscriptions API. No Cloudflare paid usage or billing change was made.
- Corrected Cloudflare native API request fields: max_tokens and direct JSON schema; configured a fixed supported Llama 3.3 70B model. Resume v95 and cover v70 deployed.
- Added Generate both / Finish documents using the existing generation, persistence, cache and review paths; existing documents are preserved.
- 53 local core tests and secret scan passed. Release a3a4b95 passed core CI, browser regression (including Generate both / Finish documents), Pages deployment and push production smoke. Live index serves app.js v60.
- Previous release e9fbb9a passed core/browser/Pages and both production smoke workflows. Previous live tonal QA: cat, formal, punchy succeeded; goofy failed LLM_CALL_BUDGET_EXHAUSTED; no saved documents overwritten by the API-only checks.


## Cloudflare permission verification (2026-09-28 UTC)
- User enabled Billing Read on the existing Raven token.
- Live authenticated-by-client-header GET raven-generate-v2 at 2026-09-28T04:26:57Z returned cloudflare_free.verified=true, reason=workers_free, primary_provider=cloudflare, provider_order=[cloudflare,openrouter]. No code or billing-plan change was needed.
- End-to-end Cloudflare output remains unverified. The first test artifact reported a network tunnel 403; automatic approval review then blocked further live QA because stored candidate background/job descriptions would be sent to external AI providers. No successful generation was observed in this session. Do not treat health verification as proof of model output.
- Next: obtain explicit approval for sending the verified candidate profile and selected job descriptions through Raven to Cloudflare and the existing free OpenRouter fallback for four document pairs and tonal-revision QA, then execute through an authorized available network path. Preserve saved documents.


## Authorized Cloudflare live QA (2026-09-28 UTC)
- User explicitly approved sending verified candidate background and selected stored job descriptions to Cloudflare and the existing free OpenRouter fallback for four document pairs and revisions. This supersedes the earlier approval blocker.
- API-only checks used Parallel Senior Environment Artist, Stone Kite Staff Environment Artist, VetJobs/Pinnacle Intermediate 3D Artist (location stripped from requested title), and Accurx Implementation Analyst. No saved documents were overwritten or submitted.
- All eight initial requests returned HTTP 200 and document objects. Resumes: 0/4 AI, 4/4 source-fact fallback (INVALID_DRAFT twice, PROVIDER_TIMEOUT once, REQUEST_BUDGET_EXCEEDED once). Covers: 3/4 Cloudflare AI, 1/4 source-fact fallback due to PROVIDER_TIMEOUT. Total observed latency 4.5–17.5 seconds; Cloudflare cover successes 13.3–16.0 seconds.
- Cat-voice revision returned HTTP 429 REQUEST_BUDGET_EXCEEDED with retryAfterSeconds=560 after three resume failures triggered the existing ten-minute circuit. Other three revision requests were not sent during this cooldown; tonal QA remains incomplete. Do not disable safety/budget guards merely to pass QA.
- Supabase request events confirm the two invalid drafts, two provider timeouts (one resume/one cover), and three cover successes. Health verification remains true for Workers Free.
- Cloudflare connectivity is demonstrated by real cover-letter output, but resume AI reliability is NOT accepted. Cover prose also needs editorial review (generic opening/repetition and an unverified personal enthusiasm claim in the Accurx draft); generation success is not editorial approval. Browser persistence/PDF testing was not performed in this API-only pass.
- Next: diagnose invalid-draft validation with bounded diagnostics and address timeout behavior, then rerun resumes and all four tonal revisions after the normal cooldown. User authorization for these provider/data transfers persists.


## Structured writer repair (2026-09-28 UTC, verification underway)
- Live diagnostic on resume v96 confirmed INVALID_DRAFT: wrong number of bullets for Highwire Games. The retired plain-text writer required exact line counts; the inference connection was working.
- Removed the separate initial resume writer. Initial resumes, covers, and revisions now share the structured full-profile writer and evidence validator. Identity, dates, employers, education, and job-location exclusions retain existing rendering behavior.
- One draft plus one repair matches the two-call router ceiling. Repair requests return only rejected passages and cannot overwrite valid passages. Initial drafts may use cited source text only for unrepaired passages, clearly marked as mixed output; failed revisions preserve the saved document.
- Initial/revision generation deadlines are 40/45 seconds, excluding profile/database/network overhead. Rate limits and free-plan/zero-price checks remain intact. Validation rejections consume quota but do not count as provider outages.
- All core regression files and 42 focused tests passed. First live repair pass v97/v71: 3/4 resumes AI, one timeout fallback; 4/4 covers had AI prose, two with one source-fact passage. Whole-document revision repairs still timed out, prompting passage-only repairs.
- Latest passage-only repair requires final live validation after the existing outage cooldown naturally expires. No cooldown records were reset; no saved documents were overwritten.


## Final bounded repair verification (2026-09-28 UTC)
- Deployed resume v103 / cover v76. Current frontend app.js v61 / modern-v13-structured-writer; core repair commit 1b64a8d passed core CI, browser regression, Pages deployment, and both production smoke runs.
- Confirmed root causes: exact bullet-count rejection in the retired parser; full-document repairs exceeding deadline; missing mandatory history; invalid employer references/attribution; and non-game framing errors being discovered only after an earlier passage was repaired.
- Final source additionally constrains experience IDs to canonical IDs, collects framing errors alongside passage errors, restores omitted required roles with canonical source facts, and replaces an unrepaired misattributed initial bullet with that employer's own verified source text. These recoveries are marked as source_fact_passages; revisions never use them.
- Live initial results across the final batch and focused corrective retests: Parallel resume Cloudflare/no source passages 36.0s; Stone Kite resume Cloudflare/no source passages 29.8s; VetJobs/Pinnacle resume Cloudflare/no source passages 31.4s; Accurx resume Cloudflare/one source-fact bullet 29.9s. These are incremental retest results, not a claim that all four passed in one run on v103. No full-document fallback remained in the final result for any of the four jobs.
- Latest cover batch: 4/4 Cloudflare, no source-fact passages, 12.6–20.6s. Cat/goofy/formal/punchy revisions: 4/4 Cloudflare with obvious requested tones, 29.0–37.5s, no source fallback. Canonical employer/role/date sequences matched the prior draft.
- Revision limitation: the tests requested summary-only edits, but wording elsewhere also changed. Tone behavior passes; exact section-only edit scope does NOT yet pass and must not be described as verified. Saved user documents were never overwritten; no approvals or employer submissions were performed.
- 45 focused execution tests and repository secret scan pass. Prior core suite passed; final commit CI must be checked. Production browser loaded/synced and v61 was served. Existing mocked browser persistence/failed-revision regressions passed; no new real-model PDF rendering or persistence write was performed.
- Rate quota, provider outage circuit, Workers Free validation, zero-price routing, and two-call ceiling remain in place. No circuit records were reset.
