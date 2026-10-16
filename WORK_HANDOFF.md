# Raven execution handoff

## Current task — one-click Apply acceptance — October 16, 2026

The stale employer-tab bug is fixed and published. PR #109 merged as `337a2bac32f09b76f21d1d4b3b3a0a8e5fa4029b`. On a saved Apply attempt whose tab closes during status, inspection, or form readiness, Raven closes the old attempt, verifies the canonical saved job ID and HTTPS listing URL, opens one fresh employer tab, and continues with the verified saved resume PDF. The retry is bounded to one. A changed job link or a second failure stops safely. The employer form remains for review; Raven never submits it.

## Changes and verification

- Web asset cache tag v105 is deployed and was observed after a live Raven reload.
- PR core 38940222200 and browser regression 38940222213 passed.
- Main core 38940717613, browser regression 38940717421, Pages 38940717384, and production smoke 38940765951 passed.
- No personal data was transmitted and no application was submitted.

## Remaining acceptance

Verify visible resume attachment on five real Games / 3D employer forms. The first known ready case is Warpfrog Senior 3D Artist: the saved resume is the current Raven Resume PDF, and the blank live Dover application is open at `https://app.dover.com/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47c/?rs=76643084`. Before personal data or files are transmitted, confirm the exact resume and employer destination at action time. Once authorized, check the visible filename and recognized fields, then stop before Submit. Continue with the next eligible real listing until five successes or a concrete unsupported-site blocker is documented.
