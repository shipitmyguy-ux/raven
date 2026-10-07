# Raven execution handoff

Latest task: exclude selling jobs from Professional (2026-10-07).

## Implemented and verified
- Existing shared track-filter.js now exports professionalRoleAllowed. It rejects selling titles and explicit selling responsibilities, preserving non-selling training, operations, support and enablement.
- Backend candidateAllowedForTrack uses it for new ranking and cached discovery reads. Browser combinedJobs filters saved/discovered Professional listings. Existing saved records, documents and application history are not mutated.
- index.html cache versions bumped. Five focused regression cases added to core CI; all core workflow regression commands, syntax, secret scan and whitespace checks pass. Browser list execution used saved/applied/discovered fixtures; no live hosted/browser/backend verification is claimed.

## Delivery
- Branch codex/professional-no-sales starts from the current GitHub main branch, independent of pending resume-download work.
- Preserve the untracked Smile-Break-Senior-Environment-Artist.json file; it is not part of this change.
- Separate user approval to merge/deploy remains required from the prior handoff. After approval, publish frontend and deploy raven-backend-v3 with the updated shared module, then verify live Professional results, refresh behavior and persistence.

## Current publication blocker
Automatic approval review rejected pushing this change to the external GitHub repository because separate publication authorization was not established. No push or deployment occurred. Request explicit approval to push to shipitmyguy-ux/raven, merge, and deploy the frontend/backend before proceeding. Local changes and validation are complete.
