# Raven Tasks

Legend: [ ] open, [x] complete, [~] in progress, [!] blocked / needs verification

## P0 - Core reliability
- [x] Add user-facing Options/Settings panel using existing runtime-config settings.
- [ ] Audit job descriptions across every Raven tab.
- [ ] Fix LinkedIn and other source extraction failures/truncation.
- [ ] Verify source -> parser -> Supabase -> UI ingestion path.
- [ ] Verify "Search jobs now" uses the backend path only.
- [ ] Verify quick/deep search persistence and deduplication.
- [ ] Verify status changes persist after refresh.

## P0 - Documents
- [!] Verify resume generation with a real online Gemini output (Edge Function deployed; Gemini secret still required).
- [!] Verify cover-letter generation with a real output.
- [ ] Verify generated files attach to the correct job.
- [ ] Verify generated-file links survive refresh.
- [ ] Add/fix failure, timeout, retry, and stuck-task handling.
- [ ] Ensure generated content uses only verified qualifications.

## P1 - Efficiency
- [ ] Replace unnecessary model polling with event/on-demand processing.
- [ ] Cache reusable inputs/results where practical.
- [ ] Keep deterministic processing out of AI paths.
- [ ] Review/remove obsolete five-minute polling if no longer needed.

## P1 - Import/search/extension
- [ ] Verify Chrome extension import on LinkedIn, Indeed, Glassdoor, Monster, and similar sites.
- [ ] Improve title/company extraction fallbacks.
- [ ] Prevent duplicate extension/share imports.
- [ ] Ensure imported jobs appear without manual recovery.
- [ ] Preserve source provenance and original URL.

## P1 - Data/backup
- [ ] Confirm Supabase remains the single live source of truth.
- [ ] Verify Google Sheets backup/export flow.
- [ ] Document/verify restore procedure.
- [ ] Verify clean export of Raven data.

## P1 - Drive/doc organization
- [ ] Verify intended Google Drive destination for generated documents.
- [ ] Verify Drive links remain associated with the correct job.

## P2 - UX/testing/operations
- [ ] Audit empty states, counts, filters, sorting, and card/detail layout.
- [ ] Verify desktop layouts at common sizes.
- [ ] Verify dialogs/panels do not break navigation.
- [ ] Add useful backend/frontend error reporting.
- [ ] Add deployment regression checklist.
- [ ] Add basic health/status view.
- [ ] Remove dead legacy/localStorage/old Sheets/old ChatGPT-window paths when confirmed unused.
- [ ] Review repository for accidentally committed secrets.

## Production acceptance test
- [ ] Find job
- [ ] Import job
- [ ] Parse full description
- [ ] Persist to Supabase
- [ ] Change application status
- [ ] Generate resume
- [ ] Generate cover letter
- [ ] Review generated docs
- [ ] Refresh
- [ ] Confirm all job/status/document data persists
