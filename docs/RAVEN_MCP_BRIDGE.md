# Raven MCP bridge

## OAuth follow-up (2026-10-09)
User-enabled OAuth discovery now returns 200 and JWKS contains ES256. Bridge 0.3.0 adds public metadata at https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-mcp-v1/.well-known/oauth-protected-resource and an HTTP 401 discovery challenge. Signed OAuth access tokens must have the exact issuer, bridge resource audience, expiration, authenticated owner, client ID and session ID. Generic `authenticated` audiences, ID tokens, unsigned tokens and other owners/clients fail before job/profile access.

The consent page is https://shipitmyguy-ux.github.io/raven/oauth-consent.html. Configure Site URL https://shipitmyguy-ux.github.io and Authorization Path /raven/oauth-consent.html. Allow the consent URL and its authorization_id query variant in Auth redirect settings. Sign-in supports the default email magic link as well as code templates. Enable dynamic registration; registration_endpoint was absent from the last live discovery check. OAuth metadata alone does not establish ChatGPT connection acceptance.

Server settings: RAVEN_MCP_OWNER_SUBJECT is the owner's Supabase Auth UUID. RAVEN_MCP_OAUTH_GRANTS is an array of objects with `subject`, `client_id`, `expires_at`, explicit `job_ids` (1–200) and `scopes` selected from jobs:read/profile:read/documents:create/documents:revise. Remove a grant to revoke bridge access on the next request. Existing hashed bearer grants remain separate and unchanged. OAuth permissions are not inferred from user_metadata or from identity scopes.

Supabase currently supports only standard OIDC scopes, not custom application scopes. Discovery requests email identity scope; Raven grants supply the effective job/document permissions. Configure a Custom Access Token Hook for the explicitly registered Raven client to issue aud=https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-mcp-v1. Preserve all required token claims and other clients' audiences. This hook and server grants still require secure configuration; they are not enabled by this source patch. Accepting the generic audience would defeat resource binding and is intentionally prohibited.

Verification: 19 actual signed-JWT/bridge regression cases, all required core commands, four installed-Edge consent page cases and mobile visual inspection pass. The pinned Supabase SDK 2.117.3 is loaded with SRI. Tests do not send email or approve a live connection. Actual user sign-in, token issuance/audience, authenticated writes, production token revocation/expiry and full ChatGPT/Raven reload are still pending. Signature verification alone does not provide immediate Supabase session/consent revocation; server grant removal is the verified immediate bridge revocation mechanism.

References: https://supabase.com/docs/guides/auth/oauth-server/getting-started ; https://supabase.com/docs/guides/auth/oauth-server/oauth-flows ; https://supabase.com/docs/guides/auth/oauth-server/token-security ; https://developers.openai.com/plugins/build/auth .

## Option 3 integration milestone (2026-10-08)
- Five tools: granted-job lookup, job/profile reads, current document/hash read, resume/cover save and scope/hash/version-protected replacement.
- Archive migration applied; transactional replacement, stale rejection and document independence verified on disposable database fixtures. Archives are service-only and included in backups.
- Deployed raven-mcp-v1 ACTIVE v1 (bridge 0.2.0); unauthenticated requests verified 401. Actual authenticated MCP saves and ChatGPT connection remain unverified.
- 15 bridge tests, all 27 core commands, renderer/syntax/secret/whitespace checks passed.
- Connected Drive verified; existing NetBox Labs resume PDF copied unchanged and metadata-read back in private Raven Applications folder. Automatic Drive synchronization is not implemented.
- Blocker: Supabase OAuth server disabled, no owner Auth user, no exposed secure-settings/secret provisioning operation. Standards-compliant OAuth/consent and account activation remain necessary.

## Tools and storage
- list_jobs(query?) finds only explicitly granted job IDs, matching title/company, at most 200 entries.
- get_job(job_id) returns stored description, current job version and grounded writing prompt for both documents.
- get_verified_profile() returns canonical evidence/fact IDs without name/contact.
- get_document(job_id, document_type) returns current HTML data URL, version and SHA-256 for revision/export.
- save_generated_document(job_id, document, expected_version, document_type?) defaults to resume; coverLetter selects raven_jobs.cover_letter. Uses existing evidence validator, deterministic final review and canonical escaped renderer. No model call or comprehensive semantic-truth guarantee; human approval required.

Initial saves use atomic version and empty-field predicates. Replacements require explicit replace=true, documents:revise scope and expected_document_sha256 matching the exact current document. The SECURITY INVOKER RPC locks the job, checks version and prior content, archives into raven_document_versions, and updates only the chosen field in one transaction. Approval remains tied to exact content and must be renewed. Stored output is HTML, not native PDF.

The applied SQL is supabase/sql/raven-mcp-document-versions.sql, migration name raven_mcp_document_versions. Archive RLS is enabled with no anon/authenticated access. Service-role access is SELECT/INSERT only. Backups include archives; restore ignores existing IDs. Destructive admin restore is separate.

## Dedicated bearer grants
Server-only settings: existing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY; RAVEN_MCP_OWNER_SUBJECT; RAVEN_MCP_GRANTS JSON array with token_sha256, subject, expires_at, explicit job_ids and scopes; optional exact RAVEN_MCP_ALLOWED_ORIGINS. Scopes: jobs:read, profile:read, documents:create, documents:revise. Save requires jobs/profile/create; replacement additionally requires revise.

Credential is 43-128 base64url characters with at least 256 bits random entropy; only SHA-256 stored. Expiration, owner binding and grant membership checked on every request. Revocation removes/rotates grant. Public anon keys and x-raven-client do not authorize MCP. Never put credentials in code, public config, prompts or logs. No grant provisioning was confirmed in production here. This is a single-owner prototype because canonical jobs/profile have no tenant columns; never claim general multi-user isolation.

Transport: JSON Streamable HTTP, initialize/ping/tool calls/notifications, supported versions 2025-03-26, 2025-06-18, 2025-11-25. No GET SSE stream. Authentication precedes database access. Request body streamed/bounded to 200KB; database requests timeout after 10 seconds; supplied browser Origin must be allowlisted. Deploy with verify_jwt=false only because handler enforces dedicated custom authentication.

## ChatGPT connection blocker and next steps
Official ChatGPT connection choices are OAuth/no-auth; arbitrary static bearer configuration is not a verified path. Never enable no-auth to bypass setup. The project's OAuth discovery currently returns 404 feature_disabled, and the owner's connected email has zero Supabase Auth users. Available connectors do not expose secret provisioning or project Auth configuration.

Use existing Supabase OAuth 2.1 rather than a homegrown authorization server. Enable OAuth/DCR, provision the owner through sign-in, host consent, implement protected-resource metadata and token validation (issuer/audience/expiry/client/owner/job scopes), then install the custom MCP connection and verify real ChatGPT retrieval -> grounded generation -> confirmed save -> Raven full reload. This code does not implement that OAuth resource/consent path yet. Required tests include real expired/revoked/wrong-owner credentials and actual authenticated Edge Function writes. Deployment/SQL/mocks are not evidence of a usable ChatGPT plugin.

## Verified Google Drive copy
Private folder: https://drive.google.com/drive/folders/1xF6dKybo9TVhQ7ypSBeKtSX2ZYSng2Pr . Connected account verified. One existing NetBox Labs resume was decoded unchanged from Raven, rendered to a one-page PDF, visually inspected, uploaded and metadata-read back: https://drive.google.com/file/d/1skokFujSfzT0RbObb2ip5ePTYdYtsU-u/view . Supabase attachment untouched.

This establishes a real connector-assisted PDF copy, not automatic backend synchronization. Connector OAuth credentials are unavailable to the Edge Function. Future flow must use connected Drive tools after confirmed Raven saves or an independently authorized server-side Google OAuth integration. Persist separate Drive success/failure/retry state. Native Google Docs, cover-letter copies and continuous sync remain unverified.

## Verification/maintenance
Run node --test tests/mcp-bridge.test.mjs, node scripts/build-mcp-renderer.mjs --check, node scripts/check-secrets.mjs and all core CI commands. Fifteen synthetic cases cover authorization, expiry/revocation, scoped lookup, evidence rejection, resume/cover save, readback, stale/race preservation and replacement gating. Database fixtures verified transactional old-content archival, stale rejection and independent resume/cover replacement; user data preserved. Security advisors report only INFO RLS-without-policy for intentionally service-only tables.

Renderer generated from app.js and raven-core.js; regenerate after layout changes. Canonical server contact rendering excludes device-local overrides.

Official references verified: https://developers.openai.com/plugins/build/auth ; https://developers.openai.com/api/docs/guides/custom-mcp-server ; https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication .

## Apply on site resume trigger (2026-10-08)
- App v81: native employer link opens immediately; scheduled resume-only preparation reuses existing writer, job preparation and persistence. No cover auto-generation or employer submission.
- Refreshes actual source description and saves discovery jobs first; empty/expired sources fail visibly. Existing resumes are preserved and repeated clicks share active generation.
- Six focused execution checks pass. Three browser tests added for save/reload, preservation and missing listing. Local Chromium download failed with invalid archive; browser tests and authenticated live generation/reload remain unverified.
- Existing frontend persistence is reused; no new cross-device transactional-save guarantee is claimed. The MCP bridge retains its separate CAS/archive gate.
