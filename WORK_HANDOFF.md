# Raven execution handoff

## Current task — Mad Head live application support — October 16, 2026

Main is at `49f05866dcf850325c6644a2d78db840ed316b8c`; PR #107 is open on `codex/madhead-live-form-support`. It updates the existing extension path and does not introduce a desktop app.

## Real employer-page evidence

Chrome shows the actual Mad Head Games Lead Environment Artist application at https://careers.madheadgames.com/jobs/lead-environment-artist-ckS9/new. The installed Raven Application Assistant v2.6.0 injects on this page. Raven's bridge element is only on Raven's own web app, so checking for it on the employer page was the wrong signal.

Calling the injected extension inspector with the job title and company returns `manual: No recognized application controls`. Inspection of the live form found:
- first name, last name, and email are labeled through placeholders;
- the CV control is named `Resume` inside a field group labeled CV / Resume;
- a separate optional portfolio URL field is described by its surrounding field-group text;
- a separate portfolio PDF input is present.

The current generic matcher ignored placeholders and could not associate the CV input with a label. PR #107 updates those matchers and adds a CI regression based on the observed live form structure. The regression confirms contact-field recognition, portfolio URL recognition, CV input targeting, leaves the distinct portfolio-file input untouched, and never submits. Core run 38924679490 and full browser run 38924678795 passed on commit 8b9af9f9eef17e39ea863654734a5f4ddb814257. These CI results are not live employer acceptance.

## Safety and remaining work

No personal details were entered, no documents were transmitted, and the employer form was not submitted. After PR #107 merges and Pages publishes the new extension package, the unpacked installation will need one final reload. Then re-run the read-only inspector on the actual employer page. Before sending profile details or a PDF to Mad Head Games, confirm the exact fields/files at action time. Do not submit.

The form requests a portfolio PDF as well as a portfolio URL. The current direct Apply packet supports resume and cover letter, not a portfolio-file document; keep that upload manual unless Raven adds verified portfolio-document support.

The helper branch `codex/apply-existing-drive-pdfs` remains separate and untouched. It has 16 local commits and its single-document request issue still needs careful integration. Do not overwrite its private state.

## Next

1. Merge PR #107 after all checks for its latest commit pass.
2. Verify the GitHub Pages package and production smoke.
3. Reload the unpacked extension once, then run the live read-only form inspection.
4. Ask for the exact action-time data/file approval before any real employer transmission. Leave the application unsubmitted.
5. Handle the helper single-document integration as a separate tracked change.
