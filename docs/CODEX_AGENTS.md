# Raven Codex agents

Project-scoped roles live in `.codex/agents/`: `explorer` traces existing feature paths, `implementer` makes focused changes, and `reviewer` checks bugs and regressions. Explorer and reviewer use `read-only`; implementer uses `workspace-write`. No model or reasoning setting is pinned, so normal parent/default resolution applies.

The parent retains requirements, assigns bounded work and file ownership, collects results, resolves findings, and handles durable project status and delivery. These definitions do not authorize automatic delegation on unrelated tasks or launch agents by themselves.

Example request: “Use Raven's explorer to trace this feature, then delegate the focused fix to implementer and ask reviewer to check the diff. Wait for their results and coordinate verification.”

Use a new Raven Codex session after these files are present in its checkout. Current official documentation describes automatic project-agent discovery from this directory. The custom `explorer` intentionally takes precedence over Codex's built-in role of the same name. Model defaults are inherited. Parent live permission overrides can supersede file sandbox defaults, so read-only roles also prohibit writes in their instructions.

Agent definitions and Git worktrees are separate. A role does not receive an isolated checkout automatically; the parent must choose and report the workspace and coordinate concurrent edits.

Validation: parse all three files as TOML, check required fields and intended sandbox modes, and run whitespace and secret checks. Live discovery/spawning must be reported separately from file validation; saving definitions does not prove activation in an already-running chat.

Source checked 2026-10-08: [Official OpenAI subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).
