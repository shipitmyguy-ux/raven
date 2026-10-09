# Raven: handoff for another AI

Prepared 2026-10-09. This document is an orientation and continuation guide, not a substitute for reading current source and live state. GitHub is authoritative; deployment versions and setup observations below are dated. Never infer that a historical task checkbox describes the current deployment.

## Start here

1. Read [AGENTS.md](../AGENTS.md), [RAVEN_STATUS.md](../RAVEN_STATUS.md), [TASKS.md](../TASKS.md), then [WORK_HANDOFF.md](../WORK_HANDOFF.md), in that order.
2. Inspect branch, clean/dirty status, origin, latest main, relevant PRs and Actions before changing anything. Preserve unrelated local files and edits. Routine new branches use `codex/`.
3. Read the relevant technical documents linked below and inspect the implementation. Date-specific QA records establish what was actually tested.
4. Check exposed Work usage. At 2% remaining or less with refresh more than five minutes away, hold substantial work and preserve completed work. If usage is unavailable, say so and proceed normally.

Repository: [shipitmyguy-ux/raven](https://github.com/shipitmyguy-ux/raven). Web app: [Raven](https://shipitmyguy-ux.github.io/raven/). Supabase project reference: `umvmilulnqnmeqvfoxxc`.

## Product and boundaries

Raven is a web job-search, application-tracking and application-assistance system, with a browser capture/assistance extension. The intended flow is discovery/import → canonical job → evidence assessment → tailored documents → human review → assisted employer form → manual submission → lifecycle/follow-up/analytics.

Four tracks are Professional, Labor, Wildcard, and Games / 3D. Track tabs filter existing results; refresh uses a shared all-track path. Confirmed remote work anywhere is eligible. In-person/hybrid roles require explicit nearby Colorado work locations using the configured city whitelist, not an estimated radius. Professional excludes direct selling duties/titles while permitting appropriate support/operations/enablement. Games / 3D requires relevant art-role evidence and rejects technical/programming and other excluded roles. Filtering must not delete saved documents or application history.

Web and browser extension are in scope. Native iOS/Android are excluded. Final employer submission stays manual. Generated prose must use verified facts; a posting never establishes a candidate qualification. Human document approval remains necessary.

## Canonical systems and file map

| System / source | Responsibility |
| --- | --- |
| GitHub | Code, public configuration, SQL, documentation, tasks, handoffs and release evidence |
| GitHub Pages | Static frontend; `main` publication through Actions |
| Supabase Postgres / Edge Functions | Live jobs, applications, documents, canonical facts, runtime operations |
| `runtime-config.json` | Default public UI/theme/status/features and public OAuth client configuration; never secrets |
| `job-search-config.json` | Search defaults/source configuration |
| Google Drive | Optional authorized copies and configured private source artifacts; not authoritative Raven runtime state |
| Google Sheets | Retired from active architecture; never restore it as a live store |
| Chat history | Transient context; never the sole durable project record |

Important implementation locations:

- `index.html`, `app.js`, `styles.css`, `theme.css`: UI, job/document actions and responsive layout.
- `config.js`, `raven-api.js`: API wiring; inspect these rather than guessing active endpoints.
- `raven-core.js`: canonical normalization, fingerprints, deterministic rendering/cache helpers.
- `document-revision.mjs`, `document-download.mjs`: narrow revision handling and document exports.
- `extension/src/`: `manifest.json`, background/capture scripts, `assistant-core.js`, `chatgpt-files.js`; published package currently verified as 2.2.0.
- `supabase/functions/raven-backend-v3/`: canonical search/jobs, normalization, persistence, signals/events/snapshots and health.
- `supabase/functions/raven-enrich-v1/` and `_shared/listing-availability.mjs`: bounded source enrichment and authoritative closure detection.
- `_shared/track-filter.js`: shared geographic/track eligibility; used by backend and browser.
- `_shared/document-writer.mjs`, `document-handler.mjs`, `document-review.mjs`, `llm-router.mjs`, `cloudflare-free.mjs`, `studio-context.mjs`: structured writing, factual gates, provider routing and official studio context.
- `raven-generate-v1`, `raven-generate-v2`, `raven-cover-v2`: existing generation services. Inventory contains legacy/experimental functions too; existence does not establish current client use.
- `supabase/functions/raven-mcp-v1/index.ts`, `_shared/mcp-bridge.mjs`, `_shared/mcp-oauth.mjs`, `_shared/mcp-resume-renderer.mjs`: ChatGPT-facing bridge.
- `oauth-consent.html`, `oauth-consent.mjs`: hosted OAuth owner sign-in and approve/deny page.
- `supabase/sql/raven-mcp-document-versions.sql`: transactional document archive/replacement RPC; other migrations are under `supabase/migrations/`.
- `scripts/export-raven.mjs`, `verify-raven-backup.mjs`, `restore-raven.mjs`: checksummed portable recovery; device backup also preserves local state/master resumes.
- `.github/workflows/`: `test.yml`, `browser-regression.yml`, `pages.yml`, `production-smoke.yml`.

Architecture and invariants: [ARCHITECTURE](ARCHITECTURE.md), [DECISIONS](DECISIONS.md), [DOCUMENT_WRITING](DOCUMENT_WRITING.md), [POST_APPLICATION_PLATFORM](POST_APPLICATION_PLATFORM.md), [BACKUP_RESTORE](BACKUP_RESTORE.md).

## Shipped baseline and actual evidence

The October 8 ready-fixes release is published: PR67, merge `ba223bcbd019bf4918cbc9dc22ad20c2b4f8bea4`, frontend v80/core v5/export v2, enrich v10, backend v55. It includes genuine Word export, corrected closing/signature line breaks, wrapping document controls, status-pill containment, accessible applied check icon, and persisted source-confirmed closures. Source closures disappear from discovery without losing submitted stages or saved documents. See [release evidence](qa/2026-10-08-ready-fixes-release.md) and [export inspection](qa/2026-10-08-document-exports.md).

Release core/full-browser CI, Pages and both smoke runs passed. Fourteen hosted Edge smoke cases used synthetic backend/ATS fixtures. A disposable live closure fixture verified fresh-read persistence and ingestion-reset protection; its exact QA rows were removed. All 378 existing job/document/lifecycle digests matched before/after. These checks establish that release, not current real employer-form acceptance.

Existing capabilities include canonical deduplicated discovery/import, bounded search with cached-result resilience, description recovery, lifecycle/follow-up controls, job events and immutable application snapshots, interview context, evidence coverage, source/track/submitted-variant analytics, and checksummed backup/recovery. Consult current status for evidence dates rather than copying old live counts.

Application Assistant implements exact-version resume/cover approval, invalidation on changes, contact profile/non-sensitive answer memory, expiring host-scoped single-use packets, conservative completion signals and ATS-specific adapters. Synthetic coverage includes Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo and generic forms. It must not answer legal/demographic/salary/sponsorship/attestation/CAPTCHA/assessment questions or click final Submit.

## Current priority: finish authenticated ChatGPT integration

Option 3 MCP PR59 is merged into main `2512fdd`. OAuth PR68 is merged at `a2936122841d60c668ae8ed6fd9ad81847edb45a`; final PR core and full-browser runs `37952856732` / `37952856793` passed. Main core `37953058958`, full browser `37953059014`, Pages `37953059098` and both production smoke runs `37953059027` / `37953250794` passed. The hosted consent URL returned HTTP 200 with expected content. The user signed in successfully; a direct database read confirms one email-verified Auth account. Publication and owner sign-in are verified; authenticated ChatGPT connection acceptance remains pending.

Primary-agent live verification reports `raven-mcp-v1` v3 ACTIVE, bridge 0.3.0: public protected-resource metadata HTTP 200; anonymous, public-key and untrusted-JWT calls HTTP 401. Nineteen bridge/OAuth tests and required core commands pass. Four installed-Edge consent cases include real pinned SDK/SRI loading and mobile screenshot inspection. Owner sign-in has separate live evidence; these tests do not establish a connected ChatGPT session.

The user enabled Supabase OAuth. Discovery returns 200 and JWKS has ES256. Last discovery lacked `registration_endpoint`; dynamic client registration remains unverified, and no undeleted OAuth client existed at the last database read. Do not repeat obsolete claims that OAuth is disabled or there is no owner Auth account.

Bridge tools are `list_jobs`, `get_job`, `get_verified_profile`, `get_document`, `save_generated_document`. Access is single-owner, explicitly granted jobs/permissions, not tenant-isolated multi-user access. OAuth validates signature, issuer, exact bridge resource audience, expiry, owner, client and session. Standard Supabase OIDC scopes do not grant Raven job/document permissions. Server grants are separate. Public keys and `x-raven-client` never authorize MCP.

Initial document saves check empty field and version atomically. Replacements additionally require explicit replacement, `documents:revise`, matching current document hash and version; the RPC locks/archives/updates transactionally and changes only the requested document. Saved output is HTML, not a native PDF. Manual/MCP import uses deterministic evidence/schema/rendered-content checks, not the full model-review pipeline or comprehensive truth proof.

Continue in this order:

1. Verify published consent page and protected-resource metadata. Dashboard Site URL is `https://shipitmyguy-ux.github.io`; Authorization Path is `/raven/oauth-consent.html`. Allow the consent URL and authorization-query variant in Auth redirect settings; verify DCR. Supabase's actual toggle label is **Allow Dynamic OAuth Apps**, below Authorization Path. Confirm **Enable dynamic app registration**, then **Save changes**.
2. Owner sign-in is complete. Provision `RAVEN_MCP_OWNER_SUBJECT` as that account's Supabase Auth UUID securely, never in public files; server provisioning is still pending.
3. Register/approve the actual client. Provision `RAVEN_MCP_OAUTH_GRANTS` with owner subject, exact client ID, expiry, explicit job IDs (1–200) and selected `jobs:read`, `profile:read`, `documents:create`, `documents:revise` permissions. Secrets tooling is not currently exposed through the connector; dashboard/approved secure configuration may be necessary.
4. Configure a Custom Access Token Hook for the explicitly registered Raven client to issue audience `https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-mcp-v1`. Preserve required claims and other clients' audiences. Never relax validation to generic `authenticated` or accept ID tokens.
5. Verify token issuance/consent and real authenticated reads. Exercise wrong-owner/client, expired credentials, grant removal, stale writes and exact-document replacement safety in production with controlled fixtures.
6. Verify ChatGPT retrieves a granted job and complete description, reads canonical facts, generates grounded structured content, saves to that exact job, and Raven restores the same output after a full reload. Confirm resume/cover independence and preservation of existing documents.

Grant removal is checked every request. Signature verification alone does not prove immediate Supabase session/consent revocation; production revocation/expiry acceptance remains pending. Never use no-auth as a setup workaround. See [MCP setup and security contract](RAVEN_MCP_BRIDGE.md).

The user reports clicking “Connect Raven” inside chat does nothing, but copying/pasting the link into an external browser works. Treat this as a reported chat navigation symptom with an external-browser workaround, not a reproduced Raven code bug. Sandbox browser/shell setup failures likewise describe the execution environment, not Raven runtime.

## Upcoming work, in practical order

| Priority | Work | Completion evidence required |
| --- | --- | --- |
| 1 | OAuth owner/client/grants/audience setup and ChatGPT activation | Actual authenticated retrieve → generate → save → Raven reload, plus rejection/revocation checks |
| 2 | Apply on site resume-only preparation acceptance | Six focused checks and new browser cases pass in final CI; real validated output on correct job, fresh reload and unchanged cover/history remain necessary |
| 3 | Manual ChatGPT JSON/device transfer acceptance | Reload installed extension, signed-in prefill/file generation, job-bound attachment validation/persistence and refresh |
| 4 | Drive copy automation | Persisted success/failure/retry after confirmed Raven save; real resume and cover PDF copies read back, intended private account/folder verified |
| 5 | Real employer Application Assistant acceptance | Current form selectors, exact approved file attachments, sensitive-question blocking, correct completion matching; manual final submission |
| 6 | Native export acceptance | Inspect actual output in native Word and browser print/PDF, including pagination, closing/signature and all source blocks |
| Continuing | Generation reliability and source-quality improvements | Bounded comparable live trials, factual audit and preservation on failure; never treat passing review as clean-quality proof |
| Future / conditional | Personal email/OAuth outcome adapter, additional direct ATS coverage, employer→ATS registry | Privacy/storage design and explicit account authorization first; value justifies maintenance |

One authorized Drive resume PDF copy was uploaded and metadata-read back. That proves a connector-assisted copy only. Automatic backend synchronization and cover-letter Drive acceptance are unfinished; connector credentials are not available to the Edge Function. Supabase remains canonical.

Personal email ingestion is not connected. Generic signal classification/matching and confidence-gated events exist; do not describe an email adapter as shipped. A paid OpenAI provider pilot PR58 remains inactive: do not merge or enable it. PR61 and dependency maintenance PR53/54 were pending in the last release record; inspect their current GitHub state before planning around them. Option 2 sign-in with ChatGPT was pending eligibility and is separate from MCP.

## Known defects, limits and historical issues

- **Confirmed writing limits:** high clean-document success is unestablished. Recorded trials had review-blocked professional output, repeated headline/closing themes, provider timeouts and citation-retention failures. Numeric guard follow-up resolved the reproduced number rejection but did not resolve separate repetition. These are dated observations requiring focused reproduction, not permission to loosen grounding gates. See [reliability sweep](qa/2026-09-30-v68-reliability-sweep.md) and [number review](qa/2026-09-30-accurx-number-review.md).
- **Scoped revision limit:** only resume summaries have a surgical patch path preserving every outside byte. Other section-specific requests can still use whole-document writing. Do not promise narrow preservation for them.
- **Source completeness:** some aggregators expose snippets only; one previously documented short employer posting lacked a detailed public description. Extension capture/official ATS resolution can help, but missing source facts must never be invented.
- **Historical prompt failure:** October 6 manual prompt fetch failed before ChatGPT opened, and a one-off external draft had malformed keys/unsupported wording. Current live reachability and clean latency remain unverified; do not claim a universal ongoing outage without retesting.
- **Historical saved typo:** TASKS retains a request to locate/review any saved resume with “Darksiers.” The generation guard prevents new near-miss titles but does not repair old stored documents. Confirm an actual affected document before a scoped correction.
- **Acceptance gaps:** OAuth end-to-end, extension installation, signed-in ChatGPT transfer, native export and actual employer forms have not been established by mocks/package downloads or database unit tests.
- **Superseded:** PR55/62–65 publication blockers, APPLIED text badge, collapsed pills, joined Word signature and closure-persistence defects were addressed by the October 8 release. PR66 was closed as a duplicate. PR59 is now merged. Older service versions and “OAuth disabled” notes are history.

## Writing and data safety rules

Default generation uses Cloudflare Workers AI with the existing Workers Free check, then zero-price OpenRouter fallback. The production writer uses structured drafts, canonical facts, deterministic checks and separate final factual review, within bounded budgets/circuits/quotas. Source-fact/mixed fallback cannot become an application-ready production success. A failed/unavailable review must preserve saved documents. Model review can miss errors or flag acceptable wording; human review remains required. MCP/manual import has a different deterministic validation path; do not conflate them.

Do not reset provider circuits/quotas, introduce paid routing, silently re-certify old documents, automatically approve generated files, infer sensitive answers or submit employer applications. Document changes invalidate exact-content approval. Test on synthetic/disposable records where possible, compare existing state before/after, remove only exact QA records and report the cleanup.

Never commit tokens, secrets, service-role keys, private qualifications/resumes/contact details or live job data. Public runtime keys are not server credentials. Canonical jobs currently lack tenant ownership columns; expanding to multiple owners requires a deliberate isolation design. Preserve immutable snapshots/archives and service-only access.

Standing authorization permits routine Raven Git pushes. It does not grant unrelated destructive actions or new spending. User shorthand `d` means “do it” for the current proposed action/priority. Check current applicable authorization before publishing features beyond the already authorized integration/release scope.

## Validation and operations

Use Node 22 and the committed dependency lock. Initial commands:

```sh
git status --short --branch
git remote -v
git fetch origin
npm ci --ignore-scripts --no-audit --no-fund
node scripts/check-secrets.mjs
git diff --check
node scripts/build-mcp-renderer.mjs --check
node --test tests/mcp-bridge.test.mjs tests/mcp-oauth.test.mjs tests/apply-resume.test.mjs
npm run test:e2e
npm run test:smoke
```

Run **all current syntax and core regression commands from [.github/workflows/test.yml](../.github/workflows/test.yml)** for meaningful changes; some tests are custom executable files, so `node --test tests/*.mjs` is not an equivalent substitute. Browser setup and projects are defined in `playwright.config.mjs` and browser workflows. Install the configured browser where needed. Mocked browser tests establish contracts; distinguish them from real user login, live model quality and employer-site behavior. Do not use browser automation to click final submit.

The MCP renderer is generated from canonical rendering; regenerate using `scripts/build-mcp-renderer.mjs` when appropriate and inspect differences. Windows line-ending drift can affect the check without a content change; do not dismiss actual renderer drift as formatting.

Frontend publication follows `pages.yml` after committed main changes; verify hosted `/raven/` paths, assets/config/version and successful production smoke. Edge Function code and SQL require separate deployment/application from committed source. MCP deploys with `verify_jwt=false` because its own handler performs strict authentication; other functions have existing client/origin gates that must be preserved. Verify active bundles/metadata/rejection behavior instead of assuming frontend publication redeployed Supabase.

Backup commands are `npm run backup:raven`, optional `-- --scope=full`, and `npm run verify:backup`; inspect [backup instructions](BACKUP_RESTORE.md) for arguments and secure environment requirements. Restore is dry-run by default; destructive replacement is explicitly gated. Do not put private backups in the public repository.

Before ending meaningful work, commit/push authorized changes, update status if state changed, reconcile tasks, and replace the execution handoff with exact verified results, remaining setup and next action. Record commit/PR/deployment identifiers and distinguish implemented, tested with fixtures, deployed, and live accepted. A queued document task is complete only when real output is linked to the correct job and survives refresh.

## Suggested prompt for a replacement AI

> Continue Raven from GitHub repository shipitmyguy-ux/raven. Read AGENTS.md, RAVEN_STATUS.md, TASKS.md, WORK_HANDOFF.md and docs/RAVEN_AI_HANDOFF.md before acting. Verify current main, PRs, Actions and live configuration; the dated handoff may be superseded. Finish the current authenticated ChatGPT integration priority through real retrieve/generate/save/full Raven reload acceptance while preserving user documents and exact-version approvals. Keep provider costs unchanged, credentials server-only, explicit job/client permissions, resource audience validation and manual employer submission. Report exactly what is verified and preserve durable project state in GitHub.
