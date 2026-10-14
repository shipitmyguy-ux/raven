# Raven execution handoff

## Document preparation without the extension — October 14, 2026

The owner authorized decoupling combined Prepare from the Chrome extension. The web-only implementation lets the existing local writer generate/reuse both documents and verify canonical saved hashes and live Drive PDF receipts even when the bridge is missing, unresponsive or protocol-incompatible. Raven retains Documents ready with an explicit Resume action and an extension-setup reason. That deferred path does not retrieve attachment bytes, read applicant profile/answers, inspect the employer page or send an application packet.

A compatible explicit Resume checks the same job URL, exact saved document hashes and Drive receipts, and then prepares the form without a second writer run. Already-open recovery also requires persisted hashes and fresh verification before clearing. Writer/receipt/hash/job-identity/protocol failures remain errors. Reload alone starts no work; application status and submission remain manual. The two-worker writer and extension2.4.2 are unchanged; no helper restart or extension Reload is needed for this release.

Local verification: all38 core command groups and secret scan passed. Forty-two preparation Node cases and six focused browser cases passed. Initial full browser run passed152/153; the existing completion-event test emitted before its fixture job loaded. Its positive and negative cases now wait for the job, and focused rerun passed. Final GitHub checks/publication remain pending. Verification uses controlled fixtures; no fresh live generation timing, personal-document reset or employer submission is claimed.

Branch codex/extension-independent-documents; app94/module5 web cache update included. Preserve all existing user documents/history. Prior app93/extension2.4.2 live HyperHug acceptance remains historical evidence.