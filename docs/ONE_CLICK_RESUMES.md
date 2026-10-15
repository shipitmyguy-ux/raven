# One-click resume and Drive PDF

The Raven ChatGPT button now calls a local helper: generate from the exact job and canonical verified profile, validate/save through the existing private bridge, render the saved HTML as PDF, upload through connected Google Drive, verify PDF metadata and folder, and persist the Drive link. It opens Raven review after fresh job/activity readback. No prompt sending, JSON transfer, download or manual upload is required. Human review and employer submission remain manual.

The helper uses the installed Codex CLI signed into ChatGPT. No paid API provider or API key is enabled. Keep this computer and helper running. Launch under the owner Windows account with `scripts/start-oneclick-raven.ps1`; encrypted existing tunnel credentials, installed Edge, npm dependencies, ChatGPT CLI sign-in and connected Google Drive are required. The browser may request a one-time local-network permission. The helper is not installed as an automatic Windows startup service.

Public defaults remain in runtime-config.json: chatgpt-one-click=true and chatgpt-helper-url=http://127.0.0.1:8766. Disable the flag to restore the direct ChatGPT handoff described in CHATGPT_DIRECT_RESUMES.md. Existing saved documents are reused, not overwritten. Retrying verifies the existing Drive file; durable local receipts recover an upload whose Raven event write failed without reuploading different PDF bytes. New uploads use company/title/document filenames.

The helper binds only 127.0.0.1, checks Raven origin, page referrer, host, client header and expiring in-memory bearer sessions. It authorizes the canonical job before queue/event writes. Two isolated document workers can run concurrently. Short private-bridge calls are serialized to preserve grant state, and saves are coordinated per job with fresh version checks. The original scope/expiry/create-only safeguards still apply. The current personal grant expires November 1, 2026. Progress is persisted in existing raven_job_events; no database schema/public OAuth changes. Secrets never enter browser configuration or model subprocesses.

Draft generation disables apps, shell and web search. Upload subprocesses expose only the registered connected Drive upload_file/get_file_metadata tools; per-process approval is restricted to the explicitly requested upload. Verification subprocesses expose metadata only. Drive success must come from actual successful connector events, matching source path/name/folder and PDF metadata; model output alone is never accepted. Metadata verification is connector-reported, not separate server Google OAuth.

## Actual acceptance, October 13, 2026

One fresh request for Mob Entertainment Principal Environment Artist (JT-1791413319517), run cc07e339-7586-442f-a02d-c64632013a99, completed writing, canonical save, PDF rendering, real Drive upload/metadata verification and durable export recording without a ChatGPT window or extra approval. Document SHA256: 6e20888cb4a7b55166fee56cd2a49d1592e2252aed0886215a12e08e100354df. File 1Aswd4Dfuaz9z35JZMx_shPr7Ag-kNW1- is a 70,461-byte PDF in 1resumecoverletter. Two PDF pages were visually inspected; extraction found all source blocks. Independent profile audit found no unsupported material claims. The initial BulletFarm run saved its draft but stopped at tool approval; a narrowly scoped upload setting resolved it and retry reused the saved document successfully.

All52 local core workflow commands,24 oneclick cases, four focused Edge browser cases, secret scan, diff check and new PowerShell launcher syntax passed. Browser fixtures cover automatic review/refresh and stopped-helper handling. GitHub publication and real browser acceptance are recorded separately in WORK_HANDOFF.md; do not infer them from local tests. Personal output and receipts remain ignored under private/.

## Published acceptance

PR74 merged/published at 144ac07eb08a0c0861e2a4772e8dfd7a34349ba8. PR core/Windows/safety checks and125 browser cases passed. Main core38470191323, browser38470191259 (125 cases), Pages38470191324, push smoke38470191266 and post-Pages smoke38470240820 (14 cases) passed. Actual published app87/runtime flag and real Edge button/helper run64ab5365-daba-446c-8a8e-d1f7b6a1fb36 passed without local asset routing or a ChatGPT window. Full reload retained the exact document SHA, Drive file, Applied status and approval. Normal local-network permission was explicitly granted; users may need to allow it once. Final helper restarted and remains running; no automatic startup service. Personal outputs/receipts remain ignored.

## Document controls

With one-click enabled, Prepare application, Create missing documents, and individual empty-document Generate actions use the same helper. Up to two document tasks run at once: a resume and cover letter for one job, or resumes for two different jobs. A pair reserves both worker slots and drafts its two documents concurrently. Further requests wait for capacity. Overlapping requests for the same job/document are reused or rejected instead of producing competing writes. Existing documents/exports are reused; explicit revisions retain the existing revision route. Background completion does not open review over another selected job.

Each Codex subprocess already has a separate UUID work directory and retains the existing ChatGPT sign-in, model configuration, restricted tool access, and factual validation. Parallel drafts do not grant additional tools or enable API billing. Short private bridge operations remain serialized. Saves re-read the current posting/profile and document state under a job lock; sibling-document version changes are allowed only when the source context is unchanged. Same-document workflow and application-PDF access share a lock so a second export cannot replace a file during upload/readback. Pair failures retain the successful sibling for review and retry. The helper health response exposes `writer_concurrency: 2`. Paired phone work can claim up to two rows while preserving its existing authorization and conditional claim checks.

This is bounded concurrency, not a claim of unlimited immediate execution or a measured speedup. Independent barrier tests verify overlapping work and the concurrency ceiling; live simultaneous model throughput still depends on ChatGPT and Drive response times.

Activity keeps the latest valid export per document visible alongside recent progress. Published app89 read-only acceptance confirmed two links survive reload without helper calls or changes to existing documents/Drive files/approval/application state. Export visibility remains bounded by the existing200-event activity fetch.

## Always-on local writer and phone queue — October 14, 2026

The writer stays on the owner's Windows computer. A protected Supabase queue carries requests from paired browsers; it does not run the AI or hold ChatGPT/Drive credentials. The computer polls outbound, so no tunnel, inbound router port, or public helper listener is needed. Local generation remains available if the queue service is unavailable.

### Activate on the existing Windows computer

1. Update the existing Raven checkout with `git pull --ff-only` and install its locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund`.
2. Close the previously launched helper window after any generation finishes. The startup supervisor deliberately does not terminate an existing manual helper.
3. From the repository root, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-oneclick-startup.ps1` as the Windows account already signed into Codex and Drive. No administrator account, saved Windows password, or machine-wide execution-policy change is requested.
4. Open Raven Options → **Connect phone to writer** on that computer. Allow the browser's local-network permission if requested, then create a private pairing link.
5. Open the link on the phone and select **Connect this device** once. Return to Raven; the normal Generate buttons now submit to the local writer queue.

This session cannot install the task or verify personal generation on the owner's Windows machine. Source publication is not activation. End-to-end acceptance still requires an actual paired phone request, canonical document/PDF readback and reload on that computer.

### Startup and power behavior

The current-user scheduled task starts after Windows sign-in, runs with limited privileges, and restarts its supervisor after failure. The supervisor restarts the helper after process failure and avoids duplicate helper processes. The helper prevents idle sleep only while document jobs are queued locally or running, including saving, PDF uploads and receipt checks. Overlapping jobs share one hold until the final job completes or fails. This applies on AC and battery without keeping the display on. Idle polling, pairing and phone heartbeat do not hold the laptop awake. Helper completion or crash releases the request. No Windows power-plan, explicit sleep or lid setting is changed. Windows restart requires signing in again. While asleep, the laptop cannot claim phone requests; they wait until it wakes.

In Raven, open **Options → Laptop keep-awake** for live status and **Stop keeping awake**. Status refreshes every five seconds while Options is open. It distinguishes starting, on, stopped, idle and unavailable. Stop leaves jobs running and allows normal sleep for the remainder of that batch; the next batch enables keep-awake again. These controls address the local writer on this computer; an unavailable or outdated writer shows an actionable message.

The optional standalone fallback remains: run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\control-oneclick-awake.ps1 -Action Status` to check the current Raven sleep hold. Use `-Action Stop` to release it without cancelling jobs. The hold stays off for the remainder of that overlapping batch; the next batch enables it again. Normal sleep may pause unfinished work after a manual stop.

Remove startup using `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-oneclick-startup.ps1 -Remove`. A manually started helper is not owned or stopped by that task.

### Pairing and recovery

Pairing creates a random 256-bit device credential. Only its hash is stored server-side; the phone stores the token locally. Pairing uses a URL fragment, removes it from browser history immediately, and requires a deliberate Connect action. Do not share this link publicly. Creating a new pairing link revokes all prior device credentials for that computer. Disconnect removes the credential from that browser; re-pair on the computer for server-wide revocation.

Pairing cannot outlive the existing local document grant (currently documented as November 1, 2026). Expired grants require owner renewal and re-pairing. Each request is authorized again by the local writer before generation. The queue cannot revise, overwrite, approve, or submit an application. Only the existing create/reuse document workflow runs.

Pending requests survive a closed phone browser. A pending retry reuses the same run; the queue is capped at 20 pending/running requests per computer. Computer heartbeat makes offline waiting visible. Interrupted running requests fail on helper restart and require a retry, which reuses saved documents and verified upload receipts. No automatic takeover reruns an uncertain upload. After 15 minutes the phone stops watching but the queued/running work remains; refresh Raven later for saved documents and activity. Status/result lookup is restricted to the paired device that created the request.

Database tables have RLS enabled, no client-role grants, and no public policies. The Edge Function verifies a nonexpired/nonrevoked paired credential before operations; only service-role access can call the atomic enqueue function. This is the existing single-owner dataset architecture, not multi-user tenancy.

### Future feature: cloud-hosted writer

Backlog only: move the same writer to an owner-controlled always-on host so the laptop can be off. Preserve the queue, factual checks, create-only saves, receipts, and Drive readback. Before enabling, verify ChatGPT-plan eligibility for the exact hosting arrangement, protected authentication/refresh, Drive/PDF runtime support, costs, and worker ownership/failover. Do not turn on a separately billed model fallback without explicit authorization. No cloud generation host has been provisioned.

## Routing and diagnostics (October 14, 2026)

All browser document actions select their adapter through routeDocumentRequest. Explicit revisions retain the existing revision writer; configured one-click generation/export uses the existing helper. Application preparation retains its extension-independent orchestration and blocks competing document actions. No extension reload is needed for this change.

Run `npm run test:documents` for the focused synthetic client/workflow/server/security suite. Existing core CI invokes these files, and full browser CI includes request/stage failure recovery. Local server tests need loopback HTTP and temporary-file rename permissions.

For a failed run, use the request ID shown in Raven to find `private/oneclick/runs/<run_id>.json` or the matching `resume_workflow` job event. Diagnostics contain `failed_stage`, `failed_document_type`, `error_code`, `stage_started_at`, `elapsed_ms`, and `stage_timings` (stage/document/duration_ms). Unknown error messages map to WORKFLOW_FAILED; raw tool errors, prompts and credentials are not added to diagnostics. Timings for concurrent documents overlap and must not be summed as wall-clock duration. Existing upload receipts and canonical readback still govern retries. The local helper needs a normal restart to load changed server code; frontend publication alone cannot update a running helper.

## Automated upload and restart recovery regressions

Run `npm run test:document-recovery` for the six process-level recovery cases, or `npm run test:documents` for the full focused suite. Existing core CI runs recovery jobs on both ubuntu-latest and windows-latest with Node22; failures fail CI.

The suite uses the production client, helper, workflow and receipt journal with temporary file-backed synthetic document/Drive services. Each resume, cover-letter and paired case first creates synthetic documents and uploads, then interrupts before link recording. One mode returns a failed write; the other force-kills the actual child listener, starts a fresh helper on the same isolated port, and verifies HELPER_RESTARTED and bearer renewal before explicit retry.

Assertions cover no generation/render/upload on retry, unchanged document/PDF hashes and modification times, physical file count and exact file IDs, canonical job linkage, one export event per document, unchanged approval/control-application state, repeated retry idempotence and completed-output recovery in another fresh process/session. Fixture state is restricted to uniquely created OS temporary directories; it never reads private configuration, inherits credentials, contacts real Drive or binds the production helper port. These deterministic service-boundary tests replace repeating manual recovery checks for code changes; they do not exercise Google OAuth or provider availability.

Automated coverage was merged in [PR88](https://github.com/shipitmyguy-ux/raven/pull/88). All six cases passed on both Linux and Windows in [PR CI](https://github.com/shipitmyguy-ux/raven/actions/runs/38673592388) and [main CI](https://github.com/shipitmyguy-ux/raven/actions/runs/38673813682). The PR full browser regression also passed all165 cases.

## Validation repair, October 15, 2026
Explicit application phrases referencing the exact advertised title no longer count as unsupported past seniority. Historical title claims remain checked. Bounded repairs include the validator explanation. Exact rejected cover drafts pass local replay; live save/export retry requires user approval after automatic review rejection.

## Candidate identity and character limits

The owner-directed document policy restores **Mike Rodriguez** in every newly validated resume name and cover-letter signature. This applies to local generation, server writing, manual imports and full revisions. Existing saved documents are preserved. Prompts and structured schemas share the passage maxima enforced at save time.

Explicit document-specific character caps found in supplied posting text or revision instructions override word-count targets. The final gate counts rendered visible text, including identity/contact/section labels, with whitespace collapsed to a single space. It rejects overlong output and provides bounded repair feedback rather than slicing prose or dropping required facts. Summary-only revisions preserve every other saved section and validate supplied summary and complete-resume caps. Employer limits that are not supplied or detectable from posting/instruction text remain unknown; this is not a claim to inspect every employer form limit.
