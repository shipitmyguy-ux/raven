# Raven execution handoff

## Document preparation without the extension — October 14, 2026

The owner authorized decoupling combined Prepare from the Chrome extension. The web-only implementation finishes both canonical documents and live Drive PDF receipt checks before any extension probe or employer preflight, including when the extension is compatible. A missing, unresponsive or outdated bridge cannot block document preparation. Raven retains Documents ready with an explicit Resume action and an extension-setup reason. That deferred path does not retrieve attachment bytes, read applicant profile/answers, inspect the employer page or send an application packet.

A compatible explicit Resume checks the same job URL, exact saved document hashes and Drive receipts, and then prepares the form without a second writer run. Already-open recovery also requires persisted hashes and fresh verification before clearing. Writer/receipt/hash/job-identity/protocol failures remain errors. Reload alone starts no work; application status and submission remain manual. The two-worker writer and extension2.4.2 are unchanged; no helper restart or extension Reload is needed for this release.

Local verification: all38 core command groups and secret scan passed. Forty-three preparation Node cases and six focused browser cases passed. Initial full browser run passed152/153; the existing completion-event test emitted before its fixture job loaded. Its positive and negative cases now wait for the job, and focused rerun passed. Final GitHub checks/publication remain pending. Verification uses controlled fixtures; no fresh live generation timing, personal-document reset or employer submission is claimed.

Branch codex/extension-independent-documents; app94/module5 web cache update included. Preserve all existing user documents/history. Prior app93/extension2.4.2 live HyperHug acceptance remains historical evidence.