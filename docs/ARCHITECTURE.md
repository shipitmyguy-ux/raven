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
- Private JSON snapshots: portable Supabase data backup/recovery; see `docs/BACKUP_RESTORE.md`.\n- Google Sheets: retired; not part of the live or backup architecture.
- Work/Chat conversations: transient only.

## Change discipline
Do not create a parallel data/configuration system without a documented reason in `docs/DECISIONS.md`.

## Reusable core and efficiency
- `raven-core.js` owns canonical job normalization, URL normalization, stable fingerprints, and reusable browser cache helpers.
- Source-specific ingestion should adapt into the canonical job shape instead of creating parallel downstream workflows.
- Deterministic normalization, deduplication, rendering, persistence, and UI state stay outside model calls.
- Generated AI content is structured data; browser code owns presentation/rendering.
- Identical resume-generation inputs are fingerprinted and reused from cache rather than calling the model again.
- Frontend search no longer performs timer-driven polling after a search; refresh happens on explicit actions, track changes, and return-to-app refresh.

## Application workflow expansion
Raven should cover the full workflow without making final submission decisions for the user:
external source -> capture -> canonical Job -> evaluate -> tailor -> autofill -> user review -> submit -> outcome tracking -> follow-up -> analytics.

### CandidateProfile
- Parse verified master-resume facts into one structured, reusable profile.
- Treat CandidateProfile as the factual source for AI-generated application documents and answers.
- Keep provenance for generated claims so Raven can flag content unsupported by the profile.

### ApplicationAnswerVault
- Store reusable application answers separately from generated prose.
- Deterministic/sensitive answers (contact data, work authorization, sponsorship, relocation, education, etc.) must come from explicit user-approved values, not model inference.
- AI may draft open-ended answers from verified CandidateProfile facts; cache approved answers for reuse.

### ATS adapter layer
- Prefer established ATS-specific selectors/configuration patterns over a single brittle universal parser.
- Target common systems first (Greenhouse, Lever, Ashby, Workday), then expand through adapter/configuration rules.
- Keep the final Submit action under explicit user control.

### Posting snapshots and provenance
- Preserve an immutable original posting snapshot separately from enriched/current descriptions.
- Record source and canonical URL, and detect likely cross-source duplicates by URL plus company/title identity.

### Outcome loop
- Model Contact, Interview, FollowUp, and application outcome data explicitly rather than burying them in job notes.
- Future email integration may classify confirmations, assessments, interviews, offers, and rejections and propose/status-update the matching application.
- Analytics should connect source, job, tailored document, application, and outcome so Raven can measure what actually produces interviews/offers.

### Privacy boundary
Before autofill/email expansion, document which profile/application fields stay local, which are stored in Supabase, and which may be sent to an AI provider. Minimize provider payloads and never expose secrets in browser code or Git.
