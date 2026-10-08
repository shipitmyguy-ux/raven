# Closed listing checks

Expanded jobs expose **Check listing**, using the existing enrichment endpoint.
One click checks one source URL with a seven-second fetch timeout. No timer,
scheduled search, model call, lifecycle transition, or deletion is involved.

Explicit closed/filled/expired notices and expired matching schema.org JobPosting
`validThrough` values confirm closure. A current matching structured posting can
confirm reopening. Other pages remain unconfirmed. HTTP 404/410 alone, access
restrictions, timeouts, redirects away from the listing and missing text do not
confirm closure. ATS pages exposing those notices or structured postings are
supported; API-only/JavaScript-only ATS states remain unconfirmed.

The existing `raven_jobs` and `raven_search_results` rows retain JSON availability
evidence in `listing_check`, separately from application `status`. Evidence includes
the reason, check time, HTTP status and latest check result. An ambiguous recheck
retains a previous confirmed closure. Search upserts do not overwrite this field.
Both cached and fresh search responses exclude confirmed closed discovery rows.

Saved closed jobs appear in Closed listings. Applied, Interview, Offer and Rejected
records retain their stage, documents, application dates, snapshots and timeline.
Cards display CLOSED LISTING. View listing, saved-document review and another
check remain available; application shortcuts and generation are suppressed.
The user's manual lifecycle control remains available.

## Release prerequisite

Apply `supabase/closed-listing-schema.sql` before deploying updated
`raven-enrich-v1` and `raven-backend-v3`, then publish the frontend. This additive
SQL artifact changes no RLS policies or grants. The existing table policies remain
in force. Register it through the deployment environment's migration workflow.
The local Supabase CLI was unavailable; no production schema/function deployment
or live job mutation was performed in this implementation session.

## Verified locally

Five focused execution tests cover source wording, failures/access restrictions,
redirects, structured expiry identity, persistence patches, ambiguous rechecks,
reopening and application-history preservation. Browser fixtures verify closed
saved-job grouping and interview/document preservation across full reload.
These are mocked backend/source checks, not real employer-site or production
database acceptance. Real source formats and live SQL filtering need release QA.
