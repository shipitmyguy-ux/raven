# Raven execution handoff

## Current state — October 16, 2026

Apply reliability PR #105 and follow-up PR #106 are merged on main at `49f05866dcf850325c6644a2d78db840ed316b8c`. The Pages release publishes extension v2.6.0.

The workflow starts from Raven's **Apply job** button. It opens a correlated employer tab, inspects the form, fills recognized safe profile fields, attaches verified documents, retains saved cover text for supported text-only controls, and never submits the application. The extension's Chrome context menu currently offers **Save to Raven**; it does not offer direct Apply from arbitrary employer pages.

## Verified

- Reusable core CI run 38920102857 passed.
- Browser regression run 38920103042 passed.
- Pages deploy run 38920102689 passed.
- Production smoke run 38920178847 passed all 14 cases.
- Seven synthetic ATS protocol 3 fixtures passed in isolated Chrome; no personal data or application submission.
- Published ZIP is https://shipitmyguy-ux.github.io/raven/extension/raven-capture-extension.zip. Manifest version is 2.6.0.
- Extracted package is staged at `C:\Users\damsp\.codex\visualizations\2026\10\16\01a144e3-10d6-7d33-87ed-bdd5f1d5e822\raven-extension-2.6.0`.

## Remaining acceptance work

- Install/reload v2.6.0 in Chrome. User approved this, but browser-control policy refused the `chrome://extensions` page. The user must manually choose **Load unpacked** for the staging folder (or replace files in the existing loaded folder and click **Reload**), then refresh the Raven tab.
- The running helper is on branch `codex/apply-existing-drive-pdfs`, commit `661066e`; its request validation accepts exactly two documents. It has 16 branch commits. Preserve and integrate that work before activating the current main helper implementation, which accepts one or two documents.
- After extension/helper activation, use a supported synthetic form or a specific user-approved employer/document combination to verify recognized values and visible file attachments. Stop before final submission. No live employer upload is currently claimed.

## Source of truth

GitHub is canonical for Raven code and task state. The implementation and smoke fixes are merged. No employer received user data and no application was submitted in this session.
