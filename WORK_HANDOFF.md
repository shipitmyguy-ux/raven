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


## Chat implementation update - 2026-09-18
Completed the Raven Options panel:
- grouped settings into collapsed Layout, Job information, and Behavior sections,
- added controls for card density, sidebar width, detail width, salary, remote status, source, notes, sync status, and default sort,
- persisted per-device overrides in localStorage,
- kept runtime-config.json as the default source,
- added Reset to defaults,
- settings apply immediately without a page reload.

Files changed: `index.html`, `styles.css`, `app.js`.
Commits: `fdd8cb62`, `20a7e975`, `f0705a77`.


## Chat implementation update - 2026-09-18
Changed Options navigation UX:
- category list no longer expands inline,
- selecting Layout, Job information, or Behavior opens a single settings card,
- settings card slides in from left to right,
- top-left back arrow returns to the category list,
- existing setting persistence and reset behavior remain intact.

Files changed: `index.html`, `styles.css`, `app.js`.
Commits: `580a883d`, `a7987a28`, `cd64a02a`.


## Chat implementation update - 2026-09-18
Polished Options navigation:
- category settings cards now slide in right-to-left,
- back arrow is larger and more visually prominent,
- all select/dropdown controls use a unified width for cleaner alignment.

File changed: `styles.css`.
Commit: `f051cc74`.


## Chat implementation update - 2026-09-18
Added Master resumes to the top of the Options list:
- supports multiple master resumes,
- source can be Google Drive URL or local file,
- local files are stored in browser IndexedDB on that device,
- each master resume can be assigned to Games / 3D, Professional, Labor, and/or Wildcard,
- resume-generation task input now includes the master resume assigned to the job's track,
- master resumes can be edited or deleted.

Files changed: `index.html`, `styles.css`, `app.js`.
Commits: `102bf53c`, `2c5a84eb`, `66335184`.

Important: generation workers still need to consume the new `input.masterResume` payload for the source resume to actually shape generated output end-to-end.


## Chat implementation update - 2026-09-18
Updated the live JobTrack Queue Worker automation to consume `input_json.masterResume` for tailored resumes.
- Drive master resumes are used by URL.
- Local master resumes are consumed from task payload content.
- Missing local source blocks generation rather than silently substituting.
- Track assignment is respected.
- Output records which master resume was used.
- Mirrored worker contract to `docs/QUEUE_WORKER.md`.

Important architecture finding: `raven-tasks-v1` is only a queue API; the live ChatGPT automation is the actual document-generation consumer.


## Resume generation rule - 2026-09-18
All generated tailored resumes must render to no more than 2 pages in the final PDF. The generator should preserve normal professional readability and meet the limit by prioritizing relevant experience and removing lower-value or redundant content, not by using unusually small fonts or excessively narrow margins. Page count must be verified before marking a resume task complete.
