# Raven execution handoff

## Latest task: Word/PDF export inspection (2026-10-08)
Separate export worker branched from main at 74e852c on `fix/document-export-layout`, leaving the MCP checkout untouched. PR #55 already merged. Fixed demonstrated Word closing/signature concatenation by preserving explicit HTML breaks and writing OOXML breaks; no saved documents or qualification prose mutated. Import/frontend cache versions incremented.

All existing core test commands, added line-break unit test, syntax, secret scan and whitespace pass. Actual converter outputs rendered with LibreOffice and current HTML with WeasyPrint: resume two pages, cover one page; every source block retained and all final pages visually clean. New browser regression added but not locally run because Chromium unavailable and installation failed. Native Word, actual live download and browser print acceptance remain unverified. No production deployment. Work usage state unavailable.

See `docs/qa/2026-10-08-document-exports.md` for evidence and limitations. Next: CI/browser check, review/integrate, then live Word/PDF export verification. Keep concurrent MCP work isolated.

## Prior production baseline

Latest task: global remote-anywhere / local-in-person location preference.

## Global job location preference (2026-10-07)
- All four tabs allow confirmed remote work anywhere; in-person and hybrid roles require an explicit nearby Colorado city/state work location.
- Nearby communities: Fort Collins, Loveland, Windsor, Timnath, Wellington, Laporte/La Porte, Bellvue, Severance, Greeley, Johnstown, Berthoud, Eaton and Ault. This is a city whitelist, not a measured driving-radius promise.
- Missing/broad locations and statewide/travel work are excluded. Employer headquarters and description mentions do not establish the work location.
- Shared eligibility applies before ranking, to cached backend discovery reads, and to browser saved/discovered lists. Stored records, documents and application history remain intact.
- Policy is shown globally in Options > Behavior. All 26 core regression commands, syntax, secret scan and whitespace pass locally; Published PR #57 at b6811ba26264ce27fc8e7c74387e608644421352. Hosted app v76/filter v3 and Options > Behavior policy verified; backend v55 ACTIVE, health healthy. Live results: Professional 56, Labor 47, Wildcard 47, Games / 3D 1, with zero global location violations. PR core/full-browser CI passed after adding a local location to the valid cached ATS fixture (69 of 70 passed before fixture correction). Release core, Pages and both production smoke runs passed; release full-browser job was still running at last check.

Standing push authorization remains in AGENTS.md. Unrelated untracked Smile-Break JSON is untouched. Prior release browser regression completed successfully.
