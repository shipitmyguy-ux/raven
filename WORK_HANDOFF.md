# Raven execution handoff
## Password sign-in follow-up (2026-10-09)
Consent page now supports password sign-in alongside explicit email sign-in, plus a private Set password form for an authenticated account. Password fields are cleared after requests; no credentials are logged or persisted by Raven. OAuth approval, grant checks and token validation are unchanged.

User states they never defined a password. A read-only aggregate found one Auth account with a nonempty credential field; this does NOT prove the user knows a usable password. The owner must privately set their password in their existing signed-in consent tab, or complete one email sign-in after the rate limit clears. No password was set by the agent and no email was sent.

Verified locally: seven installed-Edge consent tests (synthetic auth, real pinned SDK load, mobile layout), mobile screenshot inspected, all 45 syntax/core/secret commands in test.yml, and whitespace checks. Local Node v24.19.0; CI remains Node 22. Codex sandbox shell still fails setup; approved alternate execution works. Existing signed-in browser automation was not retried. Actual ChatGPT tools remain unavailable in this chat; token issuance, tool retrieval/save and Raven reload remain unverified. Paid pilot PR58 is inactive; user data untouched.
## Next actions
1. Publish the password consent change after review/CI; source branch codex/oauth-password-signin, based on main 364093f (PR69 already merged).
2. Owner privately sets a password using Set password in their already signed-in consent tab. If signed out, one successful email sign-in is needed after the limit clears. Never request credentials in chat or reset the owner through admin impersonation.
3. Reconnect Raven in ChatGPT and verify actual list_jobs/get_job/get_verified_profile, grounded generation/save for the granted job, then Raven refresh persistence. These tools are unavailable in this chat.
4. Verify live hook issuance, expiry/revocation. Keep strict resource audience, owner/client/session and grant validation.

## Existing live state
raven-mcp-v1 v4; single-owner 30-day grant for DataHouse PROJECT MANAGER JT-1789707628035, jobs:read/profile:read/documents:create only. No revision permission. User reports hook enabled. Existing docs preserved; no live writes made this session. See docs/qa/2026-10-09-mcp-live-grants.md for earlier evidence and limitations.

Routine pushes authorized. User d means do it. Usage 91% remaining at session start. Preserve unrelated renderer line-ending change and Smile-Break-Senior-Environment-Artist.json. Paid-provider PR58 remains inactive.

## Publication gate
PR70: https://github.com/shipitmyguy-ux/raven/pull/70, implementation head 68e956fbc21dae1e0b7fb0d7b30dea82c2c98592. GitHub core run 37960978120 and full browser run 37960977991 passed. Live protected-resource metadata still returns 200. Auth log aggregates show historical OAuth token endpoint 200 responses and email OTP 429 responses; they do not prove post-hook token claims or tool access.

Automatic approval review rejected merging PR70: standing branch-push authorization was not accepted as explicit authorization to publish this authentication change to main. Explicit user approval for PR70 has been requested. Do not bypass or retry without approval. Code and docs are pushed; the hosted page does not yet contain password support.
