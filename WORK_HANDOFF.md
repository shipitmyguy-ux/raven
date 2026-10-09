# Raven execution handoff

## OAuth connection follow-up (2026-10-09)
User defined d as do it; implementing the stated priority of authenticated ChatGPT integration. Existing Option 3 push/deploy authorization applies. PR59 is merged into main 2512fdd. Paid pilot PR58 remains inactive.

## Implemented and verified
Branch codex/mcp-oauth extends bridge 0.3.0 with protected-resource metadata, 401 discovery challenge and pinned JOSE signature/issuer/resource-audience/expiry/owner/client checks. Explicit expiring client/job/permission grants are checked on each request. Existing bearer grants, document validation, CAS/archive saves and human review remain intact.
Consent/sign-in page supports email links/codes, explicit approve/deny, escaped client metadata, registered callback checks and explicit continuation for previously approved connections. Public key is in runtime-config.json; no secret was committed.
Nineteen bridge/OAuth tests, all required core commands, syntax, secret scan and whitespace pass. Four installed-Edge page cases pass, including real pinned SDK/SRI loading and mobile containment; screenshot visually inspected. Browser mocks do not establish live sign-in/consent. Renderer check initially differed only in Windows checkout line endings; regeneration has no content diff.
Live read-only verification: OAuth discovery 200 after user enablement and ES256 JWKS. Auth users initially zero. Discovery lacks registration_endpoint; DCR remains unverified. No live document writes or employer submissions.

## Remaining setup and acceptance
PR68 merged a2936122841d60c668ae8ed6fd9ad81847edb45a and published. Consent page HTTP200; raven-mcp-v1 v3 ACTIVE metadata200 and anonymous/public-key/untrusted-JWT401. Final PR/main core/full-browser, Pages and both production smoke runs pass. Exact evidence/run IDs: docs/qa/2026-10-09-mcp-oauth-connection.md.
Owner sign-in succeeded; database confirms one email-verified Auth account. No OAuth client is registered yet; discovery lacks registration_endpoint. User has been asked to enable/save DCR. Complete dashboard Site URL https://shipitmyguy-ux.github.io, Authorization Path /raven/oauth-consent.html and redirect verification. Provision owner UUID and RAVEN_MCP_OAUTH_GRANTS server-side. Register/approve a client and explicit job IDs; configure its exact bridge audience using a Custom Access Token Hook. Do not accept generic authenticated audience or ID tokens. Supabase has no custom OAuth scopes; Raven permissions remain server-side grants.
Production revoked/expired-token checks, authenticated save and actual ChatGPT generation/save/Raven reload remain pending. JWT signature checks alone do not establish immediate Supabase session/consent revocation; grant removal is checked per request.
User reports links do nothing inside chat but can copy/paste them into an external browser. Continue using the external browser for setup.

## Requested AI transfer documentation
User explicitly requested a subagent to document the project, upcoming features and known bugs for another AI. Subagent project_handoff created docs/RAVEN_AI_HANDOFF.md; parent reviewed it and updated it with the latest live sign-in evidence. It covers architecture/key files, shipped capabilities, prioritized upcoming work, known writing defects versus acceptance gaps, OAuth continuation, safety/authorization, validation/deployment and a replacement-AI prompt. Prefer this consolidated handoff for transfer, then re-read canonical status/tasks/current handoff before implementing.

## Environment and preserved state
Usage checked: 93% remaining. Sandbox shell/browser fail with setup refresh errors; approved shell works. No Auth-settings/secrets connector operation exists. Untracked Smile-Break JSON untouched. Published ready-fixes release evidence remains docs/qa/2026-10-08-ready-fixes-release.md; existing exports, closed-listing behavior and documents preserved. No paid provider activated.
