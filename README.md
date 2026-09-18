# Raven

Raven is the public static frontend for the job-application tracker.

## Architecture

- **GitHub Pages:** public static frontend
- **Google Apps Script:** API/gateway
- **Google Sheets:** authoritative job data and runtime UI configuration
- **Google Drive:** private resumes, cover letters, qualification profile, backups, and recovery artifacts

The public repository must not contain resumes, private qualification data, credentials, access tokens, or private Drive documents.

## Publishing

Push to `main`. The included GitHub Actions workflow deploys the repository to GitHub Pages automatically.

Repository name: `raven`

For a normal project Pages site, the URL will be:

`https://<github-username>.github.io/raven/`

## Runtime configuration

Most visual and supported UI changes do not require a GitHub deployment. Raven loads runtime configuration from the Apps Script gateway, backed by these Google Sheet tabs:

- Theme
- Settings
- UI
- Statuses
- Features

The frontend falls back to bundled defaults if runtime configuration is unavailable.

## One-time backend requirement

The Apps Script gateway must support:

`GET ?action=getRuntimeConfig`

using the prepared `runtime-config.gs` module from the private recovery/source archive. Do not place that private project material in this public repository unless it contains no secrets or private identifiers.
