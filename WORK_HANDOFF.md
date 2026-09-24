# Raven Work Handoff

Last updated: 2026-09-24

## Remote classification parity patch
Production `raven-backend-v3` v47 now classifies remote status from explicit evidence through one shared normalization path used by Professional, Labor, Wildcard, and Games / 3D. LinkedIn's remote-search filter no longer sets `remote=true` by itself. Enrichment revalidates workplace/jobLocationType evidence instead of preserving stale LinkedIn remote flags, and the frontend prefers fresh discovered classification over stale saved flags.

Existing LinkedIn rows were reclassified. Blizzard Irvine and Epic Cary environment-art postings are now non-remote in both discovered and saved data. Fresh production searches returned HTTP 200 for all four tracks, and a live Steel browser check showed the Epic/Blizzard Games / 3D cards without Remote and with commute times. Basic production smoke also passed.


## Completed release
User chose Gemini using Raven's existing connection. No OpenAI key or new provider setup is needed.

Code release: 538742ea9520a6a6be800d2771b38c70d806c5e2.
Production deployments: raven-generate-v1 v20, raven-generate-v2 v21, raven-cover-v2 v16. UI app.js v43; document cache modern-v5.

The shared writer receives the full verified profile, posting, revision instructions and current draft. Gemini authors the prose, with hidden supporting fact references, immutable identity/employment metadata, employer-specific evidence ownership, and a separate sentence-level factual review. One bounded repair/recheck is allowed; failures preserve the previous document. Existing rendering, persistence, approval gates and request budgets remain.

Resume Matcher and Reactive Resume informed direct-writing/separate-review patterns; no third-party code or prompts were copied and no application migration was needed. See docs/DOCUMENT_WRITING.md.

## Verified
- 16 local mocked writer/handler tests passed; these test contracts and failure behavior, not real model quality.
- Core and targeted browser CI passed: https://github.com/shipitmyguy-ux/raven/actions/runs/35956594725
- Pages passed: https://github.com/shipitmyguy-ux/raven/actions/runs/35956594767
- Production smoke passed: https://github.com/shipitmyguy-ux/raven/actions/runs/35956594732 and https://github.com/shipitmyguy-ux/raven/actions/runs/35956615180
- Live Akima Intermediate 3D Artist resume/cover generation and a requested shorter summary were inspected.
- Live Campminder Manager of Learning and Implementation resume/cover generation exercised a career pivot while retaining actual employment history. A rejected employer attribution preserved the previous draft; final outputs passed the reference checks and model review.
- Both jobs' documents were read back from Supabase. Final Campminder resume and cover reopened after a fresh page load and completed backend sync.
- No document approval or employer submission was performed.

## Boundaries
GitHub remains canonical code/project state; Supabase stores live data. The canonical candidate profile supplies verified facts; this change does not re-ingest newly uploaded or Drive master resumes. No credentials or personal document fixtures committed, no schema or auth changes. Model review is imperfect and user review remains required. Older documents remain saved until rewritten; natural-language changes are available in the review dialog.

No implementation work remains for this release. Existing real employer-form attachment/completion verification and optional Drive persistence decisions remain listed in TASKS.md.
