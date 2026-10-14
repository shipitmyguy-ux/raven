# Recovery after a Raven reload during application preparation

Current correction (October 14): a genuine login/challenge destination pauses form delivery only. Prepare still generates/reuses and verifies both documents and Drive PDFs, stores documents-ready recovery metadata, and resumes only on an explicit click. Hidden/passive anti-bot markup is not a gate. Earlier recommendations to stop document generation at a login/challenge are superseded by this user requirement.


## Implementation underway — October 14, 2026

The renovation branch implements a metadata-only, 24-hour recovery record and an explicit Resume preparation control. Loading Raven does not restart generation or dispatch files. A known writer run is resumed with a read-only status request; an unavailable run requires a deliberate restart. Canonical job URL/document hashes, recorded Drive receipts, and live Drive file metadata are checked before verified PDF delivery. A browser lock and expiring lease prevent simultaneous resumes. Saved-document and Drive verification have distinct stages.

The extension inspects a metadata-only destination tab before the writer starts, then delivers PDFs once to that same bound tab. A retry with a previously delivered or completed binding focuses the same unchanged tab and skips writing and uploading. An uncertain in-flight delivery stops for manual inspection. A pre-delivery retry can inspect a fresh tab and invalidate the old binding. PDF bytes, profile values, and answers are not persisted by recovery or preflight. Hidden/custom form groups and new employer providers still require manual review. The original design discussion follows; current verification is in WORK_HANDOFF.md.

This is a minimal design note based on the current browser flow, local writer, extension bridge, and the live Believer run. It describes proposed behavior; no source changes are included.

## What currently happens

`prepareApplication` runs inside the Raven page and holds its continuation only in JavaScript memory. The helper's generation run has a durable UUID and writes run state under `private/oneclick/runs`; workflow progress and saved Drive receipts are also recorded. Raven does not persist the active preparation intent or associate it with that run UUID. If Chrome disconnects or Raven reloads, the helper can keep working and save both documents, but the page loses the continuation that fetches PDFs and sends the extension packet. Retrying the whole action can reuse documents and verified Drive exports, but the user has to start it again and cannot directly resume the lost packet-dispatch step.

The existing helper also begins `oneclick-workflow` with `queued`, then reads the saved documents and looks up and verifies matching Drive export events before publishing a more specific stage. Those readback and Drive metadata checks can take time, including roughly 20 seconds per reused file, while the UI still says “waiting for writer.”

A live Believer test generated the resume and cover letter and verified their Drive copies in about 130 seconds, including one bounded resume repair. A browser connection change interrupted the in-memory preparation continuation. The final corrected-extension retry reused the documents and opened the form in about45 seconds, with both PDFs and known fields verified. That is a partial timing measurement, not an end-to-end application-preparation duration.

## Minimal durable intent

When a person starts Prepare application, create a UUID `preparationId` and persist a small versioned record in Raven local storage. Keep only correlation and verification metadata; never store PDF bytes, profile values, answers, or page contents. Suggested record:

```json
{
  "version": 1,
  "preparationId": "uuid",
  "jobId": "JT-…",
  "jobUrl": "https://…",
  "createdAt": "…",
  "updatedAt": "…",
  "state": "generating",
  "runId": "writer-run-uuid",
  "documents": {
    "resume": { "documentSha256": "…" },
    "coverLetter": { "documentSha256": "…" }
  },
  "extensionRequestId": "uuid"
}
```

Write the record before starting the writer. When a discovered job is saved, update its `jobId` immediately and keep the same preparation ID. Persist the writer `runId` as soon as returned. After writer completion, require Raven readback and exact Drive export events for each document before storing the two exact document hashes and changing the state to `documents-ready`. When the helper has returned verified PDF bytes, hold them only in memory for immediate dispatch; do not put them in Raven local storage.

Persist only non-secret phases such as `generating`, `documents-ready`, `dispatching`, and `opened`. Expire abandoned intents after a short documented window (for example, 24 hours), and clear a completed intent when the extension acknowledges opening the application tab. A failed or stale record remains visible as resumable or needs-review, with its last stage and reason.

## Explicit resume behavior

On reload, Raven may read the intent and fetch the current canonical job and document metadata to decide whether to show a **Resume preparation** control. It must not start or continue writer work, export PDFs, upload to Drive, or dispatch an extension packet automatically. The person must click Resume preparation.

On that click, re-probe the extension and writer health, then re-fetch the job by the exact saved `jobId`. Confirm it is still the same job and URL, and stop if the source now confirms the listing is closed or the destination is an authentication/challenge barrier. Re-read both document hashes. If the record already has hashes, require an exact match; if either changed, stop and request review rather than preparing stale PDFs or silently updating the intent. Confirm the corresponding Drive export events match those same hashes and their file IDs/URLs before continuing.

If `runId` exists, first ask the helper for that exact run. If still active, Resume preparation attaches to its progress and must not enqueue a second run. If complete, verify the saved job documents and export receipts again. If the helper records a failed/restarted run, a user click may start a new run for the same job and `both`; the writer can reuse the saved documents and durable Drive receipts. Persist the new run ID and keep the preparation ID. If no run ID was returned before disconnect, a click starts `both` under the existing preparation ID and performs the same readback checks.

After hashes and Drive receipts are confirmed, regenerate or read back the exact PDFs from the local writer and verify their document hashes and PDF hashes. Dispatch only after this explicit click. Use a stable extension request ID for the intent and make the extension idempotent for the same request ID and packet identity: if the prior response was lost but the matching tab already exists, return/focus that tab instead of creating another. Reject reuse of that request ID with a different job, URL, document hashes, or packet. If no matching request exists, persist the bounded packet before creating a new tab as today.

Keep the existing per-job busy guard and add a short cross-tab lease keyed by `jobId + preparationId`, so two Raven tabs cannot resume the same intent simultaneously. Release it on completion/failure and expire it after a bounded lease. The helper's run deduplication remains a second guard; neither guard should trigger work by itself.

## Progress labels and optional fields

Emit a real helper stage before saved-document reads and before Drive receipt lookup/verification, such as `checking_saved_state` and `checking_drive_receipts`. Show “Checking saved documents and existing Drive PDFs…” for that phase; reserve “Waiting for writer” for actual queued work. Include the last stage and elapsed time in Resume preparation feedback so a wait during reused-file verification does not look idle. Keep stage events tied to `preparationId` and `runId`.

The current extension's `missing` list can include profile keys that the employer form simply does not contain. It does not establish whether those controls are required. Report three distinct outcomes: filled fields, required fields present but unanswered/unmatched, and profile fields absent from this form. Determine requiredness from native `required`, `aria-required`, an associated visible required marker, or a reviewed provider-specific group rule. If requiredness is ambiguous—especially for custom radio/checkbox groups—label it “review required” rather than guessing. Optional or absent fields should not appear as missing. Keep sensitive and unsupported questions untouched and visible for human review.

## Deduplication and acceptance boundary

Correlate one preparation with `preparationId`, the helper's `runId`, the exact job ID and `documentSha256` values, and the extension request ID. Treat the combination `(jobId, document_type, documentSha256, Drive folder)` as the idempotency key for reused Drive export verification. Never accept a matching filename alone. Recheck hashes immediately before PDF creation and immediately before dispatch.

The extension remains a preparation aid: it may open the verified target and fill known safe fields or select generated PDFs after explicit user action. Reload recovery must not approve documents, mark a job Applied, click navigation/submit, or submit the application. The user reviews the employer page and submits manually.
