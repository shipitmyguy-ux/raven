# Saved and discovered vacancy identity

Raven uses `supabase/functions/_shared/job-dedup.js` in both the browser and backend. The existing studio discovery wrapper reuses the same verified board-to-employer identities.

Identity order:

1. Canonical source URL, removing tracking parameters, fragments and trailing slash differences.
2. An exact employer posting identifier on supported ATS hosts, or a verified board alias in `docs/board-duplicate-identities.json`. Explicitly labelled application links in stored posting text can supply the identifier. No outbound application requests are made.
3. For distinct verified studio providers only, identical full descriptions of at least 600 normalized characters plus exact employer, title, location and known remote status. Short summaries and title-only matches never establish duplicate identity.

ATS parsing uses exact hostname allowlists, rejects credentials, preserves distinct requisition IDs, and requires compatible employer/title/track for different source URLs. Known Smile Break and Half Mermaid spelling aliases are reused. Unknown recruiter clients are not collapsed. Exact posting identity can reconcile different board geography labels; the selected whole row retains its own restrictions.

The browser combines saved and discovered rows before filtering. Applied history and documents take precedence over new discoveries; ignored records suppress rediscovery. All four tracks check all saved records: a saved vacancy assigned to one track is not rediscovered as new in another. Exact canonical URLs/posting IDs establish identity across tracks; description-only fallback remains track-bound. The backend removes discoveries already represented by saved records and returns the existing job on repeat imports rather than making a new saved row. Saved reads paginate with a hard cap and fail instead of trusting an incomplete identity lookup.

No automatic deletion, document replacement, application-status reset or history transfer occurs. Existing duplicates can be archived reversibly after verification. If both copies have distinct applications/documents, underlying records remain intact even when display selects one. Ambiguous identities stay separate. Simultaneous imports of previously unseen different URLs are not protected by a database identity uniqueness constraint; display and subsequent imports still reconcile them. New or unsupported board aliases without exact evidence can still require review; do not claim every possible repost can be detected.

Regression coverage: `tests/job-dedup.test.mjs`, existing studio identity/result-window tests, sales/location filter VM tests, and `e2e/job-dedup.spec.mjs` verify import reuse, saved/discovered collapse, applied document preservation through reload, canonical URL variations, ignored-state suppression, distinct requisitions, role levels, regional scope and unknown employers.
