# UI pill containment and applied icon

Date: 2026-10-08. Baseline: GitHub main 74e852c, including merged PR #55. Scope is presentation only.

## Reproduction and repair

At 320px, a synthetic saved job's Resume ChatGPT action changes to Preparing ChatGPT. The old nowrap control row shrinks neighboring Import to three lines (48.75px height) and poorly aligns the preparation spinner. Document controls now wrap, retain button label width, grow for long labels and align spinner/text. Ordinary action labels were already bounded by PR #55.

The APPLIED card tag becomes a 28px green circular check with accessible name Applied and title Applied — application recorded. Existing date/status presence semantics are preserved, including later stages and previously applied Saved/Ignored jobs. The Applied workflow action retains its text and interaction.

## Verified

- 16 mocked Edge Playwright checks: busy label/button/container bounds at 320, 375, 715, 768, 1024 and 1440px; ten status/history combinations (Saved, Interested, Ready, Applied, Interview, Offer, Rejected, historical Saved/Ignored and unapplied Ignored); accessible name/title, icon-only visible text, reload; existing lifecycle/responsive checks.
- New busy-state regression fails old CSS with Import height 48.75px and passes repaired CSS. Final screenshot-only rerun also passes.
- assistant-core, raven-core and final-closeout suites pass; app syntax, repository secret scan and git diff --check pass.
- Visually inspected: [320px busy state](2026-10-08-ui-containment/document-pills-320.png), [375px applied icon](2026-10-08-ui-containment/applied-icon-375.png), [1440px busy state](2026-10-08-ui-containment/document-pills-1440.png).

## Limits

Local synthetic fixtures only; no live job/document writes or AI calls. These checks verify layout/accessibility semantics and preserved history rules, not signed-in ChatGPT transfer, screen-reader speech, backend persistence, or deployed assets. Merge/deployment and production visual verification remain pending.
