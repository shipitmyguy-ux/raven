# Fresh document pair acceptance — October 14, 2026 MDT

The owner requested a genuinely fresh resume and cover-letter end-to-end test. An existing Saved AmeriSave Mortgage Corporation / Training Coordinator job had no resume, no cover letter and no prior PDF export event at baseline.

A real Edge browser used the published Raven app99 without asset or API interception. Create missing documents issued one paired helper request for that exact saved job. Both documents were newly generated (reused_existing=false), validated and saved, rendered to PDF, uploaded through connected Google Drive and recorded as canonical job export events. All stages completed. No manual draft, upload or database workaround was used.

Independent Drive metadata reads confirmed two distinct PDF files in the existing 1resumecoverletter folder. The resume is68484bytes and2pages; the cover letter29639bytes and1page. Local file signatures are valid PDFs; their SHA256 hashes match the canonical export events, and the Drive metadata sizes match the local rendered files. Every page was rendered and visually inspected.

After a full browser refresh, both exact saved document hashes and both Drive file IDs remained linked to the original job. Its document panel displayed two Current PDF links; its expanded Activity displayed two Open current PDF in Drive links. The completed workflow event retained its request/stage diagnostics. Job status remained Saved, and approval state stayed unchanged. Zero ChatGPT popups, employer interactions or submissions.

Detailed private evidence remains ignored in the managed document-routing-integration worktree: private/fresh-pair-live-report.json, fresh-pair-drive-metadata.json, fresh-pair-pdf-qa.json, fresh-pair-live.png and fresh-pdf-qa/. Generated originals remain in the original checkout's private/exports/. Personal document contents, private identifiers, hashes and Drive links are intentionally omitted from this public record. No application code or configuration changes were required by this test.
