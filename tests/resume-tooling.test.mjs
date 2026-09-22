import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const store = new Map();
const sandbox = { URL, window: {}, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../raven-core.js", import.meta.url), "utf8"), sandbox);
const core = sandbox.window.RavenCore;
import {
  buildRequirementEvidenceMatrix,
  validateAndCriticGeneratedDocument,
  toJsonResumeFormat,
  applyGenerationPolicies,
  DEFAULT_POLICIES
} from "../supabase/functions/raven-generate-v1/policy.ts";

console.log("Running 4-Track Resume Tooling Benchmark Suite...");

const candidateMasterText = `
Mike Rodriguez
mrodriguez@example.com | Fort Collins, CO | (555) 123-4567

SUMMARY
Senior Game Designer & Technical Operations Lead with 8 years experience in 3D realtime engines, team leadership, customer onboarding, project delivery, and facilities maintenance.

WORK EXPERIENCE
PUBG Studios — Senior Game Designer
2020 - Present
- Designed multiplayer 3D levels and realtime environment mechanics in Unreal Engine.
- Led cross-functional team of 6 artists and engineers to ship quarterly updates.

Uptick Tech — Technical Implementation Manager
2017 - 2020
- Managed technical onboarding for 40+ school district client accounts, lowering time-to-value by 25%.
- Facilitated user training sessions, documentation, project management, and data migration.

City of Fort Collins — Maintenance Specialist
2014 - 2017
- Executed physical equipment maintenance, groundskeeping, and safety compliance across city parks.
- Maintained detailed work logs and inventory records.

EDUCATION
Savannah College of Art and Design
BFA Game Design, 2010 - 2014
`;

const trackJobs = [
  {
    track: "Games / 3D",
    title: "Senior Environment Artist",
    company: "Eleventh Hour Games",
    description: `
Role focus:
Lead 3D environment art creation in Unreal Engine.
Build modular assets, shaders, and performant lighting.

Requirements:
6+ years realtime 3D environment experience.
Proficiency in Unreal Engine and PBR workflows.
`
  },
  {
    track: "Professional",
    title: "Implementation Manager",
    company: "Movable Ink",
    description: `
Role focus:
Guide enterprise customers through software platform onboarding and integration.
Deliver user training and workflow documentation.

Requirements:
Project management experience.
Strong client communication and onboarding track record.
`
  },
  {
    track: "Labor",
    title: "Technician I, Parks",
    company: "City of Fort Collins",
    description: `
Role focus:
Perform park maintenance, groundskeeping, and equipment repairs.

Requirements:
Experience with physical facilities maintenance, hand tools, and safety protocols.
`
  },
  {
    track: "Wildcard",
    title: "Customer Success Manager",
    company: "Daybreak Health",
    description: `
Role focus:
Manage school district accounts, staff training, and platform adoption.

Requirements:
Customer execution at scale, onboarding, and training experience.
`
  }
];

trackJobs.forEach((job) => {
  console.log(`Benchmarking Track: [${job.track}] - ${job.title}...`);

  // 1. Requirement Normalization
  const normReqs = core.normalizeJobRequirements(job.description);
  assert(normReqs.responsibilities.length > 0 || normReqs.requiredQualifications.length > 0, `Requirement extraction failed for ${job.track}`);

  // 2. Requirement-to-Evidence Matrix
  const matrix = buildRequirementEvidenceMatrix(normReqs, candidateMasterText);
  assert(matrix.supportedKeywordCount >= 0, `Matrix generation failed for ${job.track}`);
  assert(matrix.coverageRatio >= 0 && matrix.coverageRatio <= 1, `Coverage ratio out of bounds for ${job.track}`);

  // 3. Synthetic Generated Resume Evaluation
  const mockGeneratedDoc = {
    name: "Mike Rodriguez",
    contact: "mrodriguez@example.com | Fort Collins, CO | (555) 123-4567",
    headline: job.title,
    summary: "Experienced professional tailored for " + job.title,
    skills: matrix.items.filter(i => i.state === "supported" && i.requirementType === "keyword").slice(0, 8).map(i => i.requirement),
    experience: [
      {
        role: job.track === "Games / 3D" ? "Senior Game Designer" : (job.track === "Professional" ? "Technical Implementation Manager" : "Maintenance Specialist"),
        company: job.track === "Games / 3D" ? "PUBG Studios" : (job.track === "Professional" ? "Uptick Tech" : "City of Fort Collins"),
        dates: "2020 - Present",
        bullets: ["Delivered key projects on schedule with high quality."]
      }
    ],
    education: [
      {
        degree: "BFA Game Design",
        school: "Savannah College of Art and Design",
        location: "",
        dates: "2010 - 2014"
      }
    ]
  };

  // 4. Policy Enforcement & Factual Critic
  const processedDoc = applyGenerationPolicies(mockGeneratedDoc, DEFAULT_POLICIES, candidateMasterText);
  const criticReport = validateAndCriticGeneratedDocument(processedDoc, candidateMasterText, normReqs.keywords.all);
  assert(criticReport.valid === true, `Critic check failed for track ${job.track}: ${criticReport.issues.join("; ")}`);
  assert.equal(criticReport.titleViolations.length, 0, `Title pivot protection failed for track ${job.track}`);

  // 5. JSON Resume Export Compatibility
  const jsonResume = toJsonResumeFormat(processedDoc, matrix);
  assert.equal(jsonResume.basics.name, "Mike Rodriguez");
  assert.equal(jsonResume._raven.provenance_enforced, true);

  console.log(`  ✓ Track [${job.track}] passed: Keyword coverage = ${Math.round(matrix.coverageRatio * 100)}%, Title integrity = 100%`);
});

console.log("All 4 tracks passed resume tooling benchmark and provenance verification successfully!");
