# Raven execution handoff

## Current state — October 16, 2026

The Apply reliability work is implemented on draft PR #105:
https://github.com/shipitmyguy-ux/raven/pull/105

Latest implementation commit before these handoff-only commits:
`2f0a86452125fd165837daa6df9716e33d5e1715`

The user asked for a working way to open employer applications, fill recognized fields, and upload generated/current documents without manually copying a destination URL into ChatGPT. The implementation keeps the existing Raven Apply action as the entry point. It binds every operation to one extension-owned tab, job, document and page revision. Missing/outdated extension fallback opens the saved listing in the click gesture, then routes to a resolved form when available. Documents are delivered independently when verified; field fill waits for current-form inspection. Navigation cancels stale work. Reload can continue the same attempt. A closed tab requires another explicit Apply click for a fresh attempt. The system never submits the employer application.

Legacy v1 mailbox and v2 dispatch were retired from the active path; historical metadata and saved documents are retained. Recognized ATS adapters have synthetic fixtures. Unsupported sites/formats require manual handling.

## Verified

- Core CI passed at implementation commit `2f0a864`: test job plus Ubuntu and Windows document recovery/concurrency checks and private-tunnel Windows check. Both v3 Apply suites ran; new extension runtime scripts were syntax-checked.
- Full Playwright browser regression passed at the same implementation commit: 153 passed.
- The planner reviewed the final harness corrections and found no blocker in the reviewed delta.
- No user personal information was sent to an employer; no application was submitted.

## Not verified

- PR #105 is draft and unmerged. The implementation is not installed or deployed from this branch.
- Synthetic adapter results do not prove real ATS/employer-side acceptance of selected files.
- No live application form was opened with the user's profile or documents.

## Next action

After the user approves merging PR #105, install/reload the resulting extension in the user's browser. With the user present, run one representative employer form to verify destination routing, recognized profile fields, resume and cover-letter file selection, fallback behavior, and closed-tab recovery. Stop before the final submit button; confirm actual visible selected files. Record each observed result and any unsupported control in `RAVEN_STATUS.md`, `TASKS.md`, and this handoff. Do not claim universal site compatibility.

## Source of truth

GitHub is canonical for code, documentation, task state and handoff. The PR remains draft until the owner chooses to merge. The local checkout was intentionally left untouched because it was stale and contained unrelated dirty/untracked files.
