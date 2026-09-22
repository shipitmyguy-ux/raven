# Raven Work Handoff

Last updated: 2026-09-22

## Purpose
This file is the durable bridge between Chat and Work. Replace/update it at the end of each meaningful Work session.

## Current handoff
Committed the deployed Control Plane Edge Function `raven-control-v1` to canonical GitHub source and integrated the Raven Web Control Panel inside the Options dialog.

Verified in this work:
- `supabase/functions/raven-control-v1/index.ts` written with safe actions (`health`, `getConfig`, `recent`, `refreshAll`, `runSourceDiagnostics`, `repairDescriptions`, `smokeAts`);
- browser policy mutation actions (`updateGenerationPolicy`, `updateSourcePolicy`, `setFeatureFlag`) return HTTP 403;
- employer application submission actions (`submitApplication`, `apply`, `finalize`) return HTTP 403;
- `config.js` and `raven-api.js` updated with `controlApiUrl` and control plane client methods;
- Web Control Panel added to Options dialog with overall health summary, job data-quality metrics, task-health state, identity/dedupe diagnostics, source diagnostics, recent control events, Refresh All button, Run Source Diagnostics button, Repair Descriptions button, ATS Smoke Test button, and read-only policy/feature flag displays;
- Refresh All refreshes all job tracks (`Games / 3D`, `Professional`, `Labor`, `Wildcard`);
- health rendering handles partial/failed diagnostic responses safely with fallback messaging;
- `tests/control-panel.test.mjs` added and all 9 test suites passed cleanly with 0 errors.

Exact next action:
1. Continue with real-site Application Assistant verification on real ATS pages (Greenhouse, Lever, Ashby, Workday).
2. Run full frontend -> generation -> persistence -> application-assistant smoke flow.

## Operational Flow
`Chat -> Raven Control Plane -> Supabase/backend, with Jules only for source-code changes.`

## Usage failsafe
At the beginning of substantial Work, apply the Raven usage guard from `AGENTS.md`:
- block starting substantial work at <=2% remaining usage when refresh is >5 minutes away,
- allow work when refresh is <=5 minutes away,
- never claim a usage check if the Work environment does not expose usage state.

## Rules for the next Work session
- Pull/read GitHub first.
- Read `AGENTS.md`, `RAVEN_STATUS.md`, `TASKS.md`, and this file.
- Do not infer completion from previous conversation text.
- Inspect current code before implementing.
- Commit/push all meaningful changes.
- Update this handoff with:
  - task attempted,
  - files changed,
  - commit(s),
  - tests run,
  - verified behavior,
  - failures/blockers,
  - exact next action.

## Recovery note
Portable JSON backups cover Supabase data only. Device-local IndexedDB/localStorage master resumes, application profile/answer memory, browser caches, external Drive files, and raw secrets need separate recovery or regeneration.

## Control Plane update - 2026-09-22
Added Raven Web Control Panel and committed `raven-control-v1` source:
- added `supabase/functions/raven-control-v1/index.ts` to canonical GitHub repo,
- added control plane client API methods in `raven-api.js` and config endpoint in `config.js`,
- added Control Panel UI inside Options dialog (`index.html`, `styles.css`, `app.js`),
- added comprehensive regression coverage in `tests/control-panel.test.mjs`,
- updated `docs/ARCHITECTURE.md`, `RAVEN_STATUS.md`, `TASKS.md`, and this handoff.
