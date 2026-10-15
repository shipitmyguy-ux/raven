# Document request overlap regression evidence

Three deterministic child-helper cases exercise the production server, scheduler, workflow, client and receipt journal against synthetic file-backed services, with isolated ports and no credentials or real Drive calls.

- Generate both first: eight duplicate POSTs share one run; resume and cover-only overlaps are rejected.
- Resume first and cover letter first: an overlapping pair is rejected; the sibling single request starts independently; eight alternating duplicates share the corresponding two run IDs; another pair remains rejected.
- Gates release only after every overlap response is observed. Every case produces exactly one generation/save/render/upload/physical PDF/export record per document. File bytes, document hashes, canonical job/file URLs and a control job are checked.
- A completed Generate both retry performs no additional generation, rendering, upload or link writes. Fresh clients read back the same durable completed outputs.
- Browser regression dispatches eight stale-control bursts across all three actions, accepts one helper request and retains both Current PDF links after refresh.

Run npm run test:document-recovery (nine cases including six existing recovery scenarios), or npm run test:documents (62 cases). Both Linux and Windows required CI matrix jobs run the expanded suite. Local suites passed. CI evidence will be recorded in the handoff after execution.

PR89 passed all nine process cases on Linux and Windows (run38674565073), and full browser166/166 (run38674565017). Main Windows subsequently exposed a synthetic database read/rename race (EPERM), reproduced locally with child stderr diagnostics. Parent live-database reads now use serialized IPC snapshots, preventing an open Windows reader from denying replacement. Durable receipts/run state remain real on-disk checks. No product transport retries or production changes were added.

Fixture fix PR90 merged as418a4b4723b04050cf97a94643064c34226aa7b5 after Linux/Windows and all other CI jobs passed (run38675401207). Post-fix local validation: five consecutive full nine-case suites45/45, full document suite62/62 and secret/diff checks. An earlier longer local stress attempt passed six iterations before an environment stall timed out a test; it is not reported as a passing run.

Main post-merge verification passed: core/safety and nine process cases on both Linux and Windows (run38675594280), production smoke (run38675594360).
