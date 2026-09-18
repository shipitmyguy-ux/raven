# Raven Work Handoff

Last updated: 2026-09-18

## Purpose
This file is the durable bridge between Chat and Work. Replace/update it at the end of each meaningful Work session.

## Current handoff
The project is being normalized into a GitHub-first workflow.

Current known priorities:
1. User-facing Options/Settings panel.
2. Full job-description audit/fix across all tabs and sources.
3. End-to-end ingestion persistence verification.
4. Real resume/cover-letter generation verification.
5. Reduce unnecessary model polling.

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

## Verification note
The previous document queue could accept requests, but successful generation must still be proven with a real output linked to the correct job and surviving refresh.


## Chat implementation update - 2026-09-18
Implemented the first Options UI step directly through GitHub:
- added a small gear button at the upper-right of the top bar,
- moved sync/status text immediately to its left inside a shared topbar action wrapper,
- added a compact Options dialog shell,
- wired the gear to open the dialog and backdrop click to close,
- preserved responsive header layout with compact sizing.

Files changed: `index.html`, `styles.css`, `app.js`.
Commits: `26fbd636`, `782c6ef2`, `de6811ba`.
Next: populate the panel with the existing runtime-config settings.
