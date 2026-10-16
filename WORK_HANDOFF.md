# Raven execution handoff

## Current state — October 16, 2026

Apply reliability PR #105 and smoke/docs PR #106 are merged on main at `49f05866dcf850325c6644a2d78db840ed316b8c`. The Pages release publishes extension v2.6.0.

## Live employer-page check

From Raven, **Continue with Apply** opened the saved Lead Environment Artist role on the real Mad Head Games careers site: https://careers.madheadgames.com/jobs/lead-environment-artist-ckS9. The actual form has CV/resume and portfolio PDF upload controls, portfolio URL, contact fields and employer-specific questions.

The page was reloaded after the attempted extension install. The Raven bridge/content script was still absent, so no autofill or upload occurred. No personal details were entered, no documents were transmitted, and the form was not submitted. The extension package's manifest allows all URLs; this points to the installed extension/profile or Chrome site-access state, but the exact cause is not verified.

The browser-control safety gate blocks interaction with `chrome://extensions`. The user cannot find Raven Application Assistant in the extension list and needs a guided manual install/check. Staged unpacked v2.6.0 package: `C:\Users\damsp\.codex\visualizations\2026\10\16\01a144e3-10d6-7d33-87ed-bdd5f1d5e822\raven-extension-2.6.0`. In the same Chrome profile, use **Load unpacked** for this folder (or Reload the extension if this exact folder is already loaded), verify the card is enabled and version 2.6.0, then refresh the Mad Head page and check that the Raven bridge appears.

## Existing verification

- Core CI 38920102857, browser regression 38920103042, Pages deploy 38920102689 and production smoke 38920178847 passed.
- Production smoke passed all 14 cases; seven protocol 3 ATS fixtures passed in isolated Chrome with synthetic data.
- These checks are not real employer-site acceptance; live autofill/upload remains blocked by missing extension injection.
- Current Raven context menu action is **Save to Raven**. Applications start from Raven's **Apply job** button.

## Remaining blockers

- Verify/install extension in the user's Chrome profile and confirm bridge injection on the real employer page.
- Before any real transmission, confirm the exact personal fields and resume/portfolio files to send to Mad Head Games. Do not submit the application.
- Running helper is on `codex/apply-existing-drive-pdfs` at `661066e`, with 16 local branch commits. It rejects one-document requests; current main helper source accepts one or two. Preserve and integrate branch work before activation.
- Determine whether right-click Apply is still a required product outcome.

GitHub remains the source of truth. No application was submitted.
