# Raven execution handoff

## Active direction: private plugin through Secure MCP Tunnel (2026-10-09)
User clarified they require plugin functionality without Raven OAuth; manual JSON transfer is not the intended replacement. User reports Platform tunnel creation access and supplied a tunnel ID, retained only in the ignored local launcher. No public MCP authentication was disabled.

Official Windows tunnel-client v0.0.16 downloaded to ignored private/tunnel-client; SHA256 verified against official SHA256SUMS. scripts/start-private-tunnel-test.ps1 accepts a restricted runtime key using a masked prompt, passes it in process environment and restores it on exit; no key file or command-line secret. Launcher syntax verified. private/Start-Raven-Tunnel-Test.cmd supplies the user's tunnel ID locally.

Next: user creates an OpenAI runtime key restricted to Tunnels Read + Use and enters it directly in the local launcher. Run harmless embedded stateless demo before granting Raven data access. Connect ChatGPT using Tunnel and No authentication, verify demo tool invocation and workspace association, then prepare the scoped Raven bridge. The demo is not running: runtime key entry is pending. Tunnel availability is user-reported; successful polling, no-auth discovery, Raven reads/saves and refresh persistence are unverified. No live data or credentials changed. PR58 remains inactive.

References: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels ; https://github.com/openai/tunnel-client/blob/main/docs/permissions.md .

Preserve unrelated renderer line-ending change and Smile-Break-Senior-Environment-Artist.json. PR70 remains deployed; prior OAuth setup is not the active route. Routine pushes authorized. Usage 89% remaining at check.

