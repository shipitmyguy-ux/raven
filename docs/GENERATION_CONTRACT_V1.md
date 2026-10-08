# Generation contract v1

This directory is the new provider-neutral boundary for Raven document generation.

- `generation-contract.ts`: request/result schema and deterministic provenance/schema validation.
- `generation-provider.ts`: provider interface plus a temporary compatibility wrapper for the existing generator.
- `track-policy.ts`: explicit writing policy. Professional and Wildcard intentionally share transferable framing.

The browser/renderer must not depend on provider-specific behavior. Provider internals may use ChatGPT/MCP, the existing free generator, or a future provider, but callers receive the same structured result.

## Validation boundary
LLMs own semantic drafting, relevance, tone and nuanced critique. Code retains authorization/ownership, canonical IDs, provenance, schema/version checks, idempotency/concurrency, persistence/readback, and deterministic renderer checks.

## Gemini
Gemini is not part of the target architecture. Do not add new Gemini-specific dependencies. Existing production routes are left untouched until the compatibility adapter and tests establish safe cutover; then dead provider-specific code can be removed.

## Option 3
The MCP bridge should adapt to canonical job/profile/document services and this structured document schema. It must not create a parallel datastore or couple itself to legacy writer/reviewer internals.
