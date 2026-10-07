# Raven execution handoff

Latest completed task: exclude selling jobs from Professional (2026-10-07).

## Published behavior
- professionalRoleAllowed in the existing shared track filter excludes direct selling titles and explicit personal selling responsibilities from Professional ranking, cached discovery reads, and browser saved/discovered lists.
- Non-selling operations, training, enablement and support remain eligible. Other tracks are unchanged; no stored job/document/application data was deleted or rewritten.

## Release and verification
- PR https://github.com/shipitmyguy-ux/raven/pull/56 merged at a88dab9f4993df9f6c8345493a476c7a4f92b5a4. Hosted index confirms app v75 and track-filter v2; hosted shared module contains professionalRoleAllowed.
- raven-backend-v3 deployed ACTIVE v54, preserving the prior authentication configuration and all prior bundle files except the two filter-related changes. Health endpoint reports healthy.
- All 25 local core workflow regression commands passed, including five focused sales-filter tests; syntax, whitespace and secret scan pass. PR core/browser CI passed. Release core, Pages and both production smoke runs passed. Final post-merge full browser CI was still running at the last check.
- Read-only live listResults for Professional returned 99 records; zero were rejected by the new shared eligibility. Browser filtering of saved/applied/discovered fixtures passed without mutating records. Unknown selling duties cannot be detected if the posting does not expose them; current detection uses explicit title/responsibility evidence.

## Authorization
- User explicitly granted standing authorization for future pushes; recorded in AGENTS.md.
- User explicitly approved this merge and deployment. Earlier automatic-review blockers are resolved; do not ask again for this completed release.

The unrelated untracked Smile-Break-Senior-Environment-Artist.json remains local and was not pushed. Local checkout is main. Pending resume-download/extension work is separate from this release.
