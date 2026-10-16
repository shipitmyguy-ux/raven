# Raven execution handoff

## Current task — Mad Head live application support — October 16, 2026

Application code merged at `691eeb9128b6cf44a424800909c10a20cb5d209b`; documentation updates followed on main. PR #107 added live-form matching; PR #108 fixed a cross-form upload exclusion and added smoke coverage to Browser regression. Both are merged. Published extension package is v2.6.1.

## Verification

- PR core run 38927559259 passed.
- PR Browser regression 38927559110 passed, including the 14-case production smoke suite.
- Main core 38927988467, Pages deployment 38927988522, Browser regression 38927988474, and post-deployment smoke 38928036428 passed. Post-deploy smoke reports all 14 cases passing.
- Staged unpacked package at `C:\Users\damsp\.codex\visualizations\2026\10\16\01a144e3-10d6-7d33-87ed-bdd5f1d5e822\raven-extension-2.6.0` has manifest version 2.6.1 and merged `prepare-content.js`.

## Real employer page

The Mad Head Games Lead Environment Artist form uses placeholders for first name, last name, and email; its CV input is named `Resume` inside a CV / Resume field group. It also has a portfolio URL control and a separate portfolio PDF control. Raven's direct Apply payload does not support portfolio-file documents, so keep that input untouched.

The real form was inspected read-only. No personal data or documents were entered, no PDF was uploaded, and the application was not submitted. Chrome still needs one reload to activate the staged 2.6.1 package; then rerun the read-only inspector on the live employer page. Any transmission of personal details or files requires action-time confirmation of the exact fields, files, and employer destination.

## Next

1. Reload the unpacked Raven extension once in Chrome and refresh the Mad Head tab.
2. Run only the read-only inspector; confirm the form returns ready and recognizes CV plus portfolio URL.
3. Leave all fields and files untouched and do not submit.
4. Track portfolio-PDF support separately if needed.
5. Keep the helper branch `codex/apply-existing-drive-pdfs` separate; its existing private state must not be overwritten.
