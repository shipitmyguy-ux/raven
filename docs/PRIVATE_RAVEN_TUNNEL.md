# Private Raven tunnel

## Windows one-time setup
Run ignored private/Start-Raven-Private.cmd. First start asks for the OpenAI runtime key restricted to Tunnels Read + Use and the Supabase legacy service_role key using masked prompts. Following the user's 2026-10-09 instruction to eliminate repeated entry, scripts/private-tunnel-credentials.ps1 saves PSCredential objects to ignored private/raven-tunnel.credentials.clixml using Windows DPAPI. The file is encrypted for this Windows account and computer, with inheritance disabled and current-user-only file access. There is no plaintext key file, command-line key, or credential commit. Other processes running as this user may decrypt it; this is a trusted personal-host setup.

Subsequent launcher starts load the encrypted keys without prompts. Tunnel failures reconnect up to five times using the same credentials. Close the window to stop it. The launcher restores its previous environment and disposes secure strings on exit. Use private/Start-Raven-Private.cmd -ResetSavedKeys to replace saved keys when rotating them. A malformed or foreign-account cache fails closed and requires explicit reset. The cache does not work on another user/computer. The launcher is Windows-only.

One initial entry is still necessary: earlier credentials were intentionally memory-only and have been cleared. They were not recovered from another process or from browser storage. After enrollment an agent can start the launcher without key entry. No always-on login service or scheduled startup is installed.

## Scope and transport
Local private/raven-tunnel.json fixes the Raven origin, explicit allowed job IDs and fixed expiry. Current configuration permits the authorized DataHouse job until November 1 UTC. The adapter opens no network listener, reuses the canonical MCP handler through stdio, exposes five no-auth tools only behind the private OpenAI tunnel, and preserves public OAuth authentication. Read/profile/create permissions only; no revision or replacement. Never run two clients for this stdio tunnel.

Quoted forward-slash Node/adapter paths are required by tunnel-client v0.0.16 command parsing. Tools: list_jobs, get_job, get_verified_profile, get_document, save_generated_document. Refresh the plugin after starting updated bridge code. The save schema now describes grounded resume/cover drafts and accepts the canonical raven-chatgpt-v1 envelope for the requested document type; factual and atomic-save gates remain.

## Verified result
DataHouse resume JT-1789707628035 was created through the real private plugin, then read back exactly. Independent Supabase read confirmed stored URL SHA256 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779, length 6781. Cover remains empty. Later tunnel shutdown did not alter stored data. A fresh hosted Raven load and full page reload each returned HTTP200 backend data with the exact saved resume and Up to date sync. Actual saved claims passed canonical fact audit and deterministic review; rendered HTML inspected clean. No document overwrite, approval or employer submission. Native Word and print-dialog export are separate acceptance work.

20 bridge tests and all 46 local Node CI commands passed for the document fix. Protected-key tests use synthetic values: Windows encryption roundtrip/no plaintext, current-user ACL, prompt-free reuse, explicit reset, malformed/wrong-type failure, no temporary leak and script syntax. Bounded restart/environment cleanup dynamically verified with a fake client; real saved-key tunnel restart remains pending first enrollment. Windows CI runs tests/private-tunnel-credentials.test.ps1.

Evidence containing personal resume content stays in ignored private/actual-saved-verification-report.json and private/DataHouse-ACTUAL-SAVED-resume.*. No candidate evidence or encrypted credentials are committed.

References: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-clixml ; https://developers.openai.com/api/docs/guides/secure-mcp-tunnels ; https://developers.openai.com/api/docs/guides/custom-mcp-server .
