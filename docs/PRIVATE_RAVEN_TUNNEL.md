# Private Raven tunnel adapter

The private adapter reuses the existing MCP handler over newline-delimited stdio. It opens no network listener and changes no public endpoint. The parent tunnel process is the access boundary; keep the tunnel limited to the intended personal organization/workspace.

## Local setup

1. Install the checksum-verified official Windows tunnel-client under ignored private/tunnel-client.
2. Create ignored private/raven-tunnel.json with supabaseUrl (the existing Raven Supabase origin), jobIds (explicit allowed IDs), and expiresAt (fixed ISO expiry). Never commit private configuration. The current local setup is restricted to the previously authorized DataHouse job until November 1, 2026 UTC.
3. Close the demo tunnel window. Only one client may poll this tunnel when using stdio.
4. Run scripts/start-private-raven.ps1 -TunnelId YOUR_TUNNEL_ID using the local launcher. It asks for the restricted OpenAI runtime key and the Supabase legacy service_role key through masked prompts. The server key is privileged and bypasses database RLS; it is never a ChatGPT tool argument. Neither credential is written to disk, plugin files, or command-line arguments. The adapter fixes the database origin and exposes only its limited existing operations. Host compromise could still expose in-memory credentials; this is a trusted personal-host design, not multi-user isolation.
5. Keep the window running. Refresh the private plugin's tools in ChatGPT. Discovery should show raven-mcp-bridge and five tools: list_jobs, get_job, get_verified_profile, get_document, save_generated_document.
6. Test reads first, then grounded creation on the authorized empty document and confirm Raven reload persistence. These live steps remain pending.

The adapter creates an ephemeral internal bearer grant in memory to reuse the canonical handler. It does not impersonate a Supabase Auth user. Permissions are fixed to jobs:read, profile:read, documents:create; documents:revise is unavailable. Existing documents cannot be replaced. Fixed expiry is checked on every request and never extended on restart. Stopping the tunnel ends connectivity. Current public OAuth grants remain separate.

## Verification

Five adapter tests pass: no-auth discovery/notification handling/expiry; out-of-scope rejection and replacement denial; bounded split/batched stdio framing; fixed-origin/missing-key rejection; and real subprocess discovery without credential output. Existing bridge tests cover validation, atomic save conflicts and independent resume/cover storage. All 47 workflow commands pass after correcting a synthetic secret-scanner fixture. PowerShell launcher syntax passes. Actual production credential use, real tunnel-to-Raven discovery/read/save and Raven reload are not yet verified.

User reported successful ChatGPT demo server_info and echo calls through Tunnel + No authentication. Local health also verified successful OpenAI polling. Demo success establishes transport only. The custom-plugin creation restriction seen in the in-app browser was resolved by the user in their normal browser.

## Windows launch-path fix (2026-10-09)
Live launch failed before database access because tunnel-client's shell-style command parser consumed Windows backslashes. Launcher now converts Node and adapter paths to quoted forward-slash paths. Verified with official tunnel-client v0.0.16 dev proxy, fake database credential, full initialize -> notifications/initialized -> tools/list handshake: raven-mcp-bridge 0.3.0 and all five Raven tools returned. No live database call made. This is stronger transport evidence than direct subprocess-only testing. Real credential launch/read/save remains pending.
