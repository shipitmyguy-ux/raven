# Raven execution handoff

## Private Raven plugin adapter (2026-10-09)
User reports successful ChatGPT server_info and echo demo calls through the private tunnel without Raven OAuth. Implemented scripts/private-mcp-stdio.mjs reusing the canonical MCP handler, plus scripts/start-private-raven.ps1 with masked in-memory runtime/server credential entry. No network listener or public auth change. Fixed allowed job IDs/expiry in ignored local configuration; read/profile/create only, no revision. Five adapter tests and all 47 workflow checks pass after synthetic scanner fixture correction. Actual Raven credentials/read/save/refresh remain pending. See docs/PRIVATE_RAVEN_TUNNEL.md.
## Next actions
1. Close existing demo tunnel and start private/Start-Raven-Private.cmd. Owner privately enters OpenAI tunnel runtime key and Supabase legacy service_role key. No credentials in chat, files or GitHub. Launcher refuses to start while another tunnel-client exists.
2. Verify local health, refresh Raven Private tools in ChatGPT, call list_jobs then get_job/get_verified_profile. The adapter only permits the existing authorized DataHouse job; local expiry is fixed at November 1 UTC.
3. Grounded document creation, actual save and Raven full refresh acceptance remain mandatory. Preserve existing documents; revision scope is absent.

No need to merge frontend or deploy an Edge Function for local testing. Push the adapter branch and PR; private runtime executes local checkout. Keep PR58 inactive. Preserve unrelated renderer line-ending change and Smile-Break-Senior-Environment-Artist.json. Tunnel ID only in ignored local launchers. Demo credentials remain in its process until the user closes it; never extract them.
