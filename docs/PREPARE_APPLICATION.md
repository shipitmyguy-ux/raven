# Prepare application — independent documents, optional form filling

Prepare application first generates or reuses both canonical documents through the existing local signed-in Codex writer and verifies their saved hashes and live Drive PDF receipts. Once both documents are saved, the primary action is labelled Apply job and uses this same verified flow. This finishes independently of the Chrome extension. When a compatible extension is available, Raven can then inspect the employer destination, retrieve verified attachment bytes, and send the browser-local applicant profile and PDFs to that inspected tab. The extension fills recognized fields, selects PDFs in matching upload controls, and stops for human review. It never submits, grants document approval, or changes the application status. Applied jobs offer Prepare again for review.

## Employer access gates

Employer access controls do not prevent document preparation. A sign-in or visible challenge leaves the resume and cover letter saved in Raven with verified Drive PDFs for later use. Raven shows Documents ready and retains an explicit Resume preparation action. Resume re-inspects the destination and reuses the unchanged saved documents before filling the form. No applicant packet is delivered while access is blocked. Hidden/passive CAPTCHA infrastructure alone is not an access gate. Writer integrity, malformed protocol and job-identity errors still require recovery before continuing. Recognized browser-bridge unavailability pauses only form filling.

## Requirements and activation

Document preparation requires the local writer running on port 8766 and its existing authorized Raven/Drive connection. The Chrome extension and browser-local Application profile are needed only for employer form filling. If that stage is unavailable, both documents and verified Drive copies remain ready for review or later use. The existing phone document queue remains available separately. Existing saved documents are reused rather than overwritten. A fresh-generation test must explicitly reset only the selected job's document fields after a recovery copy is saved.

The helper health response reports application_prepare_supported. The helper is required for generation and verified Drive outputs. Extension capability is optional for document preparation: an absent, unresponsive or incompatible extension leaves Documents ready and an explicit Resume action. Form filling still requires a compatible extension. Updating web files alone does not update an installed unpacked extension or a running helper.

## Data and scope

Verified career evidence goes to the existing document-writing process. Contact/profile fields and answer memory remain browser-local until the explicit preparation action sends them, with the job's PDFs, to the extension and selected employer form. File selection can upload bytes to the employer immediately; stopping before Submit does not imply that the employer has received no data. No model is used to guess field values or legal answers.

The authenticated helper PDF endpoint accepts only a job ID and exactly two canonical document hashes. It authorizes the job, serializes export with writing, checks both documents before and after rendering, confines reads to the export directory, and limits each PDF to 2 MiB, and verifies PDF headers and byte hashes. No client-supplied paths or arbitrary download URLs are accepted. The client verifies PDF hashes again.

The extension binds the packet to a single newly created tab and exact target URL with a short lifetime. Ashby UUID posting URLs map to the same job's /application route. The web client maps only bounded, exact-host HTTPS posting routes to the same job's application route: Lever employer-slug/UUID to /apply, Gusto postings/slug-UUID to /applicants/new, and a single-tenant Breezy /p/12-hex-ID-slug to /apply. Canonical document verification and recovery retain the original saved URL, while preflight and delivery bind to the exact application target. Other direct forms are attempted without inferring redirects. It fills only supported controls with known values and leaves legal, sponsorship, demographic, salary, CAPTCHA and unknown questions for the user. Arbitrary next-page clicks, login bypass and generic board-to-employer navigation are not supported. Manual gates stop before PDF-byte retrieval or applicant-profile access.

## Verification limits

Synthetic browser tests establish button routing, canonical readback, actual File/DataTransfer behavior on controlled forms, and preservation of application status. They do not establish that an employer server accepted an upload or that every required field is complete. An employer form must visibly confirm its uploads; an unrecognized or failed upload remains a manual task. Live per-job acceptance and timing are recorded separately. Never describe fixture timing as real document-generation timing.

## Recovery

- Writer unavailable: start or update the helper, then retry. Saved documents and verified exports are reused.
- Extension absent/outdated: both documents and verified Drive PDFs still finish. Review or use the Current PDF links immediately. Enable a compatible extension and refresh Raven when form filling is needed, then click Resume; unchanged documents are reused.
- Documents changed mid-run: stop and retry from canonical records.
- Unsupported/redirected form: leave manual completion to the user and record the observed URL and fields before adding a narrow adapter.
- Upload failure: show the specific missing attachment; retain the generated document and Drive copy.
- A repeated click must not start overlapping preparation for the same job.
- If another job has a paused preparation, its metadata is preserved. The new job shows Review paused preparation and names the paused role; that action closes the drawer and focuses the existing Resume/Dismiss banner. Only an explicit owner Dismiss clears it before a different form is prepared. Standalone document generation remains independent of this gate.

Follow-up: support multiple parked preparations through a versioned per-job recovery store with lossless migration from the single-record format. Preserve uncertain dispatch as exclusive; park only settled document-ready intents when no lease is active. Show every parked job with explicit Resume/Dismiss controls. On resume, recheck the original job URL, canonical document hashes and current receipts before delivery. Keep request IDs and leases isolated per job, including across tabs, crashes and expiry; test migration and concurrent recovery without silently clearing an intent.


## Reducing extension reloads — owner direction, October 14

Treat extension updates as exceptional and batch them. Raven and the local helper own document writing, factual validation, canonical saves, Drive receipts, PDF generation, workflow state, retries and user feedback. The extension retains browser-only operations: exact tab/URL binding, DOM inspection, safe field assignment, attachment selection, and the prohibition on automatic submission. Use a stable versioned data contract with bounded identities and capabilities. No remote executable code or expanded permissions.

Implemented stage boundary: both canonical documents and live Drive PDF receipt checks finish, and their hashes are persisted, before any extension probe or employer preflight. Extension capability is an optional form-filling phase. If the extension is absent, unresponsive or outdated, generate/reuse both canonical documents, verify exact saved hashes and live Drive PDF receipts, persist metadata-only documents-ready with reasonType extension-unavailable, and stop before attachment-byte retrieval, profile/answer reads or packet delivery. Explicit Resume rechecks capability, job URL, saved hashes and Drive receipts, then reuses the unchanged documents before form delivery. The current extension and helper do not change for this web release.

Unknown or explicitly rejected protocol/identity responses remain hard failures rather than being relabeled unavailable. Pure bridge silence or disappearance can defer form filling; uncertain dispatch retains the stable request identity for safe explicit recovery. Already-open tab recovery also requires the original persisted document hashes and fresh receipts. No reload automatically generates or submits anything.

## Progress and upload-result compatibility

All browser helper consumers must use the same versioned client. Valid per-document progress (including confirming and document_complete) retains the requested run/job/document identity; unknown stages and identity mismatches remain failures. Completion still requires both exact canonical documents and verified Drive receipts.

Upload availability is observed before file dispatch. A successful employer confirmation may replace its file input with a filename/removal control; that does not mean the upload field was absent. Selected-but-unconfirmed uploads retain their warning, and genuinely missing controls are reported separately.

## Profile contact dropdowns

Country, phone and city require non-empty values in the device Application profile. Greenhouse country/city searchable dropdowns select only a unique option matching the profile; city includes profile region/country for disambiguation. A typed query is not accepted as a committed location. Unknown/ambiguous results remain manual and unfinished searches are cleared; existing selections are preserved. Authorization, sponsorship and salary are never inferred or filled by this adapter. An owner-authorized one-off salary draft entered during a supervised test does not become a reusable automatic answer.

## Automatic stale connection recovery

After an explicit Prepare/Apply/Resume action has verified both saved documents and live Drive receipts, a silent preflight following a capability response can mean Chrome invalidated the old content-script connection. Raven renews its page connection once and automatically resumes the same job and request. It rechecks canonical URL, hashes and receipts before retrieving PDFs or delivering the packet. No extension update or reload is needed. The tab-local continuation is consumed before work, expires after two minutes, and contains only job/request identity and hashes. Ordinary reloads without this continuation still start no work.

Renewal is limited to pre-delivery failure. Unknown/malformed/identity-rejected responses, manual access gates and uncertain delivery are not automatically replayed. Missing/outdated extensions retain Documents ready. A second silent preflight stops for explicit recovery instead of looping. Open editors/import/options dialogs, active document work and pending document sync prevent automatic page renewal. Form filling remains review-only; Raven never submits.
