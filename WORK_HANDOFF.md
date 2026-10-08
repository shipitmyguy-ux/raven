# Raven execution handoff

Latest task: compare a direct OpenAI API route against ChatGPT-plan sign-in without enabling paid services.

## 2026-10-08 pilot
- Draft PR #58: https://github.com/shipitmyguy-ux/raven/pull/58 on `pilot/openai-chatgpt-options-20261008`.
- Added opt-in OpenAI provider inside the existing LLM router, server-side key and explicit provider-order double gate, default `gpt-5.6-luna`. Production config and Supabase deploy unchanged.
- New synthetic request-contract tests added to core CI. Core tests passed on initial PR run; browser checks still running at last check.
- Hosted ChatGPT-plan sharing requires provider approval; no legitimate OAuth sign-in test can yet be performed for hosted Raven. See `docs/OPENAI_OPTIONS_PILOT.md`.
- No paid model requests or actual resume generation have been executed. Do not merge or set a paid provider order without explicit authorization of the cost and private data flow.
- Next: check PR CI status, then if user authorizes paid API trial, set a spend cap and an Edge Function server-side secret for a gated real resume quality test; otherwise retain existing no-cost provider route.

## Previous handoff: Global location preference
- All four tracks permit confirmed remote jobs anywhere; in-person/hybrid require explicit nearby Colorado community work city. Unknown or broad locations are excluded before ranking, including cached and browser displays.
- Published PR #57 at b6811ba26264ce27fc8e7c74387e608644421352, hosted v76/filter v3 and backend v55 active, health healthy; core release, Pages and production smoke passed. Stored records unchanged.
