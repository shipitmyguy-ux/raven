# Raven Status

## Active direction: use manual ChatGPT transfer (2026-10-09)
User called authentication a major blocker and instructed working around it or abandoning auth. Selected the existing Raven ChatGPT prompt/JSON import workflow; stop requiring MCP OAuth/password setup for current work. MCP authentication is not disabled and no public unauthenticated access is introduced. Do not resume OAuth onboarding unless requested.

Verified in source: document ChatGPT/Create ChatGPT prompt builds a grounded prompt; Import ChatGPT result accepts pasted JSON or a JSON file, validates it and saves through the existing document path. This route does not require the Raven MCP OAuth connection. Actual signed-in ChatGPT generation/import and refresh persistence are still unverified; source inspection is not live acceptance.

Next: open the target job in Raven, use ChatGPT on its resume, generate the requested JSON, then use Import ChatGPT result > JSON file on that same job and confirm the saved document after refresh. Preserve existing documents and review any replacement. Paid-provider PR58 stays inactive. Browser helper remains unavailable; no new login/email requests were sent.

## Password sign-in follow-up (2026-10-09)
Consent page now supports password sign-in alongside explicit email sign-in, plus a private Set password form for an authenticated account. Password fields are cleared after requests; no credentials are logged or persisted by Raven. OAuth approval, grant checks and token validation are unchanged.

User states they never defined a password. A read-only aggregate found one Auth account with a nonempty credential field; this does NOT prove the user knows a usable password. The owner must privately set their password in their existing signed-in consent tab, or complete one email sign-in after the rate limit clears. No password was set by the agent and no email was sent.

Verified locally: seven installed-Edge consent tests (synthetic auth, real pinned SDK load, mobile layout), mobile screenshot inspected, all 45 syntax/core/secret commands in test.yml, and whitespace checks. Local Node v24.19.0; CI remains Node 22. Codex sandbox shell still fails setup; approved alternate execution works. Existing signed-in browser automation was not retried. Actual ChatGPT tools remain unavailable in this chat; token issuance, tool retrieval/save and Raven reload remain unverified. Paid pilot PR58 is inactive; user data untouched.

## Live grant deployment (2026-10-09)
User authorized any Professional job. Provisioned one 30-day ChatGPT grant for DataHouse PROJECT MANAGER (JT-1789707628035): jobs:read, profile:read, documents:create; no revision permission. Existing resume/cover were empty and remain unchanged.

raven-mcp-v1 v4 ACTIVE loads service-only database grants when no explicit environment owner/grant configuration exists. Explicit environment configuration remains authoritative. Signature/issuer/exact-resource-audience/expiry validation occurs before database access. RPC checks singleton owner, matching unexpired/unrevoked grant, nondeleted OAuth client, active consent and matching current unexpired session every request. Private runtime identifiers are not committed.

Applied raven_mcp_oauth_grants and raven_mcp_oauth_hook_variable_fix migrations. Source: supabase/sql/raven-mcp-oauth-grants.sql. Direct hook testing found a PL/pgSQL variable ambiguity, fixed before user enablement. User reports public.raven_mcp_access_token_hook enabled/saved; configuration was not read directly through the connector.

Verified: 21 bridge/OAuth tests; all 44 core workflow commands; syntax/secret/whitespace checks; one live authorized consent/session and active grant; direct hook exact audience and other-claim preservation. Anon/authenticated cannot read grant tables or call RPC; Auth-admin execute privilege present. Connector cannot SET ROLE supabase_auth_admin; actual hook execution as that role remains unverified. Live metadata200/anonymous401. Transactional revocation probe returned expired requestState; subsequent read confirmed grant active. Do not count that probe as passed.

Pending: actual hook token issuance/refresh, authenticated ChatGPT tools, grounded generation/save and Raven reload, live revocation/expiry acceptance. Reconnect hit email rate exceeded. Avoid more sends; user asked to test existing Raven connection with list_jobs. No live document writes or employer submissions.

Browser automation remains blocked by Windows helper file-lock error32. Reset/restart attempts did not repair it. MXC unavailable. TinyFish installed but user reports auth errors. No browser workaround was verified.


## Portable AI handoff (2026-10-09)
Project orientation, architecture/key files, shipped capabilities, prioritized upcoming work, known defects versus unverified acceptance, continuation checks and a replacement-AI prompt are consolidated in docs/RAVEN_AI_HANDOFF.md. Current status/tasks/execution handoff remain authoritative for later changes.

## OAuth connection implementation (2026-10-09)
- Supabase OAuth discovery now returns 200 after user enablement; public JWKS contains ES256. Dynamic registration is now verified; discovery advertises the registration endpoint.
- Bridge 0.3.0 adds protected-resource metadata, 401 discovery challenges and strict JOSE signature/issuer/resource-audience/expiry/owner/client validation. Explicit server grants retain job/document permissions; Supabase OIDC scopes do not grant Raven access.
- A dedicated consent/sign-in page uses pinned SDK/SRI and public runtime configuration. Nineteen bridge/OAuth tests, all required core commands and four installed-Edge consent tests pass; mobile screenshot inspected.
- Published PR68 at a2936122841d60c668ae8ed6fd9ad81847edb45a; consent page returns 200 and raven-mcp-v1 v3 ACTIVE serves metadata 200. Anonymous/public-key/untrusted-signed-JWT calls each return 401. Final PR and main core/full-browser CI, Pages and both smoke runs pass. Evidence: docs/qa/2026-10-09-mcp-oauth-connection.md.
- Owner sign-in succeeded; direct database read confirms one email-verified Auth account. No OAuth client is registered yet; dynamic registration is enabled and verified. Explicit server-side owner/client/job grants, resource-audience token hook, authenticated saves and full ChatGPT/Raven reload acceptance remain pending. No live user documents were changed.

## Ready fixes published (2026-10-08)
- PR #67 merged at ba223bcbd019bf4918cbc9dc22ad20c2b4f8bea4, integrating #62/#63/#64/#65. Frontend v80/core v5/export v2, applied check icon, status/document containment and Word signature breaks are live.
- Listing migration applied and enrich v10 ACTIVE. Source-confirmed closures leave discovery; saved documents/application stages survive. Backend v55 unchanged.
- Combined/release core and full-browser CI, Pages and both production smoke runs passed; 14 hosted Edge smoke cases and hosted Word converter check passed. Extension ZIP 2.2.0 verified.
- Disposable live ATS fixture verified closure persistence, discovery exclusion and ingestion-reset protection. QA rows removed. All 378 existing job document/lifecycle digests match before/after.
- This release supersedes historical pending-publication notes for #55 and #62–#65 below. Device extension reload, signed-in ChatGPT transfer, native Word/browser-print visual acceptance and real employer-form acceptance remain outstanding. Experiments #58/#59/#61 remain pending; duplicate #66 closed without merging. Full evidence: docs/qa/2026-10-08-ready-fixes-release.md.

## UI pill containment and applied icon (2026-10-08)
- Review branch `codex/ui-pill-applied-icon` builds on main `74e852c`; PR #55 is already merged. Document controls wrap without shrinking adjacent labels, including ChatGPT preparation spinner/label states. Frontend v77 replaces the APPLIED card text with a green circular check, accessible name and tooltip; application-history presence rules are unchanged.
- Six widths (320/375/715/768/1024/1440), ten badge/history cases including fresh reload, and lifecycle/responsive checks pass in mocked Edge: 16 browser tests. The new busy-label regression fails against original CSS (Import becomes 48.75px tall) and passes after repair. Three core/workflow suites, syntax, secret scan and whitespace pass. Screenshots visually reviewed; see docs/qa/2026-10-08-ui-containment.md.
- Implemented and locally verified; merge/deployment and live-data visual verification remain pending. No runtime data or document workflow changes.

## Global job location preference (2026-10-07)
- All four tabs allow confirmed remote work anywhere; in-person and hybrid roles require an explicit nearby Colorado city/state work location.
- Nearby communities: Fort Collins, Loveland, Windsor, Timnath, Wellington, Laporte/La Porte, Bellvue, Severance, Greeley, Johnstown, Berthoud, Eaton and Ault. This is a city whitelist, not a measured driving-radius promise.
- Missing/broad locations and statewide/travel work are excluded. Employer headquarters and description mentions do not establish the work location.
- Shared eligibility applies before ranking, to cached backend discovery reads, and to browser saved/discovered lists. Stored records, documents and application history remain intact.
- Policy is shown globally in Options > Behavior. All 26 core regression commands, syntax, secret scan and whitespace pass locally; Published PR #57 at b6811ba26264ce27fc8e7c74387e608644421352. Hosted app v76/filter v3 and Options > Behavior policy verified; backend v55 ACTIVE, health healthy. Live results: Professional 56, Labor 47, Wildcard 47, Games / 3D 1, with zero global location violations. PR core/full-browser CI passed after adding a local location to the valid cached ATS fixture (69 of 70 passed before fixture correction). Release core, Pages and both production smoke runs passed; release full-browser job was still running at last check.


## Professional sales-role exclusion (2026-10-07)
- Published PR #56 at a88dab9f4993df9f6c8345493a476c7a4f92b5a4; frontend app v75 and track-filter v2 confirmed on GitHub Pages. raven-backend-v3 v54 is ACTIVE and reports healthy.
- Shared eligibility excludes direct selling titles and explicit personal selling responsibilities from Professional fresh ranking, cached reads, and browser lists. Non-selling operations, training, support and enablement remain eligible. Stored jobs, documents and application history are not mutated.
- Five focused regressions and all 25 local core workflow commands passed, plus syntax, secret scan and whitespace checks. PR core/browser checks passed. Release core, Pages deploy and both production smoke runs passed. A read-only live query returned 99 Professional results; zero were rejected by the new shared filter.
- Standing user authorization for future Raven pushes is recorded in AGENTS.md. User also explicitly approved this merge and deployment; prior approval blockers are resolved.

## ChatGPT resume prompt efficiency (2026-10-06)
- Manual ChatGPT prompts now use single-source minified evidence, matched supported keywords, and explicit must-preserve fact IDs for required Games / 3D roles. Suggested game resume length is 375–475 words. Local syntax/whitespace checks pass; this code is not deployed.
- Live Smile-Break prompt request failed with browser `Failed to fetch` before ChatGPT opened. Generator edge functions report ACTIVE, but request reachability was not verified. A one-off ChatGPT response took approximately 10 seconds and still had malformed keys and unsupported summary wording.
- A repaired JSON draft is available locally as `Smile-Break-Senior-Environment-Artist.json`; it was not imported into Raven or persisted. Existing saved resume and job status are unchanged. No end-to-end Raven generation or persistence is claimed.

## Applied-job badge (2026-10-06)
- Frontend v74 adds a prominent APPLIED tag on cards with application history. Verified locally in mocked Edge at 375px across Saved, Applied, Interview, and previously applied Ignored cases. Pushed to PR #55; GitHub core and browser checks passed. Merge/publication blocked by automatic approval review pending explicit authorization.

## GitHub delivery (2026-10-06)
- Resume downloads, JSON handoff, and action-label fixes are pushed on `codex/resume-download-json`, with PR #55 open. Push authorization blocker is resolved. Merge/deployment remain pending.

## Resume menu download (2026-10-06)
- Local frontend v73 adds Download resume to the populated resume's … menu, downloading Word directly. Mocked Edge verified absence before generation and direct download afterward. Publication remains pending.

## Action-button label containment (2026-10-06)
- Local CSS fix makes single-span labels use the full button grid and allows wrapping with growing rows.
- Local mocked Edge checks at 715, 375, and 320 pixels show every action label contained. Visually verified at 715px. GitHub push/publication remain blocked pending authorization recorded in WORK_HANDOFF.md.

## Resume downloads / ChatGPT JSON files (2026-10-06)
- Frontend v72 adds Word downloads, browser Save as PDF, and immediate JSON-file import.
- ChatGPT prompts request JSON attachments with job-bound request IDs. Extension 2.2.0 queues matching files for automatic validation/persistence, preserving newer documents and approval gating.
- Eleven focused unit checks and two mocked Edge browser checks pass. Signed-in ChatGPT attachment transfer and final export pagination remain unverified. Changes are on a working branch; publication is pending.

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
- 45 focused execution tests and repository secret scan pass. Final source commit 3f70af4 passed Reusable core tests (including targeted browser checks) and Production Smoke Tests; earlier frontend commit 1b64a8d also passed the full Browser regression and Pages deployment. Production browser loaded/synced and v61 was served. Existing mocked browser persistence/failed-revision regressions passed; no new real-model PDF rendering or persistence write was performed.
- Rate quota, provider outage circuit, Workers Free validation, zero-price routing, and two-call ceiling remain in place. No circuit records were reset.


## Summary-only repair verified (2026-09-28 UTC)
- Live code: commit 172c7bd3796415fff34b45f900a8da8723b1629c, app.js v62, resume v104, cover v77, gateway v24, grounded-llm-v4. Summary edits now return a grounded patch; frontend replaces only the saved summary content. Every byte outside it remains unchanged. No document migration is required.
- Two real summary-only revisions succeeded: formal 16.0s and playful/cat 16.4s, both through the existing free OpenRouter fallback with two provider attempts and no source-fact fallback. These two checks do not establish Cloudflare-specific summary reliability. Earlier Cloudflare initial/cover results remain historical evidence.
- 50 focused execution tests, all 19 core regression files, syntax and secret scan pass. Commit 172c7bd passed Reusable core tests (36423786232), full Browser regression (36423786231), Pages deployment (36423786064), and both Production Smoke runs (36423786307 / 36423827738).
- Real persistence: created one disposable Raven QA job, saved prior live-model resume/cover HTML, changed only its summary using the new live patch, and read both documents back through fresh backend requests. Exact revised resume and unchanged cover matched. Existing user document values were compared before/after and all were unchanged. Direct database read confirmed the patch. The exact QA row was then deleted.
- Production UI loaded the QA job and restored the revised document URL after full reload and completed backend sync. This cloud browser blocks data-URL iframe previews under its organization policy; visual browser-preview acceptance is therefore limited. CI browser preview/save/reload checks passed.
- Fresh PDF check used the production HTML renderer with the prior live-model resume/cover and new formal summary. WeasyPrint output was two resume pages and one cover page; rendered pages were visually inspected with no clipping or overlap. This checks the HTML/PDF layout, not a fresh Chrome print-dialog export. Local Chrome execution was blocked by environment socket permissions; no protection was bypassed.
- No saved user document was overwritten or approved, and no application was submitted. Free-plan validation, zero-price routing, request quotas, provider circuits and the two-call ceiling remain intact.

Current scope: narrow edits are enforced for resume summaries. Multi-section and whole-document requests continue through the full writer; other individual sections do not yet have a surgical patch path. Employer-site extension acceptance and optional future ChatGPT handoff work are separate backlog items.

## Shipped-title spelling guard (2026-09-28)
- User reported a generated resume spelling Darksiders as “Darksiers.” The exact-entity evidence check did not match misspelled output; general fact-word overlap could still pass.
- Shared document writer now rejects a one-edit near miss in any verified shipped title, including all six known single- and multiword game names, requesting the existing bounded passage repair. Exact canonical spellings pass. This does not rewrite existing saved documents.
- Targeted writer tests pass (23/23). GitHub main includes the expanded validator and regression test at 310a0fa/78c5f30. Supabase resume v106 and cover v79 are ACTIVE with the new guard; the prior resume health GET returned ok. No new real-model typo reproduction was run.

## Richer resumes and evidence-based keywords (2026-09-28)
- Deployed writer changes to resume v113 and cover v85. Flexible two-page writing guidance replaces the 350–450-word / one-bullet caps; 3D history remains complete.
- Added supported keyword guidance and approved technique names, employer-scoped citation schemas, project-context/number corrections, and leadership-scope checks. Non-game skills exclude unrelated art tools unless requested by the posting. Optional highlights may be omitted.
- One reserved factual correction call prevents provider fallback from consuming the entire repair opportunity (maximum three provider calls; deadlines, free-only pricing and rate guards remain).
- 73 local regression checks and secret scan passed. Incremental live testing found several false rejections, then produced a 20-bullet AI art resume with all eight roles, zero source passages, in 23.7s; an implementation resume used AI with no source passages in 17.9s. Final polishing includes heading text extraction, unrelated art-skill filtering, and leadership scope; final acceptance follows below.
- Final v113 live art pass: OpenRouter, three provider attempts including factual repair, 22.6s, 20 bullets across eight roles (five Highwire), zero source passages. Rendered with the latest HTML layout to two visually checked PDF pages; extracted headings, contact details, skills and experience are readable. This is WeasyPrint verification, not a fresh native Chrome print-dialog export. Saved user documents were not changed.

## Studio context and document corrections (2026-09-28 MDT)
- Official-source studio context now feeds resume/cover writing with job posting primary. Nine exact studio identities registered; ambiguous names (including Parallel) and unavailable pages safely skip research. Server-only cache retains successes 30 days and failures one day. Same-domain HTTPS redirects, response-size/time limits, and no candidate data or secrets in outbound website requests. Studio matches prioritize existing facts, never establish qualifications or an unannounced project.
- Skills render consistent title capitalization with brands/acronyms preserved. New generation cache modern-v15-studio-context; app v65/core v4.
- Duplicate cover paragraphs (case/spacing/punctuation normalized) are removed before output; too few unique paragraphs use existing repair. Oversized salutations default to standard greeting/closing without dropping valid body prose.
- Game resumes now render complete canonical Shipped Titles, including Six Days in Fallujah and The Lamplighters League. Cover letters enumerating two or more verified credits are supplemented with missing canonical titles. Single relevant project mentions remain tailored. Source fallback game resumes also retain the full list.
- Saved Stone Kite resume repaired for casing and complete credits; saved letter duplicate removed and missing credits added. Separated a misattributed workflow sentence from its Ark-specific sentence and removed blanket AAA label from its expanded title list. Other job documents unchanged. Database readback matched scoped updates.
- 81 local tests pass; secret scan passes. Live research refresh succeeded; AI resume 18.9s/OpenRouter/three calls including factual repair, zero source passages, all seven titles and eight roles. Production renderer produced two clean WeasyPrint pages with title list/casing inspected. Initial two cover attempts used source fallback (provider failure / incomplete passage outside identified body failures); this is not AI acceptance. Final cover v87 retest succeeded in 12.8s, AI/OpenRouter/two calls, four unique paragraphs, no validation errors or source passages, and studio_context.status=cached.
- Deployed resume v115/cover v87. Cache migration applied. Security advisor reports only existing-category INFO RLS-without-policy notices, expected for server-only tables with anon/authenticated access revoked; see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Game / 3D relevance filtering (2026-09-28 MDT)
Root cause: game-track include terms used substring matching, so Unity matched community and game matched Burlingame. Eligibility had exclusions but no positive art-role requirement. Cached reads and saved/local UI rows bypassed ranking.

Shared track-filter.js now requires an environment/world/level/prop/material/texture/game/3D artist, modeler, world builder, Unreal generalist, or explicitly relevant art-lead role. Existing excluded technical/programming/character/VFX/community roles remain excluded. Relevant non-game 3D production remains eligible because this tab is Games / 3D. Game scoring uses phrase boundaries; other tracks retain their existing rules. Both fresh ranking and cached backend reads enforce eligibility; browser combined results filter saved and local discoveries as well. No job records or documents deleted or rewritten.

Backend v53 deployed. Live listResults returns 21 art-role results and excludes observed retail, sales, community-support, tutor, biotechnologist and game-design results. Regression suite: 85 tests pass, including actual rankCandidates collision tests. Frontend app v66 adds the shared script before app initialization. Work usage unavailable; proceeded normally.

Browser CI initially passed 61/62: its game-generation fixture incorrectly used an Implementation Project Manager title and was correctly hidden by the new rule. Fixture now uses Senior Environment Artist; a dedicated reload test verifies unrelated saved roles stay hidden while environment-art roles remain visible.

## Final document review gate (2026-09-28 MDT)
User authorized a stronger final-review gate after repeated material AI errors. Full documents now undergo deterministic whole-document checks plus a separate factual-review model call against the canonical profile. The reviewer checks employer/project/tool attribution, concrete unsupported claims, contradictions, recipient mistakes and repetition; it does not judge tone, length or keyword counts. Same-employer project context and verified lead roles may support normal paraphrasing. Similar wording is advisory unless exact repeated passages.

Local and reviewer issues are collected before a bounded passage repair, then the complete repaired document is reviewed again. Reserved reviewer budget is two calls, independent of the existing maximum three draft/repair provider attempts (maximum five calls total), within a 55-second generation deadline. Free-only pricing, Workers Free checks, rate quotas and cooldowns remain unchanged. Reviewer approval is not proof of truth; the reviewer may share the writing provider/model.

Production no longer returns source-fact fallback as a successful application document. Failed/unavailable review returns an error without replacing saved documents. Mixed/restored-source drafts also cannot become ready. Browser requires a passed factual review and checks rendered text for omitted expected content, duplicate paragraphs/bullets and placeholders before persistence. Generated drafts remain subject to explicit human approval. Old saved documents are not silently re-certified. Summary-only revisions review the changed summary and validate the whole rendered document for structural errors; they do not re-audit the old unchanged prose semantically.

Deployed resume v118 and cover v90. Frontend v67 and cache modern-v16-final-review invalidate unreviewed generation cache. 90 local tests pass, including cross-employer project attribution, preservation of good paragraphs during repair, missing Six Days in Fallujah, malformed/unavailable review and bounded review budgets. Browser tests add failure preservation/reload cases for unreviewed, fallback and rendered duplicate output. Live cover passed in 22.0s (3 provider attempts, separate factual review, no source passages). Initial live resumes were blocked for unsupported wording; early over-literal same-role project associations were corrected in reviewer policy. Final acceptance is recorded below. These attempts are not a measured reliability guarantee.

Final acceptance: app v68; resume v121 / cover v93 deployed (writer/reviewer logic matches tested v120/v92; final bundle additionally checks rendered education/highlight completeness). 90 local tests passed. Release e8a5ef9 passed core, all browser regressions including failed-draft preservation/reload, both production smoke runs and Pages. Live game resume passed in 39.2s with 17 bullets/eight roles/all seven shipped titles; professional resume passed in 27.2s. Both used five total provider attempts including independent review and successful bounded repair, zero source passages. Cover passed in an earlier live test in 22.0s/three attempts; the final cover retest hit a provider failure and was correctly blocked. Several earlier live drafts were blocked for material issues, over-literal review (subsequently corrected), or malformed repair responses (repair prompt simplified). These results do not establish a high generation success rate. Errors can still be missed or safe wording over-flagged; the review model may be the same as the writer.

The approved game resume was rendered with production HTML to two WeasyPrint pages and visually inspected; native Chrome print export was not re-tested. Existing user documents were not overwritten. Browser tests verify successful reviewed saves/reloads and rejection preserving prior documents. Final module includes expected education/highlight presence checks too. Summary-only edits preserve every byte outside the summary and have only summary-level semantic review.


## Focused v68 live reliability sweep (2026-09-29 MDT)
- Requested baseline: three resumes and three letters on app v68 / resume v121 / cover v93. Gate outcomes: 5 passes, 1 review-block, 0 provider failures. Two passing letters had confirmed unsupported claims; gate success is not factual acceptance.
- Seven corrective live calls followed. Reproduced review misses for external-partner history, personal technology/healthcare passion, historical Excel tasks, database ownership, an invented target profession, and a repeated sentence. Scoped writer/review fixes and tests also remove an overly broad truthful-transition framing block. No game-filter/provider-order work changed.
- Final source: 124b508ab1e6871d6ed9fee7e396a60e31ebfa84; ACTIVE resume v124 / cover v96; frontend remains v68. 68 targeted tests, final core/targeted-browser CI (36667098731), and production smoke (36667098510) pass.
- Final live pair: professional resume review-blocked for unsupported 17 (31.4s); letter passed after correcting unsupported technology passion (25.9s), with repetitive closing themes remaining. High generation reliability is NOT established. No further model trials after that pair.
- All 11 returned documents passed rendered completeness checks. Baseline game resumes retain eight roles/all seven credits and render to two pages; baseline letters/final letter render to one page. Native Chrome print and new live persistence were not verified. No saved documents, approvals or applications changed.
- Full outcomes, manual findings, false-positive limits, CI evidence and follow-up boundaries: docs/qa/2026-09-30-v68-reliability-sweep.md and adjacent JSON.


## Accurx number-review investigation (2026-09-30)
- Replayed the prior Accurx Professional request with an unchanged profile/posting. Diagnostic-only resume v125 reproduced the framing-then-unsupported-17 failure (event 356). Private traces show valid environment-art tenure retained in prose but its citation dropped by the framing repair. The numeric validator correctly rejected the missing citation; no transfer to an unsupported profession occurred in this replay.
- Deployed resume v126 from `b40692ea51f7c46751580c179a24a5c7c16151a6`: private request-linked numeric evidence traces and explicit repair citation obligations. No automatic citation attachment or numeric/profession safeguard relaxation. Cover v96 and frontend v68 unchanged.
- 74 targeted local tests, core/targeted-browser CI 36754731600, and production smoke 36754731548 pass. Public responses do not receive the new private trace data.
- Live verification event 357 did not repeat the number error but was blocked for repeating the headline. It does not establish successful generation or reliable model citation retention. Do not broaden this fix to duplication or repeat the prior sweep.
- Two generation requests total; all saved-document checksums across 368 rows and Accurx's stored track/last-updated value unchanged. Full evidence and limits: docs/qa/2026-09-30-accurx-number-review.md.

## ChatGPT prompt handoff (2026-09-30)
- Frontend v71 carries the complete prompt in ChatGPT's `q` link instead of opening its bare homepage. Clipboard backup remains available, and blocked pop-ups are reported accurately.
- Four focused handler tests pass (long/unicode prompt preservation, clipboard denial, popup blocking, request failure); syntax and whitespace checks pass. Actual signed-in ChatGPT composer prefill is not verified here and may depend on ChatGPT handling the link.


## Word and PDF export inspection (2026-10-08)
- [x] Reproduce and fix Word export joining a cover-letter closing to its signature; preserve HTML breaks as OOXML line breaks.
- [x] Render actual Word exports with LibreOffice and current HTML/PDF with WeasyPrint: two-page resume and one-page letter, every source block present, all final page images clean.
- [x] Pass all existing core regression commands, added line-break unit check, syntax, secret scan and whitespace.
- [ ] Run new browser export regression in CI and verify live download/native Word/browser print after integration. No deployment by this worker.
- Evidence and precise acceptance limits: docs/qa/2026-10-08-document-exports.md.
2026-10-08: PR63 narrowed to independently reproduced Ignored status pill collapse (16px width/~80px height); available width corrected. Applied icon and busy document-control containment are owned by parallel worker PR64; duplicate icon change removed here. Initial PR63 core/browser CI passed; revised four-width status-only CI pending. No deployment.
2026-10-08 isolated QA worker: PR62 line-break preservation and initial PR63 containment pass core/browser CI. PR63 is now status-pill-only to avoid duplicating parallel PR64 document controls/Applied icon. Source-confirmed closure implementation is on `fix/source-confirmed-closure`: availability independent of lifecycle, preservation tests and isolated PostgreSQL migration fixture pass; final closure core/browser CI pass at `8a9096f`, including legacy/out-of-region archived history. Authorized integration, production migration/deployment and live acceptance remain. See `docs/qa/2026-10-08-listing-availability.md`.

## Option 3 integration milestone (2026-10-08)
- Five tools: granted-job lookup, job/profile reads, current document/hash read, resume/cover save and scope/hash/version-protected replacement.
- Archive migration applied; transactional replacement, stale rejection and document independence verified on disposable database fixtures. Archives are service-only and included in backups.
- Deployed raven-mcp-v1 ACTIVE v1 (bridge 0.2.0); unauthenticated requests verified 401. Actual authenticated MCP saves and ChatGPT connection remain unverified.
- 15 bridge tests, all 27 core commands, renderer/syntax/secret/whitespace checks passed.
- Connected Drive verified; existing NetBox Labs resume PDF copied unchanged and metadata-read back in private Raven Applications folder. Automatic Drive synchronization is not implemented.
- Blocker: Supabase OAuth server disabled, no owner Auth user, no exposed secure-settings/secret provisioning operation. Standards-compliant OAuth/consent and account activation remain necessary.


## Apply on site resume trigger (2026-10-08)
- App v81: native employer link opens immediately; scheduled resume-only preparation reuses existing writer, job preparation and persistence. No cover auto-generation or employer submission.
- Refreshes actual source description and saves discovery jobs first; empty/expired sources fail visibly. Existing resumes are preserved and repeated clicks share active generation.
- Six focused execution checks pass. Three browser tests added for save/reload, preservation and missing listing. Local Chromium download failed with invalid archive; browser tests and authenticated live generation/reload remain unverified.
- Existing frontend persistence is reused; no new cross-device transactional-save guarantee is claimed. The MCP bridge retains its separate CAS/archive gate.

## Live consent follow-up (2026-10-09)
User corrected and saved Authorization Path /raven/oauth-consent.html after the old /oauth/consent URL returned 404. User reports ChatGPT authentication succeeded. Direct database read confirms one active public dynamically registered OAuth client named ChatGPT. This verifies registration and user-reported authentication, not authenticated bridge access. Server owner/client/job grants, resource-audience hook and real tool read/save/reload acceptance remain pending. No tokens or private account identifiers are recorded.

## Merge authorization resolved (2026-10-09)
User explicitly authorized PR69 merge and reaffirmed that routine pushes never require another approval. PR69 merged at b344c2b71d40ad766f30adbf082a36382480e879. Prior merge approval blocker is resolved. No source changes since the passing CI; final premerge commit only recorded QA/publication state. Real ChatGPT list/read/save/reload remains pending.

## PR70 publication approved and deployed
User explicitly approved merging/publishing PR70. Merged at bb86e2b0fd35fb62e17cc9d9109c6e95b6fec388; the previous approval blocker is resolved. Pages run 37961312719, main core 37961312588 and first smoke 37961312686 passed. Hosted consent HTML returns 200 and contains the private password form. Full main browser 37961312723 and post-Pages smoke 37961362431 also passed. All release checks are green.

Next action: owner reloads their original signed-in consent tab and privately saves a password. If signed out, authenticate by email after its limit clears. Then reconnect ChatGPT and test actual Raven tools. No private password has been supplied to the agent; actual password setup, OAuth tool access and document save/reload remain unverified.
