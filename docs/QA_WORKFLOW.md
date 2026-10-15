# Raven QA execution policy

Run the smallest relevant local checks once. Broaden after a failure, a material change, or a coverage gap; do not repeatedly run full suites while waiting for CI. Live generation is an acceptance check, not routine CI: synthetic process regressions cover duplicate admission, overlap, upload failure and forced restart without credentials or real files.

- Core Node checks own logic and security regression coverage. The Linux/Windows nine-case document recovery/concurrency matrix remains mandatory for matching changes.
- One browser workflow owns UI coverage. UI, e2e, package and browser configuration changes run the152-case local browser suite. Backend/extension-only changes run the focused safety/application cases in that same workflow; they no longer start a duplicate safety job. Manual dispatch runs full coverage. Unknown diff bases fail safe to full coverage.
- The14 production smoke cases have a separate Playwright configuration without a local HTTP server. They run after successful Pages deployment, against that deployment's commit, or by explicit dispatch. Ordinary documentation/test pushes do not start production smoke. These cases are excluded from local browser regression.
- Newer commits cancel superseded PR core/browser runs. Main CI remains independent to verify integration; it is not cancelled by PR runs. A newer deployed smoke run supersedes an older smoke run.
- Use npm ci for locked dependency installation. Existing Playwright browser caching remains. Tests do not alter real applications or submit employer forms.

Commands: npm run test:e2e (local browser152), npm run test:smoke (deployed smoke14), npm run test:document-recovery (nine credential-free process cases). Counts describe this change and can grow as meaningful scenarios are added.
