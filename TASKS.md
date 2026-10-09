# Raven Tasks

## Current verified fixes and follow-ups (2026-10-09)
- [x] Deploy role-evidence planning, employer-scoped repair, art-dominance and unsupported-claim guards (writer v7).
- [x] Persist document failure feedback through refresh and retain a successful sibling on partial failure.
- [x] Verify one-button Mercury Readiness resume/cover creation, exact saved URLs after reload, and independent job-specific content review.
- [x] Deploy Fort Collins-only hybrid rule in backend56 and hosted shared filter4; verify seven location cases and preserve history.
- [ ] Polish generic wording, repetitive suffixes and weakest selected history example; strengthen precise readiness relevance.
- [ ] Inspect native Word/PDF layout and extend the bounded independent audit to more distinct Professional roles.
- [ ] Improve cross-device error reporting and clear stale feedback when documents are replaced externally.
Evidence: docs/qa/2026-10-09-professional-fixes.md. Historical unresolved entries below are superseded only where explicitly checked above.

## Professional one-button tailoring (2026-10-09)
- [x] Run random visible Professional Generate both test and verify both exact saved URLs after reload.
- [x] Reproduce user-reported art-centered content, implement writer v5 evidence guidance and relevance checks, pass required core/targeted checks.
- [x] Deploy writer v5 to resume129/cover99 and verify source; fresh Dutchie live test completes but saves0, so full-pair acceptance fails.
- [x] Complete three bounded worker diagnostic samples (Ashby/Stripe browser, Mercury API because worker browser unavailable); compare actual returned output or explicitly record none, prepare prioritized plan. No approvals/submissions.
- [!] Reliable grounded, tailored one-button creation remains unresolved: accepted generic Ashby output and false reviewer rejection of verified Mercury evidence.
- [ ] Implement role-evidence planning and separate factuality/relevance/fit review; preserve exact titles/attribution and real domain gaps.
- [ ] Persist actionable per-document failures after refresh; diagnose incomplete cover review before retrying.
- Plan/evidence: docs/qa/2026-10-09-professional-random-audit.md.

## Live browser workflow (2026-10-09)
- [x] Check actual hosted sync/reload, job search, saved-document previews, Word downloads and approval gate using in-app browser.
- [x] DataHouse remains hidden as intended: user explicitly rejects hybrid roles outside Fort Collins. Do not add a saved-record exception.
- [ ] Tighten hybrid eligibility from nearby northern Colorado to Fort Collins only, retaining the requested remote/in-person scope separately.
- [ ] Native Word and browser PDF/print-dialog acceptance remain separate.
- Evidence: docs/qa/2026-10-09-live-browser-workflow.md.

## Private cover-letter save acceptance (2026-10-09)
User d authorized the recommended DataHouse cover-letter test. Actual Raven Private get_job/get_verified_profile succeeded; confirmed no existing letter before create-only save. Wrote a 199-word first-person letter grounded in canonical project-delivery, leadership, mentoring, cross-functional collaboration, internal meetings, workflow and technical evidence. No budget/certification/methodology/tool qualifications invented. Actual save returned saved=true/review_required=true; fresh get_document URL exactly matched.

Independent Supabase read confirms cover URL length2699, SHA256 2db3c979af463869ff76aaf4b48aecd5b072922a63ba30ea7f7716a3d4b77948, version2026-10-09T19:28:09.501+00:00. Existing resume hash remains 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779. No replacement, approval or employer submission. Worker hosted reload/render verification is the final pending check. Personal output/evidence remains ignored private/. No source-code change needed for this successful save.

## Protected-key ACL compatibility fix (2026-10-09)
Initial real enrollment failed because Windows PowerShell could not autoload Microsoft.PowerShell.Security for Set-Acl. Cache was not saved; the launcher disposed entered credentials. Replaced Set-Acl with direct .NET Windows file ACL APIs, preserving DPAPI/current-user-only protection and avoiding module-path incompatibility. Synthetic credential/retry/environment tests pass in both bundled PowerShell7 and Windows PowerShell5.1; actual protected enrollment remains pending repeat local entry. Corrected ignored cmd launcher to forward options on the PowerShell invocation rather than pause. Saved DataHouse resume/full hosted reload acceptance remains verified; no documents changed.

## Windows-protected tunnel reuse and saved-resume acceptance (2026-10-09)
User explicitly requested eliminating two-key entry on every restart. Launcher now stores Windows-DPAPI-encrypted PSCredentials in ignored private/raven-tunnel.credentials.clixml with current-user-only ACL, reloads without prompts, and reconnects up to five times. Explicit -ResetSavedKeys rotates the cache; malformed/foreign-user caches fail closed. Windows-only; no plaintext keys or command-line credentials, no secrets committed. Synthetic protected-key tests pass; Windows CI job added. No login service or scheduled startup added.

Actual saved DataHouse resume passed independent canonical audit/deterministic review and rendered HTML inspection. Fresh hosted Raven load and full reload each fetched the exact saved URL from real backend HTTP200 with Up to date sync; browser writes blocked and none attempted. Stored hash matches initial plugin save/readback; cover empty and user data preserved. Actual browser refresh acceptance is now verified.

The previous memory-only credentials were cleared. Updated one-time masked setup window opened; initial protected enrollment and live tunnel restart remain pending. Once enrolled, no repeated entry is needed. Keep public auth and paid PR58 unchanged. Saved resume remains review-required; no application submitted.

## Private tunnel document-save fix (2026-10-09)
Raven Private discovery and real list_jobs/get_job/get_verified_profile now succeed. Failed DataHouse resume had two problems: the canonical manual-import wrapper was passed to a bridge expecting its inner resume, and its Professional summary foregrounded game-art identity. Independent validation against live canonical evidence identified the framing rejection; corrected private draft passes validateDraft and reviewDocument. Candidate drafts/evidence remain local and excluded from commits.

Bridge now advertises grounded resume/cover JSON schemas and safely unwraps the exact raven-chatgpt-v1 envelope for the requested kind. Unknown wrapper keys/wrong format/missing requested kind are rejected. Existing factual, permission, version, create-only and replacement gates remain. Five new regressions bring bridge suite to 20 tests; all 46 local Node commands in test.yml pass, including secret scan and renderer checks. Prospective cover claims permit empty fact IDs as in the canonical writer.

Running tunnel still uses prior bridge code; corrected raw resume is compatible and being tested through the actual plugin. New code requires next runtime restart and tool refresh; no live reload or public deployment is claimed. No need to terminate the healthy runtime to test the corrected draft. Worker owns one create-only DataHouse save and independent readback. A separately created ChatGPT chat is directed to read-only plugin verification to prevent competing writes. Browser reload acceptance pending.

## Stale ChatGPT demo tool list (2026-10-09)
User reports a new chat exposes only server_info, echo and uppercase. Read-only local inspection confirms one active tunnel-client running private-mcp-stdio (not the embedded demo); loopback health returned live=true, ready=true. This establishes current runtime health, not successful ChatGPT Raven discovery or database credentials. Most likely the installed plugin retains the demo descriptors; also check that its tunnel/workspace matches the local Raven connection.

Next: keep the current Raven window running; open Raven Private plugin details and refresh tools/actions. Verify list_jobs, get_job, get_verified_profile, get_document and save_generated_document before opening a new chat and invoking list_jobs. If refresh is absent or still shows demo tools, create a fresh private plugin using the same intended tunnel and No authentication, verify the five tools, then install/select it. Do not restart the working runtime or retrieve in-memory credentials. No database call or document modification occurred in this investigation. Live read/save/full-refresh acceptance remains pending.

Official refresh guidance: https://developers.openai.com/api/docs/guides/custom-mcp-server .

## Private Raven plugin adapter (2026-10-09)
User reports successful ChatGPT server_info and echo demo calls through the private tunnel without Raven OAuth. Implemented scripts/private-mcp-stdio.mjs reusing the canonical MCP handler, plus scripts/start-private-raven.ps1 with masked in-memory runtime/server credential entry. No network listener or public auth change. Fixed allowed job IDs/expiry in ignored local configuration; read/profile/create only, no revision. Five adapter tests and all 47 workflow checks pass after synthetic scanner fixture correction. Actual Raven credentials/read/save/refresh remain pending. See docs/PRIVATE_RAVEN_TUNNEL.md.

## Active direction: private plugin through Secure MCP Tunnel (2026-10-09)
User clarified they require plugin functionality without Raven OAuth; manual JSON transfer is not the intended replacement. User reports Platform tunnel creation access and supplied a tunnel ID, retained only in the ignored local launcher. No public MCP authentication was disabled.

Official Windows tunnel-client v0.0.16 downloaded to ignored private/tunnel-client; SHA256 verified against official SHA256SUMS. scripts/start-private-tunnel-test.ps1 accepts a restricted runtime key using a masked prompt, passes it in process environment and restores it on exit; no key file or command-line secret. Launcher syntax verified. private/Start-Raven-Tunnel-Test.cmd supplies the user's tunnel ID locally.

Next: user creates an OpenAI runtime key restricted to Tunnels Read + Use and enters it directly in the local launcher. Run harmless embedded stateless demo before granting Raven data access. Connect ChatGPT using Tunnel and No authentication, verify demo tool invocation and workspace association, then prepare the scoped Raven bridge. The demo is not running: runtime key entry is pending. Tunnel availability is user-reported; successful polling, no-auth discovery, Raven reads/saves and refresh persistence are unverified. No live data or credentials changed. PR58 remains inactive.

References: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels ; https://github.com/openai/tunnel-client/blob/main/docs/permissions.md .

## Active direction: use manual ChatGPT transfer (2026-10-09)
User called authentication a major blocker and instructed working around it or abandoning auth. Selected the existing Raven ChatGPT prompt/JSON import workflow; stop requiring MCP OAuth/password setup for current work. MCP authentication is not disabled and no public unauthenticated access is introduced. Do not resume OAuth onboarding unless requested.

Verified in source: document ChatGPT/Create ChatGPT prompt builds a grounded prompt; Import ChatGPT result accepts pasted JSON or a JSON file, validates it and saves through the existing document path. This route does not require the Raven MCP OAuth connection. Actual signed-in ChatGPT generation/import and refresh persistence are still unverified; source inspection is not live acceptance.

Next: open the target job in Raven, use ChatGPT on its resume, generate the requested JSON, then use Import ChatGPT result > JSON file on that same job and confirm the saved document after refresh. Preserve existing documents and review any replacement. Paid-provider PR58 stays inactive. Browser helper remains unavailable; no new login/email requests were sent.

## Portable AI handoff (2026-10-09)
- [x] Use a subagent to document project architecture, shipped capabilities, upcoming priorities, known defects versus verification gaps, continuation instructions and a replacement-AI prompt in docs/RAVEN_AI_HANDOFF.md; parent reviewed current-source links and live-state distinctions.

## OAuth connection follow-up (2026-10-09)
- [x] Verify user-enabled OAuth discovery and ES256 signing key.
- [x] Implement protected-resource discovery, challenge and signed OAuth JWT validation with explicit client/owner/job grants.
- [x] Implement sign-in/consent UI; test explicit email/approval, escaped metadata, callback validation, SDK integrity and mobile layout.
- [x] Publish PR68; verify live consent page/metadata, authentication denials, final PR/main CI, Pages and both smoke runs.
- [x] Owner sign-in through hosted page; confirm email-verified Auth account in database.
- [x] Correct/save authorization path; user reports successful ChatGPT authentication and database confirms dynamic ChatGPT client registration. Full redirect/tool acceptance remains pending.
- [x] Apply private single-owner grants/hook; provision one Professional job; deploy v4. User reports hook saved.
- [x] Implement password sign-in and authenticated private password setup; seven local browser checks and all 45 workflow checks pass. PR70 approved/merged and Pages deployed; PR core/full-browser CI passed. Owner private setup remains pending.
- [ ] Verify live hook token issuance/refresh and authenticated tool discovery; fresh email sign-in currently rate-limited.
- [ ] Verify authenticated ChatGPT retrieval/generation/save and Raven reload, including production expired/revoked credentials.

## Ready fixes release (2026-10-08)
- [x] Publish and verify PR67 integrating #62/#63/#64/#65; frontend v80/enrich v10.
- [x] Preserve existing user data and remove disposable QA records.
- [ ] Generation/MCP experiments #58/#59/#61 and dependency maintenance #53/#54 remain pending.
- Alternate closure #66 closed as duplicate; code retained on its branch.
- Evidence: docs/qa/2026-10-08-ready-fixes-release.md.

## UI pill containment and applied icon (2026-10-08)
- [x] Reproduce narrow busy document controls; wrap rows and preserve readable neighboring labels.
- [x] Replace APPLIED card tag with accessible check; preserve application-history presence rules.
- [x] Verify six widths, ten history cases/reload, lifecycle and responsive behavior (16 browser tests); three core suites, syntax, secret scan and whitespace; visually inspect mobile/desktop screenshots.
- [x] Integrate PR64 in PR67; verify hosted v80/icon/wrapping and passing full-browser CI. See docs/qa/2026-10-08-ready-fixes-release.md.

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
- [~] Reduce manual ChatGPT resume latency and omissions: compact prompts and explicit must-preserve facts are implemented locally; verify live prompt-service reachability and a clean under-10-second end-to-end output before claiming completion.
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


## Accurx unsupported-number follow-up (2026-09-30)
- [x] Reproduce the prior case without saved-document writes and privately trace passage-to-fact attribution.
- [x] Distinguish missing citation from semantic tenure misuse; add private numeric tracing with HTTP privacy tests.
- [x] Improve repair citation obligations only after reproducing the omission; keep all validation safeguards.
- [x] Deploy resume v126; pass 74 targeted tests, core/targeted-browser CI and production smoke; verify unchanged saved documents.
- [~] Full Accurx generation still review-blocked: final event 357 repeats the headline. Number rejection did not recur, but live citation-retention reliability is not established. This separate repetition path is outside this task.
- Evidence: docs/qa/2026-09-30-accurx-number-review.md. Two calls only; no repeated six-call sweep.

## ChatGPT handoff correction (2026-09-30)
- [x] Carry full prompt into the ChatGPT launch URL; preserve clipboard fallback and report blocked popups.
- [x] Verify four focused handler cases and bump frontend to v71.
- [ ] Verify prefill in the user’s signed-in ChatGPT session.

## Resume downloads and ChatGPT JSON (2026-10-06)
- [x] Add genuine Word download and Save as PDF in review.
- [x] Request downloadable JSON instead of displayed resume text; add file import fallback.
- [x] Implement job-bound extension handoff through existing fact-check/save.
- [x] Verify focused units and mocked browser download/import/reload.
- [x] Publish frontend and extension package (#55 already merged; hosted v80/ZIP 2.2.0 verified).
- [!] Update/reload the installed extension on the user device; installation is not verified.
- [ ] Verify signed-in ChatGPT file creation and attachment handoff; inspect Word/PDF pagination.

## Action labels (2026-10-06)
- [x] Fix text escaping Generate both and allow action labels to wrap.
- [x] Verify containment at 715, 375, and 320 pixels in mocked Edge; visually inspect 715px.
- [x] Push/publish action-label fix; verified hosted release and CI.

## Resume overflow download (2026-10-06)
- [x] Add Download resume only when a saved resume exists; reuse direct Word export.
- [x] Verify absent-before-generation and menu download in mocked Edge.
- [x] Publish resume overflow download; hosted release verified.

## GitHub delivery (2026-10-06)
- [x] Push prepared changes to `shipitmyguy-ux/raven` after user authorization; open PR #55.
- [x] PR #55 merged; hosted frontend and extension ZIP 2.2.0 verified.

## Applied-job badge (2026-10-06)
- [x] Add prominent APPLIED badge, retaining it for later application stages/history.
- [x] Verify badge presence/absence and mobile containment in mocked Edge.
- [x] Push badge to PR #55 and pass GitHub core/browser checks.
- [x] Publish application-history indicator; PR #67 replaces the prior APPLIED tag with an accessible check icon.

## Professional sales-role exclusion (2026-10-07)
- [x] Exclude direct sales roles and explicit selling duties using shared browser/backend eligibility.
- [x] Preserve saved records and keep non-selling support, training, enablement and operations roles eligible.
- [x] Verify focused filters, browser-list fixtures, ranking, all core workflow regressions, syntax and secret scan.
- [x] Merge/publish with explicit user authorization; deploy backend v54 and verify live frontend/filter, healthy service and 99 Professional results.

- [x] Push Professional sales-filter review branch and create PR #56; attach to the active chat.
- [x] Record user standing authorization for future Raven pushes.
- [x] Resolve the production-deployment requirement through explicit user approval; merge PR #56 and deploy frontend/backend.

## Global location preference (2026-10-07)
- [x] Apply remote-anywhere / local-in-person eligibility across every tab, including cached and saved lists.
- [x] Verify geographic, remote, hybrid, ranking and browser preservation regressions plus required core checks.
- [x] Publish frontend/backend and verify live results (PR #57, app v76/filter v3, backend v55, zero violations in all four tracks).


## Word and PDF export inspection (2026-10-08)
- [x] Reproduce and fix Word export joining a cover-letter closing to its signature; preserve HTML breaks as OOXML line breaks.
- [x] Render actual Word exports with LibreOffice and current HTML/PDF with WeasyPrint: two-page resume and one-page letter, every source block present, all final page images clean.
- [x] Pass all existing core regression commands, added line-break unit check, syntax, secret scan and whitespace.
- [x] Browser export CI and actual hosted Word converter check passed; export fix deployed via PR67.
- [!] Native Word/browser-print visual and signed-in transfer acceptance remain.
- Evidence and precise acceptance limits: docs/qa/2026-10-08-document-exports.md.
- [x] Reproduce collapsed Ignored status pill and correct duplicate reserved-width deduction (PR63).
- [x] Revised status-only CI and combined full-browser CI passed; integrated independent PR63/64 fixes.
- [x] Export QA/fix and mobile pill containment + accessible Applied icon: PR62/63 core/browser CI successful.
- [x] Implement bounded explicit source closure detection, independent persisted evidence and preserved saved document/application history; local core/classification/persistence fixtures pass.
- [x] Final closure browser/core CI and revised PR63 status-only CI pass; parallel PR64 owns document-control/icon changes.
- [x] Integrate overlaps, apply migration, deploy enrich v10/frontend v80 and verify disposable live closure/persistence/data preservation.

## Option 3 integration follow-up (2026-10-08)
- [x] Five tools, cover save, exact-hash/version revisions and transactional old-document archive.
- [x] Archive schema deployed and disposable database replacement verified; 15 bridge + 27 core commands pass.
- [x] MCP deployed with fail-closed authentication; anonymous calls return 401.
- [x] Google Drive PDF copy verified on one existing saved resume.
- [ ] OAuth settings, owner sign-in, consent/resource/token verification, secure grants and ChatGPT activation.
- [ ] Authenticated MCP generation/save/full Raven reload acceptance.
- [ ] Automatic Drive copies with persisted success/failure and retry; cover-letter Drive acceptance.

- [x] Apply on site starts resume-only source-grounded preparation; six focused checks pass.
- [~] Added browser cases pass in final PR68/main CI; live generated output/readback/reload remains pending. Earlier local Chromium download failure is superseded by CI browser acceptance.

- [x] Verify private tunnel demo runtime readiness and successful OpenAI polling (2026-10-09).
- [ ] Connect no-auth private demo plugin and verify actual ChatGPT tool call before attaching Raven data.

## Live verification result (2026-10-09)
Created chat Test Raven plugin loaded all five Raven Private tools. Its initial authorized create-only run retrieved job/profile, saved a truthful transferable-first resume using the inner object, then get_document returned matching persisted HTML. No invalid-payload retries; no existing document replaced. Save version 2026-10-09T18:04:49.929+00:00. Parent independent Supabase read confirms resume length 6781 and SHA256 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779, matching chat readback. Cover remains empty. Local worker observed existing resume and correctly did not write another draft. Resume remains human-review-required; no approval or employer submission.

Later plugin calls returned Session terminated. Local inspection found no tunnel-client process and prior loopback health port unavailable. Current tunnel is stopped; stopping it does not remove the saved document. Cause of shutdown unverified. Future connection requires restarting private/Start-Raven-Private.cmd and entering credentials privately. New schema/envelope code loads on that restart; refresh plugin tools afterward. No credentials extracted or persisted. Browser inventory exposed no apps/browsers, so full Raven UI refresh/visual acceptance remains unverified. Initial plugin save and fresh plugin readback plus independent database persistence are verified.

## Protected enrollment and live reconnect verified (2026-10-09)
Encrypted credential cache exists after owner's local enrollment. One tunnel-client is running; local health reports live=true/ready=true. Fresh actual Raven Private get_document succeeded after restart and returned the exact saved DataHouse hash 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779 and unchanged version 2026-10-09T18:04:49.929+00:00. No document writes. Previous initial-enrollment blocker is resolved. Prompt-free future starts are covered by synthetic tests; another real stop/start solely to test reuse was not performed. Hosted full reload/fact/render verification remains passed. Keep tunnel window running; future launcher starts use the saved encrypted cache. No approval or employer submission.

Final cover-letter acceptance: worker fresh hosted Raven load/full reload each returned real backend HTTP200 with exact saved cover SHA2562db3c979af463869ff76aaf4b48aecd5b072922a63ba30ea7f7716a3d4b77948 and unchanged resume SHA2565d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779. Both sync Up to date and cover cache retained. Actual stored HTML screenshot visually clean with complete paragraphs and separated closing/signature. No browser writes attempted. Cover save/readback/database/reload/render acceptance passed; no further writes needed. Evidence private/cover-reload-verification.json and DataHouse-ACTUAL-SAVED-cover.* ignored. Native Word/print-dialog acceptance remains separate.

- [x] Implement Professional role-evidence planning, narrow false reviewer rejection, generic-summary check and local durable generation errors;47 core commands pass.
- [ ] Publish v6 and independently compare actual per-job resume/cover outputs, exact linkage and reload; browser regression pending.

- [x] Fix worker-reproduced Mercury data-analysis inference and generic-summary variant; keep numeric attribution checks. Correct Windows CI mock exit status; both engines and intentional assertion-failure probes verified.
- [ ] Review cross-team execution responsibility inflation and retry only after its specific guard/prompt fix; Dutchie pair currently0 outputs.

- [x] Verify Mercury onebuttonpair savedboth and exacthostedreload; independentcoverqualitativepass/resumefail separated.
- [x] Implement v7 relevant initialhistorychoice and deterministic artdominance/efficiency/generic-bypass checks;72targeted/47corepass.
- [ ] Verify v7 actual pair on another eligible Professional job; independent tailoring review required.

