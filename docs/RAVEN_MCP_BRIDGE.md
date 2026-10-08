# Raven MCP bridge prototype

## Implemented
`supabase/functions/raven-mcp-v1/index.ts` serves a stateless, JSON-response Streamable HTTP MCP endpoint. It handles initialization, ping, tool discovery/calls and initialization/cancellation notifications. GET is authenticated but returns 405 because there is no SSE stream. Supported negotiated versions: 2025-03-26, 2025-06-18 and 2025-11-25. This is an isolated prototype; production deployment and a ChatGPT connection are not verified.

Three tools reuse existing Raven data and manual ChatGPT validation:
- `get_job(job_id)`: reads an explicitly granted saved job, its stored notes/description, version and resume-present flag. When the grant also permits profile access, returns Raven's existing grounded writing prompt. Stored descriptions may be incomplete; no live retrieval or completeness guarantee is implied.
- `get_verified_profile()`: returns career evidence and canonical fact IDs, excluding name/contact. This is still private career data and requires explicit profile scope.
- `save_generated_document(job_id, document, expected_version)`: accepts the inner structured resume object from the existing Raven ChatGPT schema, validates it against the current canonical profile and job, runs existing deterministic final-review checks, renders the canonical browser layout, checks content presence, and atomically saves an initial resume into `raven_jobs.resume`. Returns the persisted HTML data URL and new version. No cover-letter save yet.

The write path never replaces an existing resume, even with a matching version. A database PATCH predicates on job ID, exact prior `last_updated`, and an empty/null resume in the same request, so racing writers cannot overwrite the winner. Other fields, existing documents, approvals and employer submissions are not modified. Data URLs follow Raven's existing preview/print workflow; this is not native PDF generation.

## Access model
The inspected live schema has no user/tenant ownership columns on `raven_jobs` or `raven_canonical_profiles`. Therefore this version deliberately supports only a configured single owner of the existing default profile. It must not be presented as a general multi-user service.

Server-only settings:
- Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `RAVEN_MCP_OWNER_SUBJECT`: an operator-chosen stable identifier for the owner of this Raven dataset; not a user-editable claim.
- `RAVEN_MCP_GRANTS`: JSON array of explicit scoped grants. Each entry has `token_sha256`, `subject`, `expires_at`, `job_ids` and `scopes`. Scopes are `jobs:read`, `profile:read`, `documents:create`. Save requires all three. Subject must match the owner configuration. Job IDs must be listed individually; no wildcard is accepted. Use short expirations and random credentials with at least 256 bits of entropy.
- `RAVEN_MCP_ALLOWED_ORIGINS`: optional comma-separated exact browser origins; any supplied origin is rejected unless listed. Server-to-server clients normally send no Origin.

The bearer credential must consist of 43–128 base64url-safe characters. Only its SHA-256 hash is stored in grants. Requests are authenticated before any database access, including initialization and tool discovery. Expiration, owner binding and grant configuration are checked on every request. Revoke by removing a grant or rotating its hash in server secrets. A service-role key, public anon key or `x-raven-client` header must never be used as the MCP client credential. Do not store credentials in Git, browser config, URLs, chat prompts or logs.

Body size is streamed and bounded to 200 KB even without an honest Content-Length. Outbound database requests have a 10-second timeout. Tool IDs/arguments are checked before use; database errors expose no response payload or credential. Model HTML is not accepted: the server escapes authored text through a generated copy of the canonical resume renderer.

## Deployment and connection steps
1. Review the draft PR and security model, including the single-owner limitation. Confirm the desired authorized fixture and job-ID grants.
2. Provision a dedicated random bridge credential and configure its hash, scopes, job allowlist, expiry and owner subject through secure server settings. There are no production grants by default.
3. When deployment is authorized, deploy `raven-mcp-v1` plus its shared imports with gateway `verify_jwt=false`; the function's own dedicated-credential validator is mandatory. Do not modify existing production generators or enable paid OpenAI routing. No database migration or new Data API grants are required.
4. Test initialize, tools/list, authorized reads, negative credential/scope cases and an initial document save/read/reload using a disposable authorized fixture. Never overwrite an approved resume.
5. Verify the intended ChatGPT account's custom MCP connection flow and authentication requirements. This prototype supplies dedicated bearer authentication, **not an OAuth authorization server, browser consent screen, or automatic ChatGPT app installation**. If that connection requires OAuth, add a standards-compliant authorization flow before declaring ChatGPT connection ready. Do not expose an unauthenticated endpoint to sidestep setup.
6. Verify ChatGPT retrieval -> grounded generation -> validation -> saved Raven preview -> full reload, then user review. Until this succeeds, claim only implemented/synthetic-tested status.

## Validation limits
This follows Raven's manual ChatGPT import contract, which requires deterministic evidence/schema validation rather than another provider/model call. It adds the existing deterministic `reviewDocument` checks. It does not claim separate model semantic review, flawless truth checking or application approval. Human review remains required. No provider calls, paid API usage, automatic submission or new provider disclosure happen in this backend.

## Tests and maintenance
Run `node --test tests/mcp-bridge.test.mjs`, `node scripts/build-mcp-renderer.mjs --check`, `node scripts/check-secrets.mjs` and the repository core regression commands. Twelve synthetic tests cover scoped access, expiry/revocation/owner binding, privacy, unsafe input, version conflicts, racing saves, evidence validation, preservation, readback and escaping. They use a mock REST store and do not prove real Supabase/ChatGPT deployment or live-model quality.

The renderer is generated from `app.js` and the skill-label helper in `raven-core.js`; run `node scripts/build-mcp-renderer.mjs` after layout changes. CI rejects stale generated layouts. Backend contact rendering uses only the canonical server profile, not device-local LinkedIn/portfolio overrides.

Sources checked: MCP Streamable HTTP transport specification (`https://modelcontextprotocol.io/specification/2025-11-25/basic/transports`), current Supabase documentation through its docs search, Supabase changelog index and live read-only column inspection on 2026-10-08. No relevant schema/auth breaking change applies to this migration-free REST adapter.
