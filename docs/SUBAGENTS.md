# Raven custom agents

Five project-scoped definitions live in .codex/agents/: explorer, implementer_one, implementer_two, implementer_three and reviewer. Explorer and reviewer default to read-only; each implementer defaults to workspace-write. All omit model and reasoning overrides, inheriting the resolved parent/default settings. The project explorer intentionally takes precedence over the built-in explorer.

Format reference: https://learn.chatgpt.com/docs/agent-configuration/subagents (checked 2026-10-08). Each standalone TOML defines name, description and developer_instructions. Sandbox defaults are configuration, not authority to bypass parent permissions; live parent overrides and connector permissions still apply.

## Activation

Start a fresh local Codex session in this trusted Raven checkout so project configuration is loaded. Ask explicitly to use the named custom agents. Example:

> Use explorer to map these three independent Raven tasks. Assign task A to implementer_one, task B to implementer_two and task C to implementer_three, each in a separate worktree and branch. Coordinate dependencies, integrate the results and use reviewer to review the combined diff.

Definitions are reusable configuration; saving them does not launch workers or allocate worktrees. Hosted ChatGPT Work does not read local Codex configuration; use explicit role instructions there instead. The current session has four concurrency slots including the parent, so three implementers can run together; explorer/reviewer should run in another phase unless the runtime exposes additional slots. Five saved roles do not guarantee five simultaneous workers.

## Ownership and integration

The parent assigns each worker a task, acceptance criteria, exclusive file scope, base commit, branch and absolute worktree path before concurrent writes. Use one separate worktree per simultaneous implementer, with codex/ branches. Keep shared-file changes serial or assign them to one owner. Each implementer has equivalent general implementation ability; task numbers identify ownership rather than specialization.

Workers return focused changes and actual check results. The parent integrates commits in dependency order, resolves overlaps, runs combined validation, obtains reviewer findings and fixes them, updates RAVEN_STATUS.md/TASKS.md/WORK_HANDOFF.md once, then commits and pushes under the Raven contract. Workers must not independently merge or deploy.

Read-only roles return proposed changes and evidence to the parent. They do not modify repository or runtime state. Connector permissions remain separate from filesystem sandbox settings.

## Verification

All five files parsed with Python 3.12 tomllib; required fields, exact names, sandbox defaults and absence of model overrides were checked. Implementer instructions are identical. Git whitespace validation passed. Live custom-agent discovery/spawning is not yet verified; no workers were launched for this configuration task.
