# Raven

Raven is the public static frontend for the job-application tracker.

## Architecture

- **GitHub Pages:** public static frontend
- **GitHub runtime-config.json:** Raven UI/theme/status/feature configuration
- **Google Apps Script:** API/gateway for job reads and writes only
- **Google Sheets:** authoritative job database
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
