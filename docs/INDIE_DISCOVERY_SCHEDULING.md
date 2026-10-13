# Indie discovery scheduling

The registry can contain more studios than a single collector tick can visit. Discovery candidates remain pending until their official board is verified. A directory listing, failed request, or filtered-out role is never evidence that a studio has no vacancies.

## Fair due selection

`selectDueSources(rows, options)` is a pure helper in `_shared/studio-schedule.mjs`. It requires `enabled=true`, `verification_status=verified`, a nonpending provider, a nonempty board key, and a valid `next_check_at` at or before the supplied clock. It returns original rows without mutation, oldest due first; priority breaks equal-due ties. Repeated IDs/slugs are selected once.

Read database candidates in `next_check_at.asc,priority.desc,id.asc` order. A priority-first database limit can starve quiet indie studios before this helper sees them. Include the scheduling fields in the projection. If source-specific provider/host caps fill up, paginate oldest-due candidates until the bounded candidate budget is exhausted or enough eligible sources are selected. Unselected rows remain due for subsequent ticks. Directory GET pagination is a separate requirement and must not silently stop at500 rows.

The helper defaults to12 total selections, at most6 per provider and6 per fetch host. Known provider API hosts are grouped explicitly, BambooHR is grouped by board host, and unknown providers fall back to their careers-site host. Host names are grouping hints only; fetch permissions continue to come from fixed provider endpoints. The same provider's different studio boards still share the provider limit. These limits do not authorize parallel networking or12 completed scans per tick.

Retain collector concurrency2, its140-second tick deadline, existing response limits, per-source deadlines and detail request budgets. Begin live integration with `maxSources:6` unless actual scan-duration evidence demonstrates that12 is reliable. At15-minute ticks, six completed sources per tick yields a theoretical576 checks/day; twelve yields1152, before retries, downtime and deadline deferral. A shared-provider cap of6 can still constrain a large same-provider cohort to576/day. Actual observed completions, deferred sources and oldest-overdue age determine practical capacity.

## Cadence and failures

`computeNextCheck(source, {status, fetched, failureCount, now})` returns an ISO timestamp. Only completed `ok` or `failed` source checks may schedule a new timestamp. No check result is invented for untouched rows.

A valid explicit `interval_hours` of6–168 is authoritative after successful checks. Existing24-hour configuration must not silently become weekly when the feed returns zero. New verified quiet sources can be configured with168-hour intervals, actively hiring sources with24, and selected high-priority sources with6. When no valid configured interval exists, the fallback policy is6 hours for priority3,168 hours for a validated successful total vacancy count of zero, and24 hours otherwise. The helper examines `fetched`, never the count of roles eligible for Mike's title/location preferences. Unknown total counts do not qualify for weekly empty-feed scheduling.

Failures back off12,24,48,96 and168 hours. A longer configured interval is preserved. `failureCount` means consecutive failures including the current failure; when omitted, the helper adds one to `source.consecutive_failures`. A successful recovery follows the configured successful cadence. Partial description enrichment does not mean the vacancy-list source failed: pass `status:ok` when list validation and persistence succeeded, while retaining separate description health.

No schema addition is necessary for this helper. The collector owns check-history writes, consecutive-failure updates, list-versus-detail status, and scheduling persistence. Any future automatic adaptation of explicitly configured intervals needs a separate user/configuration policy rather than overriding those settings here.

## Verification and limits

Run `node tests/studio-schedule.test.mjs`. Fixtures cover600 rows, oldest-due progress across ticks, priority ties, provider/host caps, duplicate rows, pending/blocked/disabled exclusion, invalid/future timestamps, configured cadence, true empty versus filtered-empty feeds, unknown counts and capped failure backoff.

These are pure policy tests. They do not establish deployed collector integration, live throughput, database pagination completeness, or job ingestion. Verify those independently before claiming expanded monitoring capacity.
