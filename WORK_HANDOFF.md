# Raven execution handoff

## Active direction: use manual ChatGPT transfer (2026-10-09)
User called authentication a major blocker and instructed working around it or abandoning auth. Selected the existing Raven ChatGPT prompt/JSON import workflow; stop requiring MCP OAuth/password setup for current work. MCP authentication is not disabled and no public unauthenticated access is introduced. Do not resume OAuth onboarding unless requested.

Verified in source: document ChatGPT/Create ChatGPT prompt builds a grounded prompt; Import ChatGPT result accepts pasted JSON or a JSON file, validates it and saves through the existing document path. This route does not require the Raven MCP OAuth connection. Actual signed-in ChatGPT generation/import and refresh persistence are still unverified; source inspection is not live acceptance.

Next: open the target job in Raven, use ChatGPT on its resume, generate the requested JSON, then use Import ChatGPT result > JSON file on that same job and confirm the saved document after refresh. Preserve existing documents and review any replacement. Paid-provider PR58 stays inactive. Browser helper remains unavailable; no new login/email requests were sent.
## Prior implementation record (superseded priority)
# Raven execution handoff
## Password sign-in follow-up (2026-10-09)
Consent page now supports password sign-in alongside explicit email sign-in, plus a private Set password form for an authenticated account. Password fields are cleared after requests; no credentials are logged or persisted by Raven. OAuth approval, grant checks and token validation are unchanged.

User states they never defined a password. A read-only aggregate found one Auth account with a nonempty credential field; this does NOT prove the user knows a usable password. The owner must privately set their password in their existing signed-in consent tab, or complete one email sign-in after the rate limit clears. No password was set by the agent and no email was sent.

Verified locally: seven installed-Edge consent tests (synthetic auth, real pinned SDK load, mobile layout), mobile screenshot inspected, all 45 syntax/core/secret commands in test.yml, and whitespace checks. Local Node v24.19.0; CI remains Node 22. Codex sandbox shell still fails setup; approved alternate execution works. Existing signed-in browser automation was not retried. Actual ChatGPT tools remain unavailable in this chat; token issuance, tool retrieval/save and Raven reload remain unverified. Paid pilot PR58 is inactive; user data untouched.
## Next actions
1. PR70 is merged and Pages deployed. Complete owner private password setup, then the real ChatGPT acceptance flow below.
2. Owner privately sets a password using Set password in their already signed-in consent tab. If signed out, one successful email sign-in is needed after the limit clears. Never request credentials in chat or reset the owner through admin impersonation.
3. Reconnect Raven in ChatGPT and verify actual list_jobs/get_job/get_verified_profile, grounded generation/save for the granted job, then Raven refresh persistence. These tools are unavailable in this chat.
4. Verify live hook issuance, expiry/revocation. Keep strict resource audience, owner/client/session and grant validation.

## Existing live state
raven-mcp-v1 v4; single-owner 30-day grant for DataHouse PROJECT MANAGER JT-1789707628035, jobs:read/profile:read/documents:create only. No revision permission. User reports hook enabled. Existing docs preserved; no live writes made this session. See docs/qa/2026-10-09-mcp-live-grants.md for earlier evidence and limitations.

Routine pushes authorized. User d means do it. Usage 91% remaining at session start. Preserve unrelated renderer line-ending change and Smile-Break-Senior-Environment-Artist.json. Paid-provider PR58 remains inactive.

## PR70 publication approved and deployed
User explicitly approved merging/publishing PR70. Merged at bb86e2b0fd35fb62e17cc9d9109c6e95b6fec388; the previous approval blocker is resolved. Pages run 37961312719, main core 37961312588 and first smoke 37961312686 passed. Hosted consent HTML returns 200 and contains the private password form. Full main browser 37961312723 and post-Pages smoke 37961362431 also passed. All release checks are green.

Next action: owner reloads their original signed-in consent tab and privately saves a password. If signed out, authenticate by email after its limit clears. Then reconnect ChatGPT and test actual Raven tools. No private password has been supplied to the agent; actual password setup, OAuth tool access and document save/reload remain unverified.