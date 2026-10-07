# Raven execution handoff

Latest task: exclude selling jobs from Professional (2026-10-07).

## Completed
- Shared professionalRoleAllowed filters direct selling titles and explicit personal selling duties in backend ranking, cached-result reads, and browser saved/discovered lists. Existing job records and documents are preserved; non-selling operations/training/enablement remain eligible.
- Five focused tests and all 25 core workflow regression commands pass locally, along with syntax, secret scan and whitespace checks. GitHub core job also passed; final browser CI status should be checked.
- Pushed codex/professional-no-sales and opened https://github.com/shipitmyguy-ux/raven/pull/56. The PR is attached to the active chat.
- User explicitly authorized future pushes without asking again; recorded in AGENTS.md. Prior push blocker is resolved.

## Production blocker
Automatic approval review rejected supabase.deploy_edge_function for raven-backend-v3: the user authorized pushes but did not clearly authorize this specific production deployment. No backend deployment or PR merge occurred. Ask only for explicit merge/publication and production backend deployment authorization, then complete those actions and live checks. Do not retry the deployment through another path.

Prepared backend deployment preserves the active v53 bundle and patches only functions/_shared/track-filter.js and functions/raven-backend-v3/utils.ts. Existing verify_jwt=false is preserved. Raven Backend project ref is umvmilulnqnmeqvfoxxc. Frontend changes publish through GitHub Pages on main merge. Check final PR browser/core CI before merging.

Preserve untracked Smile-Break-Senior-Environment-Artist.json. It is unrelated and was not pushed.
