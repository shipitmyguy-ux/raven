# Raven execution handoff

## Exact existing Drive PDFs for Apply — October 15, 2026 MDT

Apply attachment preparation now resolves the current job/hash/folder export receipt and reads its original PDF through the authenticated Drive raw-file tool. Both binary hashes must match the canonical export hashes; stale/missing receipts, wrong file/folder, changed bytes and oversized/non-PDF data fail closed. No renderer, writer or upload fallback. Existing authorization, job locks, final document-version readback and attachment protocol remain. Drive read capability is isolated to this stage; generation cannot access it. No new network download endpoint.

Focused regression coverage is in the existing required core CI commands (application-pdf and oneclick-security); no additional CI job or duplicate full local suite. Initial local focused preparation/extension/security checks:72 passed. Live Nex verification in progress; do not claim acceptance yet.

Branch codex/apply-existing-drive-pdfs. Local helper restarted idle with this managed worktree source; original private state and credentials retained. One live Nex Apply request started. Remaining: inspect real binary hashes and employer acceptance, confirm no duplicates/status changes, capture review evidence, record results and CI.
