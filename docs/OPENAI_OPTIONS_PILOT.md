# OpenAI versus ChatGPT plan integration pilot — 2026-10-08

## Goal
Evaluate a true Raven one-click resume flow without silently enabling paid model usage or modifying existing job/application records.

## Option 1: OpenAI API (test-only implementation)
- Added an `openai` provider adapter to the existing shared LLM router (same evidence, validation and document rendering pipeline).
- Explicit double gate: a server-only `RAVEN_OPENAI_API_KEY` secret **and** `RAVEN_LLM_PROVIDER_ORDER` containing `openai`. A key alone is never enough.
- Default model: `gpt-5.6-luna`; optional `RAVEN_OPENAI_MODEL` can select another supported model for a quality comparison.
- Uses Chat Completions structured JSON results and the existing factual review; credentials never go to the public browser.
- The current production provider order and all deployed Supabase functions remain unchanged.
- Zero-cost synthetic mock tests verify explicit opt-in, no-key refusal and the request/result contract.
- **Not verified**: live OpenAI authentication, actual model output quality, latency, application-provider billing, production document persistence, or PDF downloading. Those require a dedicated server-side key and controlled live tests. Never add a secret to GitHub, prompts or Raven browser configuration.
- Before live trial, establish an API spending cap, obtain authorization for charges and for transmitting candidate/profile data to OpenAI, deploy a gated backend staging instance, and run 1–2 controlled jobs. Preserve approved docs and make no automatic employer submissions.

## Option 2: Sign in with ChatGPT plan usage
- OpenAI's 2026-09-28 documentation supports eligible plan usage in open-source and local tools, and explicitly asks **remotely hosted applications** to request access before offering it.
- Raven is a remotely hosted GitHub Pages web app using Supabase backend, not a locally run desktop app. Its public-source status does **not** by itself permit the local-client OAuth flow.
- **Result**: eligibility is not demonstrated. No live OAuth/token-sharing pilot can be claimed or embedded in Raven without provider authorization. Do not try to bypass eligibility with a pretend localhost host or public token-storage scheme.
- Reference: https://developers.openai.com/siwc/token-sharing-open-source
- Access route: https://developers.openai.com/siwc/request-client-id
- Any accepted integration would need server-side credential handling, user grants, usage labeling and revocation, plus tests covering the hosted callback.
  
## Decision checkpoint
Option 1 has an isolated, testable adapter but is not production-enabled. Option 2 currently requires access approval. Prioritize a controlled API trial if the user chooses to enable and fund it; otherwise continue fixing the existing free generator and revisit option 2 after eligibility approval. One-click native PDF generation is separate work; existing browser Save-as-PDF remains as-is.
