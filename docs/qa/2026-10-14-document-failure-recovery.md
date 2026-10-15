# Post-upload failure recovery acceptance — October 14, 2026 MDT

The owner authorized simulating a failure after PDF upload but before link recording, then retrying and checking for regeneration or duplicate PDFs.

## Controlled boundary

Selected an existing Saved Verra Mobility / Project Manager pair with both documents already saved, no Drive export events, no existing upload receipts, and zero matching files in the configured folder. No existing documents or events were deleted to manufacture the condition.

A separate, job-scoped test process imported the current production workflow/server modules, used the existing protected configuration and actual PDF/Drive adapters, and shared the normal durable receipt journal. It rejected only the target job's record_drive_export calls after checking that successful uploads and atomic receipt writes had already occurred. The normal listener was left running unchanged. The test process durably reported failed/recording, and no document_drive_export events were written.

Initial attempt:0 draft-generation calls,0 document-save calls,2 PDF renders,2 actual uploads,2 injected link-write failures. Original document hashes were preserved. The isolated process exited before retry, so recovery could not depend on its in-memory receipt cache.

## Normal retry and independent checks

A real Edge browser used published app99 and the unchanged normal helper: resume Review→Save PDF to Drive, then the cover-letter ChatGPT action. Both completed using the original receipt file IDs and saved document hashes. No asset/API interception, synthetic Drive result or manual link write was used during retry.

-0 draft-generation workers and0 upload tools on retry. The two relevant worker directories contain only Drive metadata schemas and completed get_file_metadata calls. One concurrent metadata worker for another file was excluded by identity; it also performed no upload.
-0 PDF rerenders: original local PDF SHA256 values, sizes and modification times stayed unchanged.
-One canonical export event per document, bound to the original job, document type/hash and uploaded file ID.
-Full browser refresh preserved both document hashes and displayed both Current PDF links. Status remained Saved. No approval or employer submission action occurred.

Independent connected-Drive metadata search for the exact two filenames in 1resumecoverletter confirmed:

| Checkpoint | Matching PDFs |
| --- | ---: |
| Before test |0|
| After uploads, with links still unsaved |2|
| After normal retries |2|

The same two file IDs, sizes and creation/modification timestamps remained after retry: no duplicate PDF was created.

Private evidence is ignored in the managed document-routing-integration worktree: private/failure-recovery-baseline.json, failure-recovery-injection-report.json, failure-recovery-retry-report.json, failure-recovery-drive-audit.json, failure-recovery-worker-audit.json and failure-recovery-live.png. User document contents, private IDs, hashes, cloud links and credentials are omitted here. No permanent fault hook, code/configuration change, helper restart or extension update was needed. The normal helper ended healthy with zero active tasks.

## Automated coverage

This scenario is now covered for resume, cover letter and paired requests by tests/oneclick-recovery.test.mjs. Run `npm run test:document-recovery`; the existing core CI workflow runs the same cases on Linux and Windows without credentials or live data. See docs/ONE_CLICK_RESUMES.md for fixture boundaries and assertions.
