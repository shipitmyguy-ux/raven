# Raven execution handoff

## Option 3 integration milestone (2026-10-08)
- Five tools: granted-job lookup, job/profile reads, current document/hash read, resume/cover save and scope/hash/version-protected replacement.
- Archive migration applied; transactional replacement, stale rejection and document independence verified on disposable database fixtures. Archives are service-only and included in backups.
- Deployed raven-mcp-v1 ACTIVE v1 (bridge 0.2.0); unauthenticated requests verified 401. Actual authenticated MCP saves and ChatGPT connection remain unverified.
- 15 bridge tests, all 27 core commands, renderer/syntax/secret/whitespace checks passed.
- Connected Drive verified; existing NetBox Labs resume PDF copied unchanged and metadata-read back in private Raven Applications folder. Automatic Drive synchronization is not implemented.
- Blocker: Supabase OAuth server disabled, no owner Auth user, no exposed secure-settings/secret provisioning operation. Standards-compliant OAuth/consent and account activation remain necessary.

User explicitly authorized completing, pushing and deploying Option 3 and Google Drive copies. No further deployment approval needed. Branch feature/raven-mcp-bridge, PR #59. Do not merge/activate paid OpenAI pilot PR #58; preserve concurrent refactor/generation-contract work. Usage state unavailable.

SQL canonical file supabase/sql/raven-mcp-document-versions.sql applied as raven_mcp_document_versions. Service-role archive UPDATE/DELETE revoked. Restore inserts archives after jobs and ignores existing IDs. No existing user documents were changed.

Drive destination/file IDs and remaining setup limits are in docs/RAVEN_MCP_BRIDGE.md. One existing resume PDF copied; no bulk backfill. OAuth discovery returned feature_disabled; owner count zero. No secret-management endpoint in available tools. Never expose unauthenticated MCP or service-role credentials to clients. Database-only QA is not ChatGPT connection acceptance.

## Apply on site resume trigger (2026-10-08)
- App v81: native employer link opens immediately; scheduled resume-only preparation reuses existing writer, job preparation and persistence. No cover auto-generation or employer submission.
- Refreshes actual source description and saves discovery jobs first; empty/expired sources fail visibly. Existing resumes are preserved and repeated clicks share active generation.
- Six focused execution checks pass. Three browser tests added for save/reload, preservation and missing listing. Local Chromium download failed with invalid archive; browser tests and authenticated live generation/reload remain unverified.
- Existing frontend persistence is reused; no new cross-device transactional-save guarantee is claimed. The MCP bridge retains its separate CAS/archive gate.

## Concurrent main release preserved
# Raven execution handoff

Latest task: publish ready fixes while leaving generation/MCP experiments pending (user instruction, 2026-10-08).

## Delivered
PR67 merged at ba223bcbd019bf4918cbc9dc22ad20c2b4f8bea4 and deployed. It integrates PR62 Word line breaks, PR63 status pills, PR64 document wrapping/applied icon and PR65 source-confirmed listing closure. Conflicts resolved preserving export module v2, accessible applied icon and all regression tests. Frontend v80/core v5/filter v3 is live. Listing migration applied; raven-enrich-v1 v10 ACTIVE; backend remains v55. Existing PR55 features and extension ZIP 2.2.0 were already live; stale task entries corrected. Duplicate alternative PR66 closed without merging; branch preserved. Experiments #58/#59/#61 and maintenance #53/#54 remain pending.

## Actually verified
All combined local core commands/syntax/secret/whitespace pass. Combined PR and release core/full-browser CI, Pages and both smoke runs pass. Installed Edge: 14 hosted production smoke cases with synthetic fixtures plus hosted Word converter assertion set pass. The converter test initially assumed localhost root; private URLs were corrected to the hosted /raven path before passing.

Disposable production job/search fixtures used a nonexistent Greenhouse posting with authoritative Job not found evidence. Live enrichment persisted closure; fresh backend reads retained Interview/application date/both documents and excluded discovery. Database trigger resisted simulated ingestion reset. QA records removed; ordered document/lifecycle digest and count (378) identical before/after. No user documents or applications changed. Source assets, export v2 and downloadable extension 2.2.0 verified directly.

## Remaining
Device extension installation/reload; signed-in ChatGPT prefill/file creation/automatic handoff; native Word/browser-print visual acceptance; real employer-form attachment/selectors/completion. Production smoke uses synthetic backend/adapter fixtures and does not establish those real-site checks. No paid API/provider experiment activated. Existing MCP v1 was observed but untouched.

## Environment
Usage checked: 94% remaining at start. Windows sandbox launch failed; approved elevated shell was used. Supabase migration/cleanup connector calls each had an expired request-state response; database state was checked before retrying. Durable exact QA cleanup succeeded. Untracked Smile-Break JSON untouched.

Evidence and run IDs: docs/qa/2026-10-08-ready-fixes-release.md. Standing push authorization remains in AGENTS.md.
