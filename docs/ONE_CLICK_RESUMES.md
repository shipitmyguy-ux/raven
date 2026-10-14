# One-click resume and Drive PDF

The Raven ChatGPT button now calls a local helper: generate from the exact job and canonical verified profile, validate/save through the existing private bridge, render the saved HTML as PDF, upload through connected Google Drive, verify PDF metadata and folder, and persist the Drive link. It opens Raven review after fresh job/activity readback. No prompt sending, JSON transfer, download or manual upload is required. Human review and employer submission remain manual.

The helper uses the installed Codex CLI signed into ChatGPT. No paid API provider or API key is enabled. Keep this computer and helper running. Launch under the owner Windows account with `scripts/start-oneclick-raven.ps1`; encrypted existing tunnel credentials, installed Edge, npm dependencies, ChatGPT CLI sign-in and connected Google Drive are required. The browser may request a one-time local-network permission. The helper is not installed as an automatic Windows startup service.

Public defaults remain in runtime-config.json: chatgpt-one-click=true and chatgpt-helper-url=http://127.0.0.1:8766. Disable the flag to restore the direct ChatGPT handoff described in CHATGPT_DIRECT_RESUMES.md. Existing saved documents are reused, not overwritten. Retrying verifies the existing Drive file; durable local receipts recover an upload whose Raven event write failed without reuploading different PDF bytes. New uploads use company/title/document filenames.

The helper binds only 127.0.0.1, checks Raven origin, page referrer, host, client header and expiring in-memory bearer sessions. It authorizes the canonical job before queue/event writes. A serialized queue preserves bridge grant state. The original scope/expiry/create-only safeguards still apply. The current personal grant expires November 1, 2026. Progress is persisted in existing raven_job_events; no database schema/public OAuth changes. Secrets never enter browser configuration or model subprocesses.

Draft generation disables apps, shell and web search. Upload subprocesses expose only the registered connected Drive upload_file/get_file_metadata tools; per-process approval is restricted to the explicitly requested upload. Verification subprocesses expose metadata only. Drive success must come from actual successful connector events, matching source path/name/folder and PDF metadata; model output alone is never accepted. Metadata verification is connector-reported, not separate server Google OAuth.

## Actual acceptance, October 13, 2026

One fresh request for Mob Entertainment Principal Environment Artist (JT-1791413319517), run cc07e339-7586-442f-a02d-c64632013a99, completed writing, canonical save, PDF rendering, real Drive upload/metadata verification and durable export recording without a ChatGPT window or extra approval. Document SHA256: 6e20888cb4a7b55166fee56cd2a49d1592e2252aed0886215a12e08e100354df. File 1Aswd4Dfuaz9z35JZMx_shPr7Ag-kNW1- is a 70,461-byte PDF in 1resumecoverletter. Two PDF pages were visually inspected; extraction found all source blocks. Independent profile audit found no unsupported material claims. The initial BulletFarm run saved its draft but stopped at tool approval; a narrowly scoped upload setting resolved it and retry reused the saved document successfully.

All52 local core workflow commands,24 oneclick cases, four focused Edge browser cases, secret scan, diff check and new PowerShell launcher syntax passed. Browser fixtures cover automatic review/refresh and stopped-helper handling. GitHub publication and real browser acceptance are recorded separately in WORK_HANDOFF.md; do not infer them from local tests. Personal output and receipts remain ignored under private/.

## Published acceptance

PR74 merged/published at 144ac07eb08a0c0861e2a4772e8dfd7a34349ba8. PR core/Windows/safety checks and125 browser cases passed. Main core38470191323, browser38470191259 (125 cases), Pages38470191324, push smoke38470191266 and post-Pages smoke38470240820 (14 cases) passed. Actual published app87/runtime flag and real Edge button/helper run64ab5365-daba-446c-8a8e-d1f7b6a1fb36 passed without local asset routing or a ChatGPT window. Full reload retained the exact document SHA, Drive file, Applied status and approval. Normal local-network permission was explicitly granted; users may need to allow it once. Final helper restarted and remains running; no automatic startup service. Personal outputs/receipts remain ignored.

## Document controls

With one-click enabled, Generate both, Finish documents and individual empty-document Generate/ChatGPT buttons all use the same helper. A running resume reserves only resume; a cover-letter request can be accepted and shown queued while it waits for the helper. Generate both reserves both kinds and suppresses overlapping duplicates. Busy labels survive job-card rerenders. Helper execution stays serialized to protect canonical save versions; accepted requests are not simultaneous model calls. Existing documents/exports are reused; explicit revisions retain the existing revision route. Background completion does not open review over another selected job.

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

The current-user scheduled task starts after Windows sign-in, runs with limited privileges, and restarts its supervisor after failure. The supervisor restarts the helper after process failure and avoids duplicate helper processes. While plugged in, it requests system wakefulness without keeping the display on. It releases the sleep request on battery and on exit. It does not change lid-close behavior, disable explicit sleep, bypass Windows sign-in, or keep a signed-out session alive. Keep the laptop plugged in, signed in, and ventilated with the lid open. Windows restart requires signing in again.

Remove startup using `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-oneclick-startup.ps1 -Remove`. A manually started helper is not owned or stopped by that task.

### Pairing and recovery

Pairing creates a random 256-bit device credential. Only its hash is stored server-side; the phone stores the token locally. Pairing uses a URL fragment, removes it from browser history immediately, and requires a deliberate Connect action. Do not share this link publicly. Creating a new pairing link revokes all prior device credentials for that computer. Disconnect removes the credential from that browser; re-pair on the computer for server-wide revocation.

Pairing cannot outlive the existing local document grant (currently documented as November 1, 2026). Expired grants require owner renewal and re-pairing. Each request is authorized again by the local writer before generation. The queue cannot revise, overwrite, approve, or submit an application. Only the existing create/reuse document workflow runs.

Pending requests survive a closed phone browser. A pending retry reuses the same run; the queue is capped at 20 pending/running requests per computer. Computer heartbeat makes offline waiting visible. Interrupted running requests fail on helper restart and require a retry, which reuses saved documents and verified upload receipts. No automatic takeover reruns an uncertain upload. After 15 minutes the phone stops watching but the queued/running work remains; refresh Raven later for saved documents and activity. Status/result lookup is restricted to the paired device that created the request.

Database tables have RLS enabled, no client-role grants, and no public policies. The Edge Function verifies a nonexpired/nonrevoked paired credential before operations; only service-role access can call the atomic enqueue function. This is the existing single-owner dataset architecture, not multi-user tenancy.

### Future feature: cloud-hosted writer

Backlog only: move the same writer to an owner-controlled always-on host so the laptop can be off. Preserve the queue, factual checks, create-only saves, receipts, and Drive readback. Before enabling, verify ChatGPT-plan eligibility for the exact hosting arrangement, protected authentication/refresh, Drive/PDF runtime support, costs, and worker ownership/failover. Do not turn on a separately billed model fallback without explicit authorization. No cloud generation host has been provisioned.
