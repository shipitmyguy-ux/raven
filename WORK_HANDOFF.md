# Raven execution handoff

## Keep-awake controls inside Raven - October 14, 2026

Options now includes Laptop keep-awake with automatically refreshed local status, active-task count, Check status and Stop keeping awake. States distinguish idle, starting, confirmed awake, manually stopped and unavailable; an absent/old writer is never labelled off. The UI only checks on opening Options and while it remains open. Closing Options ends polling. Paired-phone generation is unchanged; these controls address the writer on this computer.

The authenticated loopback GET /power and exact POST /power/stop routes retain existing origin, referrer, local-client and bearer-session checks. Stop releases the sleep hold without cancelling jobs, changing documents or statuses, or submitting applications. The remainder of an overlapping batch stays released; the next batch reacquires it. Native confirmation and exit update the state, including stops from the existing shortcut. App95/client4; no extension update.

Verified all38 local core command groups, secret scan, syntax and all155 Edge browser tests. New tests cover session/foreign-origin/GET-mutation rejection, invalid Stop payload, parallel-job stop/rearm behavior, client response validation, live UI Stop and missing/outdated helper recovery. Restarted the idle existing helper; authenticated live /power returned supported:true, active_tasks:0, state:idle. No personal document generation or submission. Web publication is in progress.

## Keep awake only during jobs - October 14, 2026

Implemented and activated in the existing local helper. A pipe-owned Windows sleep request is acquired only for accepted local/phone document runs (including locally queued work), PDF preparation and Drive receipt verification. It covers durable success/failure saves and overlapping work; the last completed/failed task releases it. Helper exit/crash closes the pipe. Supervisor idle polling no longer holds the system awake. Active jobs request wakefulness on AC or battery; Windows display, lid, explicit sleep and power-plan settings are unchanged.

Manual Status/Stop controls are in scripts/control-oneclick-awake.ps1, with user-facing launchers in this chat's outputs. Stop releases the hold without cancelling jobs and keeps it released for that overlapping batch; the next batch enables it again. A sleeping laptop cannot claim phone requests until it wakes.

Verified 47 focused helper/client/workflow/security/power tests, including real Windows native acquire/release and manual Status/Stop, parallel/queued jobs, failure persistence, secret scan and clean diff. Restarted the verified idle helper using its existing protected launcher; live health confirms job_scoped_awake:true and active_tasks:0. No personal generation, employer submission, extension update, startup-task installation or Windows sleep-plan change. No existing Raven scheduled task/supervisor was found running; activation applies to the manually launched helper. Preserve the existing protected config and receipts outside this checkout.

## Document preparation without the extension — October 14, 2026

The owner authorized decoupling combined Prepare from the Chrome extension. The web-only implementation finishes both canonical documents and live Drive PDF receipt checks before any extension probe or employer preflight, including when the extension is compatible. A missing, unresponsive or outdated bridge cannot block document preparation. Raven retains Documents ready with an explicit Resume action and an extension-setup reason. That deferred path does not retrieve attachment bytes, read applicant profile/answers, inspect the employer page or send an application packet.

A compatible explicit Resume checks the same job URL, exact saved document hashes and Drive receipts, and then prepares the form without a second writer run. Already-open recovery also requires persisted hashes and fresh verification before clearing. Writer/receipt/hash/job-identity/protocol failures remain errors. Reload alone starts no work; application status and submission remain manual. The two-worker writer and extension2.4.2 are unchanged; no helper restart or extension Reload is needed for this release.

PR84 merged at4bce41d after all core, Windows, safety and153-browser checks passed. Local38 core groups, secret scan,43 preparation Node cases and six focused browser cases passed. The initial completion-event fixture readiness issue was corrected by waiting for the job before emitting positive/negative events. App94/module5 is published. Main core, browser regression, Pages deployment and both production smoke runs passed. Hosted verification confirmed documents are saved before the extension probe and the downloadable extension remains unchanged at 2.4.2. Verification uses controlled fixtures; no fresh live generation timing, personal-document reset or employer submission is claimed.

Current checkout main; PR84 merged with app94/module5 web cache update. Preserve all existing user documents/history. Prior app93/extension2.4.2 live HyperHug acceptance remains historical evidence.