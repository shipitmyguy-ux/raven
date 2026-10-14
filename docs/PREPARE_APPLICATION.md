# Prepare application — first version

The Prepare application button generates or reuses both canonical documents through the existing local signed-in Codex writer, verifies saved Raven/Drive records, renders the exact saved versions to PDF, then sends their bytes and the browser-local applicant profile to the Raven Chrome extension. The extension opens a tab for that job, fills recognized fields, selects the PDFs in matching upload controls, and stops for human review. It never submits, grants document approval, or changes the application status. Applied jobs offer Prepare again for review.

## Employer access gates

Employer access controls do not prevent document preparation. A sign-in or visible challenge leaves the resume and cover letter saved in Raven with verified Drive PDFs for later use. Raven shows Documents ready and retains an explicit Resume preparation action. Resume re-inspects the destination and reuses the unchanged saved documents before filling the form. No applicant packet is delivered while access is blocked. Hidden/passive CAPTCHA infrastructure alone is not an access gate. Component, transport and job-identity errors still require recovery before continuing.

## Requirements and activation

Use desktop Chrome with the updated Raven Application Assistant extension, the updated local writer running on port 8766, and the saved Application profile in Raven Options. Refresh Raven after reloading the extension. The existing phone document queue remains available for document generation; application preparation requires the local desktop helper and extension. Existing saved documents are reused rather than overwritten. A fresh-generation test must explicitly reset only the selected job's document fields after a recovery copy is saved.

The helper health response reports application_prepare_supported. The frontend checks the extension and helper before starting generation. Missing/outdated components produce a recovery message. Updating web files alone does not update an installed unpacked extension or a running helper.

## Data and scope

Verified career evidence goes to the existing document-writing process. Contact/profile fields and answer memory remain browser-local until the explicit preparation action sends them, with the job's PDFs, to the extension and selected employer form. File selection can upload bytes to the employer immediately; stopping before Submit does not imply that the employer has received no data. No model is used to guess field values or legal answers.

The authenticated helper PDF endpoint accepts only a job ID and exactly two canonical document hashes. It authorizes the job, serializes export with writing, checks both documents before and after rendering, confines reads to the export directory, and limits each PDF to 2 MiB, and verifies PDF headers and byte hashes. No client-supplied paths or arbitrary download URLs are accepted. The client verifies PDF hashes again.

The extension binds the packet to a single newly created tab and exact target URL with a short lifetime. Ashby UUID posting URLs map to the same job's /application route. Other direct forms are attempted without inferring redirects. It fills only supported controls with known values and leaves legal, sponsorship, demographic, salary, CAPTCHA and unknown questions for the user. Automatic next-page navigation is not part of this version.

## Verification limits

Synthetic browser tests establish button routing, canonical readback, actual File/DataTransfer behavior on controlled forms, and preservation of application status. They do not establish that an employer server accepted an upload or that every required field is complete. An employer form must visibly confirm its uploads; an unrecognized or failed upload remains a manual task. Live per-job acceptance and timing are recorded separately. Never describe fixture timing as real document-generation timing.

## Recovery

- Writer unavailable: start or update the helper, then retry. Saved documents and verified exports are reused.
- Extension absent/outdated: load/reload the current extension, refresh Raven, then retry.
- Documents changed mid-run: stop and retry from canonical records.
- Unsupported/redirected form: leave manual completion to the user and record the observed URL and fields before adding a narrow adapter.
- Upload failure: show the specific missing attachment; retain the generated document and Drive copy.
- A repeated click must not start overlapping preparation for the same job.


## Reducing extension reloads — owner direction, October 14

Treat extension updates as exceptional and batch them. Raven and the local helper own document writing, factual validation, canonical saves, Drive receipts, PDF generation, workflow state, retries and user feedback. The extension retains browser-only operations: exact tab/URL binding, DOM inspection, safe field assignment, attachment selection, and the prohibition on automatic submission. Use a stable versioned data contract with bounded identities and capabilities. No remote executable code or expanded permissions.

The next small implementation is to make extension capability an optional second phase. If the extension is absent or outdated, generate/reuse and verify both canonical documents and Drive copies, save documents-ready metadata with an actionable form-setup reason, and return before PDF packet delivery. Explicit Resume then probes the extension and reuses the unchanged documents before form inspection/delivery. Add tests for absent bridge, incompatible protocol, no packet/profile delivery, retry without a second writer run, and writer/receipt/hash failures. Current individual document generation already does not require the extension; the combined Prepare action still probes it early. This structural change is planned, not yet implemented.
