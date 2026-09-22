# Raven browser-control backend

The deployed browser-control worker is `raven-browser-worker` in the Raven Supabase project.

Runtime responsibilities:
- Connect to a short-lived Steel Chromium session over CDP.
- Expose only bounded browser actions: `ping`, `open`, `snapshot`, `screenshot`, `click`, `type`, `select`, and `wait`.
- Keep Steel credentials and CDP websocket URLs server-side.
- Audit control actions to `raven_control_events`.
- Permanently reject employer final-submission actions.

The production Control Bridge is hosted at https://raven.floot.app and proxies browser actions to the Supabase worker.

## Safety invariant

Do not add a command that submits, applies, finalizes, or completes an employer application. Raven may navigate, fill fields, and prepare an application, but final employer submission remains a manual user action.

## Deployment

Canonical deployed function: `raven-browser-worker`, currently version 6 as of 2026-09-22.

The function source is intentionally maintained in Supabase as the executable deployment. This repository document records the architecture and safety contract so future Raven changes do not accidentally recreate a separate browser-control path.
