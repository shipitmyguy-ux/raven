# Raven execution handoff

## Document routing and stage diagnostics — October 14, 2026 MDT

Consolidated Generate, paired generation, ChatGPT, and Save PDF to Drive selection in routeDocumentRequest. Preserved current concurrent writers, prepare-application guard, phone resume behavior, explicit revisions, saved-document reuse and verified export readback. App98/client5. Durable helper state and resume_workflow metadata now retain request ID, failed stage/document, safe allowlisted error code, stage timestamps, elapsed time and per-document stage durations. Parallel sibling failures retain their own stage. Browser failures show request ID and failed stage. No extension changes.

Verified: all71 current core workflow commands passed; focused Edge suite8 cases passed against synthetic local APIs, including paired outputs/reload, overlapping requests, stopped helper, retained Drive links and new failure recovery. Additional parallel-failure regression passes. npm run test:documents provides the focused local suite; existing CI invokes these test files. No live generation, saved-job changes, Drive uploads, helper restart or production rollout performed for this task. GitHub PR/CI status recorded below when available.

Implementation integrated from origin/main 905f444 in managed document-routing-integration worktree; original checkout and unrelated oneclick-codex/profile/personal artifacts preserved. Current helper process has not been restarted and must load updated code before diagnostics are active. Frontend requires normal Pages publication.

Carry forward unrelated priorities: preserve owner visa-only exclusion policy (AGENTS.md); confirm scheduled spreadsheet refresh and ArenaNet/Cinnamon source checks before claiming ingestion success; GitHub issues85/86 remain separate. Current main source changes and data preserved.
