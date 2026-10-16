# Raven execution handoff

## Current task — automatic resume connection — October 16, 2026

The published Raven Apply flow resolves the verified employer destination and prepares the exact saved resume PDF through the local helper. Extension v2.6.1 delivers that PDF to the matching Resume/CV field. The user starts this by clicking Apply in Raven; the employer form remains open for review and manual submission.

The compatible local helper was stopped at session start. It was restarted from existing worktree commit `0b92db5` and reports ready. A per-user Windows sign-in task named `Raven One Click Writer` now starts the helper automatically. Its optional phone queue reports unavailable; local generation remains available. Direct loopback health read was blocked by the tool sandbox.

## Verification state

- Published extension v2.6.1; prior live Mad Head inspection reported `ready`.
- Read-only inspection confirmed a Resume/CV upload control and a separate portfolio PDF field.
- No candidate document was generated, transmitted, or uploaded in this session.
- Real live file attachment remains unverified. Do not submit the employer form during acceptance.

## Next

Verify the automatic Resume/CV attachment on the next user-initiated Raven Apply action and inspect the exact attached filename. Keep the user in control of employer submission.