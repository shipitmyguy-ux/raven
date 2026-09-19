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


## Chat implementation update - 2026-09-18
Restored an instant resume first-pass path:
- clicking Resume now builds a local parser-friendly draft immediately from the assigned local master resume and the job description,
- local PDF/text master resumes are extracted in-browser,
- job-posting keywords are used to prioritize existing verified master-resume content without inventing qualifications,
- the instant draft is saved to the Raven job record immediately and opened for review,
- the existing ChatGPT queue remains as a background refinement/fallback instead of blocking the button,
- duplicate/refinement tasks use stable idempotency keys.
Files changed: `app.js`.
Commits: `aab70f0d`, `2e435977`.
Important: this restores near-instant first-pass behavior, but the local deterministic draft is not equivalent to a fully AI-written resume. Live browser behavior still needs verification.


## Working baseline checkpoint - 2026-09-18
Treat the instant local resume first-pass path introduced in commits `aab70f0d` and `2e435977` as the current known-working baseline for resume generation UX.
- Preserve this path while experimenting with hosted LLM generation.
- New online-LLM work must be additive behind a feature/provider switch or safe fallback.
- Do not remove the instant local path until a hosted path is verified faster, reliable, free at single-user volume, and end-to-end functional.


## Online resume generation integration - 2026-09-18
Implemented the new primary resume generation path:
- when online, Raven calls Supabase Edge Function `raven-generate-v1` immediately,
- the function calls Gemini 2.5 Flash-Lite and requests structured ATS-friendly resume output,
- factual content is constrained to the assigned master resume,
- output is rendered into Raven's parser-friendly single-column resume format,
- the Generate Resume button disables and shows an animated Generating state while the request runs,
- the local deterministic generator runs only when `navigator.onLine === false`,
- online provider/configuration errors are surfaced and do NOT silently fall back locally,
- normal resume clicks no longer depend on the scheduled ChatGPT queue worker.
Frontend commits: `7c389516`, `5a79e640`, `5cde7bc`.
Edge function source commit: `fefabf78`.
Supabase function: `raven-generate-v1` version 1, deployed ACTIVE.

Blocker: `RAVEN_GEMINI_API_KEY` (or `GEMINI_API_KEY`) still must be added to Supabase Edge Function secrets. Connected tooling does not expose secret-management actions, so this one-time credential step requires the user. Do not put the key in GitHub or frontend JavaScript.
Live end-to-end Gemini generation is NOT verified until that secret is present and a real job successfully generates.


## Resume click-path repair - 2026-09-18
User reported that pressing Resume did not start generation.
Root causes fixed:
- Resume action previously opened an existing resume instead of regenerating whenever `job.resume` was already populated.
- GitHub Pages was still referencing cached script URLs `app.js?v=27` and `config.js?v=5` after the online-generator changes.
Changes:
- Resume action now regenerates even if an older resume exists.
- Cover-letter existing-document behavior is unchanged.
- Bumped frontend cache-busting to `app.js?v=28` and `config.js?v=6`.
Commits: `676049f1`, `ded518a3`.
Next verification: refresh Raven and press Resume; button should show Generating spinner, call `raven-generate-v1`, and replace the prior resume on success.
