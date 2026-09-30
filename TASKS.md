# Raven Tasks

Legend: [ ] open, [x] complete, [~] in progress, [!] requires real-site/user-account verification

## Closeout status

### Core reliability
- [x] Options/Settings panel is live.
- [x] Audit saved-job description completeness across all four tabs. Seven blank Lever descriptions were repaired through the public Lever Postings API; the only remaining short saved description is Twin Atlas Environment Artist, whose public careers page exposes the role/location but no detailed posting text.
- [~] Source-description recovery is implemented for LinkedIn guest pages, Lever's public posting API, schema.org/JobPosting JSON-LD, visible page content, and metadata. Some aggregator pages can still expose only snippets.
- [x] Shared source -> parser -> Supabase -> Raven UI architecture is enforced; tabs are filters rather than separate ingestion pipelines.
- [x] Search Jobs uses the shared `raven-backend-v3` path.
- [x] Remote status uses one shared evidence-backed classifier across all four tracks; LinkedIn remote-query false positives were removed and existing Epic/Blizzard misclassifications were repaired.
- [x] Games / 3D hard eligibility removes programmer/engineer/developer titles and clearly non-English postings before ranking/persistence; stale matching discovery rows and the unapplied Gameplay Programmer saved row were removed.
- [x] Quick and deep search are production-verified on every track. Latest deep pass completed with 67 Professional, 78 Labor, 48 Wildcard, and 9 Games / 3D results.
- [x] Zero-result quick refreshes preserve recent cached discovery rows instead of blanking a tab.
- [x] Stale background deep-search runs are automatically reconciled and no longer remain indefinitely `running`.
- [x] Saved job/status/document fields persist through a fresh backend read. Verified with a disposable production QA job, then removed.
- [x] Canonical identity/deduplication preserves distinct postings while identifying exact/canonical duplicates.
- [x] Malformed ATS rows were cleaned; current malformed saved/search-result counts are zero.

### Documents
- [x] Live resume generation verified on real stored jobs across all four tracks.
- [x] Live cover-letter generation verified on real stored jobs across all four tracks.
- [x] Eight-request live acceptance pass returned HTTP 200 and canonical-fact-only output.
- [x] Request budgets/rate limits and failure recording are regression-tested.
- [x] Document status/data persistence through the backend is verified.
- [x] Fresh resume and cover letter generated in the live Raven UI for Akima Intermediate 3D Artist; both previews reopened after refresh and backend synchronization (2026-09-23).
- [!] Verify the exact approved files attach to current real employer file inputs. Synthetic Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic adapters pass.
- [!] Verify conservative completion detection on real employer confirmation pages.

### Efficiency / recovery / operations
- [x] Timer-driven five-minute polling is removed; Raven is event/on-demand driven.
- [x] Reusable generation/profile/job-analysis caches are in place.
- [x] Supabase is the single live data source; Sheets/legacy queue paths are retired.
- [x] Portable Supabase backup/restore tooling is documented and regression-tested with checksums, dry-run restore, and destructive-restore guards.
- [x] Device backup/restore covers application profile, answer memory, preferences, approvals, viewed state, master-resume metadata, and local master-resume files from IndexedDB.
- [x] Repository secret scanner runs in CI and currently passes.
- [x] Deployment regression checklist is documented.
- [x] Core regression and targeted browser suites run on pull requests/main.
- [x] Production smoke now runs automatically on every main push and after a successful Pages deployment.
- [x] Latest production smoke passed.
- [x] Backend health currently reports healthy with 0 active failures.

### Import / extension
- [x] High-confidence title/company recovery and canonical URL identity are implemented.
- [x] Duplicate extension/share imports are guarded by canonical identity.
- [x] Source and original job URL are retained on saved/discovered jobs.
- [~] Browser-extension extraction fallback exists for pages the user can view.
- [!] Verify extension import end-to-end on current LinkedIn, Indeed, Glassdoor, Monster, and representative employer ATS pages.
- [!] Verify imported jobs appear in Raven immediately on those real pages without manual recovery.

### UX
- [x] Restore visible View listing / Apply on site links independently of the approved-document assistant.
- [x] Save discovery jobs and recover missing descriptions before document generation; verify both generated documents remain attached after refresh.
- [x] Live production smoke verifies app load, all four tabs, bounded card layout, global refresh state, filter-only tabs, bookmark persistence, and document-review approval persistence.
- [x] Targeted browser regression verifies Application Assistant safety behavior.
- [x] Responsive browser regression now covers representative mobile, tablet, laptop, and desktop widths in addition to the production smoke viewport.
- [~] Continue improving user-visible backend/frontend diagnostics as new failure modes are discovered.

### Google Drive
- [ ] Decide whether generated documents should remain Raven data-URLs/local review artifacts or also be persisted to a Google Drive folder.
- [!] If Drive persistence is desired, verify the intended destination and account authorization before enabling writes.

## Production acceptance
- [x] Find jobs through production search.
- [x] Parse/store supported source data.
- [x] Persist a job to Supabase.
- [x] Change status and verify it through a fresh backend read.
- [x] Generate resumes and cover letters from the live engines.
- [x] Preserve document data through backend refresh/read.
- [x] Automated deployed-app smoke passes.
- [x] Live Raven UI generation -> review -> refresh verified for both documents on Akima Intermediate 3D Artist (2026-09-23).

## Application Assistant / safety
- [x] Canonical CandidateProfile/fact-ID generation constrains generated claims to verified evidence.
- [x] Local editable Answer Memory supports reusable non-sensitive answers.
- [x] Exact-document approval is invalidated by regeneration/revision.
- [x] Sensitive/legal/demographic/attestation/salary/sponsorship/CAPTCHA/assessment questions remain blocked.
- [x] Final employer Submit remains behind explicit user action and is never automated.
- [x] Synthetic adapter coverage exists for Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic forms.
- [!] Real employer-site adapter selectors, approved-file attachment, and completion detection still require live-site verification.
- [x] Immutable application-time posting/document snapshots are persisted server-side and surfaced in Interview mode.
- [ ] Define privacy/storage boundaries before optional email-driven automation is enabled.

## Future product roadmap
These are feature expansions, not Raven closeout blockers.
- [x] Shared post-application lifecycle is implemented: persisted follow-up scheduling, generic job activity/events, interview/offer/rejection transitions, recruiter/follow-up/assessment activity, and snapshot-backed interview context all reuse one event model.
- [~] Generic application-signal classification/matching is implemented with confidence-gated automatic transitions and user-visible suggestions. A personal email/OAuth adapter is intentionally not connected yet.
- [x] Outcome analytics cover applications, interviews, offers, response timing, source, track, and stable submitted-resume variants derived from immutable application snapshots.
- [x] User-facing fit analysis uses deterministic verified-evidence coverage with supported, partial, and missing-evidence requirements; opaque search scores remain internal ranking signals only.
- [ ] Expand direct ATS coverage beyond the current adapters as source value justifies it.
- [x] Generic schema.org/JobPosting extraction exists for unsupported employer pages.
- [~] Aggregators are primarily discovery/provenance sources; continue canonical employer/ATS resolution when a reliable target is available.
- [ ] Add/maintain an employer -> ATS identifier registry if direct employer querying becomes worth the maintenance cost.
- [x] Source-health diagnostics are persisted and surfaced through the control plane.


## Natural writing upgrade
- [x] Evaluate Resume Matcher and Reactive Resume approaches; retain Raven and use direct full-context writing plus factual review.
- [x] Implement shared Gemini writer for both document types and context-aware revisions; remove deterministic sentence assembly.
- [x] Test writer contracts, errors, grounding-review/repair gate and request budgets with mocked provider responses.
- [x] Deploy and verify authored prose on Akima and Campminder, both document previews, revision behavior, invalid-draft preservation and persistence after refresh (2026-09-24). All 16 mocked writer/handler tests and required CI/production smoke passed.


## Generate button regression (2026-09-25)
- [x] Remove obsolete device-local master requirement from canonical-profile generation; cover both document types, revisions, and forced regeneration.
- [x] Surface failures beside the Generate button, catch initial render failures, and retain progress after discovery jobs receive saved IDs.
- [x] Add browser regressions for no device masters across all four tracks, missing legacy files, failed generation/retry, and forced regeneration.
- [x] Deploy with existing Pages workflow; verify real Accurx regeneration and Omega Generate -> preview -> full refresh/backend sync, with identical saved preview text. Core/browser CI and both production smoke runs passed.


## 2026-09-27 reliability / ChatGPT handoff
- [x] Deploy bounded zero-cost generation and source-fact fallback for both initial documents; 8/8 live output checks passed.
- [x] Grounding punctuation/prompt matching fixes and focused unsupported-specifics checks; 49 local core tests passed.
- [x] Complete CI browser persistence, isolated live save/reload, and PDF layout verification; exact browser-print limitations recorded below.
- [ ] Discuss minimum-click ChatGPT handoff/import for both documents before implementation.


## Cloudflare and Generate both
- [x] Wire native Cloudflare inference with a fail-closed Workers Free-plan check; unit and contract coverage passes.
- [x] Implement one-click generation of missing resume/cover letter using existing review/persistence.
- [x] Cloudflare Billing Read enabled; Workers Free confirmed and real inference output verified. Live quality acceptance is tracked below.
- [x] Verify new Generate both browser tests and Pages deployment in CI (a3a4b95); live app.js v60 confirmed.


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
- 45 focused execution tests and repository secret scan pass. Final source commit 3f70af4 passed Reusable core tests (including targeted browser checks) and Production Smoke Tests; earlier frontend commit 1b64a8d also passed the full Browser regression and Pages deployment. Production browser loaded/synced and v61 was served. Existing mocked browser persistence/failed-revision regressions passed; no new real-model PDF rendering or persistence write was performed.
- Rate quota, provider outage circuit, Workers Free validation, zero-price routing, and two-call ceiling remain in place. No circuit records were reset.

- [x] Unify initial/resume revision writer and use bounded passage repairs.
- [x] Validate four initial document pairs and four tonal revisions with authorized real data.
- [x] Preserve exact untouched wording for summary-only revisions; other narrow section types remain outside this patch path.
- [x] Fresh real-model PDF/persistence acceptance using isolated production data and WeasyPrint layout review; browser export limits recorded below.


## Summary-only repair verified (2026-09-28 UTC)
- Live code: commit 172c7bd3796415fff34b45f900a8da8723b1629c, app.js v62, resume v104, cover v77, gateway v24, grounded-llm-v4. Summary edits now return a grounded patch; frontend replaces only the saved summary content. Every byte outside it remains unchanged. No document migration is required.
- Two real summary-only revisions succeeded: formal 16.0s and playful/cat 16.4s, both through the existing free OpenRouter fallback with two provider attempts and no source-fact fallback. These two checks do not establish Cloudflare-specific summary reliability. Earlier Cloudflare initial/cover results remain historical evidence.
- 50 focused execution tests, all 19 core regression files, syntax and secret scan pass. Commit 172c7bd passed Reusable core tests (36423786232), full Browser regression (36423786231), Pages deployment (36423786064), and both Production Smoke runs (36423786307 / 36423827738).
- Real persistence: created one disposable Raven QA job, saved prior live-model resume/cover HTML, changed only its summary using the new live patch, and read both documents back through fresh backend requests. Exact revised resume and unchanged cover matched. Existing user document values were compared before/after and all were unchanged. Direct database read confirmed the patch. The exact QA row was then deleted.
- Production UI loaded the QA job and restored the revised document URL after full reload and completed backend sync. This cloud browser blocks data-URL iframe previews under its organization policy; visual browser-preview acceptance is therefore limited. CI browser preview/save/reload checks passed.
- Fresh PDF check used the production HTML renderer with the prior live-model resume/cover and new formal summary. WeasyPrint output was two resume pages and one cover page; rendered pages were visually inspected with no clipping or overlap. This checks the HTML/PDF layout, not a fresh Chrome print-dialog export. Local Chrome execution was blocked by environment socket permissions; no protection was bypassed.
- No saved user document was overwritten or approved, and no application was submitted. Free-plan validation, zero-price routing, request quotas, provider circuits and the two-call ceiling remain intact.

Current scope: narrow edits are enforced for resume summaries. Multi-section and whole-document requests continue through the full writer; other individual sections do not yet have a surgical patch path. Employer-site extension acceptance and optional future ChatGPT handoff work are separate backlog items.

## Shipped-title spelling (2026-09-28)
- [x] Reject one-edit misspellings in all six verified shipped titles, including multiword names; test a near miss and exact spelling for each.
- [x] Deploy shared validator to resume v106 and cover v79; verify active bundles and endpoint health.
- [ ] Correct any existing saved resume containing “Darksiers” after locating and reviewing that document; the generation guard does not mutate saved documents.

## Richer resume content and supported keywords (2026-09-28)
- [x] Replace thin 3D bullet guidance with evidence-backed two-page writing targets.
- [x] Add supported posting-keyword guidance without keyword-count rejection or invented qualifications.
- [x] Accept verified technique names, same-employer project context, and legitimate game-title numbers.
- [x] Restrict evidence references by employer and reject unsupported leadership claims.
- [x] Preserve one bounded factual repair after provider fallback; test maximum-three-call limit.
- [x] Improve skills and heading extraction for ATS parsing; invalidate old generation cache.

## Studio context and document corrections (2026-09-28 MDT)
- [x] Cache bounded official studio research and feed source-grounded relevance to both writers.
- [x] Normalize skills casing while preserving brand names/acronyms.
- [x] Remove repeated cover paragraphs and repair the saved Stone Kite letter.
- [x] Preserve complete shipped-credit lists and repair the saved Stone Kite resume.
- [x] Test and deploy shared writers and cache schema; verify saved-document readback.

## Game tab relevance (2026-09-28 MDT)
- [x] Fix Unity/community and game/Burlingame substring collisions.
- [x] Require actual relevant art roles in new searches, cached responses and browser lists.
- [x] Preserve saved job data/documents; verify live backend excludes unrelated results.

## Final document review gate (2026-09-28 MDT)
- [x] Add whole-document checks and separate source-grounded factual reviewer.
- [x] Combine local/factual issues for one targeted repair and review the complete result again.
- [x] Reject unreviewed, source-fallback and malformed rendered documents before persistence.
- [x] Add regression cases for reported failures and preservation of prior saved documents.
- [x] Complete live game/professional resume and cover checks, browser failure-preservation acceptance, and record remaining provider/reviewer limitations.


## Focused v68 reliability sweep (2026-09-29 MDT)
- [x] Run the requested unchanged-baseline three resumes and three covers, record gate/provider outcomes and manually audit output.
- [x] Reproduce and fix only observed generation/review defects; preserve truthful career transitions, verify supported-history/prospective wording controls, commit/deploy resume v124 / cover v96.
- [x] Run 68 targeted tests, final core/targeted-browser CI and production smoke; verify final live rejection/repair behavior and rendered completeness.
- [~] High clean-document generation success remains unestablished. Final professional resume still review-blocked; final letter's closing themes remain repetitive. Future investigation should distinguish missing citations from semantic number misuse without loosening safeguards or counting gate passes as clean acceptance.
- Evidence: docs/qa/2026-09-30-v68-reliability-sweep.md. No further model trials beyond the recorded 13 calls.
