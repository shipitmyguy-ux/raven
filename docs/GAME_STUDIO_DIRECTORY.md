# Raven Game Studio Directory

The studio registry is a separate discovery pipeline from the interactive Raven job search.

## Live architecture
- Database: `raven_studio_sources`, `raven_studio_checks`, and `raven_studio_cron_auth`.
- Collector: Supabase Edge Function `raven-studio-scan`; deployments require the function source plus `functions/_shared/track-filter.js`.
- Scheduled invocation: Supabase pg_cron job `raven-studio-scan-15m`, using pg_net and a dedicated token kept in Supabase Vault. Never put this token in GitHub, client JS, issues or logs.
- Public read-only directory: `studio-directory.html` calls the collector's public GET endpoint, which returns names, source state, check times and official careers URLs, not secrets.
- Protected POST requires `x-raven-studio-secret`, verified against the SHA-256 hash held in the service-only database table.
- Results are written to `raven_search_results`, preserving Raven's existing saved-job and resume workflows.

## How studios are checked
Only provider-verified sources can be scanned. Ashby, Greenhouse and Lever are supported; initial sources are seeded by `20261012_raven_studio_directory.sql`.
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
