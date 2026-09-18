# Raven Test Checklist

Run after meaningful production changes.

## Load/state
- Raven loads without blocking console errors.
- Jobs load from the intended live source.
- Counts and tabs agree with underlying state.
- Refresh preserves the selected job/status/data where expected.

## Job import
- Import/save a real job URL.
- Title/company/source are captured or have sensible fallback behavior.
- Full job description is present.
- Original URL/source provenance is retained.
- Duplicate import does not create an unwanted duplicate.

## Job descriptions
Test representative sources, especially:
- LinkedIn
- Indeed
- Glassdoor
- Monster
- other currently supported sources

Confirm descriptions are not empty, placeholder-only, or unexpectedly truncated.

## Search
- Trigger Search jobs now.
- Confirm backend request runs without exposing a ChatGPT prompt/window.
- Confirm new results persist in Supabase.
- Confirm duplicates are handled.

## Status
- Change a job status.
- Navigate between tabs.
- Refresh.
- Confirm status remains correct everywhere.

## Options
- Open Options/Settings.
- Change each exposed setting.
- Confirm immediate UI effect where intended.
- Refresh and confirm local preference persistence.
- Confirm runtime config still supplies defaults.

## Documents
- Generate a real resume for a specific job.
- Generate a real cover letter for that job.
- Confirm both are linked to the correct job.
- Open/review outputs.
- Refresh Raven.
- Confirm links and associations persist.
- Confirm failures do not remain pending forever.

## Regression
- Add job still works.
- Job selection/details still work.
- Filters/sorting still work.
- Extension/import path still works.
- No secrets are exposed in browser-delivered files.
