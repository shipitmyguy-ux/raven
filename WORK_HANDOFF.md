# Raven execution handoff

## Apply reliability audit — October 16, 2026

A deeper audit of main 9126d2c disproved the prior conclusion that only extension reload/live acceptance remained. Controlled execution of the primary version-1 Apply code reproduced same-host wrong-job filling, unrelated-tab packet deletion, acknowledgement timeout reported as success, and resume retrieval skipped when cover is missing. No personal data was transmitted. The stronger optional preparation engine is a separate code path; its checks do not prove direct Apply reliability. Read-only Raven UI inspection showed Panic Stations has neither document. See docs/qa/2026-10-16-apply-reliability-audit.md for evidence, limitations and the repair acceptance contract. Diagnosis complete; remediation and live acceptance are NOT complete.


## Current priority
User requests a candid diagnosis and a working result, permitting replacement if necessary. Recommended scope is consolidation of Apply execution, not a full project rewrite. Preserve open-form access and independent document generation; do not reintroduce review/approval gates. The repair is not yet implemented.

## Required next implementation
Base a clean isolated checkout on latest GitHub main; the existing cwd has unrelated uncommitted document-routing work. Reuse exact tab/job/request binding and employer-acceptance machinery from the stronger preparation path. Eliminate the global packet race and false timeout success. Support each document independently and explicitly continue attachment when requested missing documents become ready. Add an in-page fallback preserving job and document context. Read the audit for exact source locations and release criteria.

## Verified this session
Four controlled failures reproduced using exact GitHub main source and a synthetic DOM/storage harness. Existing Raven UI inspected read-only: Panic Stations shows both documents missing; another job's preparation remains parked. No live uploads, submissions, data changes, extension update or application-code changes. Installed extension version was not confirmed.

## Release baseline and cautions
PR100/101/103/104 are merged. v2.5.0 package is published; previously recorded CI/Pages/smoke passed, but live Mad Head/Panic acceptance remains absent. Those release checks do not negate the newly reproduced defects. Earlier IllFonic acceptance applies to its tested path/version and is not proof of today's direct Apply engine. No claim of user data actually reaching a wrong employer.

Existing canonical jobs/documents/history, factual validation, manual final submission and standing push authorization remain. Keep the extension small and batch any required reload. Automatic document work for discovered jobs has shipped queue code, but end-to-end usefulness must be checked rather than inferred from enqueue success. Other discovery/phone/cloud tasks should not displace the current Apply acceptance objective.
