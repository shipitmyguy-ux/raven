# Raven execution handoff

## Option 3 integration milestone (2026-10-08)
- Five tools: granted-job lookup, job/profile reads, current document/hash read, resume/cover save and scope/hash/version-protected replacement.
- Archive migration applied; transactional replacement, stale rejection and document independence verified on disposable database fixtures. Archives are service-only and included in backups.
- Deployed raven-mcp-v1 ACTIVE v1 (bridge 0.2.0); unauthenticated requests verified 401. Actual authenticated MCP saves and ChatGPT connection remain unverified.
- 15 bridge tests, all 27 core commands, renderer/syntax/secret/whitespace checks passed.
- Connected Drive verified; existing NetBox Labs resume PDF copied unchanged and metadata-read back in private Raven Applications folder. Automatic Drive synchronization is not implemented.
- Blocker: Supabase OAuth server disabled, no owner Auth user, no exposed secure-settings/secret provisioning operation. Standards-compliant OAuth/consent and account activation remain necessary.

User explicitly authorized completing, pushing and deploying Option 3 and Google Drive copies. No further deployment approval needed. Branch feature/raven-mcp-bridge, PR #59. Do not merge/activate paid OpenAI pilot PR #58; preserve concurrent refactor/generation-contract work. Usage state unavailable.

SQL canonical file supabase/sql/raven-mcp-document-versions.sql applied as raven_mcp_document_versions. Service-role archive UPDATE/DELETE revoked. Restore inserts archives after jobs and ignores existing IDs. No existing user documents were changed.

Drive destination/file IDs and remaining setup limits are in docs/RAVEN_MCP_BRIDGE.md. One existing resume PDF copied; no bulk backfill. OAuth discovery returned feature_disabled; owner count zero. No secret-management endpoint in available tools. Never expose unauthenticated MCP or service-role credentials to clients. Database-only QA is not ChatGPT connection acceptance.

## Apply on site resume trigger (2026-10-08)
- App v77: native employer link opens immediately; scheduled resume-only preparation reuses existing writer, job preparation and persistence. No cover auto-generation or employer submission.
- Refreshes actual source description and saves discovery jobs first; empty/expired sources fail visibly. Existing resumes are preserved and repeated clicks share active generation.
- Six focused execution checks pass. Three browser tests added for save/reload, preservation and missing listing. Local Chromium download failed with invalid archive; browser tests and authenticated live generation/reload remain unverified.
- Existing frontend persistence is reused; no new cross-device transactional-save guarantee is claimed. The MCP bridge retains its separate CAS/archive gate.
