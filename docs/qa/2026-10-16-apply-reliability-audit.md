# Apply reliability audit — October 16, 2026

Audited GitHub main at 9126d2c0c6d8abe889bcb23518230cff3b65195b. This is a diagnosis and repair acceptance contract, not a claim that Apply has been fixed. No employer form was filled or submitted in this audit.

## Confirmed failures in the primary Apply path

1. app.js sendApplicationPacket resolves true both for an acknowledgement and for its 800 ms timeout. A silent bridge therefore reports success.
2. app.js attachSavedApplicationPdfs returns immediately unless BOTH saved documents exist. A saved resume alone never reaches PDF verification/retrieval. The primary Apply button itself does not start missing-document generation or subscribe this attachment task to later generation completion.
3. extension/src/content.js consumeApplicationPacket checks hostname for the initial packet, not exact company/requisition URL or an extension-owned tab binding. A different job on the same shared ATS host can receive the packet. The follow-up uses a globally stored session, so it is not independent proof of local tab ownership.
4. content.js startup and storage-change handlers remove the global packet even when the receiving page did not consume it. Another open page can discard delivery intended for the employer tab.
5. content.js uploadAvailableDocument reports uploaded immediately after assigning input.files and dispatching events. The banner calls this attached without observing employer acceptance.
6. Direct content.js fill runs at startup and packet changes; it does not wait for delayed form controls or replay safe missing fields when later steps appear. Its MutationObserver watches completion, not field readiness.

The optional version-2 preparation path uses separate prepare-content.js / background machinery with stronger URL/tab identity, preflight, readiness and selected-versus-accepted reporting. Existing focused preparation tests exercise that machinery. Passing them does not establish the behavior of the primary version-1 Apply path.

## Verification performed

Executed the exact fetched content.js and extracted app.js functions in Node v24.20.0 with an isolated fake DOM/storage environment and synthetic email synthetic@example.invalid. No browser automation or network requests were used in these reproductions.

- Packet for company-a/JOB-A on apply.workable.com filled the synthetic email on company-b/JOB-B on the same host, wrote a session, and displayed a filled-field banner.
- Startup on unrelated.example removed the global pending packet despite not consuming it.
- sendApplicationPacket without any extension acknowledgement resolved true.
- attachSavedApplicationPdfs with a saved resume and no cover letter made zero verification/retrieval calls.

These are controlled reproductions of code behavior, not evidence that the user's private information has actually been sent to a wrong employer.

Read-only inspection of the existing Raven browser tab showed Panic Stations with both documents labelled Needs a document, and a separate paused preparation for another role. The existing Workable tab was still on its job detail route. This observation does not establish which code/extension version originally opened it. The installed extension version could not be inspected through the browser tool's restricted internal-page access.

## Project/process findings

- The working checkout is on an older document-routing branch with existing modifications; it must not be reset or used as the base for this repair.
- WORK_HANDOFF.md and status history describe merged PR100 as open/in progress. TASKS.md has a newer merged entry. The architecture document understates current extension responsibilities.
- Release checks are real evidence for their covered cases; live Mad Head/Panic acceptance remains explicitly absent.
- The previous assistant conclusion that only an extension reload and live acceptance remained was incorrect.
- The user outcome is a correctly prepared employer application. Queued, packet-saved, file-selected, merged and deployed are intermediate states.
- Increasing prompt specificity alone cannot fix missing delivery ownership, false success reporting, or divergent execution paths.

## Recommended repair scope

Preserve canonical jobs, history, grounded document generation and existing documents. Consolidate browser Apply execution around one engine, reusing the stronger preparation primitives. Keep employer navigation available while documents prepare; do not restore document approval/review gates.

1. Bind each attempt to job ID, request ID, exact authorized destination and extension-owned tab/frame. Never broadcast personal packets as a shared mailbox. Only its owner may acknowledge or retire a request.
2. Keep a real distinction among opening, waiting for fields, filling, preparing document, selecting upload, accepted upload, needs user action and failure. A timeout is never an acknowledgement.
3. Handle resume and cover independently. Reuse available current documents; generate missing requested documents through the existing writer and deliver when ready to the same still-matching form. Preserve user edits.
4. Reuse readiness and employer acceptance checks across direct Apply and optional preparation. Isolate each tab and each request through navigation, retries and multiple jobs.
5. Keep fallback in the current employer tab, with the job and correct files retained. Offer Use this page after user navigation; offer direct downloads and field-copy actions when automation cannot handle the form. No URL transfer into ChatGPT.
6. Check actual running web/helper/extension capabilities and writer availability. Ship one integrated extension update when necessary.
7. Temporarily prioritize this workflow over source expansion, phone/cloud writer features and further UI entry points. A right-click action can call the same engine later; it is not a reliability fix.

## Release acceptance

First reproduce and then eliminate the four controlled failures above. Run the relevant existing checks on the actual primary Apply path, including rejected uploads, delayed controls, same-host different jobs, unrelated tabs, missing cover, no documents, disconnected helper, stale extension and retry after navigation.

Then verify the installed published system on real intended jobs: Panic Stations, Mad Head, a previously successful Breezy case, and additional representative ATS forms from the user's actual job set. Record which cases are automatic, which require explicit fallback, time to ready, manual interventions, and accepted attachments. A fallback is not counted as automatic success.

Verify fresh browser/session starts, repeat attempts and multiple open jobs. Preserve saved documents and existing form values. No auto-submit. Do not call the product working based solely on CI or one prepared fixture.

A whole-project rewrite is not supported by current evidence. Replace the Apply execution path if consolidation cannot meet this contract; keep working data/document components. An alternative commercial tool would require the same real-job acceptance comparison before adoption.
