# Raven execution handoff

Updated: 2026-09-27


## Reliable free generation (2026-09-27)
- Deployed resume v93 and cover v69: initial generation falls back to source facts on provider, validation, rate-limit or budget-service failures. Free AI has a 12-second generation deadline; revisions have 25 seconds and never silently return a fallback. Database/network overhead is additional.
- Production calls use only OpenRouter with its existing zero-price cap; no paid provider fallback.
- Fixed punctuation-sensitive grounding and revision prompt words removing factual anchors; revision instructions no longer exempt invented numbers, tools or entities. Shared checks reject selected unsupported tools, credentials and responsibility/outcome claims; this is not comprehensive semantic verification.
- Four live resumes and four covers returned 8/8 HTTP 200. Five used AI; three used source-fact fallback. Observed total times 3.8–23.3 seconds including cold/network overhead.
- 49 local core tests and secret scan pass. Browser tests could not launch locally: both installed Playwright versions received invalid browser-download archives. Browser persistence/PDF checks are not newly verified.
- Frontend labels fallback output and invalidates older generation cache. Existing failed-revision preservation remains in place.
- User now wants to discuss a low-click manual ChatGPT copy/paste workflow for both documents; not implemented yet.

Live QA outputs remain transient; no existing job documents were overwritten by API-only tests. Four live revision checks were started; results must be checked before claiming successful tonal changes.
