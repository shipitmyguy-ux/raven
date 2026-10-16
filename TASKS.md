## One-click Apply — 2026-10-16

- [x] Fix Dover same-posting route rebinding, tenant identity, profile-field context, actual Resume input selection, and existing country-choice preservation.
- [x] Add regression coverage for route changes, shared upload wrappers, MUI portfolio/Discord fields, country selection, and avoiding the Autofill parser.
- [x] Merge PR #110 and pass PR core/Windows recovery/browser/smoke/Pages checks.
- [x] Publish the cache bust to app.js?v=106; Pages deployment succeeded.
- [ ] Owner reloads the installed Chrome extension and refreshes Raven. Browser policy prevents agent access to chrome://extensions and prohibits workarounds.
- [ ] Verify visible fields and Resume attachment on the already-approved Warpfrog live form; stop before Submit.
- [ ] Continue the five-real-job acceptance target only with per-destination approval before each personal-data/document upload. No application submissions.

## Live employer-page acceptance — October 16, 2026

- [x] Inspect the actual Mad Head Games Lead Environment Artist application in Chrome and confirm v2.6.0 injects in the employer page's isolated extension context.
- [x] Identify the observed form: first/last/email use placeholders; CV / Resume uses a file control named `Resume`; portfolio URL is described by its field group; a separate portfolio PDF input exists.
- [x] PR #107 added placeholder, field-group, and CV file matching. Its post-merge smoke caught an upload-safety bug where full-form text made unrelated sensitive questions suppress uploads.
- [x] PR #108 fixed upload context to use only the control label/field group and added production smoke to every Browser regression run. Merged as `691eeb9`.
- [x] Verify PR checks: core 38927559259 and Browser regression 38927559110 passed; the PR browser run included all 14 smoke cases.
- [x] Verify release: Pages 38927988522, core 38927988467, and Browser regression 38927988474 passed; post-deploy production smoke 38928036428 passed all 14 cases.
- [x] Update the staged unpacked v2.6.1 package's `prepare-content.js` from merged main.
- [x] User reloaded the extension and Mad Head tab; the live isolated extension context reports v2.6.1 and inspector status `ready`. Read-only mapping confirms the `Resume` CV input and one portfolio URL input.
- [x] Leave the separate portfolio PDF control untouched; the current Apply payload does not support it. No fields were filled, no files attached, no personal data transmitted, and no application submitted. Any later personal-data/document transmission requires action-time confirmation of exact fields/files and destination.

No personal data was entered or transmitted, no PDFs were uploaded, and no application was submitted. CI smoke verification is not live employer acceptance.


## Automatic resume connection — October 16, 2026

- [x] Confirm the published main flow automatically fetches the exact saved PDF and delivers it to the extension for matching Resume/CV upload fields.
- [x] Restart the application-PDF-capable local helper and register a per-user Windows sign-in task named `Raven One Click Writer`.
- [x] Confirm extension v2.6.1 and the previously inspected live Mad Head form returned `ready`.
- [ ] Verify a real attachment on the exact employer form when the user initiates the matching Raven Apply action; inspect the attached filename before submission. Do not submit.

No personal document was generated or transmitted in this session. The writer reported ready, but its HTTP health endpoint could not be read from the tool sandbox; the optional phone queue is unavailable.

- [x] Verify GitHub CI for automatic stale-tab reconnect; PR and main checks pass.
- [x] Merge and publish the web-only reconnect fix; verify deployed `app.js?v=105`.
- [ ] After confirming exact resume PDF and employer destinations at action time, verify visible resume attachment on eligible real Games / 3D forms; never submit.
