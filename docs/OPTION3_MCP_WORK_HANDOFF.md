# Option 3 — Raven ↔ ChatGPT MCP bridge: Work handoff

## Goal
Implement a secure ChatGPT-facing Raven MCP integration, while Raven remains the canonical job/application dashboard. ChatGPT should retrieve a saved job and its complete description, retrieve verified career facts, and save a generated resume to that same job with validation. The slide-out and full-screen Raven assistant UI are separate parallel work.

## Work startup
Read AGENTS.md, RAVEN_STATUS.md, TASKS.md, WORK_HANDOFF.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/DOCUMENT_WRITING.md. Use GitHub repository shipitmyguy-ux/raven and branch feature/raven-mcp-bridge, branched from main. Read current Supabase schemas and APIs. Keep changes isolated from draft PR #58 (paid OpenAI API pilot).

## MVP implementation
1. Audit Raven's existing Supabase job, verified candidate profile, and document persistence APIs. Confirm auth and per-user ownership boundaries; never expose service-role secrets in client code.
2. Design a least-privilege authenticated MCP interface with three operations: get_job(job_id), get_verified_profile(), save_generated_document(job_id, document, expected_version). Enforce authorization, validation, source-fact provenance, safe versioning, and no silent overwrites.
3. Reuse Raven's existing factual review and approval safeguards. Keep employer submission manual.
4. Add synthetic security, ownership, bad-input, document-association, persistence and regression tests. Verify actual write/reload only with authorized safe fixtures.
5. Document ChatGPT connection requirements, which may vary by account/plan. Do not claim an MCP connection or live end-to-end generation until actually confirmed.
6. Open a draft PR with verified results, blockers and exact setup steps. Update repository task/status/handoff documentation.

## Boundaries
No API spending, private data disclosure to a new provider without authorization, production deployment, destructive migration, automatic employer submissions, or invented qualifications. Do not merge PR #58 or enable paid OpenAI routing. Option 2 (Sign in with ChatGPT for hosted Raven) is still pending eligibility approval and is not a prerequisite for the MCP prototype.

## Acceptance
ChatGPT can, once connected and authorized, retrieve a real user-owned job, read verified facts, create a grounded resume, validate it, save it to the right job, and see it persist after reload. Until that is verified, report implementation/test status precisely.
