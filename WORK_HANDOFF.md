# Raven execution handoff

## Exact existing Drive PDFs for Apply — October 15, 2026 MDT

Apply attachment preparation now resolves the current job/hash/folder export receipt and reads its original PDF through the authenticated Drive raw-file tool. Both binary hashes must match the canonical export hashes; stale/missing receipts, wrong file/folder, changed bytes and oversized/non-PDF data fail closed. No renderer, writer or upload fallback. Existing authorization, job locks, final document-version readback and attachment protocol remain. Drive read capability is isolated to this stage; generation cannot access it. No new network download endpoint.

Focused regression coverage is in the existing required core CI commands (application-pdf and oneclick-security); no additional CI job or duplicate full local suite. Initial local focused preparation/extension/security checks:72 passed. Live Nex verification in progress; do not claim acceptance yet.

Branch codex/apply-existing-drive-pdfs. Local helper restarted idle with this managed worktree source; original private state and credentials retained. One live Nex Apply request started. Remaining: inspect real binary hashes and employer acceptance, confirm no duplicates/status changes, capture review evidence, record results and CI.

## Preserved concurrent main handoff

# Raven execution handoff

## Published preview/edit/OK and live Fair Play Labs recovery — October 15, 2026 MDT

PR93 and PR94 merged; app102 is published. Owner requested removing separate manual document approvals. Preview offers edits or OK; OK closes review without creating approval state. Saved documents continue through current canonical hashes, exact PDF bytes and live Drive receipt verification. The secondary continue control now uses the same preparation pipeline. Existing approval storage remains preserved but cannot gate application progress. Factual validation and manual employer submission remain required by their respective existing systems.

Actual owner-approved retry saved the missing Fair Play Labs cover and uploaded its exact PDF. A subsequent audit found the owner-edited resume had a new hash/no current export. Owner explicitly approved exporting that latest saved resume; helper completed with both saved documents reused and the cover PDF reused. Full Chrome reload confirmed both exact Current PDF links persisted. During live observation preparation advanced to Application opened in Chrome, and Apply job became available again; no old validation alert remained. Verified published cover preview has OK, then clicked OK and confirmed it closes with both current links and job still Saved. The active preparation was not duplicated or interrupted. No employer submission, fabricated qualifications or document replacement by this agent. Employer fields/attachment contents were not independently audited in this chat.

Verification: 80 focused writer/bridge/workflow/security tests, full document process suite, 74 preparation/workflow checks, nine focused Edge cases plus three wording cases passed. PR93 all CI passed. PR94 core/Linux/Windows passed; full browser first exposed old wording assertions, then one test race reading legacy approval before revision completion. Fixed the race by waiting for Changes saved and verified three repeated local passes. Main corrected core38799208544 passed; final full browser38799208471 remains queued/running at handoff. Published smoke initially13/14 because the test expected removed approval wording; corrected two assertions and actual deployed local Edge smoke14/14 passed. Hosted smoke rerun for corrected assertions remains pending. No repeated local full browser sweep. Secret scan passed.

Implementation PR94 merge a8c490c; test synchronization2def2bf. Latest private retry receipt/private fresh-readback reports stay ignored; output documents/PDFs/credentials are not in Git. Both earlier auto-review export blockers were resolved by explicit owner approval; no permission request remains. No extension reload/update needed.

Final verification: app102 main full browser run38799107396 passed all156 cases. Corrected hosted production smoke38799510505 passed14/14; latest core38799509913 passed. Test-only follow-up full browser runs remain queued/running; no further product changes. Live preview OK, both current PDF links and Application opened in Chrome were observed.
