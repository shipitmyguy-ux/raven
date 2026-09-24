# Raven Work Handoff

Last updated: 2026-09-23

## Latest completed work
Fixed missing job listing/application links and broken resume/cover-letter generation on discovery results. User explicitly authorized publishing. Deployed commits: 8c2dfe68bdde6c479c52a68fa5e2922c2a59a599 and e012c571406727b9f1f3ee999c1075a571802d8d.

- Expanded job cards now show View listing and Apply on site links. The separate approved-document assistant still requires approval of the exact documents.
- Shared preparation saves a discovery job before generating either document and retrieves its description if missing. Generated documents therefore attach to a durable saved job instead of being discarded.
- Concurrent preparation shares one save/enrichment operation. Offline discovery generation and missing/expired descriptions return clear errors.
- The app.js asset version was bumped. New browser regressions are selected by the required workflow.

## Actual verification
- Reproduced the original production failures on Akima Intermediate 3D Artist: both generators rejected the empty description, and there was no original-listing link.
- Local JavaScript syntax and focused execution checks passed (discovery persistence, concurrent preparation, both document saves, missing/expired descriptions, offline guard).
- Core regression and targeted browser suites passed on e012c57; Pages deployment and both production smoke runs succeeded.
- In the live Raven UI, generated a resume and cover letter for the same Akima role, inspected both previews, refreshed the page, waited for backend synchronization, and reopened both previews.
- Visually confirmed readable View listing and Apply on site buttons and their original LinkedIn posting destination.
- Left the genuine Akima job saved with both generated documents for user review. Did not approve documents, mark applied, or submit to an employer.

## Remaining independent closeout items
1. Real employer-site Application Assistant/extension checks for approved-file attachment, current adapter selectors, and conservative completion detection.
2. Real-site extension import checks on aggregator and representative ATS pages.
3. Decide whether optional Google Drive persistence is wanted; current document persistence does not depend on Drive.

## Operating boundaries
GitHub is canonical code/project state; Supabase is authoritative live runtime data; Google Sheets is retired. Final employer submission remains manual. iOS/Android remain excluded. Prefer direct tooling; no Jules dependency. Prior platform, lifecycle, backup, evidence-coverage, and outcome analytics state is retained in RAVEN_STATUS.md and TASKS.md.
