# Natural document writing

## Decision
Raven keeps its existing Gemini connection. The user selected Gemini rather than setting up separately billed OpenAI API access.

The old generator used an LLM to select fact IDs, then assembled the final document with fixed sentences. The new generator gives Gemini the complete verified candidate profile and job posting and asks it to write the document. There is no fact-selection bottleneck and no sentence-template fallback.

## Workflow
1. Existing discovery preparation saves the job and recovers its description.
2. The shared writer receives the complete canonical profile (all roles/facts, transferable facts, skills, shipped titles, education), full available posting, and optional current document plus revision request.
3. Gemini writes the headline, summary, bullets, highlights or cover-letter paragraphs in a rendering schema. Identity, employment titles/dates/employers and education are copied from the canonical profile; selected skill names must be verified.
4. Hidden fact IDs link each authored passage to the full source catalog. Resume bullets may cite only their employer’s facts; employer-specific cover paragraphs cannot use unrelated or general facts. A separate Gemini request checks each sentence against its cited evidence for unsupported claims and attribution errors. One factual repair and recheck is allowed. Persistent failures return an error; the saved document is not replaced.
5. Raven's existing HTML rendering, persistence and exact-document approval flow remain in use. The modern-v5 cache version prevents old generated responses being reused.

The review dialog displays progress and errors; a failed rewrite leaves the old document and approval intact. Cover signatures are normalized to avoid duplicate names.

Default writing model: gemini-3.5-flash. Existing RAVEN_GEMINI_MODEL overrides it. RAVEN_GEMINI_FALLBACK_MODEL defaults to gemini-3.5-flash-lite. The existing Cloudflare gateway and direct Google endpoint remain available; retries and total model time are bounded. Responses report the actual writing and review models. No OpenAI credentials are required.

## Reuse evaluation
- [Resume Matcher cover-letter service](https://github.com/srbhr/Resume-Matcher/blob/main/apps/backend/app/services/cover_letter.py) supplies resume data and the posting directly to a writing model. Its [refinement workflow](https://github.com/srbhr/Resume-Matcher/blob/main/apps/backend/app/prompts/refinement.py) adds checks after writing. We use those architectural patterns, without its keyword-injection or automatic word-replacement passes.
- [Reactive Resume's editing prompt](https://github.com/reactive-resume/reactive-resume/blob/main/packages/ai/src/prompts/chat-system.md) uses structured resume edits and preserves history. Raven already has structured rendering and review, so adopting its entire application would add a migration without resolving the writing problem.
- No third-party implementation or prompt text was copied and no new package dependency was introduced.

## Boundaries
The canonical profile in raven_canonical_profiles remains the source of candidate facts. Master-resume assignments still control the existing frontend workflow; this change does not ingest new facts from an uploaded file or Drive link. Update the verified profile when the candidate's facts change. The writer receives all available stored facts, not the content of inaccessible source files.

The model sees the full available posting up to 60,000 characters; larger inputs are rejected rather than silently truncated. An incomplete source posting still limits tailoring. Fact-checking is model-based and cannot guarantee truth; candidate review is still required. Identity and employment metadata checks are deterministic.

## Verification and deployment
Run the core workflow and tests/document-writer.test.mjs. The writer tests use mocked model responses; they verify context, contract, factual-repair gating, refusal/incomplete handling, timeout/error boundaries, retry limits and request budgets. They do not establish prose quality.

Deploy both raven-generate-v2 and raven-cover-v2 with both shared modules, then raven-generate-v1. Keep their existing verify_jwt=false deployment setting and existing request/CORS gates; this change does not modify access policy. No schema migration or secret changes are required.

Acceptance requires real resume and cover-letter output, factual/editorial inspection, a revision using the prior draft, persistence after reload, and at least one career-pivot example. Record actual results in WORK_HANDOFF.md. Generation never submits an application or approves a document.
