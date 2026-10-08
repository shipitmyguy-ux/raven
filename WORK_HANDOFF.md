# Raven execution handoff

Latest task: reusable project-scoped Codex explorer, implementer and reviewer (2026-10-08).

## Delivered
- .codex/agents/explorer.toml: read-only execution-path tracing and evidence gathering.
- .codex/agents/implementer.toml: workspace-write focused implementation and behavior verification.
- .codex/agents/reviewer.toml: read-only bugs, regressions, security and data-preservation review.
- docs/CODEX_AGENTS.md: invocation example, parent coordination, permissions, inherited defaults and explicit workspace semantics.
- Updated RAVEN_STATUS.md and TASKS.md. No application code or runtime data changed.

## Actually verified
- Usage exposed 2% used / 98% remaining; failsafe allowed work.
- Required startup documents and relevant architecture/test/decision guidance read. Official OpenAI subagent documentation fetched and checked.
- No prior project .codex agent configuration existed. Checkout base 74e852cde42827ce16a9c58f07e95bceeb1d180f matched GitHub main before edits.
- Three files passed Python tomllib parsing, exact role schema, name/filename matching, sandbox-mode checks and absence of explicit model/reasoning overrides. Repository secret scan passed; whitespace checked before commit.
- Local command execution required automatic-review-approved escalation because the sandbox runner failed before starting PowerShell.

## Limits / next use
- No agents were launched. CLI help exposed session browsing but no custom-definition discovery command; live discovery/spawning remains unverified.
- Start a new Raven Codex session in a checkout containing these definitions and explicitly request the roles for a relevant task. Custom explorer intentionally overrides the built-in name. Parent permission overrides can supersede sandbox defaults; role instructions independently prohibit read-only writes.
- Definitions do not create isolated worktrees. Parent assigns scope/files/workspace and handles review, status/tasks/handoff and authorized commit/push.
- Routine push authorized by AGENTS.md. Delivery branch: codex/raven-custom-agents in shipitmyguy-ux/raven. Commit/push and remote equality are verified after this handoff is written; see final response for commit identity.

## Prior runtime state
Global location preference remains published (PR #57, app v76/filter v3, backend v55), with zero violations observed across all four tracks. Prior release browser regression completed successfully. Other real employer-site, signed-in ChatGPT attachment and document-export acceptance work remains in TASKS.md; this configuration task does not close it.
