# Raven browser-control backend

The deployed browser-control worker is `raven-browser-worker` in the Raven Supabase project.

Runtime responsibilities:
- Create and release short-lived Steel Chromium sessions server-side.
- Connect to Steel Chromium over CDP.
- Expose only bounded browser actions: `ping`, `start`, `stop`, `open`, `snapshot`, `screenshot`, `click`, `type`, `select`, `wait`, and `smoke`.
- Keep Steel credentials and CDP websocket URLs server-side.
- Audit control actions to `raven_control_events`.
- Permanently reject employer final-submission actions.

The production Control Bridge is hosted at https://raven.floot.app and proxies browser actions to the Supabase worker.

## Chat-driven browser testing

The worker now owns the full Steel session lifecycle, so a browser test no longer depends on an externally created Steel session.

The `smoke` action:
1. Creates a short-lived Steel session.
2. Opens `https://shipitmyguy-ux.github.io/raven/`.
3. Verifies the Raven page title/header and current UI state.
4. Switches to the Professional track.
5. Types `Project` into the search box.
6. Verifies the tab/search DOM state.
7. Captures screenshot metadata.
8. Releases the Steel session in a `finally` block.

This can be invoked and inspected through the connected Supabase tooling from normal ChatGPT chat, so routine interactive Raven browser verification no longer requires a Work-mode browser handoff.

## Safety invariant

Do not add a command that submits, applies, finalizes, or completes an employer application. Raven may navigate, fill fields, and prepare an application, but final employer submission remains a manual user action.

## Deployment

Canonical deployed function: `raven-browser-worker`, version 7 as of 2026-09-23.

The repository copy at `supabase/functions/raven-browser-worker/index.ts` is the canonical source mirror for the deployed function.
