# Raven Game Studio Directory

The studio registry is a separate discovery pipeline from the interactive Raven job search.

## Live architecture
- Database: `raven_studio_sources`, `raven_studio_checks`, and `raven_studio_cron_auth`.
- Collector: Supabase Edge Function `raven-studio-scan`; deployments require the function source plus `functions/_shared/track-filter.js` and `functions/_shared/studio-providers.mjs` and `functions/_shared/studio-collector.mjs`.
- Scheduled invocation: Supabase pg_cron job `raven-studio-scan-15m`, using pg_net and a dedicated token kept in Supabase Vault. Never put this token in GitHub, client JS, issues or logs.
- Public read-only directory: `studio-directory.html` calls the collector's public GET endpoint, which returns names, source state, check times and official careers URLs, not secrets.
- Protected POST requires `x-raven-studio-secret`, verified against the SHA-256 hash held in the service-only database table.
- Results are written to `raven_search_results`, preserving Raven's existing saved-job and resume workflows.

## How studios are checked
Only provider-verified sources can be scanned. Ashby, Greenhouse, Lever, Workable, SmartRecruiters and BambooHR are supported; initial sources are seeded by `20261012_raven_studio_directory.sql`.
Pending directory entries are *not* considered checked. They need a verified career-page URL and provider board identifier before being enabled. Do not guess IDs or declare zero jobs for pending or failed sources.

Each cron tick scans up to six due sources in batches of two. Successful sources follow their interval; failed sources back off at least twelve hours. Health and errors are recorded in `raven_studio_checks`.

Currently eligibility uses Raven's shared Games / 3D art title and remote/local filters. This means a source may have public openings but zero *eligible* jobs; check the history and distinguish fetched totals from eligible totals.

## Adding a verified provider
1. Verify an official studio careers page and the specific board name from its job URLs.
2. For Ashby, use `jobs.ashbyhq.com/<board>`; for Greenhouse, verify `boards.greenhouse.io/<board>`; for Lever, verify `jobs.lever.co/<board>`.
3. Insert or update `raven_studio_sources` with provider, board_key, careers_url, interval_hours, priority, enabled and next_check_at. Never modify the user's job applications or documents.
4. Confirm a successful check, compare job count and location filters, and confirm canonical job URLs before scaling to another batch.

## Health queries
```sql
select studio_name,provider,last_status,last_checked_at,last_success_at,last_job_count,last_error
from public.raven_studio_sources order by priority desc,studio_name;
select status, count(*) from public.raven_studio_checks group by status;
select company,title,url from public.raven_search_results where source like 'Studio:%';
select jobname,schedule,active from cron.job where jobname='raven-studio-scan-15m';
```

## Still to expand
- Verify official career page URLs and ATS identifiers for pending studios.
- Add safe official-site discovery for studios without supported provider APIs.
- Add request-level telemetry and source-change alerts.
- Grow the directory in verified batches; a thousand unverified names would be worse than a smaller, reliable source library.

## Provider expansion — 2026-10-12

The collector accepts only fixed public ATS API hosts and validated board identifiers. Responses reject redirects, cap streamed bodies at 4 MB and fail explicitly above 1,000 jobs. SmartRecruiters pagination is bounded; incomplete pages produce a failed check rather than a false complete result. Workable uses its public widget endpoint. The directory supports provider, status and careers-site search, distinguishes successful zero matches from unverified/failed sources, and shows paused or scheduled checks.

Deployment path filters include the directory page and collector. Normalizer and actual-handler fixtures verify all five providers, authentication, ingestion, title/location eligibility, pagination and failure records. Browser fixtures cover filtering, retry, malformed responses and narrow-screen containment.

## Description coverage, publisher scoping and health

SmartRecruiters and BambooHR descriptions are retrieved only for eligible jobs from fixed provider detail endpoints with validated board/job identities. Each source fetches at most twelve missing descriptions at concurrency two. Cache entries expire after24 hours and invalidate for a newer posting date; failed refreshes preserve previous text and report degraded coverage. Responses cap at4 MB; normalized descriptions cap at20,000 characters. Deferred entries advance as already-fetched entries become fresh cache hits. Source/tick deadlines bound work; unchecked due sources remain queued for the next cron tick.

Publisher boards require `job_scope` with exact `field` and `values`; supported fields are department, company, title, organization. Organization matches only SmartRecruiters' Organizational Unit valueLabel. Filters apply before normalization/attribution. Unknown or malformed scopes fail closed; whole publisher feeds must never be attributed to an individual studio.

`consecutive_failures` tracks list/persistence failures. First failures show failing; three consecutive failures show broken. Successful recovery resets the count. Missing/failed/deferred descriptions instead show degraded coverage without claiming a source outage or zero roles. Public directory displays warnings plus official verification outcomes; unsupported/blocked verification remains pending, never a false broken check.

## Official career portal support and result visibility

ZeniMax iCIMS uses the first-party ZeniMax embedded directory and iCIMS public JobPosting details, requiring exact company scope. EA Avature validates the official numeric studio filter, result department and detail department plus explicit Work Model. Remedy Jobylon reads literal public widget data without executing script and validates company and JobPosting identity. Fixed host URLs, body limits and deadlines apply. Unknown portal templates, unrecognized job links, explicit count mismatch, unverified pagination, or blocker pages fail rather than report a successful empty source.

Portal details evaluate art title eligibility before location because explicit remote metadata can appear only in details. Existing global location policy applies after enrichment. Fresh cached descriptions skip requests; detail_cursor rotates missing candidates beyond the twelve-detail scan budget. Partial detail outcomes remain visible and saved descriptions are preserved on refresh failure.

Games/3D read results preserve the existing aggregate top100 and merge up to50 most recently seen official studio results, deduplicating by URL and applying existing role/location eligibility. This prevents valid official-board jobs at score12 being absent from the browser results window. Other tracks keep their original window.

## Indie discovery

Work With Indies is a job-board source; vacancies retain actual employer, authoritative remote/location restrictions and complete validated descriptions. Closed/expired/unpaid/revenue-share roles are excluded. Only same-board official detail URLs are fetched. Teamtailor uses verified fixed career-host bindings, exact employer/job identity and pagination counts.

Directory source_kind distinguishes studios from hiring boards. Segments indie, indie_origin, boutique, major and unknown carry ownership/source caveats rather than assuming every small or indie-origin developer remains independent. GET uses exact-count limit/offset pagination, max500 per page; UI initially loads2,000 with Load more and explicit partial results/retry.

Oldest-due selection is fair, with12-source tick budget, caps6 per provider/host, transport concurrency2 and140-second deadline. Explicit check intervals win; active feeds typically24h, quiet verified feeds168h, Work With Indies6h. Backoff12–168h is based on actual failed checks. Candidate window120 can underfill a mixed-provider tick when flooded by one provider; this is recorded in scheduling notes. Pending sources are never treated as checked vacancies.

Portal cache restoration validates unchanged title/employer and24-hour stamp, restoring remote/location so cached board posts remain eligible. Lever descriptions combine introduction, role lists and additional content. Game art generalist title additions retain character, technical, animation and VFX exclusions.

## Gamesmith and InGameJob

InGameJob reads only its English Art and Animation category (currently37listings), not the whole board. It validates advertised count/page completeness, fixed hosts/canonical title/company and active Apply UI, including archived-state rejection. This is current source-advertised availability, not a guarantee employer stillhiring. It retrieves at most12fresh rotating descriptions, serially spaced5seconds, and retains fulltext/recruiter uncertainty/geographic conditions; no speculative expirydate or cachefreshness claim. Eligible roles enter the existing Games/3D discovery cache and dedup. Gamesmith is registered disabled with blocked status because its public DNS returnsSERVFAIL; no successful scan or permanent businessclosure is claimed.

Publication status: both directory records exist inactive. InGameJob scanner implementation is tested and published, but live activation was rejected by automatic approval review pending explicit production approval. Gamesmith is blocked by DNS independently. Neither new source currently performs scheduled scans.
