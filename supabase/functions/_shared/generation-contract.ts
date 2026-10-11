// Raven generation contract v1.
// Pure contract/validation module: no provider, database, renderer, or browser dependencies.

export const GENERATION_CONTRACT_VERSION = "1";

export type RavenTrack = "Games / 3D" | "Professional" | "Labor" | "Wildcard";

export interface GenerateResumeRequest {
  jobId: string;
  track: RavenTrack;
  profileVersion: string;
  postingSnapshotVersion: string;
  idempotencyKey: string;
}

export interface EvidenceRef {
  id: string;
  kind: "experience" | "skill" | "education" | "transferable" | "posting";
}

export interface ResumeBullet {
  text: string;
  evidence: EvidenceRef[];
}

export interface ResumeExperience {
  canonicalExperienceId: string;
  role: string;
  company: string;
  dates: string;
  bullets: ResumeBullet[];
}

export interface StructuredResume {
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: Array<{ canonicalEducationId: string; text: string }>;
  shippedTitles?: string[];
}

export interface GenerationValidation {
  passed: boolean;
  errors: Array<{ code: string; path?: string; message: string }>;
  warnings: Array<{ code: string; path?: string; message: string }>;
}

export interface StructuredResumeResult {
  contractVersion: "1";
  operationId: string;
  resultVersion: string;
  provider: string;
  resume: StructuredResume;
  validation?: GenerationValidation;
}

export interface CanonicalGenerationContext {
  jobId: string;
  track: RavenTrack;
  profileVersion: string;
  postingSnapshotVersion: string;
  experienceIds: string[];
  educationIds: string[];
  evidenceIds: string[];
}

export function validateGenerationResult(
  result: StructuredResumeResult,
  context: CanonicalGenerationContext
): GenerationValidation {
  const errors: GenerationValidation["errors"] = [];
  const warnings: GenerationValidation["warnings"] = [];
  const fail = (code: string, message: string, path?: string) => errors.push({ code, message, ...(path ? { path } : {}) });

  if (!result || result.contractVersion !== GENERATION_CONTRACT_VERSION) fail("contract_version", "Unsupported generation contract version.");
  if (!String(result?.operationId || "").trim()) fail("operation_id", "operationId is required.");
  if (!String(result?.resultVersion || "").trim()) fail("result_version", "resultVersion is required.");
  if (!String(result?.provider || "").trim()) fail("provider", "provider is required.");
  if (!String(result?.resume?.summary || "").trim()) fail("summary", "Resume summary is required.", "resume.summary");
  if (!Array.isArray(result?.resume?.skills)) fail("skills", "Resume skills must be an array.", "resume.skills");
  if (!Array.isArray(result?.resume?.experience) || !result.resume.experience.length) fail("experience", "At least one experience entry is required.", "resume.experience");
  if (!Array.isArray(result?.resume?.education)) fail("education", "Resume education must be an array.", "resume.education");

  const allowedExperience = new Set(context.experienceIds);
  const allowedEducation = new Set(context.educationIds);
  const allowedEvidence = new Set(context.evidenceIds);

  for (const [i, exp] of (result?.resume?.experience || []).entries()) {
    const base = `resume.experience[${i}]`;
    if (!allowedExperience.has(exp.canonicalExperienceId)) fail("unknown_experience", "Experience must reference a canonical profile experience.", base + ".canonicalExperienceId");
    if (!String(exp.role || "").trim() || !String(exp.company || "").trim()) fail("experience_identity", "Role and company are required.", base);
    if (!Array.isArray(exp.bullets)) fail("bullets", "Experience bullets must be an array.", base + ".bullets");
    for (const [j, bullet] of (exp.bullets || []).entries()) {
      if (!String(bullet.text || "").trim()) fail("bullet_text", "Bullet text is required.", `${base}.bullets[${j}].text`);
      if (!Array.isArray(bullet.evidence) || !bullet.evidence.length) {
        fail("missing_provenance", "Every generated experience bullet must cite verified evidence.", `${base}.bullets[${j}].evidence`);
      } else {
        for (const ref of bullet.evidence) {
          if (ref.kind !== "posting" && !allowedEvidence.has(ref.id)) fail("unknown_evidence", "Generated claim cites evidence outside the canonical profile.", `${base}.bullets[${j}].evidence`);
        }
      }
    }
  }

  for (const [i, edu] of (result?.resume?.education || []).entries()) {
    if (!allowedEducation.has(edu.canonicalEducationId)) fail("unknown_education", "Education must reference canonical profile data.", `resume.education[${i}].canonicalEducationId`);
  }

  if (context.track !== "Games / 3D" && (result?.resume?.shippedTitles?.length || 0) > 0) {
    warnings.push({ code: "non_game_titles", path: "resume.shippedTitles", message: "Professional, Wildcard, and Labor resumes should include shipped titles only when job-relevant." });
  }

  return { passed: errors.length === 0, errors, warnings };
}
