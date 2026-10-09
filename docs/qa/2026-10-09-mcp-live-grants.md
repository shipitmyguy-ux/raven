# Live MCP grants QA - 2026-10-09

## Live grant deployment (2026-10-09)
User authorized any Professional job. Provisioned one 30-day ChatGPT grant for DataHouse PROJECT MANAGER (JT-1789707628035): jobs:read, profile:read, documents:create; no revision permission. Existing resume/cover were empty and remain unchanged.

raven-mcp-v1 v4 ACTIVE loads service-only database grants when no explicit environment owner/grant configuration exists. Explicit environment configuration remains authoritative. Signature/issuer/exact-resource-audience/expiry validation occurs before database access. RPC checks singleton owner, matching unexpired/unrevoked grant, nondeleted OAuth client, active consent and matching current unexpired session every request. Private runtime identifiers are not committed.

Applied raven_mcp_oauth_grants and raven_mcp_oauth_hook_variable_fix migrations. Source: supabase/sql/raven-mcp-oauth-grants.sql. Direct hook testing found a PL/pgSQL variable ambiguity, fixed before user enablement. User reports public.raven_mcp_access_token_hook enabled/saved; configuration was not read directly through the connector.

Verified: 21 bridge/OAuth tests; all 44 core workflow commands; syntax/secret/whitespace checks; one live authorized consent/session and active grant; direct hook exact audience and other-claim preservation. Anon/authenticated cannot read grant tables or call RPC; Auth-admin execute privilege present. Connector cannot SET ROLE supabase_auth_admin; actual hook execution as that role remains unverified. Live metadata200/anonymous401. Transactional revocation probe returned expired requestState; subsequent read confirmed grant active. Do not count that probe as passed.

Pending: actual hook token issuance/refresh, authenticated ChatGPT tools, grounded generation/save and Raven reload, live revocation/expiry acceptance. Reconnect hit email rate exceeded. Avoid more sends; user asked to test existing Raven connection with list_jobs. No live document writes or employer submissions.

Browser automation remains blocked by Windows helper file-lock error32. Reset/restart attempts did not repair it. MXC unavailable. TinyFish installed but user reports auth errors. No browser workaround was verified.
