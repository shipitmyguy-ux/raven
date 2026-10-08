# Raven execution handoff

Latest task: global remote-anywhere / local-in-person location preference.

## Global job location preference (2026-10-07)
- All four tabs allow confirmed remote work anywhere; in-person and hybrid roles require an explicit nearby Colorado city/state work location.
- Nearby communities: Fort Collins, Loveland, Windsor, Timnath, Wellington, Laporte/La Porte, Bellvue, Severance, Greeley, Johnstown, Berthoud, Eaton and Ault. This is a city whitelist, not a measured driving-radius promise.
- Missing/broad locations and statewide/travel work are excluded. Employer headquarters and description mentions do not establish the work location.
- Shared eligibility applies before ranking, to cached backend discovery reads, and to browser saved/discovered lists. Stored records, documents and application history remain intact.
- Policy is shown globally in Options > Behavior. All 26 core regression commands, syntax, secret scan and whitespace pass locally; Published PR #57 at b6811ba26264ce27fc8e7c74387e608644421352. Hosted app v76/filter v3 and Options > Behavior policy verified; backend v55 ACTIVE, health healthy. Live results: Professional 56, Labor 47, Wildcard 47, Games / 3D 1, with zero global location violations. PR core/full-browser CI passed after adding a local location to the valid cached ATS fixture (69 of 70 passed before fixture correction). Release core, Pages and both production smoke runs passed; release full-browser job was still running at last check.

Standing push authorization remains in AGENTS.md. Unrelated untracked Smile-Break JSON is untouched. Prior release browser regression completed successfully.

## 2026-10-08 pill containment and applied icon
- Isolated branch `fix/ui-pill-containment`, main base; PR55 already merged.
- Live desktop reproduced Ignored status pill at 16px wide and ~80px tall: percentage max-width subtracts reserved icon space inside already constrained flex content.
- Removed duplicate width deductions; pill uses available width and normal line height. Applied history marker is a compact green check with accessible Applied name and title; original applied-date/later-stage predicate preserved.
- Added browser coverage at 320/375/768/1440px. Syntax and whitespace checks pass; local browser binaries unavailable, CI browser acceptance pending. No live deployment or saved-document/status changes.
