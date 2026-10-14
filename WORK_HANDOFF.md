# Raven execution handoff

## Always-on local writer and paired phone queue — October 14, 2026

Implemented current-user Windows logon startup, crash recovery, and AC-only idle-sleep prevention. Added revocable/expiring device pairing, an authenticated bounded Supabase queue, outbound local polling, and the existing Generate-button route for paired browsers. Existing local-only use remains available. Document authoring/save/PDF/Drive verification stays in the existing serialized local workflow. Cloud-hosted writer recorded as future feature, not provisioned.

32 focused Node tests pass, including auth, device isolation, interrupted/unauthorized work, duplicate starts and saved-output verification. Live migration applied and raven-local-queue v1 ACTIVE with custom device authentication. Transaction-rolled-back SQL verifies duplicate suppression, revoked denial, invalid kinds and no client-role table/RPC grants; live anonymous request returns401. Security advisors add only three expected RLS/no-policy informational notices for service-only tables; existing password warning unchanged. Local browser runtime download failed; GitHub core, safety browser, Windows PowerShell 5.1/7 checks (38589012945) and full browser regression (38589013225) passed. PR79 merged at7382dcd662829055c3e0c3c377128e01db8c7495; frontend Pages deployment triggered. A further live synthetic pairing probe was interrupted before fixture creation; authenticated live phone generation remains unverified.

Activation remains pending on the owner's Windows computer: update checkout, close old manual helper after work finishes, install scripts/install-oneclick-startup.ps1, then pair phone via pair-writer.html. No access to that machine in this session; no startup installation, personal token, live phone generation, or new user document is claimed. Existing grant expiry remains November1. Full steps and future cloud feature: docs/ONE_CLICK_RESUMES.md.

## Previous handoff

# Raven execution handoff

## SoundAir game-generation filtering - October 13, 2026

Live resume logs show repeated INVALID_DRAFT records containing exp_soundair, most recently at 22:31 UTC. Instructions excluded SoundAir, but evidence and allowed history schemas still exposed it. Shared generationProfile now scopes game evidence before model/schema construction and external prompts. Canonical history and non-game tracks remain intact; explicit SoundAir revisions remain supported. One-click rebuilds game guidance from scoped evidence and restricts experience_id choices.

Deployed resume v135 and cover v105 preserving existing JWT/custom checks. Live prompt-only readback confirms no soundair_1 and retained game chronology. Focused writer/helper tests61, review/reliability/bridge69, and scope/security6 pass. No saved documents or approvals changed. Live generation returned ok=true with exactly eight game roles and no SoundAir. The response architecture remains the existing grounded-llm-v7 label in the narrowly patched deployed bundle; canonical source uses v9. Local idle helper adapter activated/restarted; session readiness readback passed. PR78 core, Windows and browser-safety checks passed. 35/36 local core commands passed; remaining OAuth command lacked local jose dependency, while the complete GitHub core job passed with dependencies installed. No user document was saved by the acceptance generation. The deployed code is a narrow patch to live bundles, rather than replacement with broader canonical changes.


## Approved InGameJob production activation — 2026-10-13

User explicitly approved deployment/activation with d. Deployed collectorv14/backendv69 ACTIVE and applied committed gamesmith_ingamejob_sources migration. Actual Vault-authenticated scan request584 HTTP200 checked1source:37fetched,7details attempted,6complete plus1excluded,0deferred,6eligible. All six full descriptions1549–4639chars persisted and remote/geographic conditions preserved. Public directory confirms enabled/verified/ok/complete and24hour interval with next check October14. Gamesmith remains blocked/disabled/pending provider because publicDNS fails; no successful Gamesmith scan claimed.

Prior PR77/main core,130browser,safety,Windows,Pages and smoke checks passed. Post-backend production smoke38477717810 passed. Public Games/3D results HTTP200 returns all six InGameJob listings. Security advisor comparison shows no new notices. No user documents, approvals or applications modified by this rollout. Evidence docs/board-ingamejob-verification.json; live six roles AstermanStylizedEnv,HyperVR3DGeneralist,HypercellUnityGeneralist,ValuesValueLevelArtist/LeadLevelArtist,JustCreateSenior3DArtist. Six listings are not a guarantee of six unique vacancies or personal eligibility; current shared dedup/remote-anywhere rules remain.

Previous deployment approval blocker resolved by explicit user d. Migration now applied. Implementation4c3543b, prior inactive registration400f35e. Current live168sources; InGameJob active daily, Gamesmith unavailable. Do not claim whole-board coverage: English art category only, bounded pagination/detail rotation, fresh ApplyUI validation. Local one-click helper remains running, app89 unchanged. Preserve ignored personal/private files. Remaining Gamesmith requires domain recovery and verified adapter; no automation created.
