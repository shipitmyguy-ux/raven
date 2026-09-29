# Raven document writing

## Current architecture
Cloudflare Workers AI is first, with zero-price OpenRouter fallback. Cloudflare inference requires the existing successful Workers Free subscription check. No paid route or billing changes are allowed.

Initial resumes, cover letters, and revisions use `writeDocument` with the full verified canonical profile, evidence catalog, posting, and optional current draft/instructions. The model produces structured JSON. `validateDraft` restores canonical identity, employer metadata and education, rejects unsupported numbers/tools and employer attribution errors, and applies track rules. These checks are not comprehensive semantic proof; user review remains required.

The retired initial-resume plain-text parser required exact bullet counts and rejected otherwise useful output. The shared writer accepts variable bullet counts within bounds and uses the full evidence catalog rather than truncated summary citations.

## Repair and failure behavior
One draft and one repair use up to two draft-provider attempts plus one reserved correction call. For passage failures the repair schema permits only locally identified paths and the model returns just the replacement claims. Valid passages remain unchanged. Structural failures permit one full repair.

Only initial drafts may replace remaining failed passages with their own cited source facts. Such documents carry `source_fact_passages` and the frontend marks them as mixed output. A total service failure can still produce the existing source-fact fallback. Revisions must validate successfully and never silently become fallback documents.

Content failures are recorded as rejected and still consume rate quota; provider outages/timeouts remain failures for the existing circuit. No guard is disabled. Initial generation is bounded to 40 seconds and revisions to 45 seconds; database/network overhead is additional. Safe validation reasons are retained without storing model payloads or credentials.

## Presentation and persistence
Raven retains its modern HTML/PDF layout, two-page resume guidance, existing job/document persistence and exact-document approval flow. `modern-v13-structured-writer` invalidates older generation cache. No application is submitted or document approved by generation.

## Verification
Run core regression files, especially document-writer, document-reliability, cloudflare-free, and browser generation/revision persistence checks. Model mocks verify contracts and failure handling, not live writing quality. Use the same four real jobs for live comparisons; verify provider, fallback/mixed status, timing, output content, and obvious tonal revisions. Keep test output separate from saved user documents.

Deploy existing resume and cover functions with document-handler, document-writer, document-v3 (source fallback), llm-router, and cloudflare-free shared modules. Preserve existing verify_jwt=false and client/origin gates. No schema migration or credential change is required.

## Mandatory history and attribution recovery
Resume work-history IDs are restricted to canonical IDs in the output schema. Initial game resumes recover omitted required roles using the canonical employer facts, with mixed-output metadata. An initial bullet still attributed to the wrong employer after repair is replaced in full with a fact from its actual employer; citations are never simply relabeled on unsupported model prose. Non-game framing checks are included in passage diagnostics so one repair can address framing and factual problems together.

## Known verification limits
The original full-document revision path changed unrelated wording on summary-only requests. The scoped path below now avoids that behavior. Current live success counts in WORK_HANDOFF combine a full test batch with focused corrective retests; they are not a reliability guarantee. Fresh isolated live persistence, production reload of the saved document URL, and WeasyPrint PDF layout checks now pass; see WORK_HANDOFF for exact evidence and browser export limitations.


## Summary-only revisions (2026-09-28)
The frontend recognizes summary edits, including “rewrite only the summary” and “make the summary shorter,” and sends `revisionSection: "summary"`. It validates that the saved HTML has one editable summary before making a model call. The gateway forwards the scope; the writer returns only a grounded summary claim and permits one bounded repair. The handler returns `document_patch`, never a partial resume mistaken for a complete document. Existing clients and whole-document requests retain the full writer.

The frontend requires the matching patch response, escapes its text, and replaces only the original summary element's content. All bytes outside that content stay unchanged, including existing formatting, contact links, skills and work history. No saved-document migration is required. Unsupported legacy formats, missing patches, validation failures, and changed revision bases leave the saved document intact. A successful edit uses the existing persistence/retry path and invalidates document approval.

Only resume summaries have this narrow patch path. Multi-section and whole-document requests continue through the full writer. No other section-specific behavior is claimed.

## Richer evidence-based writing and keyword support (2026-09-28)
Games / 3D writing targets 550–700 words with flexible 3–5 bullets on strongest roles and 1–3 elsewhere, retaining the complete game chronology. Counts and keyword coverage are guidance rather than rejection rules. A supported-keyword catalog adds verified techniques from role facts and vetted equivalent phrases (e.g. PBR / physically based rendering). The posting cannot establish candidate qualifications. Non-game skills omit unrelated art tools unless the posting names them. The renderer uses continuous skills text and standard headings without letter spacing; caches now use modern-v14-evidence-rich.

Identity, employer metadata, dates, and education remain canonical. Work-history schema branches restrict citations to the selected employer. A verified project association can support other bullets from that same employer; game-title numbers are excluded from metric checks only when the title is supported. Leadership wording requires role-specific evidence. Style-only adjectives do not independently trigger rejection. These checks still are not comprehensive semantic verification.

Provider routing allows up to two draft attempts and, only if both were consumed before factual correction, one reserved repair on the last successful provider. This is at most three calls, still within the existing request deadline and free-only/rate guards. No cooldowns or quotas were reset. Existing source fallback behavior remains and is labeled; it is not AI-quality acceptance.

Verified skill overflow is de-duplicated, ranked by supported posting matches, and capped at 16 without rejecting the resume. Unknown skills still fail.
