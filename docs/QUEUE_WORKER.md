# Raven Queue Worker

The legacy document-generation consumer is the ChatGPT automation named **JobTrack Queue Worker**. It is currently disabled and must not be treated as an active polling dependency. Raven resume generation now has a direct on-demand Edge Function path; keep the queue worker disabled unless queue-based document generation is intentionally re-enabled.

## Authoritative queue
- Supabase project: `umvmilulnqnmeqvfoxxc`
- Tasks: `public.raven_tasks`
- Jobs: `public.raven_jobs`

## Tailored resume behavior
For `tailored_resume` tasks:
1. Inspect `input_json.masterResume` first.
2. If present, use it as the primary source resume for structure, emphasis, experience selection, and factual content.
3. Continue to enforce the private qualification profile and `preserveFacts=true` as hard truth constraints.
4. For `sourceType: "drive"`, use the supplied Google Drive URL.
5. For `sourceType: "local"`, use the supplied `dataUrl`, `fileName`, and `mimeType`.
6. If a local master resume is missing/unavailable, set `BLOCKED_USER_INPUT`; do not silently substitute another resume.
7. Respect track assignments. Do not substitute a master resume assigned to a different track.
8. If no master resume is supplied, fall back to the private qualification profile and existing generation policy.
9. Record the master resume ID/name/sourceType used in `raven_tasks.output_json`.

## Output
For completed resume generation:
- create editable Google Doc,
- create application-ready PDF,
- create DOCX,
- verify files,
- write the PDF link to `raven_jobs.resume`,
- write generation metadata to `raven_tasks.output_json`,
- mark task `COMPLETED`.

## Important architecture note
`raven-tasks-v1` is only the queue API. It enqueues and updates tasks; it is **not** the document generator.

The current actual queue consumer is the ChatGPT automation. If Raven later moves to a standalone server/Edge Function worker, this document defines the behavior that worker must preserve.

## Token / polling efficiency
- Keep the ChatGPT queue worker disabled during normal Raven operation.
- Prefer direct, user-triggered generation for resumes.
- Do not add timer polling merely to discover whether a task completed; use explicit refresh/event-driven status where possible.
- If queue processing is re-enabled, claim only actionable tasks and exit immediately when none exist.
