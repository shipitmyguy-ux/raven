# Raven execution handoff

## Official portal adapters and studio visibility — 2026-10-12
Implemented bounded ZeniMax iCIMS, EA Avature and Remedy Jobylon adapters, exact company/studio verification, remote eligibility revealed by details, cache-before-fetch and rotating detail cursors. Fixed official studio result starvation: Games/3D preserves top100 aggregate results and merges up to50 fresh Studio sources with URL deduplication and existing eligibility. Full posting-to-prompt fixtures added; no candidate generation or saved records written.

Local49 workflow commands pass. New source candidates MachineGames, Motive, DICE, Remedy, Techland and Avalanche have official evidence. Source activation, CI and live rollout validation follow. id/Bethesda exact taxonomy, Respawn studio filter ID and other source-specific blockers remain unresolved.

Base5ab342a. Worktree /workspace/scratch/df332aa39da8/raven-portals. Five parallel workers investigated adapters, remaining18 sources and app flow; root owns integration/deployment. CI includes portal unit tests, result-window actual db function test, actual collector dispatch and source-to-prompt browser fixture. Next: committed-source deployment, service-only schema provider/cursor extension, six source activations, live source checks and public results full description readback. Never read/output Vault token; reuse existing cron command.
