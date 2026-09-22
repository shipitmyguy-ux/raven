# Raven

Raven is the public web application for the job-application tracker.

> **GitHub-first project:** For current project state, priorities, and handoff information, read [AGENTS.md](AGENTS.md), [RAVEN_STATUS.md](RAVEN_STATUS.md), [TASKS.md](TASKS.md), and [WORK_HANDOFF.md](WORK_HANDOFF.md). Chat and Work conversations are transient; GitHub is the durable project-state source of truth.

## Architecture

- **GitHub:** canonical source for Raven code, configuration, project state, handoffs, and deployment documentation
- **GitHub Pages:** public static frontend
- **runtime-config.json:** Raven UI/theme/status/feature defaults
- **Supabase Edge Functions:** canonical search/job API plus enrichment, commute, generation, and bookmark services
- **Supabase Postgres:** authoritative live Raven job/application/runtime data store
- **Google Drive:** private resumes, cover letters, qualification profile, backups, and recovery artifacts where configured
- **Google Sheets:** backup/export only; not the canonical live data store

The public repository must not contain resumes, private qualification data, credentials, access tokens, service-role keys, or private Drive documents.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md) for the durable architecture contract.

## Chat / Work operating model

Raven is designed so a new coding session can reconstruct the project entirely from GitHub.

At the start of a session:
1. Pull/read the current repository.
2. Read `AGENTS.md`.
3. Read `RAVEN_STATUS.md`, `TASKS.md`, and `WORK_HANDOFF.md`.
4. Inspect current code before making changes.

At the end of a meaningful Work/coding session:
1. Commit and push code changes.
2. Update project status/tasks.
3. Replace/update `WORK_HANDOFF.md` with verified results and the exact next action.

No meaningful Work task is considered complete while its only record exists in conversation history.

## Publishing

Push to `main`. The included GitHub Actions workflow deploys the repository to GitHub Pages automatically.

Repository: `shipitmyguy-ux.github.io/raven`

Live site:

`https://shipitmyguy-ux.github.io/raven/`

## Automated Smoke Testing

Automated headless Playwright smoke tests run against the deployed Raven app (`https://shipitmyguy-ux.github.io/raven/`) and synthetic Application Assistant flows covering all current ATS adapters (Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic fallback).

- **Local command:** `npm run test:smoke`
- **GitHub Actions manual workflow:** `Production Smoke Tests` (`.github/workflows/production-smoke.yml`), triggered via `workflow_dispatch`

Failure artifacts (screenshots and Playwright traces) and full test reports are uploaded automatically on GitHub Actions.

## Runtime APIs

The current frontend configuration points to Supabase Edge Functions for:
- canonical search + saved-job data (`raven-backend-v3`)
- job-description enrichment
- commute data
- document generation

See `config.js` and `raven-api.js` for the current client-side API wiring.

## Runtime configuration

Raven loads UI configuration from `runtime-config.json`.

That file controls:
- Theme
- Settings
- UI field order and visibility
- Statuses
- Feature flags

The planned user-facing Options/Settings panel should reuse this existing settings model rather than create a second configuration architecture. Per-user UI overrides may be stored locally where appropriate while `runtime-config.json` remains the default.

## Chrome extension

Raven Capture is built automatically during GitHub Pages deployment. The live site exposes the ZIP at:

`https://shipitmyguy-ux.github.io/raven/extension/raven-capture-extension.zip`

Install by extracting the ZIP and loading the extracted folder from `chrome://extensions` with Developer mode enabled.

## Background job search

The Raven search UI calls the Supabase backend directly rather than opening a ChatGPT prompt/window.

Current/target source configuration is documented in `job-search-config.json`. Search/import results should be normalized, ranked/deduplicated, persisted through Raven's Supabase data path, and displayed in the appropriate Raven tab.

## Verification

Use [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md) after meaningful production changes. Backup and disaster-recovery instructions are in [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md).
