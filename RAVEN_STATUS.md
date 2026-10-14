# Raven Status

## Application preparation first version — October 14, 2026

Implemented Prepare application / Prepare again for review: existing local writer generates or reuses both documents, canonical readback verifies saved Raven/Drive records, authenticated serialized export returns exact PDFs, and the desktop Chrome extension opens a job-bound form, fills recognized fields and selects PDFs. Human review and submission remain manual; document approvals and Applied history are preserved. Ashby UUID postings open the same job's application route. Unsupported navigation, legal answers, location autocomplete and unknown fields remain manual.

Validation: 65 core workflow commands were checked; the single extracted test-harness dependency failure was repaired and focused rerun passes. Full local Edge browser suite passed 134/134 before the final bounded-upload/race hardening; final targeted Node tests passed 29/29. Extension 2.3.0 package prepared. Live acceptance is pending updated extension loading, helper activation and publication. Believer selected by user for fresh generation; its original job/documents backed up locally and not yet cleared. Random active 3D sample: HyperHug 3D Environment & Prop Artist, Values Value Level Artist, Values Value Lead Level Artist. No employer submission. See docs/PREPARE_APPLICATION.md.

## Always-on local writer and paired phone queue — October 14, 2026

Implemented current-user Windows logon startup, crash recovery, and AC-only idle-sleep prevention. Added revocable/expiring device pairing, an authenticated bounded Supabase queue, outbound local polling, and the existing Generate-button route for paired browsers. Existing local-only use remains available. Document authoring/save/PDF/Drive verification stays in the existing serialized local workflow. Cloud-hosted writer recorded as future feature, not provisioned.

32 focused Node tests pass, including auth, device isolation, interrupted/unauthorized work, duplicate starts and saved-output verification. Live migration applied and raven-local-queue v1 ACTIVE with custom device authentication. Transaction-rolled-back SQL verifies duplicate suppression, revoked denial, invalid kinds and no client-role table/RPC grants; live anonymous request returns401. Security advisors add only three expected RLS/no-policy informational notices for service-only tables; existing password warning unchanged. Local browser runtime download failed; GitHub core, safety browser, Windows PowerShell 5.1/7 checks (38589012945) and full browser regression (38589013225) passed. PR79 merged at7382dcd662829055c3e0c3c377128e01db8c7495; frontend Pages deployment triggered. A further live synthetic pairing probe was interrupted before fixture creation; authenticated live phone generation remains unverified.

Activation remains pending on the owner's Windows computer: update checkout, close old manual helper after work finishes, install scripts/install-oneclick-startup.ps1, then pair phone via pair-writer.html. No access to that machine in this session; no startup installation, personal token, live phone generation, or new user document is claimed. Existing grant expiry remains November1. Full steps and future cloud feature: docs/ONE_CLICK_RESUMES.md.


## SoundAir game-generation filtering - October 13, 2026

Live resume logs show repeated INVALID_DRAFT records containing exp_soundair, most recently at 22:31 UTC. Instructions excluded SoundAir, but evidence and allowed history schemas still exposed it. Shared generationProfile now scopes game evidence before model/schema construction and external prompts. Canonical history and non-game tracks remain intact; explicit SoundAir revisions remain supported. One-click rebuilds game guidance from scoped evidence and restricts experience_id choices.

Deployed resume v135 and cover v105 preserving existing JWT/custom checks. Live prompt-only readback confirms no soundair_1 and retained game chronology. Focused writer/helper tests61, review/reliability/bridge69, and scope/security6 pass. No saved documents or approvals changed. Live generation returned ok=true with exactly eight game roles and no SoundAir. The response architecture remains the existing grounded-llm-v7 label in the narrowly patched deployed bundle; canonical source uses v9. Local idle helper adapter activated/restarted; session readiness readback passed. PR78 core, Windows and browser-safety checks passed. 35/36 local core commands passed; remaining OAuth command lacked local jose dependency, while the complete GitHub core job passed with dependencies installed. No user document was saved by the acceptance generation. The deployed code is a narrow patch to live bundles, rather than replacement with broader canonical changes.


## Approved InGameJob production activation — 2026-10-13

User explicitly approved deployment/activation with d. Deployed collectorv14/backendv69 ACTIVE and applied committed gamesmith_ingamejob_sources migration. Actual Vault-authenticated scan request584 HTTP200 checked1source:37fetched,7details attempted,6complete plus1excluded,0deferred,6eligible. All six full descriptions1549–4639chars persisted and remote/geographic conditions preserved. Public directory confirms enabled/verified/ok/complete and24hour interval with next check October14. Gamesmith remains blocked/disabled/pending provider because publicDNS fails; no successful Gamesmith scan claimed.

Prior PR77/main core,130browser,safety,Windows,Pages and smoke checks passed. Post-backend production smoke38477717810 passed. Public Games/3D results HTTP200 returns all six InGameJob listings. Security advisor comparison shows no new notices. No user documents, approvals or applications modified by this rollout. Evidence docs/board-ingamejob-verification.json; live six roles AstermanStylizedEnv,HyperVR3DGeneralist,HypercellUnityGeneralist,ValuesValueLevelArtist/LeadLevelArtist,JustCreateSenior3DArtist. Six listings are not a guarantee of six unique vacancies or personal eligibility; current shared dedup/remote-anywhere rules remain.


## Gamesmith and InGameJob sources — 2026-10-13

User requested both boards added. Implemented InGameJob public English Art and Animation category integration, complete bounded pagination, fresh canonical/employer/title/active-Apply checks, complete nested descriptions, remote/geography/hybrid conditions, serial5second request starts, max12 rotating details and24hour source cadence. Added existing shared saved/discovery dedup recognition and directory label. Gamesmith registered blocked/disabled/pending provider because firstparty domain DNS returns SERVFAIL independently; no speculative adapter or false scan success. Provider constraint/migration extends only ingamejob; no saved jobs, documents, approvals or applications modified.

Actual anonymous Node scan:37cards/two pages;7targetdetails attempted,6complete+1excluded2D,0deferred; final capturedHTML replay after narrow remote-condition fixes yields6eligible. All9requestsHTTP200; evidence timestamps are response completion, not request starts. All58 local core commands,11adapter cases,14provider dispatch and existing dedup/scheduling checks passed; independent review repaired lookalike employer-host and nested-description guards. PR77 merged/published at4c3543be8b3185eaa2d340697f4130f6c58f0c0e. All PR core/safety/Windows/full-browser checks passed; main core38477079053/browser38477078909/Pages38477078938/push smoke38477079046/post-Pages smoke38477119733 passed. Automatic approval review rejected production raven-studio-scan and raven-backend-v3 deployment: shared-service blast radius requires explicit human production approval. Neither backend deployment occurred, and activation migration20261013220741 was not applied. Live collector remainsv13/backendv68.

Unaffected work completed: reversible inactive directory registration (docs/qa/2026-10-13-gamesmith-ingamejob-staging.sql) added both entries; public GET confirms168sources, Gamesmith blocked/disabled/pending provider and InGameJob pending/disabled/pending provider. InGameJob final capturedHTML replay yields6eligible,11tests; live scheduled ingestion remains UNVERIFIED and INACTIVE. No saved user jobs/documents/applications were modified by source registration. Pending: explicit deployment/activation approval; Gamesmith separately requires DNS recovery and a verified adapter.

 Evidence docs/board-ingamejob-verification.json and docs/board-gamesmith-verification.json.


## Generate both and overlapping document requests — 2026-10-13

User reported Generate both failing and cover-letter requests blocked during resume generation. Root causes: Generate both bypassed the enabled local helper; one-click reservation covered the whole job rather than each requested document. Implemented app88 unified routing and document-specific reservations with durable busy labels and selected-job review guard. Helper keeps its serialized save/export queue to preserve canonical version/grant safeguards; another document may be accepted while the first runs and waits its turn. Existing documents, approvals and applications preserved. Added actual-server regression for same-job resume-running/cover-queued/completed. Six focused Edge browser cases and25 oneclick Node cases pass. Actual helper both request b64da602-f68e-4228-9451-5e2bd204e3ea confirmed existing Streamline resume/cover and both verified Drive files preserved. PR75 merged at1635e5a and app88 published. All57 local core commands,25 oneclick cases, six focused Edge cases and all129 full browser cases passed; PR core/safety/Windows and main core38473716878/browser38473716968/Pages38473716844/push smoke38473717090/post-Pages smoke38473758228 passed. Actual deployed pair requests accepted/completed; canonical reload preserved both Streamline hashes, Drive files, Applied status and approval, no ChatGPT window. Live QA found progress events hide exports beyond the first10 activity rows. App89 follow-up retains newest valid export per document alongside recent10 events; regression passes. PR76 merged/published at8b3708d27f72083d4735df5dce191b558aa56d39; app89. PR all130 full-browser cases/core/safety/Windows pass. Main core38474939345, Pages38474939330 and push smoke38474939419 pass; final browser38474939389 and post-Pages smoke38474995553 also passed. Actual hosted read-only app89 acceptance passed: two original Drive links visible before/after full reload, zero helper calls, both document hashes/file IDs/Applied/approvals unchanged. Evidence ignored private/oneclick-app89-links-report.json. Historical exports retain timestamps; visibility is limited to exports available in the existing200-event API window.






## One-click resumes — 2026-10-13

Implemented button → local signed-in Codex helper → validated Raven save → exact PDF → verified Drive upload → durable review link. Existing documents preserved; retries reuse verified exports. No manual prompt/JSON/upload, paid API route, automatic approval or employer submission. Helper must run on this computer; browser may request one-time local-network permission. Grant expires November 1. No automatic Windows startup installed.

Actual fresh Mob Entertainment resume JT-1791413319517 completed every stage: PDF file 1Aswd4Dfuaz9z35JZMx_shPr7Ag-kNW1- in 1resumecoverletter, document SHA6e20888cb4a7b55166fee56cd2a49d1592e2252aed0886215a12e08e100354df. Two-page PDF visually/text verified; independent factual audit passed. BulletFarm retry reused saved draft. All52 local core commands,24 oneclick cases, four focused browser cases, secrets/diff and PowerShell syntax passed. Published with all GitHub checks and real hosted browser/reload acceptance passed. Details: docs/ONE_CLICK_RESUMES.md.

PR74 merged/published at 144ac07eb08a0c0861e2a4772e8dfd7a34349ba8. PR core/Windows/safety checks and125 browser cases passed. Main core38470191323, browser38470191259 (125 cases), Pages38470191324, push smoke38470191266 and post-Pages smoke38470240820 (14 cases) passed. Actual published app87/runtime flag and real Edge button/helper run64ab5365-daba-446c-8a8e-d1f7b6a1fb36 passed without local asset routing or a ChatGPT window. Full reload retained the exact document SHA, Drive file, Applied status and approval. Normal local-network permission was explicitly granted; users may need to allow it once. Final helper restarted and remains running; no automatic startup service. Personal outputs/receipts remain ignored.




## All-track duplicate audit and cleanup - 2026-10-13

Audited all 391 saved records and all 800 discovery-cache metadata rows, plus 177 API-visible full descriptions. Existing source cache contains 383 copies of saved vacancies, 16 of them surfacing in another track. Backend and UI now suppress saved identities across all four tracks; exact posting identity survives track assignment changes. Added narrowly verified Eleventh Hour Games and Mob Entertainment source aliases and LinkedIn posting-ID normalization. Eleventh Hour's original Greenhouse Applied record wins display/import while both applied histories and identical document links stay stored. Mob's Applied record is retained, with a guarded correction of its stale remote flag from validated matching source metadata. No saved rows or documents are deleted or overwritten.

27 similar employer/title groups examined: Smile Break already resolved, two additional groups confirmed; other 24 retained as distinct regional/requisition postings or unverified matches. All 52 local core workflow commands and focused all-track/alias/import tests passed. Added browser fixtures for duplicate applied copies and cross-track suppression. Published and deployed: frontend app87 and backend v68 ACTIVE. All-track live discovery/import checks passed: all 391 saved records, 16 application records and 25 document-bearing records are preserved, except the planned Mob remote metadata correction. Repeated confirmed repost imports return the original Applied ID and create no rows. Live UI shows one Eleventh Hour Applied card with both document Review actions and one Mob Applied card. All 52 local core commands passed; published core, safety/Windows, full browser regression, Pages and production smoke passed on bd6e3f8. Final exact-URL/incomplete-employer regression passed locally. These checks execute automatically on refresh, import and display; unsupported or ambiguous cross-source aliases remain separate. Evidence: docs/qa/2026-10-13-all-jobs-dedup.md and docs/qa/2026-10-13-all-jobs-cleanup.sql. Private baseline stays outside Git.


## Saved/discovered duplicate prevention - 2026-10-13

Implemented shared browser/backend vacancy identity and saved-record aware discovery suppression. Fixes the Smile Break ArtStation repost appearing alongside the existing Applied Remote Game Jobs record. Imports now return the existing job ID/status/documents for exact matches. Supported ATS identifiers and explicitly labelled application links cover future cross-source copies; verified aliases remain shared with studio result dedup. Canonical tracking URL normalization, distinct requisition/title/track checks, exact-description/geography fallback and unknown-employer guards retain separate vacancies. Saved lookup paginates and fails at its bound rather than silently missing old records.

Published implementation 1ed277c plus import correction 36a1825 and final browser fixture 6faa9df. Backend v66 ACTIVE; hosted app86/shared dedup script verified. GitHub core 38463562070 (core, safety browser and Windows jobs), full browser 38463562018 and production smoke 38463562024 all passed. Pages 38462970395 passed. Initial fixture failure was an incorrect checkbox locator for an aria-pressed button; corrected to the actual control and verified through reload. All 50 original core workflow commands passed locally before integration with the concurrently published direct-resume work. Secret and diff checks passed. Live POST addJob for the existing ArtStation mirror returns the original Applied ID and both exact document values, creates no row, and leaves the entire original application record unchanged. Live listResults suppresses Smile Break discovery; browser reload shows one preserved application with both Review actions. Guarded cleanup SQL archives only the empty-document mirror and adds one idempotent provenance note; document hashes, application date and original last_updated verified unchanged. Evidence: docs/JOB_DEDUPLICATION.md and docs/qa/2026-10-13-smilebreak-cleanup.sql. Screenshot retained in the calling chat outputs, not published in the repository.

Limit: unsupported aliases and simultaneous first imports of previously unseen different URLs are not guaranteed by a database unique identity constraint. Do not claim every possible duplicate is detected. No destructive cleanup.


## Direct ChatGPT resumes and Drive PDF implementation — 2026-10-13

Implemented a short job-bound ChatGPT button request that saves via Raven Private without manual JSON. Added review Save PDF to Drive, private exact-HTML PDF rendering, local PDF/document hash checks, configured-folder checks and idempotent durable Drive links in existing job activity. User selected 1resumecoverletter. Private owner explicitly opted into saved-job scope; create-only/version/expiry and public OAuth protections retained. Fixed Windows tunnel Node path; tunnel started with encrypted saved credentials and actual plugin read verified.

Actual existing-resume PDF rendered, page inspected, connected Drive upload metadata read back in target folder, and export event persisted/read back with unchanged resume URL/version. 51 workflow commands, 13 direct/private focused cases, five browser cases and Windows credential tests passed, including the two added syntax checks. Latest main integrated; unrelated personal artifacts and renderer line endings preserved. User explicitly approved merge/publication; PR73 merged at 8ad4cc0 and hosted app85/direct module/config/buttons verified. PR core, Windows, safety and all 120 browser cases passed. Main core/browser/Pages and push smoke passed; post-Pages smoke 38462714410 passed all14 cases. Signed-in ChatGPT full-chain acceptance and refreshed seven-tool plugin discovery remain pending. See docs/CHATGPT_DIRECT_RESUMES.md.

## Skillsearch scheduled runner — 2026-10-12 evening MDT / 2026-10-13 UTC

Skillsearch is operational again through an ordinary anonymous GitHub-hosted collector. Source 558887d805b3fbe7da5f6cd414bd73c815800878 is published; studio collector v13 deployed, backend remains v64. Registry 166 entries / 80 verified enabled / 86 pending, blocked or unsupported. Direct Supabase requests still return 403; the collector consumes the dedicated skillsearch-feed branch snapshot instead.

Hosted runner 38348798014 first verified category plus all five current descriptions HTTP 200. Daily publisher run 38349118808 repeated all six successful requests and published a 352,845-byte snapshot. Raven's real scheduled check at 2026-10-13T04:59:49Z fetched five jobs, attempted/completed all five descriptions, deferred zero, eligible zero, detail health complete. Public directory readback verifies enabled/verified/ok/complete; anonymous collector POST remains 401. Current zero matching jobs is a filter outcome, not a failed scan.

Workflow runs daily at 10:17 UTC (04:17 MDT, 03:17 MST), with main-only scoped GitHub token publication to the separate feed branch. No Supabase credentials or browser impersonation. Complete pagination and fresh source HTML are bounded; daily rotating twelve-description windows keep producer/consumer population aligned. Supabase reparses canonical identity, expiry, recruiter labeling and remote restrictions with the existing adapter. Snapshots older than 36 hours fail; page capture timestamps remain unchanged. Missing details remain partial; failed listing collection does not overwrite a good snapshot. GitHub schedules may be delayed; stale data is not silently renewed.

Validation: all core regression workflow commands passed locally, final eight snapshot tests and eleven existing Skillsearch tests passed, provider dispatch passed, secret scan and diff checks passed. Independent review fixed a future-growth detail-window mismatch. GitHub core 38349118834 and smoke 38349118832 passed; hosted daily publisher passed. Positive matching-role snapshot fixtures verify full-description import behavior, but there is no current eligible Skillsearch role to demonstrate a nonzero live import. Saved jobs, resumes, covers and applications untouched.

Next: monitor first scheduled daily refresh and preserve honest partial coverage if category grows. Prior Games Jobs Direct single-description failure, Hitmarker rotation and remaining 86 catalog entries remain follow-ups. Evidence in docs/board-skillsearch-verification.json. No complete indie-market coverage claim.

## Recruiter board rollout — 2026-10-12 evening MDT / 2026-10-13 UTC

Source commit 89114c6cb8a8407134c5577ffe70c629adb0285c is published. Collector v12 and backend v64 are deployed. Registry: 166 entries, 79 verified enabled sources, 87 pending/blocked/unsupported. 8Bit and Games Jobs Direct have successful live checks. Skillsearch's adapter is implemented and tested, but its deployed collector request returned HTTP 403; the follow-up migration marks it blocked and disables automatic scans. Research access alone is not operational verification.

8Bit's own recruiter table returned all 69 placements across seven pages. Three art descriptions were freshly verified; one eligible Senior 3D Artist listing has Europe-only remote scope and 2,502 characters. Its company is explicitly “8Bit (undisclosed client).” Hybrid UK/US roles were excluded. Games Jobs Direct's UI-supported match-all artist+remote search returned 46 cards across five pages, not whole-site coverage. Seven relevant descriptions were attempted, six verified, one failed, none deferred. Three full-description Sperasoft Lead Props/Environment 3D Artist listings retain distinct Warsaw/Poland (6,314 characters), Yerevan/Armenia (3,068) and Belgrade/Serbia (2,956) locations. Remote status does not establish personal or US eligibility. Five-second request spacing, serial requests, expiry/activity validation and bounded fresh details are enforced. Partial detail health remains visible.

All three sources are job boards/recruiters, not assertions of indie studio ownership. Unknown client labels cannot deduplicate separate employers. Existing remote-anywhere filtering, exact posting deduplication and source scheduling remain in use. Saved jobs, resumes, covers and applications were untouched. Evidence: docs/board-eightbit-verification.json, docs/board-skillsearch-verification.json, docs/board-gamesjobsdirect-verification.json; runtime Skillsearch blocker is recorded in migration 20261013044533.

Validation: all 50 local workflow commands passed; independent adapter review and 30 new adapter cases passed. Thirteen provider dispatches were verified across two bounded ticks. GitHub core tests, Pages deployment and both production smoke runs for 89114c6 passed. Hosted directory provider labels and anonymous collector POST 401 verified. Live database checks prove 69/1 for 8Bit and 46/3 for Games Jobs Direct. Public Games/3D readback verifies complete descriptions and regional locations. Full separate browser workflow was not triggered by this change; CI core browser safety fixtures passed.

Next: investigate supported Skillsearch runtime access without bypassing blocks; inspect the single Games Jobs Direct detail failure; continue bounded Hitmarker rotation, cumulative coverage bookkeeping, remaining catalog verification and exact employer aliases. GameJobs.co, Grackle and Polycount remain blocked/manual as previously documented. No claim of complete indie market coverage.

## Hitmarker, board gaps and duplicate identities — 2026-10-12 evening MDT / 2026-10-13 UTC

Published source2a288765abd106d8805e78adced76ae055692723 plusHyperHugaliasc61a1b05265443619513e752f75c6184658da5ac; studio collector v11/backend v63 deployed. Registry163 entries,77 verified active with real successful last checks,86 pending/blocked/unsupported. Added Hitmarker6h public-sitemap monitoring; GameJobs.co blocked and Grackle unsupported/manual entries are not active scans. Evidence docs/board-{hitmarker,gamejobs,grackle}-verification.json, board-gamejobs-primary-fallback.json and board-duplicate-identities.json.

Hitmarker official sitemap index advertises3 pages,actual5000/5000/4432=14432indexed URLs;174 targeted artslug candidates. These are NOT14432active jobs. Anonymous server detail validates canonical URL/JobPosting identifier/employer,full description, visible acceptingapplications, explicit remote/country scope and optionalexpiry. No gated client-search key/account actions/outbound application fetch.12fresh details per source check,2 concurrent, rotatingcursor, advertisedlastmodthenIDpriority. Empty/unverifiablelistidentity cannot hydratecache. Speculative/openapplication/talentpool/pipeline/evergreen,filled/expired,unpaid and2D-only jobs excluded. Partial coverage honest and configured6h schedule retained.

Two actual scheduled checks cursor0→12→24 each fetchedall14432sitemapURLs,attempted12detailfetches. First yielded1matching role,11fulldetails+1generalapplicationexcluded;second2matching roles/12complete details.24distinct candidate pages examined;eachcheck reports162candidates outside its current budget, not cumulative verifiedcoverage. Public Games/3Dreadback now24rows:3Hitmarker listings (MobEntertainment PrincipalEnvironmentArtist6363chars,USremote;StoryToys3DArtLead10254chars,remote;HyperHug3DArtistweaponskins2321chars,remote). Mob/StoryToys are2additional opportunities;HyperHug alreadyappearsviaAshby and now merges by exact primary application UUID5470c42c-1502-42aa-a3de-3ce213fb62d8. No claimall174 checked orall threeunique. Existing sharedremote-anywhere policy retained, restrictions/fullqualificationtext preserved, no personaleligibilityclaim.

Games/3Dpresentationdedup hides4verifiedcrossboard copies without modifying/deletingDB/savedjobs. HalfMermaidEnvironmentArtist canonicalTriNet30538/125496;Senior125495;SmileBreakSeniorEnv canonicalParallel6ab429f63bd186aa38742a13. ExactcuratedboardURLs/providerbindings+employer+fulltitle+remote required;HyperHugHitmarker andAshby exactprimaryposting also verified; onlylocationphrasingequality waived whereexactposting identityverified. Whole winningrow retained, WWIHalfMermaid EU/CET±3 andArtStationSmileBreak geography unchanged. Othercases requireexactnormalizedemployer/title/location/remote acrossknownStudio providers; officialATS preferred,boardsrichestdescription; sameprovider multiplepostings preservewholeambiguousgroup; unknownemployers notmerged. Rolelevels/geoscopes protected. Publicreadback verifiesonecardperknown4roles; rows24 because4duplicatecardsremoved and3newboardlistingsadded. HyperHug exactalias choosesofficialAshbywhole row, retainingRussianC1requirement.

GameJobs.co root/www/indexeddetail403; indexedposting isn't proofworkingfeed. Singularity6temporaryenv historical78–83/hr+Colorado listing rejected:actualemployerjobpageSSRJobnotfound404,careers24emptydepartments,boardbindingunverified. Grackleremotepage200advertises255results/30observedcards;6samehostredirects inspectLocation only andpointtoWWI oralreadyverifiedBlackbirdLever. Nohosteddescriptions/APIestablished; keepmanualdiscovery, do notclaimfullmonitoring. Hitmarker/ArtStation independentresearchrequests sometimes403; existingruntimechecks retainhonestfuturefailure/detailhealth, noaccessbypassattempted.

Validation:50localworkflowcommands pass;finalHitmarker10tests andexactpostingalias/dedupwindow regressions pass. Independentreview caughtandfixedcredentialURLs,generalinterest/pipeline/filled cases. CIcore38334016846 includesbrowser safetyfixtures,Pages38334016878,smoke38334016789/38334041414 allpass. FinalHyperHugfix core38334578116 andsmoke38334578090 pass; backend63publicreadback24rows/oneofficialHyperHugweaponcard retainsRussianC1. HostedHitmarkerproviderlabel verified;publicAPIonecardeachHalfMermaid/SmileBreak andall3Hitmarkerfulltexts readback;collector anonymousPOST401. ExistingVault-backedcron internallyinvoked withoutsecretread/output. Savedjobs,resumes,coverletters,employerapplications untouched. FullseparateBrowserworkflow nottriggered bybackend/providerdiff; coresafetybrowserpasses. CompleteGitHubroot34entriescheckedbeforepush.

Next:remaining150artcandidates notyetexamined inthisrollout; rotating scanscontinue6h. Prioritizefreshcandidateswhilepreservingcoverage andimproveper-source cumulativecoverage bookkeeping. ExpandHitmarkerslugdiscovery toremainingallowedmaterial/texture/worldbuilder/modeler forms; continue exact employer-target alias verification;supportedGameJobs/Gracklefeedsifavailable;remaining86catalogitems,firstpartyFunovus,andfaircandidatewindow scaling. No250–500verifiedindiecompletionclaim. Writer/exportworkunchanged.

## Forums and ArtStation — 2026-10-12 evening MDT / 2026-10-13 UTC

ArtStation was absent from repository search coverage. Added ArtStation public jobs feed, Blender Artists Paid Work53 and Epic Developer Community Job Offerings76. Collector v10 deployed; backend stays61. Source commit59e3394d74936bdacc46972df62903d0dc213274, narrow ArtStation2D fix fd87af40cf7de56ffcb0e86ab43cc3c1db6513b0. Registry160 entries,76 verified active (all76 last_status ok;75 healthy plus preexisting WWI detail degradation),84 unverified/blocked. Three active boards added; Polycount recorded blocked/manual, never claimed checking. Evidence docs/forum-{artstation,blenderartists,epic,polycount,other-sources}-verification.json.

Real ArtStation anonymous official-site-JS-linked API109 current ads across50/50/9 pages. Exact totals/page uniqueness/approved state/current placement expiry/company identity/full description checked; no outbound apply requests. Explicit2D-only titles excluded, mixed2D/3D allowed. Actual second live check fetched109 and eligible5,complete coverage. Public Games/3D listResults25 rows (previous20), including ArtStation Epic PrincipalEnvironmentArtist4078chars,Streamline3DEnvironmentArtist2590,StreamlineLeadEnvironmentArtist4457,Entelechy Roblox3DArtist3458,SmileBreak SeniorEnvironmentArtist5428. SmileBreak also appears via RGJ, so five additional board listings are not five unique vacancies. Existing HalfMermaid cross-board aliases also remain. Geographic scopes preserved; LA hybrid advertised remote is excluded. Shared remote-anywhere policy unchanged; visibility does not establish personal residency/work authorization. ArtStation checks6h.

Blender actual live checked90 topic metadata records and1 target firstpost,eligible0; Epic120 metadata records and4 target firstposts,eligible0;bothsuccessfulcomplete coverage. Original posts within90days, not bumps, strict category/URL/topic identity, closed/filled/hidden/deleted/deadline/service/zero-budget/unpaid/pure-revshare exclusions; paid fixed cash with optional bonus allowed. Unknown forum employers explicitly labeled, never inferred from usernames. Max10 list pages,12details/two concurrent/rotatingcursor; verify monotonic bumped ordering and stop only fully historical window or exhausted feed. Firstposts always revalidated despite description cache to catch mutable closure/deadline text. Original descriptions and explicit country restrictions retained. Daily checks.

Polycount direct HTML/RSS/API403; public search retrieval gives manual leads: Sept30 paid remote hand-painted Unity EnvironmentArtist (employer undisclosed); Oct11 Stormseeker starship contract200USD initialtask, remote unspecified; Aug22 US-only stylizedartist includes environmentwork but remote unspecified. Kenshi2 TerrainArtist closingOct4 excluded. Other communities investigated: ZBrushCentral lacks confirmed dedicated hiring scope/current paid env lead; GameDev.net lacks paid proof for latestenvrole; CGSociety502,3DTotaljobs404,3DCoat no verified hiring category. No blocked/bypassed feed activated and no forum messages/applications sent.

Validation:50 local workflow commands passed before final narrow2D change; final ArtStation10 tests + secret/diff checks pass. Independent review of3adapters completed. CI59e339: core38330157488,fullBrowser38330157500,Pages38330157482,smoke38330157440/38330181837 pass. Finalfixfd87af4 core38330370749 andsmoke38330370926 pass. Hostedlabels and public25-result/fiveArtStation full-description readback verified; anonymouscollectorPOST401. Existing Vault cron internally invoked without reading/outputting secrets. Two freshly discovered unwanted2D rows setIgnored reversibly; savedjobs/resumes/covers/applications untouched.

Publishing recovery: initial GitHubtree call lost its base reference, briefly producing partial repository commit8a53f4. Immediately restored complete34-root-entry base via59e339 and verified compare against prior89c44c contains exactly17 intended added/modified files and0removed. CorrectedPages,fullBrowser,core andsmoke all pass. No partial collector deployed. SQL cleanup firstrequest expired; safe reversible status update succeeded and live readback confirms2D rows hidden.

Next: resolve cross-board employer/role aliases (HalfMermaid/SmileBreak), revisit Polycount supported access, first-party customcareers(Funovus), remaining84 source verification, fair scheduler candidatewindow scaling. Writer/export tasks unchanged. Forum boards are mixed employers, not evidence of independent studio ownership.

## More indie studios — 2026-10-13 UTC

Published source commit a69a7ffc44774473b9992503e72fa91fef0184b4; collector v8, backend remains v61. Registry156 entries:73 verified active sources (all73 last_status ok,72 healthy; preexisting Work With Indies detail degradation remains),83 pending/unverified. This batch26 upserts =17 new registry entries +7 previously pending activations +2 existing binding refreshes, net24 active sources added. Evidence: docs/indie-{teamtailor-expansion,breezy-verification,recruitee-verification,extra-verified-feeds,remote-game-jobs-verification}.json. Provider and catalog migrations applied successfully from committed source.

Added Teamtailor Fatshark,Sloclap,Hazelight,NeonGiant,Ironbelly,Shapefarm,TacticalAdventures,Awaceb,Kepler; Breezy Playdead/Wildflower; Recruitee11bit/Lucid; existing ATS DoubleEleven,Colonist,PikPok,Rushdown,Series,Nightdive,GhostStory,TurnMeUp,PanicStations,Offworld; RemoteGameJobs board. BadRobot/Dreamhaven bindings refreshed. Group boards retain actual role employers; publisher-group/indie-origin and unaudited boutique ownership labels explicit. Empty verified feeds check weekly; active studio feeds daily and RGJ every6h. CompanionGroup official outbound linkage uncaptured, Tactile EU502, Remilia gaming relevance unproven: none activated.

Actual Games/3D listResults20 rows, up from15. RGJ35 current cards yields5 matching full-description environment roles: EleventhHourGames4890chars,Smile-Break5006,MadLabs3615 and HalfMermaid2860/3180. The two HalfMermaid roles also appear through WorkWithIndies under different URLs/employer spelling, so this is3 additional employer/role opportunities, not5 unique jobs. Existing URL dedup does not merge that cross-board alias; follow-up required. CentralTime core hours/US-hours preference/Europe preference preserved. Remote visibility is not a personal residency/work-authorization determination. Other new studios currently yield0 eligible roles under existing target-title/location policy; do not equate that with no public openings. Playdead environment artist is Copenhagen onsite and correctly excluded.

Validation:50 local workflow commands pass; independent adapter review fixed credential-bearing RGJ URLs and unknown Recruitee pagination. Focused17 adapter/dispatch tests pass. CI38327410240 core+safety-e2e+Windows passes; Pages38327410143 and smoke38327410228/38327434788 pass. Hosted new provider labels/public directory count156 verified. All26 batch sources have real successful checks with complete/not_needed detail coverage. RGJ repeat scan fetched35/eligible5,0 attempted detail requests, preserving cached full descriptions and remote scopes. Public Games/3D readback verified all5 imported rows and text lengths. Anonymous collectorPOST401. Existing Vault-backed scheduled command invoked internally; no secrets read or output. Saved jobs,resumes,cover letters and employer applications untouched. Full separate Browser-regression workflow was not triggered by this provider-only diff; core safety browser fixtures passed.

Next: custom first-party careers pages (Funovus has verified remote freelance/3D environment pages), cross-board employer alias dedup, remaining83 unsupported/unverified sources, and fair-selection scaling beyond oldest120 candidate window. Broader250–500 verified indie target remains incomplete. Separate writer/export and old saved-description work unchanged.

## Indie discovery rollout — 2026-10-12 evening
Deployed collector v7 and backend v61; Pages indie/boutique/source-kind filters and paginated directory live. Registry139 entries,49 verified integrations all checked,90 pending/unverified entries. Verified indie/boutique batch18 source records includes one previously active Believer,16 new registered feeds and activation of previously pending IO; net17 added integrations. Source evidence in docs/indie-studios-verified-a.json, -b.json, indie-teamtailor-verification.json, indie-board-verification.json and indie-catalog-summary.json. Added56 sourced pending candidates without pretending they were checked.

Actual live Games/3D listResults now15 rows, up from7: seven paid-active WWI listings plus Homa Senior3DGameplay Artist Generalist. US remote makRP Game Artist(Concept+3D) description2395chars; others retain Australia,UK,EU/timezone,Canada restrictions rather than claiming globally unrestricted. Current shared policy remains remote-anywhere/local-onsiteFC, so surfaced role is not a personal residency/work-authorization claim. WWI second real scan preserves all7 remote jobs using fresh authoritative cached metadata. Work With Indies checked87 cards; one listing remains unreadable and is honestly flagged degraded description coverage, no empty/malformed description ingested.

Teamtailor verified feeds: Embark19,CoffeeStain group2,IO7,GhostShip0. Job-board taxonomy labels CoffeeStain group and WorkWithIndies rather than falsely attributing vacancies to one studio. Indie-origin/publisher-owned UnknownWorlds and other ownership caveats retained; boutique category does not assert independent ownership. New generalist title recognition accepts3DGameplay Artist/3DArtGeneralist and retains character,technical,animation,VFX exclusions. Lever normalizer now includes role lists/additional text; live Blackbird environment/prop description refresh expands522 to2531chars.

Scheduling: oldestdue fair selection,12source tick,6provider/host cap,2fetch/check concurrency and140sec deadline. Explicit6–168h intervals respected, known quiet sources weekly; failure exponential12–168h backoff. GET exact count limit/offset max500, initialUI2000+Loadmore, explicitpartial/retry. Fresh portal cache exact title+employer validation restores remote/location metadata, preventing cached board roles disappearing on next check.

Validation:49 local workflow commands and independent review pass. Core CI38326027174 includes12 directory browser fixtures+source-to-prompt fixture; fullBrowser38326027081,Pages38326027099 andsmoke38326027098/38326060533 allpass. Hosted filters/pagination, real two-pass WWI ingestion, current full-description Games/3D result readback, all49 checked source states and anonymousPOST401 verified. Catalog source SQL applied in bounded batches from committed migration; no secrets read/output. Saved jobs,resumes,cover letters and employer applications untouched.

Remaining:90 catalog entries still unverified or unsupported; one WWI listing detail unreadable; bounded candidatewindow120 canunderfill mixedprovider selection when >120 overdue fromoneprovider; documented future scaling task. First usable indie batch delivered,250–500 verified indies remains expansion target rather than completed count. Older shortened saved-description generation and unrelated writer/export tasks remain separate.

## Official portal adapters and studio visibility — 2026-10-12
Deployed studio collector v6 and backend v60. Registry67;32 active integrations all successfully checked,35 remaining pending (24 unsupported systems,3 blocked sites,8 unconfirmed scopes/linkages). Activated MachineGames, Motive Studio, DICE, Remedy, Techland and Avalanche. Real public portal source evidence is under docs/studio-{icims,ea,jobylon}-verification.json; all18 unconfirmed/blocked sources rechecked in docs/studio-source-resolution.json; activation batch in studio-portal-activation.json. Bethesda/id exact ZeniMax company taxonomy is currently unobserved; Respawn official EA job/studio linkage found but numeric filterID remains unverified. Do not imply these studios are checking.

Fixed studio result-window starvation: preserve aggregate top100 + latest50 Studio results, URL dedup and existing eligibility. Narrow bilingual title support requires substantial English qualification/role content; foreign-only title/body tests remain excluded. Live public Games/3D results now7 rows including6 Studio jobs; People Can Fly full10,300-character description returns, whereas it was previously omitted. Canada geography is retained under current remote-anywhere policy; no residency eligibility claim.

Portal adapters use fixed official hosts, exact company/department/selected-filter/detail identity, streaming4MB/6second transport and deadlines. Art-title candidates retrieve detail before location filter so Work Model Remote is not lost. Cache-before-fetch plus rotating cursor prevents first12-only starvation. EA parser requires official count/result-container integrity; changed markup or incomplete/full20-result pagination fails rather than healthy falsezero. Current EA5/7 complete feeds pass. Detail metrics match scanner; MachineGames real scheduled check fetched2, attempted1/completed1, eligible0. Current six additions all have0 eligible roles under existing title/location preferences, not0 public vacancies.

Validation:49 final local workflow commands pass; independently reviewed security/scoping/parser/remote/cache/cursor defects fixed. Core/safety7e7ac8b passed8 directory +1 source-to-prompt browser fixture; full browser/Pages and2 smoke runs pass. Finalb1ba57bf core/safety and smoke pass. Actual public discovery card data/full description readback, Node/browser adoption/reload/promptOnly full-text transport fixtures passed. Collector anonymousPOST401, live Vault scheduled collection and all six healthy source checks verified. No actual candidate generator, saved user jobs, resumes, cover letters or applications were written by acceptance tests. Existing discovered results and registry were updated by collector.

Remaining:35 provider/scoping/linkage tasks, plus generic EA pagination beyond20 currently fails explicitly until verified. Existing legacy nonempty shortened notes still skip description refresh during generation preparation; fresh studio descriptions pass complete. No native resume output acceptance was claimed. Prior writer/export deployment follow-up remains separate.

## Studio descriptions and verified coverage — 2026-10-12 evening
Deployed raven-studio-scan v5 and directory health/verification UI. All50 previously pending studios were investigated;9 additional feeds activated. Registry67, configured26, all26 checked successfully, pending41 (23 unsupported systems,3 blocked sources,15 unresolved linkage/scoping). Evidence: docs/studio-source-verification-next-a.json, next-b.json and studio-source-audit-summary.json.

New sources: Insomniac, Epic Games English board, Bend, Santa Monica, Ubisoft Massive, Crystal Dynamics, Studio Wildcard, inXile, Compulsion. Sony boards require exact department and Ubisoft exact Organizational Unit scopes; no whole publisher feed attributed to studios. These9 current checks yielded zero eligible roles under existing art/location rules; successful checks are not evidence of no public vacancies. inXile's sole feed entry is a scam warning, not a vacancy.

SmartRecruiters/BambooHR descriptions fetch from fixed validated provider endpoints, at most12 eligible missing details at concurrency2 per source;24-hour cache expiry/newer posting invalidation; failed refresh preserves prior good text. Descriptions capped20,000 characters. Actual People Can Fly persisted description length10,300 and timestamp2026-10-12T23:30:29.894Z; source detail health complete. BambooHR adapter real Wildcard detail responses verified independently; actual current Wildcard art listing is Bellevue onsite and excluded correctly. Health flags separate partial descriptions from list failures, mark third consecutive failure broken, and reset recovery. Directory shows alerts, scopes and verification outcomes.

Validation:49 final local workflow commands pass, including scoped-provider contamination, malformed configuration, actual-handler auth/persistence/mixed-key bulk writes, description identities/cache expiry/deferred coverage and failure/recovery fixtures. All CI runs for9499a1d pass: core +8 directory browser fixtures, full Browser regression, Pages and2 production smoke runs. Hosted health/verification UI and GET fields confirmed, unauthenticated POST401. Authenticated Vault-scheduled live scans pass and all9 new sources are healthy. Saved jobs/resumes/applications untouched. Source migration tool returned internal error before applying data; same committed idempotent SQL applied successfully as five10-row batches and readback confirmed all50 verification outcomes.

Remaining:41 source-specific adapter/linkage tasks in the manifests. Local Chromium unavailable, browser acceptance performed in GitHub CI. Preexisting unrelated security advisor notices unchanged. Prior writer/export deployment follow-up remains separate.

## Studio search expansion — 2026-10-12
Published collector v4 and directory UI. Registry now has 67 studios: 17 configured sources with successful checks, 50 pending verification. Added nine officially linked providers: Naughty Dog, Digital Extremes, Housemarque, Blackbird Interactive, Crytek, Striking Distance Studios, People Can Fly, CD Projekt Red, Rebellion. Evidence and API counts live in docs/studio-source-verification.json; reproducible provider expansion and source migrations committed.

Supports Ashby, Greenhouse, Lever, Workable and SmartRecruiters. Workable multi-location duplicates merge by canonical URL, preventing duplicate upsert errors; SmartRecruiters preserves full location names and bounded pagination. Fixed-host requests reject redirects and cap body/job counts. Directory adds provider/status/site search, clear filters, honest pending/failed/zero-match distinctions, schedules and load retry. Directory-only edits now trigger Pages deployment.

Verified: all 49 local workflow commands pass; Reusable core tests (including four new directory browser fixtures), full Browser regression, Pages deployment and both production smoke runs passed for 7dd509b. Hosted directory controls and public GET schedule fields verified. Anonymous POST returns401. Existing Vault-authenticated scheduled command returned HTTP200; all nine additions have successful live check records. Actual matching jobs persisted for Blackbird and People Can Fly; HyperHug's initial check adds two more. Collector cron remains active every15 minutes, individual studios follow6–24 hour intervals. Saved jobs, resumes and applications were not modified.

Limits: 50 unverified sources remain pending; publisher-wide shared boards require studio scoping. SmartRecruiters list API has no description, so its discovered snippets remain empty and existing enrichment must fetch the posting before document generation. Local Chromium download failed; GitHub browser CI passed. Prior writer/export deployment follow-up remains separate.

## Offline wording and export improvements — 2026-10-11
Writer v8 adds concrete-opening, nonrepetitive-bullet and relevant-history guidance, preserving existing factual gates. This is source implementation; live generation and backend deployment remain unverified. Word exports keep role headings with the following paragraph and keep paragraph lines together. HTML/PDF section headings avoid breaks after the heading. Frontend cache versions advance to app84/export3.

Validation: all 47 core workflow commands pass after installing declared dependencies; 58 focused tests pass. A synthetic four-role DOCX generated by the actual exporter rendered through LibreOffice to two pages; both PNGs were inspected with no clipping or overlap, and education heading/content stayed together. This is not native Microsoft Word or actual saved-resume acceptance. Browser export regression could not launch because Chromium is absent; the assertion was extended for keepNext. No existing documents changed. Private plugin list_jobs currently fails with tunnel 404.

Next: deploy the shared writer through the existing backend deployment path, test actual tailored output, inspect real saved exports and complete Chromium/native Word acceptance. Cross-device errors and broader role audits remain open. Earlier deployed writer v7/app83 acceptance is recorded in docs/qa/2026-10-09-professional-fixes.md.

## Verified Professional generation and location fixes (2026-10-09)
Writer v7 is live in resume134/cover104; hosted app83 and track-filter4 confirmed after refresh. Mercury Readiness Generate both created and saved both documents; exact URLs survived full reload. Independent worker minimum targeted-draft review passes, with genuine qualification gaps and P2 wording improvements still open. Earlier Mercury Controls resume failed quality review and remains unapproved; no old documents were replaced and no applications submitted. Backend56 enforces hybrid only in Fort Collins, including mixed-city rejection. See docs/qa/2026-10-09-professional-fixes.md and WORK_HANDOFF.md for actual acceptance evidence and limits. 47 core commands and 74 targeted worker cases pass; browser retry/persistence, apply-resume and location checks pass.

## Professional one-button tailoring correction (2026-10-09)
Actual random Anduril Fort Collins job test: Generate both once created/saved both documents and exact URLs survived full hosted reload. User correctly rejected the resume as game-centered. Mechanical persistence passed; tailoring failed. Writer v5 adds employer-specific transferable evidence guidance, art-first tenure/cover and all-art employer checks, and severe-mistailoring semantic review using the full posting. Original titles/tenure and attribution safeguards retained. All 46 declared core commands pass after aligning valid numeric fixture with transferable-first framing; 56 targeted tests independently pass. Deployment/live retest pending. User rejects hybrid roles outside Fort Collins; DataHouse remains hidden intentionally, with no saved-record exception. See docs/qa/2026-10-09-professional-one-button.md.

Final live result: committed00fb4b5 writer/reviewer deployed in existing resume129/cover99 bundles; source read-back confirms v5 and original handlers/auth. Fresh Dutchie Generate both saved0: resume review rejection, cover final review incomplete; reload confirms neither persisted and error feedback disappears. One-button success remains open. Authorized worker diagnostics: Ashby saved a fact-safe but thin/generic resume and exact reload passed; Stripe blocked/no resume; Mercury one nonpersisting API test blocked/no resume and exposed false rejection of canonical project-management/transferable evidence. No approvals/submissions/replacements. Prioritized plan in docs/qa/2026-10-09-professional-random-audit.md: explicit role-evidence planning, separate factuality/relevance/fit, correct reviewer false negatives, durable actionable failures, full-pair acceptance. No more live retries in this audit.

## Live browser workflow limitation (2026-10-09)
Actual hosted browser check: DataHouse search has no card under Professional/All jobs after sync and reload. Current displayed global location rule hides Honolulu hybrid jobs, including saved records. Prior persistence/hash checks passed but do not establish DataHouse card/review accessibility. Stone Kite saved resume/cover previews and both Word download controls pass; application approval gate retained. No approvals, revisions or submissions. PDF/native Word inspection remains untested here. See docs/qa/2026-10-09-live-browser-workflow.md. Resolve saved-record accessibility policy before claiming complete DataHouse browser workflow acceptance.

## Private cover-letter save acceptance (2026-10-09)
User d authorized the recommended DataHouse cover-letter test. Actual Raven Private get_job/get_verified_profile succeeded; confirmed no existing letter before create-only save. Wrote a 199-word first-person letter grounded in canonical project-delivery, leadership, mentoring, cross-functional collaboration, internal meetings, workflow and technical evidence. No budget/certification/methodology/tool qualifications invented. Actual save returned saved=true/review_required=true; fresh get_document URL exactly matched.

Independent Supabase read confirms cover URL length2699, SHA256 2db3c979af463869ff76aaf4b48aecd5b072922a63ba30ea7f7716a3d4b77948, version2026-10-09T19:28:09.501+00:00. Existing resume hash remains 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779. No replacement, approval or employer submission. Worker hosted reload/render verification is the final pending check. Personal output/evidence remains ignored private/. No source-code change needed for this successful save.

## Protected-key ACL compatibility fix (2026-10-09)
Initial real enrollment failed because Windows PowerShell could not autoload Microsoft.PowerShell.Security for Set-Acl. Cache was not saved; the launcher disposed entered credentials. Replaced Set-Acl with direct .NET Windows file ACL APIs, preserving DPAPI/current-user-only protection and avoiding module-path incompatibility. Synthetic credential/retry/environment tests pass in both bundled PowerShell7 and Windows PowerShell5.1; actual protected enrollment remains pending repeat local entry. Corrected ignored cmd launcher to forward options on the PowerShell invocation rather than pause. Saved DataHouse resume/full hosted reload acceptance remains verified; no documents changed.

## Windows-protected tunnel reuse and saved-resume acceptance (2026-10-09)
User explicitly requested eliminating two-key entry on every restart. Launcher now stores Windows-DPAPI-encrypted PSCredentials in ignored private/raven-tunnel.credentials.clixml with current-user-only ACL, reloads without prompts, and reconnects up to five times. Explicit -ResetSavedKeys rotates the cache; malformed/foreign-user caches fail closed. Windows-only; no plaintext keys or command-line credentials, no secrets committed. Synthetic protected-key tests pass; Windows CI job added. No login service or scheduled startup added.

Actual saved DataHouse resume passed independent canonical audit/deterministic review and rendered HTML inspection. Fresh hosted Raven load and full reload each fetched the exact saved URL from real backend HTTP200 with Up to date sync; browser writes blocked and none attempted. Stored hash matches initial plugin save/readback; cover empty and user data preserved. Actual browser refresh acceptance is now verified.

The previous memory-only credentials were cleared. Updated one-time masked setup window opened; initial protected enrollment and live tunnel restart remain pending. Once enrolled, no repeated entry is needed. Keep public auth and paid PR58 unchanged. Saved resume remains review-required; no application submitted.

## Private tunnel document-save fix (2026-10-09)
Raven Private discovery and real list_jobs/get_job/get_verified_profile now succeed. Failed DataHouse resume had two problems: the canonical manual-import wrapper was passed to a bridge expecting its inner resume, and its Professional summary foregrounded game-art identity. Independent validation against live canonical evidence identified the framing rejection; corrected private draft passes validateDraft and reviewDocument. Candidate drafts/evidence remain local and excluded from commits.

Bridge now advertises grounded resume/cover JSON schemas and safely unwraps the exact raven-chatgpt-v1 envelope for the requested kind. Unknown wrapper keys/wrong format/missing requested kind are rejected. Existing factual, permission, version, create-only and replacement gates remain. Five new regressions bring bridge suite to 20 tests; all 46 local Node commands in test.yml pass, including secret scan and renderer checks. Prospective cover claims permit empty fact IDs as in the canonical writer.

Running tunnel still uses prior bridge code; corrected raw resume is compatible and being tested through the actual plugin. New code requires next runtime restart and tool refresh; no live reload or public deployment is claimed. No need to terminate the healthy runtime to test the corrected draft. Worker owns one create-only DataHouse save and independent readback. A separately created ChatGPT chat is directed to read-only plugin verification to prevent competing writes. Browser reload acceptance pending.

## Stale ChatGPT demo tool list (2026-10-09)
User reports a new chat exposes only server_info, echo and uppercase. Read-only local inspection confirms one active tunnel-client running private-mcp-stdio (not the embedded demo); loopback health returned live=true, ready=true. This establishes current runtime health, not successful ChatGPT Raven discovery or database credentials. Most likely the installed plugin retains the demo descriptors; also check that its tunnel/workspace matches the local Raven connection.

Next: keep the current Raven window running; open Raven Private plugin details and refresh tools/actions. Verify list_jobs, get_job, get_verified_profile, get_document and save_generated_document before opening a new chat and invoking list_jobs. If refresh is absent or still shows demo tools, create a fresh private plugin using the same intended tunnel and No authentication, verify the five tools, then install/select it. Do not restart the working runtime or retrieve in-memory credentials. No database call or document modification occurred in this investigation. Live read/save/full-refresh acceptance remains pending.

Official refresh guidance: https://developers.openai.com/api/docs/guides/custom-mcp-server .

## Private Raven plugin adapter (2026-10-09)
User reports successful ChatGPT server_info and echo demo calls through the private tunnel without Raven OAuth. Implemented scripts/private-mcp-stdio.mjs reusing the canonical MCP handler, plus scripts/start-private-raven.ps1 with masked in-memory runtime/server credential entry. No network listener or public auth change. Fixed allowed job IDs/expiry in ignored local configuration; read/profile/create only, no revision. Five adapter tests and all 47 workflow checks pass after synthetic scanner fixture correction. Actual Raven credentials/read/save/refresh remain pending. See docs/PRIVATE_RAVEN_TUNNEL.md.

## Active direction: private plugin through Secure MCP Tunnel (2026-10-09)
User clarified they require plugin functionality without Raven OAuth; manual JSON transfer is not the intended replacement. User reports Platform tunnel creation access and supplied a tunnel ID, retained only in the ignored local launcher. No public MCP authentication was disabled.

Official Windows tunnel-client v0.0.16 downloaded to ignored private/tunnel-client; SHA256 verified against official SHA256SUMS. scripts/start-private-tunnel-test.ps1 accepts a restricted runtime key using a masked prompt, passes it in process environment and restores it on exit; no key file or command-line secret. Launcher syntax verified. private/Start-Raven-Tunnel-Test.cmd supplies the user's tunnel ID locally.

Next: user creates an OpenAI runtime key restricted to Tunnels Read + Use and enters it directly in the local launcher. Run harmless embedded stateless demo before granting Raven data access. Connect ChatGPT using Tunnel and No authentication, verify demo tool invocation and workspace association, then prepare the scoped Raven bridge. The demo is not running: runtime key entry is pending. Tunnel availability is user-reported; successful polling, no-auth discovery, Raven reads/saves and refresh persistence are unverified. No live data or credentials changed. PR58 remains inactive.

References: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels ; https://github.com/openai/tunnel-client/blob/main/docs/permissions.md .

## Active direction: use manual ChatGPT transfer (2026-10-09)
User called authentication a major blocker and instructed working around it or abandoning auth. Selected the existing Raven ChatGPT prompt/JSON import workflow; stop requiring MCP OAuth/password setup for current work. MCP authentication is not disabled and no public unauthenticated access is introduced. Do not resume OAuth onboarding unless requested.

Verified in source: document ChatGPT/Create ChatGPT prompt builds a grounded prompt; Import ChatGPT result accepts pasted JSON or a JSON file, validates it and saves through the existing document path. This route does not require the Raven MCP OAuth connection. Actual signed-in ChatGPT generation/import and refresh persistence are still unverified; source inspection is not live acceptance.

Next: open the target job in Raven, use ChatGPT on its resume, generate the requested JSON, then use Import ChatGPT result > JSON file on that same job and confirm the saved document after refresh. Preserve existing documents and review any replacement. Paid-provider PR58 stays inactive. Browser helper remains unavailable; no new login/email requests were sent.

## Password sign-in follow-up (2026-10-09)
Consent page now supports password sign-in alongside explicit email sign-in, plus a private Set password form for an authenticated account. Password fields are cleared after requests; no credentials are logged or persisted by Raven. OAuth approval, grant checks and token validation are unchanged.

User states they never defined a password. A read-only aggregate found one Auth account with a nonempty credential field; this does NOT prove the user knows a usable password. The owner must privately set their password in their existing signed-in consent tab, or complete one email sign-in after the rate limit clears. No password was set by the agent and no email was sent.

Verified locally: seven installed-Edge consent tests (synthetic auth, real pinned SDK load, mobile layout), mobile screenshot inspected, all 45 syntax/core/secret commands in test.yml, and whitespace checks. Local Node v24.19.0; CI remains Node 22. Codex sandbox shell still fails setup; approved alternate execution works. Existing signed-in browser automation was not retried. Actual ChatGPT tools remain unavailable in this chat; token issuance, tool retrieval/save and Raven reload remain unverified. Paid pilot PR58 is inactive; user data untouched.

## Live grant deployment (2026-10-09)
User authorized any Professional job. Provisioned one 30-day ChatGPT grant for DataHouse PROJECT MANAGER (JT-1789707628035): jobs:read, profile:read, documents:create; no revision permission. Existing resume/cover were empty and remain unchanged.

raven-mcp-v1 v4 ACTIVE loads service-only database grants when no explicit environment owner/grant configuration exists. Explicit environment configuration remains authoritative. Signature/issuer/exact-resource-audience/expiry validation occurs before database access. RPC checks singleton owner, matching unexpired/unrevoked grant, nondeleted OAuth client, active consent and matching current unexpired session every request. Private runtime identifiers are not committed.

Applied raven_mcp_oauth_grants and raven_mcp_oauth_hook_variable_fix migrations. Source: supabase/sql/raven-mcp-oauth-grants.sql. Direct hook testing found a PL/pgSQL variable ambiguity, fixed before user enablement. User reports public.raven_mcp_access_token_hook enabled/saved; configuration was not read directly through the connector.

Verified: 21 bridge/OAuth tests; all 44 core workflow commands; syntax/secret/whitespace checks; one live authorized consent/session and active grant; direct hook exact audience and other-claim preservation. Anon/authenticated cannot read grant tables or call RPC; Auth-admin execute privilege present. Connector cannot SET ROLE supabase_auth_admin; actual hook execution as that role remains unverified. Live metadata200/anonymous401. Transactional revocation probe returned expired requestState; subsequent read confirmed grant active. Do not count that probe as passed.

Pending: actual hook token issuance/refresh, authenticated ChatGPT tools, grounded generation/save and Raven reload, live revocation/expiry acceptance. Reconnect hit email rate exceeded. Avoid more sends; user asked to test existing Raven connection with list_jobs. No live document writes or employer submissions.

Browser automation remains blocked by Windows helper file-lock error32. Reset/restart attempts did not repair it. MXC unavailable. TinyFish installed but user reports auth errors. No browser workaround was verified.


## Portable AI handoff (2026-10-09)
Project orientation, architecture/key files, shipped capabilities, prioritized upcoming work, known defects versus unverified acceptance, continuation checks and a replacement-AI prompt are consolidated in docs/RAVEN_AI_HANDOFF.md. Current status/tasks/execution handoff remain authoritative for later changes.

## OAuth connection implementation (2026-10-09)
- Supabase OAuth discovery now returns 200 after user enablement; public JWKS contains ES256. Dynamic registration is now verified; discovery advertises the registration endpoint.
- Bridge 0.3.0 adds protected-resource metadata, 401 discovery challenges and strict JOSE signature/issuer/resource-audience/expiry/owner/client validation. Explicit server grants retain job/document permissions; Supabase OIDC scopes do not grant Raven access.
- A dedicated consent/sign-in page uses pinned SDK/SRI and public runtime configuration. Nineteen bridge/OAuth tests, all required core commands and four installed-Edge consent tests pass; mobile screenshot inspected.
- Published PR68 at a2936122841d60c668ae8ed6fd9ad81847edb45a; consent page returns 200 and raven-mcp-v1 v3 ACTIVE serves metadata 200. Anonymous/public-key/untrusted-signed-JWT calls each return 401. Final PR and main core/full-browser CI, Pages and both smoke runs pass. Evidence: docs/qa/2026-10-09-mcp-oauth-connection.md.
- Owner sign-in succeeded; direct database read confirms one email-verified Auth account. No OAuth client is registered yet; dynamic registration is enabled and verified. Explicit server-side owner/client/job grants, resource-audience token hook, authenticated saves and full ChatGPT/Raven reload acceptance remain pending. No live user documents were changed.

## Ready fixes published (2026-10-08)
- PR #67 merged at ba223bcbd019bf4918cbc9dc22ad20c2b4f8bea4, integrating #62/#63/#64/#65. Frontend v80/core v5/export v2, applied check icon, status/document containment and Word signature breaks are live.
- Listing migration applied and enrich v10 ACTIVE. Source-confirmed closures leave discovery; saved documents/application stages survive. Backend v55 unchanged.
- Combined/release core and full-browser CI, Pages and both production smoke runs passed; 14 hosted Edge smoke cases and hosted Word converter check passed. Extension ZIP 2.2.0 verified.
- Disposable live ATS fixture verified closure persistence, discovery exclusion and ingestion-reset protection. QA rows removed. All 378 existing job document/lifecycle digests match before/after.
- This release supersedes historical pending-publication notes for #55 and #62–#65 below. Device extension reload, signed-in ChatGPT transfer, native Word/browser-print visual acceptance and real employer-form acceptance remain outstanding. Experiments #58/#59/#61 remain pending; duplicate #66 closed without merging. Full evidence: docs/qa/2026-10-08-ready-fixes-release.md.

## UI pill containment and applied icon (2026-10-08)
- Review branch `codex/ui-pill-applied-icon` builds on main `74e852c`; PR #55 is already merged. Document controls wrap without shrinking adjacent labels, including ChatGPT preparation spinner/label states. Frontend v77 replaces the APPLIED card text with a green circular check, accessible name and tooltip; application-history presence rules are unchanged.
- Six widths (320/375/715/768/1024/1440), ten badge/history cases including fresh reload, and lifecycle/responsive checks pass in mocked Edge: 16 browser tests. The new busy-label regression fails against original CSS (Import becomes 48.75px tall) and passes after repair. Three core/workflow suites, syntax, secret scan and whitespace pass. Screenshots visually reviewed; see docs/qa/2026-10-08-ui-containment.md.
- Implemented and locally verified; merge/deployment and live-data visual verification remain pending. No runtime data or document workflow changes.

## Global job location preference (2026-10-07)
- All four tabs allow confirmed remote work anywhere; in-person and hybrid roles require an explicit nearby Colorado city/state work location.
- Nearby communities: Fort Collins, Loveland, Windsor, Timnath, Wellington, Laporte/La Porte, Bellvue, Severance, Greeley, Johnstown, Berthoud, Eaton and Ault. This is a city whitelist, not a measured driving-radius promise.
- Missing/broad locations and statewide/travel work are excluded. Employer headquarters and description mentions do not establish the work location.
- Shared eligibility applies before ranking, to cached backend discovery reads, and to browser saved/discovered lists. Stored records, documents and application history remain intact.
- Policy is shown globally in Options > Behavior. All 26 core regression commands, syntax, secret scan and whitespace pass locally; Published PR #57 at b6811ba26264ce27fc8e7c74387e608644421352. Hosted app v76/filter v3 and Options > Behavior policy verified; backend v55 ACTIVE, health healthy. Live results: Professional 56, Labor 47, Wildcard 47, Games / 3D 1, with zero global location violations. PR core/full-browser CI passed after adding a local location to the valid cached ATS fixture (69 of 70 passed before fixture correction). Release core, Pages and both production smoke runs passed; release full-browser job was still running at last check.


## Professional sales-role exclusion (2026-10-07)
- Published PR #56 at a88dab9f4993df9f6c8345493a476c7a4f92b5a4; frontend app v75 and track-filter v2 confirmed on GitHub Pages. raven-backend-v3 v54 is ACTIVE and reports healthy.
- Shared eligibility excludes direct selling titles and explicit personal selling responsibilities from Professional fresh ranking, cached reads, and browser lists. Non-selling operations, training, support and enablement remain eligible. Stored jobs, documents and application history are not mutated.
- Five focused regressions and all 25 local core workflow commands passed, plus syntax, secret scan and whitespace checks. PR core/browser checks passed. Release core, Pages deploy and both production smoke runs passed. A read-only live query returned 99 Professional results; zero were rejected by the new shared filter.
- Standing user authorization for future Raven pushes is recorded in AGENTS.md. User also explicitly approved this merge and deployment; prior approval blockers are resolved.

## ChatGPT resume prompt efficiency (2026-10-06)
- Manual ChatGPT prompts now use single-source minified evidence, matched supported keywords, and explicit must-preserve fact IDs for required Games / 3D roles. Suggested game resume length is 375–475 words. Local syntax/whitespace checks pass; this code is not deployed.
- Live Smile-Break prompt request failed with browser `Failed to fetch` before ChatGPT opened. Generator edge functions report ACTIVE, but request reachability was not verified. A one-off ChatGPT response took approximately 10 seconds and still had malformed keys and unsupported summary wording.
- A repaired JSON draft is available locally as `Smile-Break-Senior-Environment-Artist.json`; it was not imported into Raven or persisted. Existing saved resume and job status are unchanged. No end-to-end Raven generation or persistence is claimed.

## Applied-job badge (2026-10-06)
- Frontend v74 adds a prominent APPLIED tag on cards with application history. Verified locally in mocked Edge at 375px across Saved, Applied, Interview, and previously applied Ignored cases. Pushed to PR #55; GitHub core and browser checks passed. Merge/publication blocked by automatic approval review pending explicit authorization.

## GitHub delivery (2026-10-06)
- Resume downloads, JSON handoff, and action-label fixes are pushed on `codex/resume-download-json`, with PR #55 open. Push authorization blocker is resolved. Merge/deployment remain pending.

## Resume menu download (2026-10-06)
- Local frontend v73 adds Download resume to the populated resume's … menu, downloading Word directly. Mocked Edge verified absence before generation and direct download afterward. Publication remains pending.

## Action-button label containment (2026-10-06)
- Local CSS fix makes single-span labels use the full button grid and allows wrapping with growing rows.
- Local mocked Edge checks at 715, 375, and 320 pixels show every action label contained. Visually verified at 715px. GitHub push/publication remain blocked pending authorization recorded in WORK_HANDOFF.md.

## Resume downloads / ChatGPT JSON files (2026-10-06)
- Frontend v72 adds Word downloads, browser Save as PDF, and immediate JSON-file import.
- ChatGPT prompts request JSON attachments with job-bound request IDs. Extension 2.2.0 queues matching files for automatic validation/persistence, preserving newer documents and approval gating.
- Eleven focused unit checks and two mocked Edge browser checks pass. Signed-in ChatGPT attachment transfer and final export pagination remain unverified. Changes are on a working branch; publication is pending.

Last normalized: 2026-09-24

## Scope
Raven is a web-based job application tracker and application-assistant project. iOS and Android work are excluded. Final employer submission remains manual and requires user review.

## Canonical systems
- Code/project state: GitHub `shipitmyguy-ux/raven`
- Live application/job data: Supabase
- Public UI/runtime defaults: `runtime-config.json`
- Job-search defaults: `job-search-config.json`
- Portable backup/recovery: checksum-verified JSON via `scripts/export-raven.mjs` / `scripts/restore-raven.mjs`
- Device-local recovery: Raven Options -> Device backup
- Google Sheets: retired

## Active production services
- `raven-backend-v3`: ACTIVE v48
- `raven-enrich-v1`: ACTIVE v6
- `raven-commute-v1`: ACTIVE v5
- `raven-generate-v1`: ACTIVE v20
- `raven-generate-v2`: ACTIVE v21
- `raven-cover-v2`: ACTIVE v16
- `raven-control-v1`: ACTIVE v2
- `raven-bookmark-v1`: ACTIVE v2

## Verified production baseline
- GitHub `main` is canonical source.
- Supabase is the single live Raven data source.
- Saved-job read/add/update and search use `raven-backend-v3`.
- Tabs are filters; refresh searches all four tracks through one shared path.
- Remote classification is evidence-backed and shared across all tracks. A remote-search query is not itself remote evidence; LinkedIn roles are remote only when the posting/location explicitly says remote, while remote-only boards and structured ATS/workplace fields remain valid evidence.
- Games / 3D uses shared hard-eligibility gating before ranking: programmer/programming/engineer/engineering/developer titles and clearly non-English postings are rejected before persistence.
- Quick refresh is resource-bounded and preserves cached results during transient provider droughts.
- Deep search is resource-bounded; stale background runs are automatically closed.
- Latest production deep pass completed on all four tracks: Professional 67, Labor 78, Wildcard 48, Games / 3D 9.
- Backend health reports healthy: 18 tracked tasks, 0 active failures, 2 expected manual blockers, 14 historical/legacy records.
- A disposable production persistence QA job verified add -> status/document update -> fresh jobs read; the QA row was removed afterward.
- Generator acceptance: resume + cover letter across all four tracks returned 8/8 HTTP 200 responses using canonical fact selection.
- Generation budget/rate-limit behavior is verified.
- The repository secret scan, core regressions, targeted browser tests, and latest production smoke all pass.
- Production smoke runs automatically on each main push and after successful Pages deployment.
- Current malformed ATS saved/search-result counts are zero.

## Description/source quality
- Saved-job description audit is complete.
- Seven previously blank Lever postings were repaired through Lever's public posting-detail API and now contain multi-thousand-character descriptions.
- One saved Twin Atlas Environment Artist row remains short because the public careers page exposes the opening and location but no detailed job description.
- LinkedIn guest-page, Lever API, schema.org/JobPosting, visible-content, and metadata enrichment paths are available.
- Source diagnostics are stored in `raven_source_diagnostics` and surfaced through the control plane.

## Application Assistant
Implemented and browser-regression tested:
- exact resume/cover-letter approval gating,
- regeneration/revision invalidates approval,
- Application Profile and reusable non-sensitive Answer Memory,
- sensitive/legal/demographic/attestation/salary/sponsorship/CAPTCHA/assessment blocking,
- host-scoped, single-use, expiring application packets,
- Greenhouse, Lever, Ashby, Workday, iCIMS, Taleo, and generic adapter rules,
- conservative completion handoff,
- final employer submission remains manual.

Still requires real employer-site verification:
- approved resume/cover-letter attachment on current employer forms,
- adapter selectors against current live variants,
- completion detection on real confirmation pages,
- extension import on current LinkedIn/Indeed/Glassdoor/Monster and representative ATS pages.

## Post-application lifecycle
- Shared lifecycle transitions now use one frontend persistence path rather than separate bookmark/applied/ignore implementations.
- Applied jobs receive a configurable default follow-up date using the existing persisted `follow_up` field; the initial default is 7 days and can be edited from the job detail.
- Interview, Offer, Rejected, and Ignored are handled through the same lifecycle control. Rejected now has a proper pipeline bucket.
- Post-application stages suppress the old re-apply/bookmark controls that could otherwise move jobs backward accidentally.
- Strong browser-extension application completion signals route through the same lifecycle transition logic.

## Post-application platform
- `raven_job_events` is the shared timeline for lifecycle changes, recruiter contacts, follow-ups, assessments, interview activity, offers, rejections, notes, and external signals.
- `raven_job_snapshots` captures immutable application-time job/document state. Browser roles have no direct access; snapshots are service-role readable/insertable/deletable but not updateable.
- Applied jobs create an application snapshot automatically through the shared backend transition path.
- Interview mode surfaces the application snapshot, submitted documents, original posting, and activity timeline.
- Manual activity and future external adapters use the same signal/event path. High-confidence signals can advance lifecycle state; lower-confidence signals remain reviewable suggestions.
- Outcome analytics are derived from jobs + lifecycle events instead of maintained counters, with current breakdowns by source and track.
- Durable Raven backups now include lifecycle events and application snapshots.
- `raven-backend-v3` production v40 contains the shared transition, event, snapshot, signal, and analytics endpoints.

## Evidence coverage and outcome learning
- Expanded saved jobs now show deterministic verified-evidence coverage rather than a user-facing opaque fit score.
- Posting requirement candidates are compared only against the canonical skills/fact catalog and reported as supported, partial, or missing evidence; missing evidence is never rewritten into a qualification.
- Outcome analytics now include stable submitted-resume variants derived from the immutable application snapshot, in addition to source and track.
- Search ranking scores remain internal discovery signals and are not presented as candidate-quality judgments.
- Responsive regression coverage now exercises mobile, tablet, laptop, and desktop widths.
- Production `raven-backend-v3` v41 includes the evidence-coverage and resume-variant analytics endpoints.

## Backup / recovery
- `npm run backup:raven` creates the durable Supabase snapshot.
- `npm run backup:raven -- --scope=full` includes operational/audit history.
- Exports contain per-table and whole-payload SHA-256 checksums.
- Restore defaults to dry-run; destructive replace is explicitly confirmation-gated.
- `docs/BACKUP_RESTORE.md` documents the procedure.
- Device backup/restore exports/restores the relevant localStorage state plus local master-resume files stored in IndexedDB.

## Remaining closeout blockers
1. Real employer-site Application Assistant/extension verification, including file inputs and completion detection.
2. Decide whether Google Drive persistence for generated documents is desired; current Raven document persistence does not require Drive.

Everything else still listed in `TASKS.md` is either a continuing quality improvement or future product expansion rather than a current runtime/merge blocker.

## Job-card and generator repair (2026-09-23)
- Deployed 8c2dfe6 / e012c57: expanded cards expose View listing and Apply on site independently of document approvals; the assisted document-transfer action retains exact-file approval gating.
- Generation saves discovery results before invoking either generator and retrieves missing descriptions through the existing enrichment API. Concurrent preparation is shared; empty/expired descriptions produce actionable errors.
- Live browser verification: Akima Intermediate 3D Artist initially failed with missing-description errors in both generators. After deployment the job saved, its description populated, both documents generated with visible review previews, and both reopened after a full page refresh and completed backend synchronization.
- No document approval or employer submission was performed.
- Local syntax/focused execution checks passed. GitHub core regressions, targeted browser regressions (including the new discovery persistence and direct-link cases), Pages deploy, and both production smoke runs passed for e012c57.


## Natural document writing (2026-09-24)
- Replaced fact-selection/sentence-template generation with Gemini-authored prose from the complete verified candidate profile and posting, followed by a factual check and at most one repair.
- User chose the existing Gemini connection; no OpenAI API key or billing setup is required.
- Resume revisions now forward both the instructions and current document. Candidate identity/employment metadata remain canonical; failed drafts do not replace saved documents.
- Published code 538742ea9520a6a6be800d2771b38c70d806c5e2 with app.js v43 and modern-v5 document cache. All 16 mocked writer/handler tests, core/browser CI, Pages deployment and both production smoke runs passed.
- Live Akima and Campminder generation, natural-language revision, preview and saved-document reload checks passed. Final Campminder resume/cover used the source-reference gate; an invalid employer attribution was rejected without replacing the prior draft. Supabase persistence was also read back directly.
- Prior all-four-track generator acceptance above describes the previous engine. Current live prose checks cover these two real jobs; model factual review is not a guarantee, and drafts still require user review. No documents were approved or submitted.
- See docs/DOCUMENT_WRITING.md for the reuse evaluation, implementation, boundaries and acceptance procedure.


## Generate button repair (2026-09-25)
- Reproduced on live app.js v51: a fresh browser fails immediately with "Assign a master resume to this job track first." The handler is bound, but its obsolete device-local prerequisite prevents the request to the canonical-profile service. The brief spinner disappears and the only failure message was in the page header.
- Frontend generation now uses the existing server-side verified profile for both documents, including revisions and forced regeneration. No Work dependency, new service, backend deployment, or user-data migration.
- Errors remain next to the document button; the initial render is now inside the error boundary. Discovery-to-saved ID changes retain the active generation session.
- Local validation: core regression files and secret scan passed after correcting stale assertions from earlier tailoring releases. All 46 browser cases passed across the suite and focused reruns (mocked services, not live model quality).
- Deployed faac83fdce9230b3e33ff7df638d71870694217f through Pages run 36090447165. Core run 36090447168, browser run 36090447429, and production smoke runs 36090447195 / 36090468416 all passed.
- Live v53: Accurx Implementation Analyst regeneration and Omega Junior Digital Assets Operations Analyst Generate both showed progress and produced resume previews. Both reopened with identical preview text after full reload and completed backend sync. No v53 console errors were recorded.

Concurrent main updates a93af28/d89b38f/ff23f8a were reviewed before publication. Live v52 reproduces `DataError: Failed to execute get on IDBObjectStore: No key or key range specified` at getMasterResumeFile -> generateDocumentOnline -> generateForJob. The partial fix defaulted the master to an empty object and then read IndexedDB with an undefined ID. This patch removes that obsolete generation-file read entirely and preserves the concurrent stale-session recovery and preparing status.


## Reliable free generation (2026-09-27)
- Deployed resume v93 and cover v69: initial generation falls back to source facts on provider, validation, rate-limit or budget-service failures. Free AI has a 12-second generation deadline; revisions have 25 seconds and never silently return a fallback. Database/network overhead is additional.
- Production calls use only OpenRouter with its existing zero-price cap; no paid provider fallback.
- Fixed punctuation-sensitive grounding and revision prompt words removing factual anchors; revision instructions no longer exempt invented numbers, tools or entities. Shared checks reject selected unsupported tools, credentials and responsibility/outcome claims; this is not comprehensive semantic verification.
- Four live resumes and four covers returned 8/8 HTTP 200. Five used AI; three used source-fact fallback. Observed total times 3.8–23.3 seconds including cold/network overhead.
- 49 local core tests and secret scan pass. Browser tests could not launch locally: both installed Playwright versions received invalid browser-download archives. Browser persistence/PDF checks are not newly verified.
- Frontend labels fallback output and invalidates older generation cache. Existing failed-revision preservation remains in place.
- User now wants to discuss a low-click manual ChatGPT copy/paste workflow for both documents; not implemented yet.


## Cloudflare preparation and one-button generation (2026-09-27)
- Shared route now prefers Cloudflare, then the existing zero-price OpenRouter route. Cloudflare is gated on a successful account-subscriptions read proving a Workers Free plan; unknown/paid plans send no inference request.
- Actual account check returned HTTP 403, so Cloudflare inference is NOT active or live-quality verified. Existing token needs Billing Read permission (not Write) for the documented subscriptions API. No Cloudflare paid usage or billing change was made.
- Corrected Cloudflare native API request fields: max_tokens and direct JSON schema; configured a fixed supported Llama 3.3 70B model. Resume v95 and cover v70 deployed.
- Added Generate both / Finish documents using the existing generation, persistence, cache and review paths; existing documents are preserved.
- 53 local core tests and secret scan passed. Release a3a4b95 passed core CI, browser regression (including Generate both / Finish documents), Pages deployment and push production smoke. Live index serves app.js v60.
- Previous release e9fbb9a passed core/browser/Pages and both production smoke workflows. Previous live tonal QA: cat, formal, punchy succeeded; goofy failed LLM_CALL_BUDGET_EXHAUSTED; no saved documents overwritten by the API-only checks.


## Cloudflare permission verification (2026-09-28 UTC)
- User enabled Billing Read on the existing Raven token.
- Live authenticated-by-client-header GET raven-generate-v2 at 2026-09-28T04:26:57Z returned cloudflare_free.verified=true, reason=workers_free, primary_provider=cloudflare, provider_order=[cloudflare,openrouter]. No code or billing-plan change was needed.
- End-to-end Cloudflare output remains unverified. The first test artifact reported a network tunnel 403; automatic approval review then blocked further live QA because stored candidate background/job descriptions would be sent to external AI providers. No successful generation was observed in this session. Do not treat health verification as proof of model output.
- Next: obtain explicit approval for sending the verified candidate profile and selected job descriptions through Raven to Cloudflare and the existing free OpenRouter fallback for four document pairs and tonal-revision QA, then execute through an authorized available network path. Preserve saved documents.


## Authorized Cloudflare live QA (2026-09-28 UTC)
- User explicitly approved sending verified candidate background and selected stored job descriptions to Cloudflare and the existing free OpenRouter fallback for four document pairs and revisions. This supersedes the earlier approval blocker.
- API-only checks used Parallel Senior Environment Artist, Stone Kite Staff Environment Artist, VetJobs/Pinnacle Intermediate 3D Artist (location stripped from requested title), and Accurx Implementation Analyst. No saved documents were overwritten or submitted.
- All eight initial requests returned HTTP 200 and document objects. Resumes: 0/4 AI, 4/4 source-fact fallback (INVALID_DRAFT twice, PROVIDER_TIMEOUT once, REQUEST_BUDGET_EXCEEDED once). Covers: 3/4 Cloudflare AI, 1/4 source-fact fallback due to PROVIDER_TIMEOUT. Total observed latency 4.5–17.5 seconds; Cloudflare cover successes 13.3–16.0 seconds.
- Cat-voice revision returned HTTP 429 REQUEST_BUDGET_EXCEEDED with retryAfterSeconds=560 after three resume failures triggered the existing ten-minute circuit. Other three revision requests were not sent during this cooldown; tonal QA remains incomplete. Do not disable safety/budget guards merely to pass QA.
- Supabase request events confirm the two invalid drafts, two provider timeouts (one resume/one cover), and three cover successes. Health verification remains true for Workers Free.
- Cloudflare connectivity is demonstrated by real cover-letter output, but resume AI reliability is NOT accepted. Cover prose also needs editorial review (generic opening/repetition and an unverified personal enthusiasm claim in the Accurx draft); generation success is not editorial approval. Browser persistence/PDF testing was not performed in this API-only pass.
- Next: diagnose invalid-draft validation with bounded diagnostics and address timeout behavior, then rerun resumes and all four tonal revisions after the normal cooldown. User authorization for these provider/data transfers persists.


## Structured writer repair (2026-09-28 UTC, verification underway)
- Live diagnostic on resume v96 confirmed INVALID_DRAFT: wrong number of bullets for Highwire Games. The retired plain-text writer required exact line counts; the inference connection was working.
- Removed the separate initial resume writer. Initial resumes, covers, and revisions now share the structured full-profile writer and evidence validator. Identity, dates, employers, education, and job-location exclusions retain existing rendering behavior.
- One draft plus one repair matches the two-call router ceiling. Repair requests return only rejected passages and cannot overwrite valid passages. Initial drafts may use cited source text only for unrepaired passages, clearly marked as mixed output; failed revisions preserve the saved document.
- Initial/revision generation deadlines are 40/45 seconds, excluding profile/database/network overhead. Rate limits and free-plan/zero-price checks remain intact. Validation rejections consume quota but do not count as provider outages.
- All core regression files and 42 focused tests passed. First live repair pass v97/v71: 3/4 resumes AI, one timeout fallback; 4/4 covers had AI prose, two with one source-fact passage. Whole-document revision repairs still timed out, prompting passage-only repairs.
- Latest passage-only repair requires final live validation after the existing outage cooldown naturally expires. No cooldown records were reset; no saved documents were overwritten.


## Final bounded repair verification (2026-09-28 UTC)
- Deployed resume v103 / cover v76. Current frontend app.js v61 / modern-v13-structured-writer; core repair commit 1b64a8d passed core CI, browser regression, Pages deployment, and both production smoke runs.
- Confirmed root causes: exact bullet-count rejection in the retired parser; full-document repairs exceeding deadline; missing mandatory history; invalid employer references/attribution; and non-game framing errors being discovered only after an earlier passage was repaired.
- Final source additionally constrains experience IDs to canonical IDs, collects framing errors alongside passage errors, restores omitted required roles with canonical source facts, and replaces an unrepaired misattributed initial bullet with that employer's own verified source text. These recoveries are marked as source_fact_passages; revisions never use them.
- Live initial results across the final batch and focused corrective retests: Parallel resume Cloudflare/no source passages 36.0s; Stone Kite resume Cloudflare/no source passages 29.8s; VetJobs/Pinnacle resume Cloudflare/no source passages 31.4s; Accurx resume Cloudflare/one source-fact bullet 29.9s. These are incremental retest results, not a claim that all four passed in one run on v103. No full-document fallback remained in the final result for any of the four jobs.
- Latest cover batch: 4/4 Cloudflare, no source-fact passages, 12.6–20.6s. Cat/goofy/formal/punchy revisions: 4/4 Cloudflare with obvious requested tones, 29.0–37.5s, no source fallback. Canonical employer/role/date sequences matched the prior draft.
- Revision limitation: the tests requested summary-only edits, but wording elsewhere also changed. Tone behavior passes; exact section-only edit scope does NOT yet pass and must not be described as verified. Saved user documents were never overwritten; no approvals or employer submissions were performed.
- 45 focused execution tests and repository secret scan pass. Final source commit 3f70af4 passed Reusable core tests (including targeted browser checks) and Production Smoke Tests; earlier frontend commit 1b64a8d also passed the full Browser regression and Pages deployment. Production browser loaded/synced and v61 was served. Existing mocked browser persistence/failed-revision regressions passed; no new real-model PDF rendering or persistence write was performed.
- Rate quota, provider outage circuit, Workers Free validation, zero-price routing, and two-call ceiling remain in place. No circuit records were reset.


## Summary-only repair verified (2026-09-28 UTC)
- Live code: commit 172c7bd3796415fff34b45f900a8da8723b1629c, app.js v62, resume v104, cover v77, gateway v24, grounded-llm-v4. Summary edits now return a grounded patch; frontend replaces only the saved summary content. Every byte outside it remains unchanged. No document migration is required.
- Two real summary-only revisions succeeded: formal 16.0s and playful/cat 16.4s, both through the existing free OpenRouter fallback with two provider attempts and no source-fact fallback. These two checks do not establish Cloudflare-specific summary reliability. Earlier Cloudflare initial/cover results remain historical evidence.
- 50 focused execution tests, all 19 core regression files, syntax and secret scan pass. Commit 172c7bd passed Reusable core tests (36423786232), full Browser regression (36423786231), Pages deployment (36423786064), and both Production Smoke runs (36423786307 / 36423827738).
- Real persistence: created one disposable Raven QA job, saved prior live-model resume/cover HTML, changed only its summary using the new live patch, and read both documents back through fresh backend requests. Exact revised resume and unchanged cover matched. Existing user document values were compared before/after and all were unchanged. Direct database read confirmed the patch. The exact QA row was then deleted.
- Production UI loaded the QA job and restored the revised document URL after full reload and completed backend sync. This cloud browser blocks data-URL iframe previews under its organization policy; visual browser-preview acceptance is therefore limited. CI browser preview/save/reload checks passed.
- Fresh PDF check used the production HTML renderer with the prior live-model resume/cover and new formal summary. WeasyPrint output was two resume pages and one cover page; rendered pages were visually inspected with no clipping or overlap. This checks the HTML/PDF layout, not a fresh Chrome print-dialog export. Local Chrome execution was blocked by environment socket permissions; no protection was bypassed.
- No saved user document was overwritten or approved, and no application was submitted. Free-plan validation, zero-price routing, request quotas, provider circuits and the two-call ceiling remain intact.

Current scope: narrow edits are enforced for resume summaries. Multi-section and whole-document requests continue through the full writer; other individual sections do not yet have a surgical patch path. Employer-site extension acceptance and optional future ChatGPT handoff work are separate backlog items.

## Shipped-title spelling guard (2026-09-28)
- User reported a generated resume spelling Darksiders as “Darksiers.” The exact-entity evidence check did not match misspelled output; general fact-word overlap could still pass.
- Shared document writer now rejects a one-edit near miss in any verified shipped title, including all six known single- and multiword game names, requesting the existing bounded passage repair. Exact canonical spellings pass. This does not rewrite existing saved documents.
- Targeted writer tests pass (23/23). GitHub main includes the expanded validator and regression test at 310a0fa/78c5f30. Supabase resume v106 and cover v79 are ACTIVE with the new guard; the prior resume health GET returned ok. No new real-model typo reproduction was run.

## Richer resumes and evidence-based keywords (2026-09-28)
- Deployed writer changes to resume v113 and cover v85. Flexible two-page writing guidance replaces the 350–450-word / one-bullet caps; 3D history remains complete.
- Added supported keyword guidance and approved technique names, employer-scoped citation schemas, project-context/number corrections, and leadership-scope checks. Non-game skills exclude unrelated art tools unless requested by the posting. Optional highlights may be omitted.
- One reserved factual correction call prevents provider fallback from consuming the entire repair opportunity (maximum three provider calls; deadlines, free-only pricing and rate guards remain).
- 73 local regression checks and secret scan passed. Incremental live testing found several false rejections, then produced a 20-bullet AI art resume with all eight roles, zero source passages, in 23.7s; an implementation resume used AI with no source passages in 17.9s. Final polishing includes heading text extraction, unrelated art-skill filtering, and leadership scope; final acceptance follows below.
- Final v113 live art pass: OpenRouter, three provider attempts including factual repair, 22.6s, 20 bullets across eight roles (five Highwire), zero source passages. Rendered with the latest HTML layout to two visually checked PDF pages; extracted headings, contact details, skills and experience are readable. This is WeasyPrint verification, not a fresh native Chrome print-dialog export. Saved user documents were not changed.

## Studio context and document corrections (2026-09-28 MDT)
- Official-source studio context now feeds resume/cover writing with job posting primary. Nine exact studio identities registered; ambiguous names (including Parallel) and unavailable pages safely skip research. Server-only cache retains successes 30 days and failures one day. Same-domain HTTPS redirects, response-size/time limits, and no candidate data or secrets in outbound website requests. Studio matches prioritize existing facts, never establish qualifications or an unannounced project.
- Skills render consistent title capitalization with brands/acronyms preserved. New generation cache modern-v15-studio-context; app v65/core v4.
- Duplicate cover paragraphs (case/spacing/punctuation normalized) are removed before output; too few unique paragraphs use existing repair. Oversized salutations default to standard greeting/closing without dropping valid body prose.
- Game resumes now render complete canonical Shipped Titles, including Six Days in Fallujah and The Lamplighters League. Cover letters enumerating two or more verified credits are supplemented with missing canonical titles. Single relevant project mentions remain tailored. Source fallback game resumes also retain the full list.
- Saved Stone Kite resume repaired for casing and complete credits; saved letter duplicate removed and missing credits added. Separated a misattributed workflow sentence from its Ark-specific sentence and removed blanket AAA label from its expanded title list. Other job documents unchanged. Database readback matched scoped updates.
- 81 local tests pass; secret scan passes. Live research refresh succeeded; AI resume 18.9s/OpenRouter/three calls including factual repair, zero source passages, all seven titles and eight roles. Production renderer produced two clean WeasyPrint pages with title list/casing inspected. Initial two cover attempts used source fallback (provider failure / incomplete passage outside identified body failures); this is not AI acceptance. Final cover v87 retest succeeded in 12.8s, AI/OpenRouter/two calls, four unique paragraphs, no validation errors or source passages, and studio_context.status=cached.
- Deployed resume v115/cover v87. Cache migration applied. Security advisor reports only existing-category INFO RLS-without-policy notices, expected for server-only tables with anon/authenticated access revoked; see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Game / 3D relevance filtering (2026-09-28 MDT)
Root cause: game-track include terms used substring matching, so Unity matched community and game matched Burlingame. Eligibility had exclusions but no positive art-role requirement. Cached reads and saved/local UI rows bypassed ranking.

Shared track-filter.js now requires an environment/world/level/prop/material/texture/game/3D artist, modeler, world builder, Unreal generalist, or explicitly relevant art-lead role. Existing excluded technical/programming/character/VFX/community roles remain excluded. Relevant non-game 3D production remains eligible because this tab is Games / 3D. Game scoring uses phrase boundaries; other tracks retain their existing rules. Both fresh ranking and cached backend reads enforce eligibility; browser combined results filter saved and local discoveries as well. No job records or documents deleted or rewritten.

Backend v53 deployed. Live listResults returns 21 art-role results and excludes observed retail, sales, community-support, tutor, biotechnologist and game-design results. Regression suite: 85 tests pass, including actual rankCandidates collision tests. Frontend app v66 adds the shared script before app initialization. Work usage unavailable; proceeded normally.

Browser CI initially passed 61/62: its game-generation fixture incorrectly used an Implementation Project Manager title and was correctly hidden by the new rule. Fixture now uses Senior Environment Artist; a dedicated reload test verifies unrelated saved roles stay hidden while environment-art roles remain visible.

## Final document review gate (2026-09-28 MDT)
User authorized a stronger final-review gate after repeated material AI errors. Full documents now undergo deterministic whole-document checks plus a separate factual-review model call against the canonical profile. The reviewer checks employer/project/tool attribution, concrete unsupported claims, contradictions, recipient mistakes and repetition; it does not judge tone, length or keyword counts. Same-employer project context and verified lead roles may support normal paraphrasing. Similar wording is advisory unless exact repeated passages.

Local and reviewer issues are collected before a bounded passage repair, then the complete repaired document is reviewed again. Reserved reviewer budget is two calls, independent of the existing maximum three draft/repair provider attempts (maximum five calls total), within a 55-second generation deadline. Free-only pricing, Workers Free checks, rate quotas and cooldowns remain unchanged. Reviewer approval is not proof of truth; the reviewer may share the writing provider/model.

Production no longer returns source-fact fallback as a successful application document. Failed/unavailable review returns an error without replacing saved documents. Mixed/restored-source drafts also cannot become ready. Browser requires a passed factual review and checks rendered text for omitted expected content, duplicate paragraphs/bullets and placeholders before persistence. Generated drafts remain subject to explicit human approval. Old saved documents are not silently re-certified. Summary-only revisions review the changed summary and validate the whole rendered document for structural errors; they do not re-audit the old unchanged prose semantically.

Deployed resume v118 and cover v90. Frontend v67 and cache modern-v16-final-review invalidate unreviewed generation cache. 90 local tests pass, including cross-employer project attribution, preservation of good paragraphs during repair, missing Six Days in Fallujah, malformed/unavailable review and bounded review budgets. Browser tests add failure preservation/reload cases for unreviewed, fallback and rendered duplicate output. Live cover passed in 22.0s (3 provider attempts, separate factual review, no source passages). Initial live resumes were blocked for unsupported wording; early over-literal same-role project associations were corrected in reviewer policy. Final acceptance is recorded below. These attempts are not a measured reliability guarantee.

Final acceptance: app v68; resume v121 / cover v93 deployed (writer/reviewer logic matches tested v120/v92; final bundle additionally checks rendered education/highlight completeness). 90 local tests passed. Release e8a5ef9 passed core, all browser regressions including failed-draft preservation/reload, both production smoke runs and Pages. Live game resume passed in 39.2s with 17 bullets/eight roles/all seven shipped titles; professional resume passed in 27.2s. Both used five total provider attempts including independent review and successful bounded repair, zero source passages. Cover passed in an earlier live test in 22.0s/three attempts; the final cover retest hit a provider failure and was correctly blocked. Several earlier live drafts were blocked for material issues, over-literal review (subsequently corrected), or malformed repair responses (repair prompt simplified). These results do not establish a high generation success rate. Errors can still be missed or safe wording over-flagged; the review model may be the same as the writer.

The approved game resume was rendered with production HTML to two WeasyPrint pages and visually inspected; native Chrome print export was not re-tested. Existing user documents were not overwritten. Browser tests verify successful reviewed saves/reloads and rejection preserving prior documents. Final module includes expected education/highlight presence checks too. Summary-only edits preserve every byte outside the summary and have only summary-level semantic review.


## Focused v68 live reliability sweep (2026-09-29 MDT)
- Requested baseline: three resumes and three letters on app v68 / resume v121 / cover v93. Gate outcomes: 5 passes, 1 review-block, 0 provider failures. Two passing letters had confirmed unsupported claims; gate success is not factual acceptance.
- Seven corrective live calls followed. Reproduced review misses for external-partner history, personal technology/healthcare passion, historical Excel tasks, database ownership, an invented target profession, and a repeated sentence. Scoped writer/review fixes and tests also remove an overly broad truthful-transition framing block. No game-filter/provider-order work changed.
- Final source: 124b508ab1e6871d6ed9fee7e396a60e31ebfa84; ACTIVE resume v124 / cover v96; frontend remains v68. 68 targeted tests, final core/targeted-browser CI (36667098731), and production smoke (36667098510) pass.
- Final live pair: professional resume review-blocked for unsupported 17 (31.4s); letter passed after correcting unsupported technology passion (25.9s), with repetitive closing themes remaining. High generation reliability is NOT established. No further model trials after that pair.
- All 11 returned documents passed rendered completeness checks. Baseline game resumes retain eight roles/all seven credits and render to two pages; baseline letters/final letter render to one page. Native Chrome print and new live persistence were not verified. No saved documents, approvals or applications changed.
- Full outcomes, manual findings, false-positive limits, CI evidence and follow-up boundaries: docs/qa/2026-09-30-v68-reliability-sweep.md and adjacent JSON.


## Accurx number-review investigation (2026-09-30)
- Replayed the prior Accurx Professional request with an unchanged profile/posting. Diagnostic-only resume v125 reproduced the framing-then-unsupported-17 failure (event 356). Private traces show valid environment-art tenure retained in prose but its citation dropped by the framing repair. The numeric validator correctly rejected the missing citation; no transfer to an unsupported profession occurred in this replay.
- Deployed resume v126 from `b40692ea51f7c46751580c179a24a5c7c16151a6`: private request-linked numeric evidence traces and explicit repair citation obligations. No automatic citation attachment or numeric/profession safeguard relaxation. Cover v96 and frontend v68 unchanged.
- 74 targeted local tests, core/targeted-browser CI 36754731600, and production smoke 36754731548 pass. Public responses do not receive the new private trace data.
- Live verification event 357 did not repeat the number error but was blocked for repeating the headline. It does not establish successful generation or reliable model citation retention. Do not broaden this fix to duplication or repeat the prior sweep.
- Two generation requests total; all saved-document checksums across 368 rows and Accurx's stored track/last-updated value unchanged. Full evidence and limits: docs/qa/2026-09-30-accurx-number-review.md.

## ChatGPT prompt handoff (2026-09-30)
- Frontend v71 carries the complete prompt in ChatGPT's `q` link instead of opening its bare homepage. Clipboard backup remains available, and blocked pop-ups are reported accurately.
- Four focused handler tests pass (long/unicode prompt preservation, clipboard denial, popup blocking, request failure); syntax and whitespace checks pass. Actual signed-in ChatGPT composer prefill is not verified here and may depend on ChatGPT handling the link.


## Word and PDF export inspection (2026-10-08)
- [x] Reproduce and fix Word export joining a cover-letter closing to its signature; preserve HTML breaks as OOXML line breaks.
- [x] Render actual Word exports with LibreOffice and current HTML/PDF with WeasyPrint: two-page resume and one-page letter, every source block present, all final page images clean.
- [x] Pass all existing core regression commands, added line-break unit check, syntax, secret scan and whitespace.
- [ ] Run new browser export regression in CI and verify live download/native Word/browser print after integration. No deployment by this worker.
- Evidence and precise acceptance limits: docs/qa/2026-10-08-document-exports.md.
2026-10-08: PR63 narrowed to independently reproduced Ignored status pill collapse (16px width/~80px height); available width corrected. Applied icon and busy document-control containment are owned by parallel worker PR64; duplicate icon change removed here. Initial PR63 core/browser CI passed; revised four-width status-only CI pending. No deployment.
2026-10-08 isolated QA worker: PR62 line-break preservation and initial PR63 containment pass core/browser CI. PR63 is now status-pill-only to avoid duplicating parallel PR64 document controls/Applied icon. Source-confirmed closure implementation is on `fix/source-confirmed-closure`: availability independent of lifecycle, preservation tests and isolated PostgreSQL migration fixture pass; final closure core/browser CI pass at `8a9096f`, including legacy/out-of-region archived history. Authorized integration, production migration/deployment and live acceptance remain. See `docs/qa/2026-10-08-listing-availability.md`.

## Option 3 integration milestone (2026-10-08)
- Five tools: granted-job lookup, job/profile reads, current document/hash read, resume/cover save and scope/hash/version-protected replacement.
- Archive migration applied; transactional replacement, stale rejection and document independence verified on disposable database fixtures. Archives are service-only and included in backups.
- Deployed raven-mcp-v1 ACTIVE v1 (bridge 0.2.0); unauthenticated requests verified 401. Actual authenticated MCP saves and ChatGPT connection remain unverified.
- 15 bridge tests, all 27 core commands, renderer/syntax/secret/whitespace checks passed.
- Connected Drive verified; existing NetBox Labs resume PDF copied unchanged and metadata-read back in private Raven Applications folder. Automatic Drive synchronization is not implemented.
- Blocker: Supabase OAuth server disabled, no owner Auth user, no exposed secure-settings/secret provisioning operation. Standards-compliant OAuth/consent and account activation remain necessary.


## Apply on site resume trigger (2026-10-08)
- App v81: native employer link opens immediately; scheduled resume-only preparation reuses existing writer, job preparation and persistence. No cover auto-generation or employer submission.
- Refreshes actual source description and saves discovery jobs first; empty/expired sources fail visibly. Existing resumes are preserved and repeated clicks share active generation.
- Six focused execution checks pass. Three browser tests added for save/reload, preservation and missing listing. Local Chromium download failed with invalid archive; browser tests and authenticated live generation/reload remain unverified.
- Existing frontend persistence is reused; no new cross-device transactional-save guarantee is claimed. The MCP bridge retains its separate CAS/archive gate.

## Live consent follow-up (2026-10-09)
User corrected and saved Authorization Path /raven/oauth-consent.html after the old /oauth/consent URL returned 404. User reports ChatGPT authentication succeeded. Direct database read confirms one active public dynamically registered OAuth client named ChatGPT. This verifies registration and user-reported authentication, not authenticated bridge access. Server owner/client/job grants, resource-audience hook and real tool read/save/reload acceptance remain pending. No tokens or private account identifiers are recorded.

## Merge authorization resolved (2026-10-09)
User explicitly authorized PR69 merge and reaffirmed that routine pushes never require another approval. PR69 merged at b344c2b71d40ad766f30adbf082a36382480e879. Prior merge approval blocker is resolved. No source changes since the passing CI; final premerge commit only recorded QA/publication state. Real ChatGPT list/read/save/reload remains pending.

## PR70 publication approved and deployed
User explicitly approved merging/publishing PR70. Merged at bb86e2b0fd35fb62e17cc9d9109c6e95b6fec388; the previous approval blocker is resolved. Pages run 37961312719, main core 37961312588 and first smoke 37961312686 passed. Hosted consent HTML returns 200 and contains the private password form. Full main browser 37961312723 and post-Pages smoke 37961362431 also passed. All release checks are green.

Next action: owner reloads their original signed-in consent tab and privately saves a password. If signed out, authenticate by email after its limit clears. Then reconnect ChatGPT and test actual Raven tools. No private password has been supplied to the agent; actual password setup, OAuth tool access and document save/reload remain unverified.

## Tunnel runtime verified (2026-10-09)
User entered the restricted runtime key privately and started the demo. Read-only local health verified live=true, ready=true, control-plane status=ok/state=polling, recent successful poll and zero consecutive failures. Demo startup probe succeeded. No dispatched requests or response deliveries yet; ChatGPT tool discovery/calls remain unverified. No Raven data is attached. Keep the test window running; next connect a personal custom plugin using Tunnel + No authentication and test server_info/echo before implementing Raven access. Local launcher uses a process-only PowerShell execution-policy override because the host blocks script files; persistent policy unchanged.

## Live verification result (2026-10-09)
Created chat Test Raven plugin loaded all five Raven Private tools. Its initial authorized create-only run retrieved job/profile, saved a truthful transferable-first resume using the inner object, then get_document returned matching persisted HTML. No invalid-payload retries; no existing document replaced. Save version 2026-10-09T18:04:49.929+00:00. Parent independent Supabase read confirms resume length 6781 and SHA256 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779, matching chat readback. Cover remains empty. Local worker observed existing resume and correctly did not write another draft. Resume remains human-review-required; no approval or employer submission.

Later plugin calls returned Session terminated. Local inspection found no tunnel-client process and prior loopback health port unavailable. Current tunnel is stopped; stopping it does not remove the saved document. Cause of shutdown unverified. Future connection requires restarting private/Start-Raven-Private.cmd and entering credentials privately. New schema/envelope code loads on that restart; refresh plugin tools afterward. No credentials extracted or persisted. Browser inventory exposed no apps/browsers, so full Raven UI refresh/visual acceptance remains unverified. Initial plugin save and fresh plugin readback plus independent database persistence are verified.

## Protected enrollment and live reconnect verified (2026-10-09)
Encrypted credential cache exists after owner's local enrollment. One tunnel-client is running; local health reports live=true/ready=true. Fresh actual Raven Private get_document succeeded after restart and returned the exact saved DataHouse hash 5d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779 and unchanged version 2026-10-09T18:04:49.929+00:00. No document writes. Previous initial-enrollment blocker is resolved. Prompt-free future starts are covered by synthetic tests; another real stop/start solely to test reuse was not performed. Hosted full reload/fact/render verification remains passed. Keep tunnel window running; future launcher starts use the saved encrypted cache. No approval or employer submission.

Final cover-letter acceptance: worker fresh hosted Raven load/full reload each returned real backend HTTP200 with exact saved cover SHA2562db3c979af463869ff76aaf4b48aecd5b072922a63ba30ea7f7716a3d4b77948 and unchanged resume SHA2565d7f835efac4e60ea92c379547861b9282f48ebbd484f3c7301e0c7a67981779. Both sync Up to date and cover cache retained. Actual stored HTML screenshot visually clean with complete paragraphs and separated closing/signature. No browser writes attempted. Cover save/readback/database/reload/render acceptance passed; no further writes needed. Evidence private/cover-reload-verification.json and DataHouse-ACTUAL-SAVED-cover.* ignored. Native Word/print-dialog acceptance remains separate.

## Professional evidence-plan fixes (2026-10-09)
Writer v6 maps posting duties to verified employer facts, separate general evidence and domain gaps; concrete evidence replaces generic summary filler. Reviewer reconciles only exact verified capabilities and original employer facts, retaining domain/tool/tenure safeguards and rejecting dominant unrelated art production. Frontend generation failures persist on this device through reload; zero-output status is explicit. All47 core commands and57 targeted regressions pass. Worker browser regression and deployment/live per-job comparison remain pending; no new live documents created yet.

Live v6 worker Mercury API returns200 but independent audit fails quality: unsupported data-analysis expertise, generic summary, potential cross-team execution scope inflation. Added exact/hyphenated data-analysis deterministic backstop and actual generic-summary regression with targeted repair;59 targeted regressions pass. Dutchie live pair saved0: resume network failure, cover uncited/unsupported17 numeric claim; no candidate returned, no quality acceptance. Credentials CI harness falsely propagated mock exit1 despitePASS; worker fixes tests-only success exit and verifies injected assertion failures still exit1 in PS5.1/7. Publishing/live quality verification remains open.

PR71 merged; hostedfrontend82 confirmed. Latest132/102 Mercury Generateboth savedboth and exactresume/coverURLssurvivedfullreload. Independentactualcoverauditfindsgrounded, substantiallyjob-specificletter; resumefailsqualitywith4/7artproduction, genericopening, unsupportedZenimaxefficiencyoutcome. Newv7initialProfessionalhistoryschemaselectstransferableemployers, guardsrejectwhole-documentartdominance/achievedefficiencyandunrelated-highlightgenericbypass;72targetedtestsand47corecommandspass. Deployment/neweligible-jobacceptancepending. Originaldraftspreservedunapproved;noapplications.


Final publication check: location commit 69ae634 Pages, core tests and both production smoke runs passed; hosted filter4 and backend56 verified. Full browser regression remained in progress at handoff.
