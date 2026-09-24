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
