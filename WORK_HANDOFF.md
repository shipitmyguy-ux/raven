## Current owner directive and production handoff — Visa-only eligibility (October 14, 2026 MDT)

Owner correction: **Never remove or hide Games / 3D job listings merely because of GMT/UTC/CET offsets or Canada, Europe and other remote-region labels.** A job can be excluded on geographic/legal grounds only when the listing explicitly establishes a mandatory work visa or work permit. A country label, preference, right-to-work statement, or lack of visa sponsorship is not sufficient. Preserve working-hour details for owner to evaluate personally. Normal role-fit, remote/onsite, vacancy validation, and duplicate identity checks remain independent. Recorded in AGENTS.md and job-search-config.json.

Implemented source:
- `supabase/functions/_shared/studio-us-eligibility.mjs` now exports a narrowly grounded `requiresVisaOrWorkPermit` test; `usStudioScopeAllowed` excludes only confirmed required visa/permit.
- `supabase/functions/_shared/studio-sheet-feed.mjs` uses same filter to retain foreign/GMT spreadsheet rows, still handling shared careers-page URL dedup separately.
- `tests/studio-us-eligibility.test.mjs`, `tests/studio-sheet-feed.test.mjs`, and `tests/backend-game-ingestion.test.mjs` updated to reflect owner policy, with positive mandatory-visa and negative sponsorship/question examples.
- CI runs **38664934829** and final **38665523993** passed core regressions, Windows and browser safety; latest Production Smoke Tests passed as well. Production smoke on last code/status changes passed.
- Live Supabase studio scanner **v20** and `raven-backend-v3` **v72** deployed. Both responded successfully on read-only health checks.
- Reversal migration `supabase/migrations/20261015012100_restore_timezone_country_leads.sql` applied successfully; verified all eight prior GeoReview spreadsheet listings now `Discovered`, `listing_state=null`, including three GMT and five Canada. One unrelated listing availability note was preserved.
- Studio spreadsheet source `tim-ploeger-remote-games` marked `next_check_at=now()` on 2026-10-15 01:22 UTC to prompt the existing 15-minute cron. **Next run not yet confirmed.** Check `raven_studio_sources` and `raven_studio_checks` before claiming success, and verify no visa-unproven listings are suppressed.
- No saved applications, resumes, cover letters, or workflow statuses were edited; discovery-only status flags corrected.

Prior handoff below preserves other open studio-source and duplicate-review tasks.
## Latest handoff — Raven cross-source studio/ATS safeguards (October 14, 2026 MDT)

GitHub repo `shipitmyguy-ux/raven`; Supabase project `umvmilulnqnmeqvfoxxc`.

- Live functions: `raven-studio-scan` v19 and `raven-backend-v3` v71. Both were deployed with existing security/JWT configuration unchanged, validated by public read-only GET (scanner directory and backend health/listResults).
- Shared pure helpers: `supabase/functions/_shared/studio-ingest-dedup.mjs`, `studio-us-eligibility.mjs`, `job-duplicate-evidence.mjs`. Both studio scanner and broad Games / 3D ATS ingestion compare against existing discovery plus saved jobs. Do not auto-merge text-only candidates. Near matches are held for private review. Source URL observations that identify exact matches or genuinely new vacancies now write `raven_job_source_links` after ingestion succeeds.
- Private RLS tables: `raven_job_duplicate_reviews` and `raven_job_source_links`. No anon/authenticated read permissions, service role writes only; table link count was 0 when inspected shortly after deployment (no new scan yet).
- Live studio source registry total 373, verified enabled 86, pending verification 257. Newly verified: IllFonic/Breezy (successful first scan 1 eligible); Mob Entertainment/Greenhouse (successful first scan 0 eligible); ArenaNet/Ashby and Cinnamon/Teamtailor (both pending first scheduled scan at last observation 2026-10-15 01:07 UTC). First-party official site links were checked. Cinnamon Roblox Environment Artist position is explicitly an ongoing talent pool, not urgent.
- Source update migrations: `20261015005500_sheet_official_illfonic_mob.sql`, `20261015012500_arena_cinnamon_sources.sql`. RLS queue migrations `20261015010500_job_duplicate_review_queue.sql`, `20261015013500_game_job_source_provenance.sql`. Geo-review migration `20261015011000_sheet_geo_review_cleanup.sql` flagged 8 incompatible Canada/GMT rows, no saved job deletions.
- CI pass **38663769368**: core, Windows, browser safety; includes new provenance and duplicate-handling tests. Both Supabase Edge endpoints returned `ok:true` and backend `healthy:true`.
- Database audit: 836 discovery URLs, all unique; 8 GeoReview. A zero-result current unsaved Games / 3D list is expected under saved-job suppression and role filter, not loss of stored data.
- Remaining: confirm real scheduled runs for ArenaNet/Cinnamon and that source provenance/review queue populate correctly. Review job boards for official studio endpoints without guessing, and consider controlled duplicate-adjudication UI. GitHub issues #85, #86 remain open. No helper agent launched, no resume/application changes.

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

Original snapshot audit finished: 20 Saved roles have 40 canonical documents and current matching Drive PDF exports. Generated 17 new pairs, preserved three existing pairs and refreshed stale existing exports without replacing document content. Raven and connected Gmail application history, including Spam and Trash, were checked. Excluded two previously applied role mirrors, one previously ignored role and one explicitly expired vacancy; original application history and snapshots remain intact. No applications submitted, documents approved or generated jobs marked Applied. Private audit evidence and document identifiers are intentionally outside Git.

Four additional discoveries appeared during execution. Gmail found no application evidence for them. One explicitly closed posting was preserved as Ignored with its closure note. The three live remote-capable roles now have both documents and current matching PDF exports. Independent final readback confirmed all six additional document hashes and current export events, with no obvious placeholders or wrong-company text. Final bounded snapshot: 28 reviewed, 23 Saved roles / 46 documents ready (20 newly generated pairs, three existing pairs preserved); five reviewed exclusions. Regional labels and working-hour information remain visible under the owner's visa-only policy. No claim is made about discoveries arriving after this snapshot.

Published source 905f444 (web app97/module7, dedup4/client4) exposes Apply job once both documents are saved. Bounded same-job Lever, Gusto and Breezy routes open the application destination while canonical identity remains bound to the saved listing; existing Ashby mapping remains. Unknown routes/login gates stop for manual handling. Manual preflight stops before PDF bytes/profile retrieval. Extension 2.4.2 and running writer are unchanged; no extension reload or helper restart required.

A live refresh exposed saved-role visibility loss when a posting mentions hybrid alongside an explicit remote option. The bounded web correction keeps saved/application history visible independently of discovery location screening; unsaved discoveries retain normal screening. One stale discovery URL was corrected to its verified canonical employer URL without altering its source/provenance or saved documents. The visibility correction uses web app98 and passed all44 core groups, nine focused location tests and all157 Edge browser cases. Hosted verification follows publication.

Existing paused preparation is deliberately preserved: another job shows Review paused preparation with the existing Resume/Dismiss recovery choices. User must resolve that intent once before starting another application. Lossless per-job parked recovery is a documented follow-up, not implemented. No universal employer-form completion or server-accepted attachments are claimed by this batch.

Validation: all44 final local core groups, all157 Edge browser cases,47 preparation Node cases and six focused route/browser cases passed; secret scan and clean diff passed. Published core/Windows/safety, browser, Pages and post-deployment smoke checks passed. Original20 live canonical readback matches all40 current PDF exports; narrow content checks found no obvious placeholders, wrong-company text or unsupported named production tools. Two covers omit a literal employer name and merit ordinary copy review. This is not a separate full visual PDF/content audit.

A Windows test isolation fix targets only its own holder PID and proves unrelated holds survive. Temporary batch guard ended after the original batch drained; helper reported zero active tasks and native keep-awake Off before the additional three jobs. The additional batch automatically reacquired keep-awake; after completion helper active tasks returned to zero and native keep-awake was confirmed Off. Keep-awake changes no Windows power-plan settings.

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