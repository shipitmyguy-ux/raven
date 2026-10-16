# Raven execution handoff

## Current task — one-click Apply reconnect — October 16, 2026

The web Apply flow reused a saved attempt ID after its Chrome employer tab was gone. Raven then stopped and required another Apply click. The fix on branch `codex/apply-auto-reconnect` closes that stale attempt, confirms the saved job still has the same ID and HTTPS URL, opens one fresh employer tab, and continues with the same saved, verified resume PDF. The retry is bounded once. A changed URL or second failure stops safely. The employer form remains for review; Raven does not submit.

## Changes made

- Updated `app.js` and bumped its cache version to v105.
- Replaced the old regression that required a second click with checks for automatic reconnect after a closed tab and a missing-tab error, unchanged job URL, PDF delivery, and no submit request.
- Documented the reconnect behavior and remaining live acceptance.

## Verification state

- Code and regression changes are committed on the isolated GitHub branch.
- GitHub CI, merge, Pages publish, and live browser acceptance are pending.
- No employer application has been submitted.
- Real resume attachment testing requires action-time confirmation of the exact resume file and employer destinations, as recorded in the project task handoff.

## Next

Run and repair CI, publish the fix, and verify the live Raven asset. Then confirm the exact saved resume PDF and target employer forms before any file upload, verify the attachment visibly, and stop before Submit.
