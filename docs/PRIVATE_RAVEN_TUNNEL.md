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

## Stale ChatGPT demo tool list (2026-10-09)
User reports a new chat exposes only server_info, echo and uppercase. Read-only local inspection confirms one active tunnel-client running private-mcp-stdio (not the embedded demo); loopback health returned live=true, ready=true. This establishes current runtime health, not successful ChatGPT Raven discovery or database credentials. Most likely the installed plugin retains the demo descriptors; also check that its tunnel/workspace matches the local Raven connection.

Next: keep the current Raven window running; open Raven Private plugin details and refresh tools/actions. Verify list_jobs, get_job, get_verified_profile, get_document and save_generated_document before opening a new chat and invoking list_jobs. If refresh is absent or still shows demo tools, create a fresh private plugin using the same intended tunnel and No authentication, verify the five tools, then install/select it. Do not restart the working runtime or retrieve in-memory credentials. No database call or document modification occurred in this investigation. Live read/save/full-refresh acceptance remains pending.

Official refresh guidance: https://developers.openai.com/api/docs/guides/custom-mcp-server .

## Private tunnel document-save fix (2026-10-09)
Raven Private discovery and real list_jobs/get_job/get_verified_profile now succeed. Failed DataHouse resume had two problems: the canonical manual-import wrapper was passed to a bridge expecting its inner resume, and its Professional summary foregrounded game-art identity. Independent validation against live canonical evidence identified the framing rejection; corrected private draft passes validateDraft and reviewDocument. Candidate drafts/evidence remain local and excluded from commits.

Bridge now advertises grounded resume/cover JSON schemas and safely unwraps the exact raven-chatgpt-v1 envelope for the requested kind. Unknown wrapper keys/wrong format/missing requested kind are rejected. Existing factual, permission, version, create-only and replacement gates remain. Five new regressions bring bridge suite to 20 tests; all 46 local Node commands in test.yml pass, including secret scan and renderer checks. Prospective cover claims permit empty fact IDs as in the canonical writer.

Running tunnel still uses prior bridge code; corrected raw resume is compatible and being tested through the actual plugin. New code requires next runtime restart and tool refresh; no live reload or public deployment is claimed. No need to terminate the healthy runtime to test the corrected draft. Worker owns one create-only DataHouse save and independent readback. A separately created ChatGPT chat is directed to read-only plugin verification to prevent competing writes. Browser reload acceptance pending.

## Live verification result (2026-10-09)
Created chat Test Raven plugin loaded all five Raven Private tools. Its initial authorized create-only run retrieved job/profile, saved a truthful transferable-first resume using the inner object, then get_document returned matching persisted HTML. No invalid-payload retries; no existing document replaced. Save version 2026-10-09T18:04:49.929+00:00. Parent independent Supabase read confirms resume length 6781 and SHA256 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779, matching chat readback. Cover remains empty. Local worker observed existing resume and correctly did not write another draft. Resume remains human-review-required; no approval or employer submission.

Later plugin calls returned Session terminated. Local inspection found no tunnel-client process and prior loopback health port unavailable. Current tunnel is stopped; stopping it does not remove the saved document. Cause of shutdown unverified. Future connection requires restarting private/Start-Raven-Private.cmd and entering credentials privately. New schema/envelope code loads on that restart; refresh plugin tools afterward. No credentials extracted or persisted. Browser inventory exposed no apps/browsers, so full Raven UI refresh/visual acceptance remains unverified. Initial plugin save and fresh plugin readback plus independent database persistence are verified.
