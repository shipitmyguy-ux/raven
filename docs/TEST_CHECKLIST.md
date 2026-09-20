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

## ATS ingestion
- [ ] Quoted multiline descriptions remain part of one CSV record/job.
- [ ] ATS rows require a valid HTTP(S) job URL before persistence/rendering.
- [ ] Description fragments never appear as standalone job cards.
- [ ] Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, and iCIMS sample records preserve title/company/url field alignment.
- [ ] ATS byte, record, timeout, and result limits remain bounded after parser changes.

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

## Reusable-core regression
- [ ] Raven loads with `raven-core.js` available before `app.js` and without console errors.
- [ ] Saved/API jobs and discovered jobs normalize into the same canonical fields.
- [ ] Canonical URL deduplication still prevents duplicate saved/discovered cards.
- [ ] Bookmark, Applied, and Ignore persist after a hard refresh without requiring an immediate full list re-fetch after the write.
- [ ] Returning to Raven after >60 seconds refreshes saved jobs without automatically re-running discovery.
- [ ] Same job + same master resume + same template reuses cached structured resume generation.
- [ ] Changing master resume invalidates the generation cache.
- [ ] CandidateProfile extraction is reused for the same master resume.
- [ ] JobAnalysis is reused for the same job description.
- [ ] Generated work-experience entries contain no location.
- [ ] Direct resume generation remains user-triggered; disabled ChatGPT queue automation is not required.

## Application Assistant
- [ ] Reviewing an approved existing document does not regenerate or alter it.
- [ ] Regenerating/revising a resume invalidates only that resume approval.
- [ ] Regenerating/revising a cover letter invalidates only that cover-letter approval.
- [ ] Apply remains locked until both exact document versions are approved.
- [ ] Application Profile fills only recognized reusable contact fields.
- [ ] Answer Memory never fills sensitive/legal/demographic/attestation/salary/sponsorship/CAPTCHA/assessment questions.
- [ ] Application packet is host-scoped, expires, and is removed after use.
- [ ] Approved resume and cover letter attach to compatible employer file inputs without silent conversion or substitution.
- [ ] No extension path clicks final Submit.
- [ ] Applied status is updated only after strong completion evidence and correct job/host matching.
