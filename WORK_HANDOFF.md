# Raven execution handoff

Updated: 2026-09-25

## Current repair
Live v51 Generate on Accurx Implementation Analyst immediately failed with "Assign a master resume to this job track first." There was no unbound-click or ReferenceError in this browser: the obsolete local-master gate blocked the existing canonical-profile backend before any request. Header-only feedback disappeared from the user's immediate context.

The frontend now calls the existing generation service without reading/uploading a device master, catches startup rendering errors, keeps errors beside the action, retains generation state when a discovery ID changes, and applies forced regeneration consistently to both document types. app.js cache version is 53. No architecture migration, Work integration, backend/schema changes, document approvals, or employer submissions.

## Verified locally
- Core regression files and repository secret scan passed.
- 46 mocked browser cases passed across the full run and focused reruns. Fresh-browser generation, persisted review for both document types across all four tracks, missing local file, visible provider error/retry, and forced regeneration are covered.
- Earlier releases left stale test expectations for modern-v8, fixed section markup, and required history on non-game tracks. Those were aligned with the existing tailoring contract without changing writer behavior.

## Remaining this session
Deploy through the existing GitHub Pages workflow, inspect required CI/production smoke, and verify real live generation -> preview -> refresh. Replace this pending section with observed results.

GitHub remains canonical code/project state; the existing Supabase canonical profile supplies generation facts. Existing real employer attachment/completion and optional Drive persistence decisions remain in TASKS.md.

Concurrent main updates a93af28/d89b38f/ff23f8a were reviewed before publication. Live v52 reproduces `DataError: Failed to execute get on IDBObjectStore: No key or key range specified` at getMasterResumeFile -> generateDocumentOnline -> generateForJob. The partial fix defaulted the master to an empty object and then read IndexedDB with an undefined ID. This patch removes that obsolete generation-file read entirely and preserves the concurrent stale-session recovery and preparing status.
