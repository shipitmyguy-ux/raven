## Current handoff — remote games spreadsheet ingestion (October 14, 2026 MDT)

Raven Supabase project `umvmilulnqnmeqvfoxxc`; GitHub `shipitmyguy-ux/raven`. The spreadsheet URL is `https://docs.google.com/spreadsheets/d/1Kue4iGy1WNpItNyCpaMT9__A_228NmbQ9s_uUcc3wb8/edit`. Source is user-supplied public job leads.

Implemented and live deployed:
- `supabase/functions/_shared/studio-sheet-feed.mjs`, `job-duplicate-evidence.mjs`, and `supabase/functions/raven-studio-scan/index.ts`; deployed scanner v15 with existing cron authentication unchanged.
- Migration `20261015003800_remote_games_sheet_source.sql` added enabled `remotegamessheet` source `tim-ploeger-remote-games` on 24-hour check interval. Existing `raven-studio-scan-15m` cron executes it.
- First scheduled scan at `2026-10-15T00:30:02Z`: `ok`, fetched 656, eligible 28, duration 1118ms; next check `2026-10-16T00:30:02Z`.
- Initial 30 manual sheet records preserved, read-only API shows 19 of them among 26 visible Games / 3D results, no repeated URLs.
- Source registry enlarged from 169 to 373 by adding 204 disabled/unverified company candidates using migration `20261015003900_sheet_studio_candidates.sql`. No assumed official careers ownership.
- GitHub Actions `refresh-remote-games-sheet.yml` now refreshes the JSON snapshot only. No GitHub service-role secret required; no competing live import loop. The public fetch/validation Actions run passed.
- Tests: `tests/job-duplicate-evidence.test.mjs`, `tests/studio-sheet-feed.test.mjs`, `tests/studio-sheet-scan-handler.test.mjs` added to `.github/workflows/test.yml`. Core CI run 38660556057 passed (core, Windows and browser safety), and logs confirm the three new spreadsheet/dedup tests were invoked. Snapshot refresh run 38660555783 and production smoke run 38660555953 passed.

Remaining: GitHub issues #85 (official studio feeds) and #86 (cross-source text dedup through all ingestion). Verify official career/ATS destinations one by one, audit cross-source title/location aliases and any stale/manual geography rows. Keep entire user's saved-job/document/application history intact. No worker agent started from this chat.

# Raven execution handoff

## Bulk 3D preparation and Apply action - October 14, 2026

The owner authorized read-only Raven/email application-history checks and document preparation for remaining active 3D roles, with helpers in parallel and no submissions. Audit and batch results remain private outside Git. Confirmed applied/ignored/expired roles are excluded; original application records, snapshots and existing documents are preserved. Bulk generation and current-export readback are still in progress; do not mark queued work complete.

Web app96/module6 now labels the verified primary action Apply job when both documents are saved. Exact Lever HTTPS employer-slug/UUID postings map to the same job /apply route while canonical verification/recovery retain the saved URL; Ashby keeps its existing mapping. Unknown destinations and login gates remain manual. Manual preflight stops before PDF-byte/profile retrieval. A different paused job is named explicitly with Review paused preparation, retaining its metadata and linking to the existing Resume/Dismiss choices rather than silently replacing it.

The shared duplicate comparison now recognizes an exact employer ATS requisition despite translated/shortened titles, retaining same-employer, distinct-requisition and unverified-alias safeguards. This web deployment updates browser suppression; no backend function deployment is claimed. Existing saved exclusions suppress the specifically reviewed mirrors without inventing new Applied history.

Validation: all38 local core groups, all157 local Edge browser cases,45 preparation Node cases, secret scan and clean diff passed. A Windows control-test isolation issue was found while work was active: tests now pass their own holder PID and prove another hold survives. A private temporary batch sleep guard protects ongoing work until the helper drains; it changes no Windows power-plan settings and is not a permanent service. Verify its release at final completion. Extension and running writer source are unchanged; no extension reload or helper restart is required. Publication pending.

## Live keep-awake acceptance - October 14, 2026

Completed the owner-authorized real 3D-job test with a Blackbird Interactive Environment and Prop Artist role missing both documents. Used published Raven Generate controls in two sequential runs. No existing document was deleted or replaced. The job remains Saved; no employer form, upload or submission was attempted.

Observed Off before work, On during resume generation, and Stopped with the task still running after clicking Stop. Independent native verification confirmed the hold was released while the writer continued. The resume completed successfully in45.9s. A new cover-letter batch automatically reacquired the hold, confirmed in Raven and by the native control. It completed in40.8s without Stop. Raven automatically returned to Off, the native hold was absent and the helper reported zero active tasks. Timings cover accepted-run creation through durable completion, including PDF and Drive verification, excluding manual test gaps.

Both saved documents and their Current PDF links survived full Raven refresh. Workflow validation and Drive receipt checks passed; no separate full content/layout audit was performed. Private identifiers, links, hashes, screenshots and document content are excluded from these repository notes. Left the job drawer open for owner review. No source, extension or helper update was necessary.

Follow-up observation: Chrome automation briefly disconnected and reconnected during each real run; recovered the unchanged Raven tab. Document generation and Raven status continued successfully. A separate read-only connector probe was rate-limited; verification used Raven and local completion evidence. These connector interruptions are not claimed fixed.

## Keep-awake controls inside Raven - October 14, 2026

Options now includes Laptop keep-awake with automatically refreshed local status, active-task count, Check status and Stop keeping awake. States distinguish idle, starting, confirmed awake, manually stopped and unavailable; an absent/old writer is never labelled off. The UI only checks on opening Options and while it remains open. Closing Options ends polling. Paired-phone generation is unchanged; these controls address the writer on this computer.

The authenticated loopback GET /power and exact POST /power/stop routes retain existing origin, referrer, local-client and bearer-session checks. Stop releases the sleep hold without cancelling jobs, changing documents or statuses, or submitting applications. The remainder of an overlapping batch stays released; the next batch reacquires it. Native confirmation and exit update the state, including stops from the existing shortcut. App95/client4; no extension update.

Verified all38 local core command groups, secret scan, syntax and all155 Edge browser tests. New tests cover session/foreign-origin/GET-mutation rejection, invalid Stop payload, parallel-job stop/rearm behavior, client response validation, live UI Stop and missing/outdated helper recovery. Restarted the idle existing helper; authenticated live /power returned supported:true, active_tasks:0, state:idle. No personal document generation or submission. Published at 054e6fb (app95/client4); hosted page, controls and matching client verified. Main core/Windows/safety, all155 hosted browser tests, Pages deployment and both production smoke runs passed. Refresh Raven; no extension reload or further helper restart is required.

## Keep awake only during jobs - October 14, 2026

Implemented and activated in the existing local helper. A pipe-owned Windows sleep request is acquired only for accepted local/phone document runs (including locally queued work), PDF preparation and Drive receipt verification. It covers durable success/failure saves and overlapping work; the last completed/failed task releases it. Helper exit/crash closes the pipe. Supervisor idle polling no longer holds the system awake. Active jobs request wakefulness on AC or battery; Windows display, lid, explicit sleep and power-plan settings are unchanged.

Manual Status/Stop controls are in scripts/control-oneclick-awake.ps1, with user-facing launchers in this chat's outputs. Stop releases the hold without cancelling jobs and keeps it released for that overlapping batch; the next batch enables it again. A sleeping laptop cannot claim phone requests until it wakes.

Verified 47 focused helper/client/workflow/security/power tests, including real Windows native acquire/release and manual Status/Stop, parallel/queued jobs, failure persistence, secret scan and clean diff. Restarted the verified idle helper using its existing protected launcher; live health confirms job_scoped_awake:true and active_tasks:0. No personal generation, employer submission, extension update, startup-task installation or Windows sleep-plan change. No existing Raven scheduled task/supervisor was found running; activation applies to the manually launched helper. Preserve the existing protected config and receipts outside this checkout.

## Document preparation without the extension — October 14, 2026

The owner authorized decoupling combined Prepare from the Chrome extension. The web-only implementation finishes both canonical documents and live Drive PDF receipt checks before any extension probe or employer preflight, including when the extension is compatible. A missing, unresponsive or outdated bridge cannot block document preparation. Raven retains Documents ready with an explicit Resume action and an extension-setup reason. That deferred path does not retrieve attachment bytes, read applicant profile/answers, inspect the employer page or send an application packet.

A compatible explicit Resume checks the same job URL, exact saved document hashes and Drive receipts, and then prepares the form without a second writer run. Already-open recovery also requires persisted hashes and fresh verification before clearing. Writer/receipt/hash/job-identity/protocol failures remain errors. Reload alone starts no work; application status and submission remain manual. The two-worker writer and extension2.4.2 are unchanged; no helper restart or extension Reload is needed for this release.

PR84 merged at4bce41d after all core, Windows, safety and153-browser checks passed. Local38 core groups, secret scan,43 preparation Node cases and six focused browser cases passed. The initial completion-event fixture readiness issue was corrected by waiting for the job before emitting positive/negative events. App94/module5 is published. Main core, browser regression, Pages deployment and both production smoke runs passed. Hosted verification confirmed documents are saved before the extension probe and the downloadable extension remains unchanged at 2.4.2. Verification uses controlled fixtures; no fresh live generation timing, personal-document reset or employer submission is claimed.

Current checkout main; PR84 merged with app94/module5 web cache update. Preserve all existing user documents/history. Prior app93/extension2.4.2 live HyperHug acceptance remains historical evidence.