# Raven execution handoff

## OAuth connection follow-up (2026-10-09)
User defined d as do it; implementing the stated priority of authenticated ChatGPT integration. Existing Option 3 push/deploy authorization applies. PR59 is merged into main 2512fdd. Paid pilot PR58 remains inactive.

## Implemented and verified
Branch codex/mcp-oauth extends bridge 0.3.0 with protected-resource metadata, 401 discovery challenge and pinned JOSE signature/issuer/resource-audience/expiry/owner/client checks. Explicit expiring client/job/permission grants are checked on each request. Existing bearer grants, document validation, CAS/archive saves and human review remain intact.
Consent/sign-in page supports email links/codes, explicit approve/deny, escaped client metadata, registered callback checks and explicit continuation for previously approved connections. Public key is in runtime-config.json; no secret was committed.
Nineteen bridge/OAuth tests, all required core commands, syntax, secret scan and whitespace pass. Four installed-Edge page cases pass, including real pinned SDK/SRI loading and mobile containment; screenshot visually inspected. Browser mocks do not establish live sign-in/consent. Renderer check initially differed only in Windows checkout line endings; regeneration has no content diff.
Live read-only verification: OAuth discovery 200 after user enablement and ES256 JWKS. Auth users initially zero. Discovery lacks registration_endpoint; DCR remains unverified. No live document writes or employer submissions.

## Remaining setup and acceptance
Publication/live page verification underway. User must configure Site URL https://shipitmyguy-ux.github.io, Authorization Path /raven/oauth-consent.html, allowed consent redirect plus query variant, and DCR. Sign in through the hosted page, then provision owner UUID and RAVEN_MCP_OAUTH_GRANTS server-side. Register/approve a client and explicit job IDs; configure its exact bridge audience using a Custom Access Token Hook. Do not accept generic authenticated audience or ID tokens. Supabase has no custom OAuth scopes; Raven permissions remain server-side grants.
Production revoked/expired-token checks, authenticated save and actual ChatGPT generation/save/Raven reload remain pending. JWT signature checks alone do not establish immediate Supabase session/consent revocation; grant removal is checked per request.
User reports links do nothing inside chat but can copy/paste them into an external browser. Continue using the external browser for setup.

## Environment and preserved state
Usage checked: 93% remaining. Sandbox shell/browser fail with setup refresh errors; approved shell works. No Auth-settings/secrets connector operation exists. Untracked Smile-Break JSON untouched. Published ready-fixes release evidence remains docs/qa/2026-10-08-ready-fixes-release.md; existing exports, closed-listing behavior and documents preserved. No paid provider activated.
