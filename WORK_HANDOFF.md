# Raven execution handoff

## Windows-protected tunnel reuse and saved-resume acceptance (2026-10-09)
User explicitly requested eliminating two-key entry on every restart. Launcher now stores Windows-DPAPI-encrypted PSCredentials in ignored private/raven-tunnel.credentials.clixml with current-user-only ACL, reloads without prompts, and reconnects up to five times. Explicit -ResetSavedKeys rotates the cache; malformed/foreign-user caches fail closed. Windows-only; no plaintext keys or command-line credentials, no secrets committed. Synthetic protected-key tests pass; Windows CI job added. No login service or scheduled startup added.

Actual saved DataHouse resume passed independent canonical audit/deterministic review and rendered HTML inspection. Fresh hosted Raven load and full reload each fetched the exact saved URL from real backend HTTP200 with Up to date sync; browser writes blocked and none attempted. Stored hash matches initial plugin save/readback; cover empty and user data preserved. Actual browser refresh acceptance is now verified.

The previous memory-only credentials were cleared. Updated one-time masked setup window opened; initial protected enrollment and live tunnel restart remain pending. Once enrolled, no repeated entry is needed. Keep public auth and paid PR58 unchanged. Saved resume remains review-required; no application submitted.

Next: after private encrypted enrollment, start/reuse local launcher and verify live health plus read-only Raven get_job/get_document hash. Do not regenerate or replace the saved DataHouse resume. Runtime can be restarted without keys once cache exists. Preserve unrelated renderer line endings, artifacts/ and Smile-Break JSON. Full resume verification evidence stays ignored. Commit current implementation and docs; no public deployment needed.
