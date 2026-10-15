# Actual helper restart recovery — October 14, 2026 MDT

The owner requested stopping/restarting the local helper after a PDF uploads but before its link is saved, then proving disk-receipt recovery without regeneration or duplicate uploads.

## Interruption

Used an existing Saved Mercury / Senior Customer Support Operations Readiness Program Manager resume. Baseline: no resume export event, no receipt and no matching Drive PDF. The existing cover letter was preserved throughout. No saved documents or export events were removed to prepare the test.

After checking that the normal helper was idle, a temporary job-scoped helper owned the actual local loopback port. It imported the production workflow/server modules and used the normal protected configuration, PDF renderer, real Drive adapters, private state and receipt directory. The published app99 Review→Save PDF to Drive action submitted the request.

One PDF was rendered and uploaded. The hook paused before calling record_drive_export, after verifying its upload receipt was on disk and its recording progress was persisted. Canonical export count was still zero. The listener process was then force-stopped at that exact pause. The hook did not return a simulated error or finish recording the link.

## Fresh normal process

The unmodified normal helper was started with its existing protected launcher under a different process ID. It read the interrupted run from local state and reported HELPER_RESTARTED with failed_stage=recording. Looking up that run did not enqueue new work. No receipt was manually copied or manufactured.

An explicit retry through the published site's normal resume-export control completed. The fresh helper recovered the journal receipt from disk, verified the original Drive file, and recorded exactly one canonical export event against the same job/document/hash/file identity.

## Verified outcomes

- Both existing document hashes remained unchanged.
- Retry used one Drive-metadata worker and only get_file_metadata tools: no draft-generation worker or upload tool ran.
- Retry history has no writing, saving or uploading stages.
- Local PDF SHA256, size and modification time remained unchanged, confirming no rerender.
- The original Drive file ID, size and creation/modification timestamps were retained.
- Exactly one export event was saved for the target resume.
- A full browser refresh retained the correct Current PDF link; status stayed Saved and approval state was unchanged.

| Checkpoint | Matching Drive PDFs |
| --- | ---: |
| Before request | 0 |
| After upload, before process stop | 1 |
| After fresh-process retry | 1 |

No duplicate PDF was created. The normal helper finished healthy and idle, with phone queue and application preparation capabilities restored. The temporary listener is gone; no persistent fault hook, production code/configuration change, extension update, approval or submission was left behind.

Detailed private evidence is ignored in the managed document-routing-integration worktree under private/restart-recovery-*: baseline, checkpoint, initial UI report, process transitions, retry report, independent Drive audit and screenshot. Personal document contents, private IDs, hashes, cloud links and credentials are omitted from this public record.

## Automated coverage

This scenario is now covered for resume, cover letter and paired requests by tests/oneclick-recovery.test.mjs. Run `npm run test:document-recovery`; the existing core CI workflow runs the same cases on Linux and Windows without credentials or live data. See docs/ONE_CLICK_RESUMES.md for fixture boundaries and assertions.
