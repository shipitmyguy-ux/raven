# Ready fixes release — 2026-10-08

Published PR #67 at ba223bcbd019bf4918cbc9dc22ad20c2b4f8bea4, integrating #62/#63/#64/#65. The user authorized ready fixes and explicitly left generation/MCP experiments pending. Alternate closure PR #66 was closed without merging; its branch remains recoverable. Dependency maintenance PRs #53/#54 remain pending.

## Live release
- Frontend app.js v80, raven-core v5, Word export module v2; shared location filter v3 remains active.
- Word cover-letter line breaks, independent status-pill containment, wrapping document controls and accessible applied check icon are published.
- Applied the committed listing_availability migration; raven-enrich-v1 v10 ACTIVE. Existing backend v55 did not require redeployment.
- Source-confirmed closed discoveries become Expired. Unapplied saved closures use the existing archive; application stages and saved documents remain accessible. Existing refresh checks at most five stale sources sequentially. No new Closed tab, recurring schedule or generation provider cutover.

## Verification
- All combined core workflow commands, syntax, secret scan and whitespace passed locally.
- Combined PR core/browser runs 37822388011/37822388021 passed.
- Release core 37825623387, full browser 37825623438, Pages 37825623390 and both production smoke runs 37825623458/37825676441 passed.
- Direct hosted asset checks confirm v80, export v2/OOXML breaks, icon and containment rules. Extension ZIP returns HTTP 200 and contains manifest 2.2.0 with chatgpt-files.js.
- Installed Edge ran all 14 production smoke cases successfully against hosted assets with synthetic backend/adapter fixtures. These cases do not submit applications.
- The Word converter browser check initially used a localhost-root absolute import and failed on GitHub Pages. The unchanged assertion set passed after adapting only the private test URLs to /raven/document-download.mjs. It exercises the actual hosted converter and validates every synthetic block plus the OOXML closing/signature break.
- Live production fixture: a nonexistent Discord Greenhouse posting returned authoritative API error Job not found. Deployed enrichment persisted closure to synthetic saved/search records. Fresh backend reads retained Interview, applied date and both synthetic documents; cached discovery excluded the record. A simulated ingestion reset could not erase closure or reset Expired. Only the two exact QA records were removed afterward.
- Existing user rows before/after: 378; aggregate MD5 of ordered IDs/status/resume/cover/applied-date was identical (38d9fd0078960bb40bd153043b1f82cc). No saved user document/lifecycle mutation, approval or employer submission occurred.
- RLS remains enabled on both changed tables. Security advisors report INFO-only RLS-enabled/no-policy findings consistent with server-only access; no grants/policies were changed.

## Remaining acceptance
- Installed extension reload/update is a device action; published package verification does not establish installation.
- Signed-in ChatGPT prefill/file creation/automatic attachment transfer, native Word/browser-print visual acceptance and real employer-form selectors/completion remain unverified.
- Prior LibreOffice/WeasyPrint export layout evidence remains in document-exports QA.
- Experiments #58/#59/#61 remain unmerged. A pre-existing raven-mcp-v1 v1 was observed during inventory; this release did not deploy or alter it.
