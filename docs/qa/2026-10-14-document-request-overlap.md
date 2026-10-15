# Document request overlap regression evidence

Three deterministic child-helper cases exercise the production server, scheduler, workflow, client and receipt journal against synthetic file-backed services, with isolated ports and no credentials or real Drive calls.

- Generate both first: eight duplicate POSTs share one run; resume and cover-only overlaps are rejected.
- Resume first and cover letter first: an overlapping pair is rejected; the sibling single request starts independently; eight alternating duplicates share the corresponding two run IDs; another pair remains rejected.
- Gates release only after every overlap response is observed. Every case produces exactly one generation/save/render/upload/physical PDF/export record per document. File bytes, document hashes, canonical job/file URLs and a control job are checked.
- A completed Generate both retry performs no additional generation, rendering, upload or link writes. Fresh clients read back the same durable completed outputs.
- Browser regression dispatches eight stale-control bursts across all three actions, accepts one helper request and retains both Current PDF links after refresh.

Run npm run test:document-recovery (nine cases including six existing recovery scenarios), or npm run test:documents (62 cases). Both Linux and Windows required CI matrix jobs run the expanded suite. Local suites passed. CI evidence will be recorded in the handoff after execution.
