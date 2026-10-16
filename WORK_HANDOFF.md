# Raven execution handoff

## One-click Apply — October 16, 2026

PR #110 merged at 9e819773124ba701cae903055368a2d15a6d86f5. It fixes Dover same-job tracking redirects, exact company/title inspection, bounded MUI profile labels, Resume-vs-Autofill file selection, and preserving an existing country radio choice. Regression tests cover these cases. PR CI passed core, Windows/Linux recovery, full browser regression, production smoke and Pages deployment.

Commit da1e03580e3c05ce01a473a44f313ae83a95e7a2 changed the app cache key to app.js?v=106; Pages deploy passed. Post-cache-bust browser and production smoke checks were running at handoff.

The installed local package directory is C:\Users\damsp\.codex\visualizations\2026\10\16\01a144e3-10d6-7d33-87ed-bdd5f1d5e822\raven-extension-2.6.0. Its apply-background.js and prepare-content.js now contain merged source; original files were kept as .before-dover. The Chrome extension still needs Reload.

Chrome Browser Use policy blocked chrome://extensions/ because it permits only HTTP(S) URLs and explicitly forbids alternate reload routes, raw CDP, or another browser surface. This is a hard browser control boundary, not missing authorization. The owner needs to open Chrome Extensions, reload Raven Application Assistant, and refresh the Raven tab.

The Warpfrog Dover form at https://app.dover.com/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47c/?rs=76643084 is still blank. The user authorized only the profile fields and resume for this destination. No data or file has been transmitted and no application has been submitted. After reload, resume Raven's normal Apply flow and verify the visible fields and attached PDF. Stop before Submit. Other employer uploads need approval at action time for the exact employer and file.
