# Raven v68 live reliability sweep

Run September 29, 2026 MDT (September 30, 03:49–04:04 UTC). Baseline: `20bd6107dfee707041ad19a6af2f42a216357a98`, app v68, resume v121, cover v93. Production versions and served app version were checked before testing. Cloudflare Workers Free verification passed.

## Verdict

The requested six-call batch completed. Five requests passed the deployed gate, one was review-blocked, and none failed because of providers. **Gate success was not factual acceptance:** two passing cover letters contained confirmed unsupported claims. Corrective retests found further review misses. The final release closes the reproduced cases, but high generation reliability is still NOT established. The last professional resume remained blocked; the final letter passed after repair but still repeats themes.

## Original six calls — unchanged baseline

| Case | Track | Gate outcome | Seconds | Manual findings |
|---|---|---|---:|---|
| Accurx Implementation Analyst resume | Professional | Review-block | 40.0 | Initial framing rejection; final `INVALID_DRAFT` for unsupported number 17. No draft returned. |
| Accurx Implementation Analyst letter | Professional | Pass | 19.7 | Missed external-partner relationship history, personal healthcare/Tech for Good passion, and unsupported data-analysis/process-outcome wording. |
| Parallel Senior Environment Artist resume | Games / 3D | Pass | 39.7 | Eight required roles, nine bullets, seven canonical shipped titles, education and contact present. No material factual mismatch found in manual comparison. |
| Parallel Senior Environment Artist letter | Games / 3D | Pass | 21.3 | Missed invented historical Excel use for tracking progress and managing assets. |
| Stone Kite Staff Environment Artist resume | Games / 3D | Pass | 35.8 | Eight required roles, nine bullets, seven canonical shipped titles, education and contact present. No material factual mismatch found in manual comparison. |
| Stone Kite Staff Environment Artist letter | Games / 3D | Pass after repair | 24.6 | Initial unsupported-number diagnostic repaired. No exact duplicated passages or material attribution error found in returned text; future-facing capability language is not proof of prior duties. |

All returned baseline documents used Cloudflare, with a separate factual-review call and zero source-fact passages. Accurx is stored as Wildcard; this sweep deliberately requested Professional without changing its saved track. Stored descriptions and the current canonical profile were used, not reconstructed user history. These are QA fixtures, not job recommendations or applications. Calls went directly to the existing v2 generation endpoints without document persistence.

## Reproduced defects and scoped fixes

1. **Unsupported relationships, personal motivations and historical tool use passed review.** Added narrow deterministic checks for the observed external-partner history, unsupported healthcare/technology passion, and Excel task attribution. Added explicit writer/reviewer instructions against deriving these claims from posting requirements or unrelated profile facts. Tests preserve ordinary prospective interest and explicitly supported history.
2. **Database querying became database management.** A v122 professional retest invented asset-database management. Added a scoped ownership/administration check, with supported-history and prospective-learning exceptions; clarified writer/reviewer guidance about querying versus ownership.
3. **A repair invented the target profession.** A v123 repaired summary began “Implementation analyst,” although the verified work history contains no such role. Final review now rejects a target-title identity opening in a resume headline/summary unless that exact profession is verified. Explicitly seeking the target role remains permitted.
4. **A repair duplicated a sentence across different paragraphs.** The v95 letter repeated an entire substantive sentence, while paragraph-level equality checks and the model reviewer both passed it. Cover review now checks exact normalized sentences of at least 12 words across passages. The repair prompt requires a distinct purpose and preserves other valid passages. Merely similar themes remain advisory, consistent with the existing policy.
5. **False-positive framing rule.** Code inspection plus a regression reproduced a truthful transferable summary being blocked solely because it mentioned video-game background. The shared validator and passage diagnostics now permit source-industry context after transferable strengths; game-identity openings still receive the existing framing correction. This does not prove the unreturned live blocked drafts were false positives.

Changes are confined to `document-writer.mjs`, `document-review.mjs`, and their tests. No game-tab filtering, provider ordering, CI routing, quotas, cooldowns, paid providers, profile data, or saved application documents were modified. No approvals or submissions occurred.

## Corrective live calls — separate from baseline reliability

| Versions | Case | Outcome | Seconds | Result |
|---|---|---|---:|---|
| Resume v122 | Accurx resume | Pass | 25.5 | Original block cleared, but manual review found database-management overstatement. Not accepted as clean. |
| Cover v94 | Accurx letter | Pass | 19.6 | Original external-partner/healthcare claims removed; unsupported “passion for tech” remained. |
| Cover v94 | Parallel letter | Pass after repair | 23.6 | Invented Excel history removed; supported skills retained. |
| Resume v123 | Accurx resume | Pass after repair | 28.7 | Database-management wording removed; repair invented the target profession. Not accepted as clean. |
| Cover v95 | Accurx letter | Pass after repair | 26.0 | Unsupported passion caught and repaired; repair duplicated a substantive sentence. Not accepted as clean. |
| Resume v124 | Accurx resume | Review-block | 31.4 | Final `INVALID_DRAFT`: unsupported number 17 after framing repair. No document returned. |
| Cover v96 | Accurx letter | Pass after repair | 25.9 | Live diagnostic caught unsupported technology passion; returned letter removed it. No exact duplicated sentence/paragraph, no invented implementation history or database ownership. Still repetitive in its closing themes; not an editorial-quality guarantee. |

There were 13 authorized calls total: original six plus seven corrective verification calls. API gate totals across these different versions are 11 passes, two review-blocks and zero provider failures; **do not report 11/13 as a clean-document reliability rate**. Request-event IDs 343–355 independently confirm the sequence. Content rejections are recorded as HTTP 502 internally while the initial-generation API wraps them in HTTP 503 `FINAL_REVIEW_BLOCKED`; these are not provider outages.

The “17” failures cannot be conclusively labeled false-positive or correct semantic rejection: the public error includes diagnostics but not the rejected passage and its fact IDs. Seventeen years of environment-art experience is verified globally; extending that tenure to another profession or failing to cite supporting evidence can still be invalid. No number guard was relaxed on guesswork.

## Rendered completeness and validation

- All eleven returned documents passed the actual production `reviewRenderedDocument` check using HTML produced by the unchanged v68 renderer. The renderer was executed locally with its production skill-label formatter and an empty optional device-profile overlay. Returned text was compared against all expected fields. The failed requests have no document to render.
- Both baseline game resumes include Six Days in Fallujah and all other six canonical credits. Covers did not enumerate multiple shipped titles, so a complete credit list was not required. Professional resumes legitimately omit game credits. No placeholders or missing expected rendered fields were found.
- Baseline PDFs were produced from the production HTML with WeasyPrint: both game resumes are two pages; all three baseline letters are one page. Every baseline page was visually inspected, including education and shipped credits. The intermediate professional resume and final repaired letter were also visually inspected at one page each. Layout is complete; short second resume pages and repetitive prose are editorial limitations, not clipping.
- Native Chrome print was not newly verified: the local Playwright browser download returned invalid ZIP archives. No new live save/reload test was performed because these checks intentionally did not replace user documents. Existing persistence behavior is not newly claimed as live-verified.
- Final targeted tests: **68/68 passed**, including supported-history/prospective-language controls, the truthful-transition regression, bounded repair, invented target role, exact-sentence repetition, preserved valid passages and existing attribution/credit coverage. Syntax, diff whitespace and secret scan passed.
- Final source commit `124b508ab1e6871d6ed9fee7e396a60e31ebfa84`: Reusable core tests **36667098731 passed** (including targeted browser checks); Production Smoke Tests **36667098510 passed**. The first corrective release also passed core/smoke. No frontend deployment was necessary: app remains v68 and the browser-side rendered-check function is unchanged.

## Deployment and remaining limits

Source fixes: `65bce83c7dcce41d9cc6b122423a750939b23954`, `06b9b3046695bbfa8689f1bab98537eb63fdbc42`, `124b508ab1e6871d6ed9fee7e396a60e31ebfa84`. Final active services: **resume v124 / cover v96**. Every deployment originated from committed GitHub source and retained the existing client/origin access checks and `verify_jwt=false` configuration.

The final live pair verifies the updated rejection/repair behavior, not uniformly successful resume generation. All observed generation/review successes used Cloudflare; no fallback-provider reliability estimate is available. Exact regression replays catch the discovered mistakes, but differently phrased unsupported claims can still evade these scoped checks, and the factual reviewer may share the writer's model. Preserve explicit human review. No further model trials were run after the final pair.

Machine-readable outcomes, timings, service versions, request-event IDs and final-code replay checks: [2026-09-30-v68-live-results.json](2026-09-30-v68-live-results.json). Raw personal documents and canonical profile are deliberately excluded from the public repository.
