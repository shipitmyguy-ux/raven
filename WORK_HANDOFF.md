# Raven execution handoff

Latest task: closed-listing detection/culling, isolated codex/closed-job-detection review branch starting from 74e852c.

## Implemented
- Existing enrichment API supports Check listing: one URL fetch, seven-second timeout, no model calls or schedule.
- Explicit visible closure notices and expired URL-matched JobPosting evidence confirm closed. HTTP errors including 404/410, blocks, timeouts, redirects and missing text remain unconfirmed. Current matching structured posting permits reopening.
- Separate JSON listing_check on saved/discovery rows preserves application lifecycle/documents/history. Ambiguous rechecks retain prior closure. Discovery upserts retain evidence; both fresh/cache discovery responses exclude confirmed closures.
- Saved closures move to Closed listings. Post-application stages retain their stage with a closure badge. Check reason/time and View listing/recheck remain available.

## Actually verified
- Five focused Node execution tests for source variants/adverse cases, structured evidence identity, mocked database persistence/rechecks/reopening and lifecycle preservation.
- All 27 core workflow regression commands, syntax, secret scan and whitespace.
- Four mocked Edge browser checks: closed saved grouping, interview/documents surviving check and full reload, prior listing/apply controls, and discovery generation preparation. Closure badge contained at 375px; screenshot visually reviewed.
- No production user jobs/documents were changed, no applications submitted, no model data transfers or schedules.

## Release and limitations
- Apply additive supabase/closed-listing-schema.sql before deploying raven-enrich-v1 and raven-backend-v3, then frontend. Register this artifact via the release migration workflow; local Supabase CLI unavailable.
- Live SQL filtering and real employer/ATS acceptance remain pending. API-only/JavaScript-only availability remains unconfirmed. Individual user-triggered checks only; no bulk sweep.
- docs/CLOSED_LISTINGS.md documents behavior and release order. Source committed/pushed for review; production unchanged. Standing push authorization persists in AGENTS.md.
- Parallel tasks may change app.js, styles.css, index.html and project-state files. Merge while retaining their changes. Prior global location release remains recorded in RAVEN_STATUS.md.
