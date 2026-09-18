# Raven Architecture

## Principle
GitHub stores durable project state. Supabase stores durable runtime application data.

## Components

### Web frontend
Primary files currently include:
- `index.html`
- `app.js`
- `styles.css`
- `theme.css`
- `config.js`
- `runtime-config.json`
- `job-search-config.json`
- `raven-api.js`

Hosted through the repository's web deployment/GitHub Pages flow.

### Chrome extension
Located under `extension/`.
Its responsibility is to capture/import jobs into Raven, including URL and extractable job metadata.

### Supabase
Use as the authoritative live data store for jobs, statuses, descriptions, document records, and other Raven runtime state.

### Search / ingestion
Desired flow:
external source -> search/import/extraction -> normalization/deduplication -> Supabase -> Raven UI.

### Document generation
Desired flow:
job + verified user profile/resume facts -> generation request -> generation worker/service -> stored document/link -> Raven job record -> user review.

A queue acknowledgement is not equivalent to a successful generated document.

### Configuration
- `runtime-config.json`: safe, public application/UI defaults.
- `job-search-config.json`: safe search defaults/configuration.
- Secrets stay outside Git.

## State ownership
- GitHub: code, configuration, migrations, docs, project status.
- Supabase: live jobs/application/document data.
- Google Sheets: backup/export.
- Work/Chat conversations: transient only.

## Change discipline
Do not create a parallel data/configuration system without a documented reason in `docs/DECISIONS.md`.
