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
