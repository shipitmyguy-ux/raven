# Raven execution handoff

Latest task: push prepared Raven updates (2026-10-06).

## GitHub delivery
- User authorized pushing updates. Feature branch `codex/resume-download-json` was pushed successfully to `shipitmyguy-ux/raven`; PR #55 is open: https://github.com/shipitmyguy-ux/raven/pull/55.
- Earlier push approval blocker is resolved. Implementation and documentation are now durable in GitHub. Merge and production deployment remain pending; do not report updates as live.

## Resume overflow download
- Frontend v73 adds Download resume to the existing … menu only for a populated resume. Clicking downloads Word directly through the shared export helper, without opening review or changing review state.
- Verified with local mocked Edge: no download control before generation; generated resume exposes the menu item and downloads a `.docx` directly. Syntax and whitespace pass. Local-only; previous push authorization blocker remains unresolved.

## Application action label containment
- Fixed the single-span Generate both / Finish documents label occupying the 22px icon column. Single-span labels now span both grid columns; all action labels wrap and buttons/grid rows can grow.
- Bumped stylesheet cache key. Verified every icon/label bounding box inside its button at 715x764, 375x764, and 320x764 in local Edge with mocked services; inspected the 715px screenshot. No live data was changed.
- Local fix only. The previously rejected GitHub push still requires explicit user authorization; production remains unchanged.

## Resume downloads / JSON handoff
- Frontend v72: real OOXML Word downloads, browser Save as PDF, and immediate JSON-file import. `document-download.mjs` exports existing rendered text. `resume-transfer.mjs` requests file delivery and binds imports to the job/request/previous document values.
- Extension 2.2.0 adds Downloads permission, watches matching ChatGPT attachment links, queues completed file contents until acknowledged, and transfers through Raven's unchanged manual-draft fact checks and save path. Human approval remains required. No backend deployment or schema change.
- Verified: eleven focused unit checks plus 22 existing reliability checks; two mocked Edge browser checks cover Word download, print invocation, automatic import, and reload persistence. Syntax, secret scan, and whitespace pass.
- Signed-in ChatGPT attachment links/URL access and final Word/PDF pagination are not verified. Update the installed extension and reload Raven/ChatGPT for automatic transfer. Publication is pending; do not report this as live.
- Work branch: `codex/resume-download-json`, started from GitHub dacc259. See docs/RESUME_DOWNLOADS.md and extension/README.md.
- Implementation committed locally as e53f0e8. Automatic approval review rejected pushing the feature branch to `https://github.com/shipitmyguy-ux/raven.git`, citing unverified external destination/code egress without explicit user authorization. GitHub durability, pull request, CI, and production publication remain pending. Request approval for this exact branch/destination before retrying; do not bypass the rejection.

## ChatGPT prompt handoff (2026-09-30)
- Frontend v71 carries the complete prompt in ChatGPT's `q` link instead of opening its bare homepage. Clipboard backup remains available, and blocked pop-ups are reported accurately.
- Four focused handler tests pass (long/unicode prompt preservation, clipboard denial, popup blocking, request failure); syntax and whitespace checks pass. Actual signed-in ChatGPT composer prefill is not verified here and may depend on ChatGPT handling the link.

Frontend-only change; no backend, saved-document, generation guard, or candidate-profile changes. Prior Accurx investigation remains documented in docs/qa/2026-09-30-accurx-number-review.md.
