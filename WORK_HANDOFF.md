# Raven Work Handoff

Last updated: 2026-09-22

## Purpose
This file is the durable bridge between Chat and Work. Replace/update it at the end of each meaningful Work session.

## Current handoff
Production `main` now has a single Supabase data path, global all-tab refresh, shared tab search/parsing/generation logic, request budgets/circuit breakers, portable backup/recovery tooling, and enhanced generator track positioning/factual safety.

Verified in this work:
- saved-job read/add/update all use `raven-backend-v3`;
- `raven-generate-v1` includes data-driven policy integration (`policy.js`), explicit education location validation, track-specific positioning for Games / 3D, Professional, Labor, and Wildcard tracks, natural cover letter narrative prose generation, and server-side grounding/sanitization;
- short request budget limit for generation increased from 6 to 12 per 60s, allowing 8 sequential QA calls without 429 budget rejection while retaining long-term hourly limits and circuit breakers;
- `extractMasterText` recursively extracts text and canonical fact inventories from structured master resume objects as well as raw text / data URLs;
- regression test suite (`tests/generation-policy.test.mjs`, `tests/generator-quality.test.mjs`, `tests/request-budget.test.mjs`) passes cleanly with `npm test`.

Exact next action:
1. Leave PR open for independent review (do not merge automatically).
2. Continue with real-site Application Assistant verification and full frontend -> generation -> persistence -> application-assistant smoke testing.

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

## Generator Persuasiveness & Factual Safety Update - 2026-09-22
- Enhanced `raven-generate-v1` generator architecture to improve persuasiveness while preserving canonical factual safety.
- Track positioning:
  - Professional: Foreground transferable PM/ops capabilities (project delivery, team leadership, cross-functional coordination, intermediate Excel, AI/automation, asset DB metadata) while strictly preserving exact official job titles.
  - Wildcard: Position implementation, onboarding, and customer success while transparently retaining actual game-industry titles/employers.
  - Labor: Prioritize SoundAir maintenance facts (HVAC, facility maintenance, mechanical upkeep) for maintenance/facility roles.
  - Games / 3D: Maintain strong environment-art and 3D modeling targeting.
- Cover letter architecture rewritten to produce natural connective prose with server-side grounding validation and sanitization.
- Request budget short limit adjusted from 6 to 12 per 60s so 8 sequential requests pass without 429 errors.
- Files changed: `supabase/functions/raven-generate-v1/index.ts`, `supabase/functions/raven-generate-v1/policy.js`, `supabase/functions/raven-generate-v1/policy.ts`, `tests/generation-policy.test.mjs`, `tests/generator-quality.test.mjs`, `tests/request-budget.test.mjs`, `package.json`, `WORK_HANDOFF.md`.
- Tests run: `npm test` (10 test suites passed).
