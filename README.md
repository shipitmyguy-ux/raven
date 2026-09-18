# Raven

Raven is the public static frontend for the job-application tracker.

## Architecture

- **GitHub Pages:** public static frontend
- **GitHub runtime-config.json:** Raven UI/theme/status/feature configuration
- **Supabase Edge Function:** server-side background job discovery and parsing
- **Supabase Postgres:** staging store for discovered candidates and search-run history
- **Google Apps Script:** API/gateway for canonical job reads and writes
- **Google Sheets:** authoritative saved-job database
- **Google Drive:** private resumes, cover letters, qualification profile, backups, and recovery artifacts

The public repository must not contain resumes, private qualification data, credentials, access tokens, or private Drive documents.

## Publishing

Push to `main`. The included GitHub Actions workflow deploys the repository to GitHub Pages automatically.

Repository name: `raven`

For a normal project Pages site, the URL will be:

`https://<github-username>.github.io/raven/`

## Runtime configuration

Raven loads UI configuration directly from `runtime-config.json` in this repository.

That file controls:
- Theme
- Settings
- UI field order and visibility
- Statuses
- Feature flags

Changing it triggers the normal GitHub Pages deployment automatically.

Apps Script does not need a `getRuntimeConfig` route. It remains only as the existing job-data gateway for actions such as `listJobs` and `addJob`.

## Chrome extension

Raven Capture is built automatically during GitHub Pages deployment. The live site exposes the ZIP at:

`https://shipitmyguy-ux.github.io/raven/extension/raven-capture-extension.zip`

Install by extracting the ZIP and loading the extracted folder from `chrome://extensions` with Developer mode enabled.

The previous ChatGPT Site is retired from canonical use.

## Background job search

The **Search jobs now** button calls the Supabase `raven-search` Edge Function directly. No ChatGPT window or visible prompt is opened.

Current automated discovery sources are LinkedIn's public job feed plus Remotive, RemoteOK, and Arbeitnow. The broader target source pool remains documented in `job-search-config.json` for future source adapters.

Search results are parsed, ranked, deduplicated, and stored as **Discovered** candidates in Supabase. They appear inside the Professional, Labor, or Wildcard tab. A discovered candidate is written to the canonical Google Sheet only when **Save to tracker** is used.
