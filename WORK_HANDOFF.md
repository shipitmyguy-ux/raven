# Raven execution handoff

## Job-card renovation and parallel preparation — October 14, 2026

PR82 merged at 40d4492 after all PR core, Windows, safety, and browser checks passed. The web release includes compact cards, a desktop drawer/mobile sheet, one lifecycle control, document rows and More menus, exact-version PDF links, and preserved application history.

The writer has two isolated document slots: resume and cover for one job, or resumes for two jobs, run concurrently; extra work queues. Same-document duplicates are prevented. Per-job saves recheck versions, shared PDF preparation is locked, and short private-grant calls are serialized. Existing ChatGPT sign-in, model configuration and tool restrictions are unchanged. The idle helper was restarted with its existing protected configuration; health confirms ready, writer_concurrency=2, and preparation/receipt support.

Preparation inspects the destination before writing, verifies PDFs and live Drive receipts, delivers only to the inspected tab, and supports explicit Resume after refresh. Reload alone does not start work. Login/challenge/unknown forms stop for manual handling. Unanswered required controls and absent upload fields are reported separately. Employer submission remains manual.

Verified locally: all 38 core command groups, 140 mocked Edge browser cases, Windows credential safeguards, secret scan, and desktop/mobile visual review. Concurrency tests use explicit worker-start barriers to prove overlap. No new live generation, quality guarantee, or measured speedup is claimed. Prior Believer/HyperHug results and accepted Values Value login blockers remain historical evidence.

Extension source and the same unpacked outputs/raven-extension-2.3.0 folder contain version2.4.0; hashes match. The owner confirmed Reload of Raven Application Assistant and a Raven refresh after publication. Remaining follow-up: live parallel timing/acceptance, cross-role chronology validation, provider-specific custom fields, and phase timing. No automatic Windows startup installation is claimed.

Pages deployment38639487800 succeeded and published app92 was verified. Main core checks passed. Initial production checks exposed an outdated smoke-test location/label assumption; the test now opens Job details and asserts the renamed approval control remains enabled before/after reload. Corrected production smoke tests passed14/14 against the deployed app with synthetic data. The correction is test-only; no additional product deployment is needed. Personal evidence, documents and credentials remain outside Git. See docs/JOB_CARD_REDESIGN_PLAN.md and docs/APPLICATION_PREPARATION_RECOVERY_PLAN.md for design and remaining edge cases.
