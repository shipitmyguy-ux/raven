import { validateGenerationResult, type CanonicalGenerationContext, type StructuredResumeResult } from "../supabase/functions/_shared/generation-contract.ts";
import { TRACK_WRITING_POLICIES } from "../supabase/functions/_shared/track-policy.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const context: CanonicalGenerationContext = {
  jobId: "job-1", track: "Professional", profileVersion: "p1", postingSnapshotVersion: "s1",
  experienceIds: ["exp-1"], educationIds: ["edu-1"], evidenceIds: ["fact-1"]
};

const valid: StructuredResumeResult = {
  contractVersion: "1", operationId: "op-1", resultVersion: "r1", provider: "test",
  resume: {
    summary: "Verified transferable summary.",
    skills: ["Documentation"],
    experience: [{
      canonicalExperienceId: "exp-1", role: "Environment Artist", company: "Studio", dates: "2020–2024",
      bullets: [{ text: "Coordinated delivery across disciplines.", evidence: [{ id: "fact-1", kind: "experience" }] }]
    }],
    education: [{ canonicalEducationId: "edu-1", text: "B.F.A." }]
  }
};

assert(validateGenerationResult(valid, context).passed, "valid grounded result should pass");

const badEvidence = structuredClone(valid);
badEvidence.resume.experience[0].bullets[0].evidence = [{ id: "invented", kind: "experience" }];
assert(!validateGenerationResult(badEvidence, context).passed, "unknown evidence must fail");

const badExperience = structuredClone(valid);
badExperience.resume.experience[0].canonicalExperienceId = "invented-role";
assert(!validateGenerationResult(badExperience, context).passed, "unknown experience must fail");

assert(TRACK_WRITING_POLICIES.Professional.framing === "transferable", "Professional must use transferable framing");
assert(TRACK_WRITING_POLICIES.Wildcard.framing === "transferable", "Wildcard must match Professional framing");
assert(TRACK_WRITING_POLICIES["Games / 3D"].framing === "game_strict", "Games / 3D must stay strict");
assert(TRACK_WRITING_POLICIES.Labor.framing === "labor_concrete", "Labor must use concrete framing");

console.log("generation contract tests passed");
