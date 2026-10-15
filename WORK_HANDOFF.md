# Raven execution handoff

## Preview/edit/OK and refreshed-export recovery — October 15, 2026 MDT

Owner explicitly requested removing manual document approval: review now offers edits or OK (close preview), and saved documents can continue without separate approval records. Legacy approval storage is preserved, but cannot block preparation. The secondary continue action uses the same hash/receipt-verified preparation pipeline instead of the old approval-gated packet path. Automatic factual validation and manual employer submission remain intact.

Follow-up live audit found the owner-edited Fair Play Labs resume now differs from the successfully reused PDF hash and has no matching export. Resume now starts an explicit reuse/export request when current saved documents lack exports, instead of polling the old failed run. Existing documents are reused, not rewritten. Current document hashes, exact receipts, employer URL, preflight and no-submit requirements remain enforced. App102 cache version; no extension update.

Verified: nine focused Edge cases (preview OK without approval records, revisions, both stale-run paths and rejection preservation), 74 application/preparation/workflow Node cases, secret and whitespace scans. PR93 all core/browser/Linux/Windows checks passed and app101 published. New preview/export follow-up live app102 acceptance is pending deployment. Approved retry request7cd1ad26 completed both outputs; subsequent read-only audit found cover unchanged with one export and a newer resume with no current export. No document approvals or employer submission were changed by this agent. Private output IDs/hashes remain ignored.
