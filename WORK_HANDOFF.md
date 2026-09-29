# Raven execution handoff

Latest task: unrelated jobs in the Games / 3D tab.

## Game / 3D relevance filtering (2026-09-28 MDT)
Root cause: game-track include terms used substring matching, so Unity matched community and game matched Burlingame. Eligibility had exclusions but no positive art-role requirement. Cached reads and saved/local UI rows bypassed ranking.

Shared track-filter.js now requires an environment/world/level/prop/material/texture/game/3D artist, modeler, world builder, Unreal generalist, or explicitly relevant art-lead role. Existing excluded technical/programming/character/VFX/community roles remain excluded. Relevant non-game 3D production remains eligible because this tab is Games / 3D. Game scoring uses phrase boundaries; other tracks retain their existing rules. Both fresh ranking and cached backend reads enforce eligibility; browser combined results filter saved and local discoveries as well. No job records or documents deleted or rewritten.

Backend v53 deployed. Live listResults returns 21 art-role results and excludes observed retail, sales, community-support, tutor, biotechnologist and game-design results. Regression suite: 85 tests pass, including actual rankCandidates collision tests. Frontend app v66 adds the shared script before app initialization. Work usage unavailable; proceeded normally.

Prior document changes remain live: resume v115, cover v87; canonical full shipped credits, duplicate paragraph cleanup, skill casing, cached studio context. Prior release 2fb79bd passed all core/browser/smoke/Pages workflows. Saved Stone Kite documents were repaired in that task. No document changes made in this filtering task.
