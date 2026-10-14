# Application preparation: prevention and recovery plan

This plan separates current guards from safeguards to add. It is based on `docs/PREPARE_APPLICATION.md`, the local writer workflow, and the extension bridge. A form’s upload controls and server acceptance still require live, per-job confirmation; fixture results do not establish employer behavior.

## Priority 0 — preflight the destination before generation

**Current:** The extension accepts only a packet from Raven’s HTTPS origin, opens a fresh tab, binds the request to its tab ID and expected URL, and consumes the packet once. It does not submit forms or click navigation controls. Sensitive/legal, sponsorship, demographic, salary, CAPTCHA, and assessment fields are skipped. Unsupported forms and login challenges remain manual.

**Next:** Preflight the current listing and its application route before starting any model calls or PDF work. Check canonical job ID, company, title, closed status, and destination together. Stop on closed listings, login/account gates, CAPTCHA, MFA, access denial, or a mismatched/redirected job; record the observed URL and reason. Never try credentials or bypass authentication. Two sampled Values Value listings—Lead Level Artist and Level Artist—both lead to `https://ingamejob.com/en/login`. The user confirmed both as accepted blockers: no login or workaround. These are route inspections, not form tests.

## Priority 1 — factual document quality

**Current:** The writer uses the verified profile and saved job context, applies factual/structural validation, and permits one bounded repair attempt. Existing saved documents are reused rather than silently replaced; generated results are read back from Raven and their versions are checked. The app’s saved Application profile was initially empty; it has now been populated from the verified resume with name, email, portfolio, and LinkedIn. The extension uses only those known profile keys and does not infer legal answers.

**Next:** Preserve the existing rule that unsupported claims fail validation; audit role attribution, dates, skills, metrics, and job-specific claims before using a document. Show the exact resume and cover-letter hashes, reuse saved documents, and require a deliberate revision flow when a draft fails quality review. Do not silently replace a saved draft.

## Priority 2 — semantic field mapping and safe unknown handling

**Current:** The extension associates fields through accessible labels, common terms, and adapter selectors. It fills blank text, email, telephone, URL, textarea, and matching select controls, and skips fields whose labels or metadata look sensitive. Unknown legal and eligibility questions are left blank. Existing file controls are screened against resume-import/autofill labels. The extension never clicks Submit, calls `requestSubmit`, or calls a form’s `submit` method.

**Next:** Require a strong match from an explicit label or reviewed host-specific selector, plus a compatible input type. Use semantic label associations; do not infer from visual position or vague words alone. Keep unknown required fields blank and list them for the owner. Treat custom dropdowns, radio/checkbox groups, ambiguous “name” fields, and unassociated controls as manual. Detect cross-origin iframes and shadow-root forms as unsupported rather than claiming the page is complete. Continue excluding resume-parsing/import widgets because uploading there may overwrite or reinterpret data. Do not broaden the sensitive-field allowlist to improve fill rate.

## Priority 3 — confirm attachment acceptance

**Current:** The extension distinguishes a selected local file from an upload confirmed by the page and waits up to 15 seconds for visible upload status. It reports missing or unconfirmed files and leaves all submission to the person. It does not advance to another page. The PDF endpoint and browser client check PDF headers and SHA-256 values before dispatch.

**Next:** Prefer provider-specific upload state where available; treat a displayed filename alone as provisional when the page also says uploading, processing, failed, or rejected. On timeout, leave the selected file visible but label server acceptance unconfirmed and ask the person to inspect it. Keep multi-page applications manual: detect a next-step transition, stop, and list remaining required fields rather than clicking Next. Never retry an upload automatically after an uncertain result.

## Priority 4 — measured latency and safe recovery

**Current:** A fresh extension request ID, one-tab binding, one-time packet delivery, document-version rechecks, and the serialized writer reduce overlap and stale-document races. The local helper reports support through its health check. Packet expiry and size checks bound extension storage. A live Believer run generated and verified the resume and cover-letter Drive copies in about 130 seconds, including one bounded resume repair. A Chrome connection change interrupted the page's in-memory continuation before preparation dispatch; the final retry reused the saved documents and opened the form in about45 seconds, with Name/email/portfolio and both accepted PDFs verified. This measures document generation and Drive export only, not the full application-preparation workflow. HyperHug completed one-click preparation in133 seconds to the observed review-ready state, including a bounded automatic cover repair; a later independent chronology correction adds separate review time.

**Next:** Measure queue wait, resume draft/save, cover-letter draft/save, PDF rendering, Drive confirmation, tab open, field scan, and employer upload confirmation separately. Use real live runs before publishing a duration estimate; report elapsed time and last completed stage, not an unsupported total. Add one correlation ID across the local run, PDF preparation, and extension tab. Make retries idempotent, warn if timed-out work may still be running, and avoid automatic upload retries after uncertain acceptance. Keep only minimal local outcomes—job ID, document hashes, observed host/path, matched field keys, confirmed files, stop reason, stage times—and exclude values, file bytes, full answers, and page text. Clear packet data after preparation or tab closure; expire unbound packets after restart.

## Live acceptance record

HyperHug completed the fresh one-click run in133 seconds to observed ready state. Name, email and portfolio were filled and its resume was visibly accepted; there is no cover-upload field. Required pipeline-experience, Russian-proficiency and engine-integration questions remain blank for the user. No CAPTCHA interaction or submission. Its cover chronology error was caught by independent review, corrected through validated import with employer-specific passages separated, saved, and re-exported. Add explicit cross-role chronology checks to the document validation plan: supported facts can still be connected by an incorrect temporal word.

Believer's final form test confirmed Name/email/portfolio and both PDFs after fixing actual-label precedence over placeholders. Location and sponsorship remain manual. Both Values Value sign-in blockers remain accepted; no substitute jobs or complete timings are claimed.
