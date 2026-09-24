# Raven Work Handoff

Last updated: 2026-09-24

## Current work
User requested natural resume/cover-letter writing and approved implementation. They subsequently chose Gemini using Raven's existing connection rather than creating a paid OpenAI API account.

Replaced the active generators' ID-selection/fixed-sentence pipeline with a shared Gemini writer: full verified profile + posting -> authored draft -> factual check -> at most one repair/recheck. Canonical identity/employment metadata remain immutable. Revisions forward current document text and user instructions. Existing rendering, persistence, approvals and request budgets are preserved. Cache advances to modern-v4.

Evaluated Resume Matcher and Reactive Resume, adopted the direct-writing and separate-review patterns, and avoided migrating Raven or copying third-party source. See docs/DOCUMENT_WRITING.md.

## Actual verification
- 12 local mocked writer/handler tests passed, covering complete context, canonical metadata, authored prose routing, correction/recheck, rejected output, Gemini request contract, retries, access checks, rate limits and request completion recording.
- Local integration-contract tests and syntax checks passed.
- CI and live generation acceptance are pending. Do not claim prose quality or persistence verified for the new engine yet.

## Next steps
1. Required CI checks.
2. Deploy both active engines with shared document-writer.mjs/document-handler.mjs, then the router; preserve current auth configuration.
3. Generate and inspect both documents for Akima Intermediate 3D Artist, revise one with the prior text, refresh and reopen. Check a real career-pivot job without fabricating direct experience.
4. Record actual live results here and in RAVEN_STATUS.md/TASKS.md.

## Existing boundaries
GitHub is canonical code/project state; Supabase stores live data. Master resume assignments still gate the UI; canonical profile supplies verified facts. No credentials committed, no new schema. Employer submission stays manual and documents remain unapproved until user review. Previous listing/discovery-generation repair remains intact.
