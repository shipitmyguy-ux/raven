# Raven execution handoff

## Saved/discovered duplicate prevention - 2026-10-13

Implemented shared browser/backend vacancy identity and saved-record aware discovery suppression. Fixes the Smile Break ArtStation repost appearing alongside the existing Applied Remote Game Jobs record. Imports now return the existing job ID/status/documents for exact matches. Supported ATS identifiers and explicitly labelled application links cover future cross-source copies; verified aliases remain shared with studio result dedup. Canonical tracking URL normalization, distinct requisition/title/track checks, exact-description/geography fallback and unknown-employer guards retain separate vacancies. Saved lookup paginates and fails at its bound rather than silently missing old records.

Validation before publication: all 50 core workflow commands pass after updating two VM test contexts for the shared module; focused import/discovery/UI combination tests and existing studio dedup/result-window checks pass. Secret scan and diff checks pass. Added browser reload/document-preservation fixture to both full browser coverage and targeted safety CI; local Chromium is unavailable, so browser acceptance is pending CI/live verification. Publication and runtime acceptance still pending. Cleanup SQL is guarded and reversible; original application/documents/snapshots remain unchanged. Docs: docs/JOB_DEDUPLICATION.md and docs/qa/2026-10-13-smilebreak-cleanup.sql.

Limit: unsupported aliases and simultaneous first imports of previously unseen different URLs are not guaranteed by a database unique identity constraint. Do not claim every possible duplicate is detected. No destructive cleanup.


## Direct ChatGPT and Drive PDF — 2026-10-13 MDT

User requested launching the tunnel and implementing click → send → review → save PDF to Drive with no manual JSON. The tunnel is running under the owner account with encrypted saved credentials. Bundled Node preference fixes C:/Program Files quoting. Ignored local config explicitly opts into saved jobs and documentWorkflow; the fixed November 1 expiry and no-revision scope remain. Public OAuth and paid-provider routing unchanged.

Frontend app85 uses runtime-config direct-save setting, short exact-job requests and review Save PDF to Drive. New private tools export_document_pdf and record_drive_export render exact saved HTML, check document/PDF hashes and configured folder, and persist idempotent links in existing raven_job_events. Drive verification is connector-reported metadata readback, not independent server OAuth. Select Raven Private for generation and Raven Private + Google Drive for export. Refresh plugin tools after adapter restart; seven expected tools. ChatGPT still requires sending the prepared request.

Verified: actual plugin resume read after tunnel restart; existing resume produced 63,789-byte one-page PDF with 2,015 extracted characters and clean page inspection; actual Drive upload/fresh PDF+parent metadata and actual event persistence/readback. Original saved resume URL/version unchanged. Personal evidence stays in ignored private/direct-export-report.json and private/exports. No resume replacement, approval or application submission.

51 core workflow commands passed. Thirteen focused direct/private cases and five mocked Edge browser cases passed. Windows PS5.1 synthetic credential tests passed. New syntax checks and the actual PDF hash-record/idempotent retry check passed. Windows CRLF fixture readers and renderer check repaired without changing production behavior. New signed-in ChatGPT full-chain generation/export acceptance remains unverified. Frontend not yet published; Draft PR73 is pushed and attached. GitHub core and Windows checks passed. CI caught the legacy studio fixture assuming the JSON endpoint; it now explicitly tests fallback and direct modes, both passed locally. Revised browser checks are running. Publication and signed-in acceptance remain next. See docs/CHATGPT_DIRECT_RESUMES.md.

Latest origin/main 4e2a5ed integrated, retaining the verified Skillsearch scheduled runner, studio collector v13/backend v64 and prior discovery work. Existing studio monitoring/partial-coverage follow-ups remain in RAVEN_STATUS.md and TASKS.md. Preserve unrelated Smile-Break JSON, artifacts/ and renderer line endings; original renderer copy is also retained ignored in private/.
