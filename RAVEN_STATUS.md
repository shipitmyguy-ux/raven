## One-click Apply — Warpfrog blocker — 2026-10-16

PR #110 merged as 9e819773124ba701cae903055368a2d15a6d86f5. Dover Apply now supports same-posting tracking-query redirects, exact tenant identity with title verification, bounded MUI field labels, the actual Resume input (excluding the resume-autofill parser), portfolio/Discord fields, and preserving any preselected country. Review also caught and fixed shared-wrapper upload misidentification and existing-country overwrite.

PR core, Windows/Linux recovery, full browser regression, production smoke, and Pages deployment passed. A follow-up cache-bust commit da1e03580e3c05ce01a473a44f313ae83a95e7a2 changes index.html to load app.js?v=106; deployment passed. Other post-cache-bust browser/smoke checks were still running at handoff.

The installed local package under the task visualization directory has the merged apply-background.js and prepare-content.js copied in. Backups with .before-dover suffix remain beside them. Chrome has not reloaded the package. The exact Warpfrog Dover form remains blank; no profile values or resume were transmitted and no application was submitted.

Live acceptance is blocked because Chrome browser security policy rejected access to chrome://extensions (only HTTP(S) navigation is allowed) and prohibits alternative reload methods, CDP, or other browser surfaces. Owner must reload Raven Application Assistant from Chrome Extensions and refresh the Raven page. Then continue the already-approved Warpfrog fill/attach check, stop before Submit. Each additional employer upload needs action-time approval for that exact destination and file.

## Live employer-page support — October 16, 2026

PR #107 added matching for the observed Mad Head Games form's placeholder-only contact fields, CV/Resume upload, and portfolio URL. Its first post-merge smoke exposed a regression: when an upload had no field group, the matcher used the full form text, so unrelated sensitive questions caused every upload to be excluded.

PR #108 fixed the scope to the upload's own label and field group, and added the production smoke suite as an unconditional Browser regression step. PR #108 merged as `691eeb9`. The extension package remains v2.6.1 and is published at https://shipitmyguy-ux.github.io/raven/extension/raven-capture-extension.zip.

Verification on the merged commit: reusable core run 38927988467 passed; Pages deploy 38927988522 passed; Browser regression 38927988474 passed; post-deploy production smoke 38928036428 passed all 14 cases. PR checks 38927559259 and 38927559110 also passed; the PR browser run included the 14-case smoke suite. The staged unpacked package at `C:\Users\damsp\.codex\visualizations\2026\10\16\01a144e3-10d6-7d33-87ed-bdd5f1d5e822\raven-extension-2.6.0` has the merged v2.6.1 `prepare-content.js`. After the user reloaded the extension and Mad Head tab, the live isolated extension context reported version 2.6.1 and the read-only inspector returned `ready`. Read-only DOM mapping confirmed one `Resume` CV upload, one portfolio URL field, and a separate portfolio PDF control.

The real employer form was inspected without entering personal data. The portfolio PDF control remains unsupported by Raven's current Apply payload and must stay untouched. No documents were uploaded and the application was not submitted. Before any personal-data or document transmission, verify exact fields, files, and destination at action time.


## Automatic resume connection — October 16, 2026

The published main Apply path already resolves the employer destination, obtains the current saved resume as an exact verified PDF through the local helper, and delivers it to the extension's matching resume/CV control. Extension v2.6.1 is loaded and its live Mad Head form inspector previously returned `ready`. The local helper was stopped at the start of this task; the application-PDF-capable helper from existing worktree commit `0b92db5` is now running. A per-user Windows sign-in task, `Raven One Click Writer`, was registered to restart it automatically. The helper reports ready; its optional phone queue reports unavailable, while local generation remains available. The tool sandbox blocked a direct loopback health read, so the endpoint capability was not independently read back in this session. No document was generated, transmitted, or uploaded, and no application was submitted. Real live attachment acceptance remains unverified.


## Apply reconnect — October 16, 2026

PR #109 merged as `337a2bac32f09b76f21d1d4b3b3a0a8e5fa4029b`. The published Apply flow now detects a stale saved employer tab during initial status checks, inspection, or form readiness; it closes that attempt, verifies the same canonical saved job ID and HTTPS listing URL, opens one fresh tab, and reuses the saved verified resume PDF. A changed URL or second failure stops safely. There is no employer submission action.

PR checks passed: core 38940222200 and browser regression 38940222213. Main checks passed: core 38940717613, browser regression 38940717421, Pages deploy 38940717384, and production smoke 38940765951. The deployed page reloads `app.js?v=105`. No personal data was transmitted and no application was submitted. Live attachment acceptance on real employer forms remains pending.
