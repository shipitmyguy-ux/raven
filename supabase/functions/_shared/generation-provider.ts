import type { CanonicalGenerationContext, GenerateResumeRequest, StructuredResumeResult } from "./generation-contract.ts";

export interface GenerationProvider {
  readonly id: string;
  generate(request: GenerateResumeRequest, context: CanonicalGenerationContext): Promise<StructuredResumeResult>;
}

/**
 * Compatibility boundary for the existing raven-generate-v1 implementation.
 * The legacy generator remains production-owned until an adapter can translate its
 * output into StructuredResumeResult and contract tests prove persistence parity.
 *
 * New callers must depend on GenerationProvider, never on Cloudflare/OpenRouter/
 * Gemini/ChatGPT-specific routing.
 */
export type LegacyGenerationInvoker = (
  request: GenerateResumeRequest,
  context: CanonicalGenerationContext
) => Promise<StructuredResumeResult>;

export class LegacyGenerationProvider implements GenerationProvider {
  readonly id = "legacy-raven-generate-v1";
  constructor(private readonly invokeLegacy: LegacyGenerationInvoker) {}
  generate(request: GenerateResumeRequest, context: CanonicalGenerationContext) {
    return this.invokeLegacy(request, context);
  }
}
