# Raven Agent Contract

GitHub is the canonical source of truth for Raven code and project state.

## Startup
Every ChatGPT Work, Codex, or other coding session must begin by reading:
1. `AGENTS.md`
2. `RAVEN_STATUS.md`
3. `TASKS.md`
4. `WORK_HANDOFF.md`
5. Relevant files under `docs/`

Do not rely on prior chat history when the repository can provide the state.

## Source-of-truth rules
- GitHub: application code, extension code, configuration, migrations, documentation, task state, handoffs.
- Supabase: live Raven jobs, applications, document records, and other runtime data.
- Secrets: never commit secrets, API keys, service-role keys, tokens, or private credentials. Keep them in secure runtime/server/GitHub Actions configuration.
- Google Sheets: backup/export only unless the project state explicitly says otherwise.

## Work usage failsafe
Before starting any substantial ChatGPT Work task, check the usage state if the Work environment exposes it.

- If remaining usage is **2% or less** AND the next usage refresh is **more than 5 minutes away**, do **not** begin the substantial task.
- Instead, preserve/commit any already-completed work, update `WORK_HANDOFF.md` if needed, and respond that the task is being held because the usage failsafe is active.
- If remaining usage is above 2%, proceed normally.
- If the refresh is 5 minutes or less away, proceeding is allowed, but prefer short/low-risk work unless the user explicitly asks otherwise.
- Never pretend usage was checked when the environment does not expose it. If usage data is unavailable, say so and continue normally.
- This safeguard is intended to prevent starting work that is likely to fail due to exhaustion of the current ChatGPT usage window.

## Working rules
- Web application only. Do not add iOS or Android work unless the user explicitly changes scope.
- Prefer modifying existing systems over introducing parallel implementations.
- `runtime-config.json` remains the default public runtime configuration layer.
- Verify behavior before marking work complete.
- A queued background/document task is not "working" until a real output is produced, linked to the correct job, and survives refresh.
- Preserve user data.
- Do not fabricate resume qualifications or experience.

## End-of-session contract
Before ending a meaningful implementation session:
1. Commit/push code and documentation changes to GitHub.
2. Update `RAVEN_STATUS.md` if project state changed.
3. Update `TASKS.md` for completed/blocked/new work.
4. Replace `WORK_HANDOFF.md` with the latest execution summary.
5. Record what was actually verified versus what is only implemented or assumed.

No Work session is considered complete until durable project state is in GitHub.
