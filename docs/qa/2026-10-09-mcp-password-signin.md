## Password sign-in follow-up (2026-10-09)
Consent page now supports password sign-in alongside explicit email sign-in, plus a private Set password form for an authenticated account. Password fields are cleared after requests; no credentials are logged or persisted by Raven. OAuth approval, grant checks and token validation are unchanged.

User states they never defined a password. A read-only aggregate found one Auth account with a nonempty credential field; this does NOT prove the user knows a usable password. The owner must privately set their password in their existing signed-in consent tab, or complete one email sign-in after the rate limit clears. No password was set by the agent and no email was sent.

Verified locally: seven installed-Edge consent tests (synthetic auth, real pinned SDK load, mobile layout), mobile screenshot inspected, all 45 syntax/core/secret commands in test.yml, and whitespace checks. Local Node v24.19.0; CI remains Node 22. Codex sandbox shell still fails setup; approved alternate execution works. Existing signed-in browser automation was not retried. Actual ChatGPT tools remain unavailable in this chat; token issuance, tool retrieval/save and Raven reload remain unverified. Paid pilot PR58 is inactive; user data untouched.


## Publication gate
PR70: https://github.com/shipitmyguy-ux/raven/pull/70, implementation head 68e956fbc21dae1e0b7fb0d7b30dea82c2c98592. GitHub core run 37960978120 and full browser run 37960977991 passed. Live protected-resource metadata still returns 200. Auth log aggregates show historical OAuth token endpoint 200 responses and email OTP 429 responses; they do not prove post-hook token claims or tool access.

Automatic approval review rejected merging PR70: standing branch-push authorization was not accepted as explicit authorization to publish this authentication change to main. Explicit user approval for PR70 has been requested. Do not bypass or retry without approval. Code and docs are pushed; the hosted page does not yet contain password support.
