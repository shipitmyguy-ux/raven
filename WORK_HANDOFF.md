# Raven status-pill handoff — 2026-10-08

PR63 `fix/ui-pill-containment` is narrowed to the independently verified status-pill bug: live Ignored pill is 16px wide/~80px high; reserved width was deducted twice. Removed desktop/mobile max-width subtraction, preserved wrapping and normal line height. Four-width regression at 320/375/768/1440. Initial CI passed; revised status-only CI pending.

Parallel UI worker PR64 appeared after branch creation and owns document-control wrapping plus Applied icon/history semantics. Removed duplicate icon implementation/tests from PR63; retain PR64 icon and PR63 status fix during integration. Cache version/doc overlaps need reconciliation. No saved document/status mutation or deployment. Active MCP checkout untouched. Export PR62 core/browser CI passed; closure PR65 is independently pending acceptance.
