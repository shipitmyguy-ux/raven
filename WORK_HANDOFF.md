# Raven execution handoff

Latest task: UI pill containment and applied card icon (2026-10-08).

- Isolated branch codex/ui-pill-applied-icon, based on current GitHub main 74e852c. PR #55 is merged; prior notes about its pending publication are historical. Retained existing frontend and global location/sales-filter changes.
- Document controls squeezed Import into three lines during Preparing ChatGPT at 320px. They now wrap rows, prevent button shrinkage, grow with labels and align busy spinners. APPLIED card tag is a circular green check with role=img, accessible name Applied and tooltip. Existing application status/date rules unchanged; Applied workflow action remains labeled.
- Verified: 16 mocked Edge browser checks (six widths, ten pre/post/history cases, reload, lifecycle and responsive behavior); new containment test fails original CSS (48.75px Import height) then passes fixed CSS. assistant-core, raven-core, final-closeout suites, app syntax, secret scan and whitespace pass. Visually reviewed 320px busy state, 375px icon and 1440px busy state. Evidence: docs/qa/2026-10-08-ui-containment.md.
- Frontend v77/CSS asset version updated. No backend, data, approval, apply-trigger, Drive or export changes. Other workers own those tasks.
- Routine push authorized by AGENTS.md. Review PR is delivery target; merge/deployment and live production visual acceptance pending. No employer application submitted, model request sent or live job/document changed; browser fixtures synthetic.
- Latest deployed global location and Professional sales exclusions remain in RAVEN_STATUS.md; this patch does not alter them.
- Workspace shell initialization failed; host shell worked. Bundled Playwright + installed Edge used with temporary local config (removed); runtime shim in ignored node_modules not shipped. Usage checked: 96% remaining, failsafe inactive.
