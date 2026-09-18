# Raven Status

Last normalized: 2026-09-18

## Scope
Raven is a web-based job application tracker and automation project.
iOS and Android work are currently excluded.

## Canonical systems
- Code/project state: GitHub `shipitmyguy-ux/raven`
- Live application/job data: Supabase
- Public UI/runtime defaults: `runtime-config.json`
- Job-search defaults: `job-search-config.json`
- Google Sheets: backup/export role only

## Current known implementation
The repository contains:
- Raven web frontend
- Runtime configuration
- Job search configuration
- Raven API/frontend integration files
- Chrome extension
- GitHub workflows
- GitHub-first agent/status/task/handoff contract
- Architecture, deployment, test, and decision documentation

Current `config.js` routes Raven search, data, tasks, enrichment, and commute requests to Supabase Edge Functions.

## GitHub parity status
GitHub-first parity scaffolding is now in place. Future Chat/Work sessions should read the repository rather than depend on previous conversation history.

## Highest-priority unfinished work
1. Add and verify a user-facing Options/Settings panel using existing runtime settings.
2. Audit every Raven tab for complete job-description loading.
3. Fix missing/truncated LinkedIn and other source descriptions.
4. Verify source -> parser -> Supabase -> Raven UI end to end.
5. Verify the in-page "Search jobs now" path uses the backend search flow without exposing a ChatGPT prompt/window.
6. Finish and verify real resume/cover-letter generation. Online resume path is deployed but awaiting Gemini secret.
7. Remove unnecessary model-driven polling and prefer event/on-demand processing.

## Important verification boundary
Document generation is NOT considered verified merely because a request is queued.
A successful test requires:
- a real generated document,
- attached to the correct job,
- accessible from Raven,
- and still present after refresh.

## GitHub-first operating mode
All future Chat and Work sessions should reconstruct project state from the repository. Conversation history is supplemental, not authoritative.
