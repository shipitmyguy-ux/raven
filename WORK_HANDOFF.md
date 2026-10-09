# Raven execution handoff
## Stale ChatGPT demo tool list (2026-10-09)
User reports a new chat exposes only server_info, echo and uppercase. Read-only local inspection confirms one active tunnel-client running private-mcp-stdio (not the embedded demo); loopback health returned live=true, ready=true. This establishes current runtime health, not successful ChatGPT Raven discovery or database credentials. Most likely the installed plugin retains the demo descriptors; also check that its tunnel/workspace matches the local Raven connection.

Next: keep the current Raven window running; open Raven Private plugin details and refresh tools/actions. Verify list_jobs, get_job, get_verified_profile, get_document and save_generated_document before opening a new chat and invoking list_jobs. If refresh is absent or still shows demo tools, create a fresh private plugin using the same intended tunnel and No authentication, verify the five tools, then install/select it. Do not restart the working runtime or retrieve in-memory credentials. No database call or document modification occurred in this investigation. Live read/save/full-refresh acceptance remains pending.

Official refresh guidance: https://developers.openai.com/api/docs/guides/custom-mcp-server .

Prior Windows launch-path fix remains committed at 0e21e56. Preserve unrelated renderer changes and Smile-Break-Senior-Environment-Artist.json. Private configuration/tunnel IDs remain ignored. No frontend merge or public Edge deployment is needed for this local runtime. Keep paid PR58 inactive.
