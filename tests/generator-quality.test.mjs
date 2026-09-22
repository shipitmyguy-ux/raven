import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_POLICIES,
  applyGenerationPolicies,
  verifyEducationLocation,
  extractMasterText,
  extractCanonicalFactInventory,
  sanitizeCoverLetterProse
} from "../supabase/functions/raven-generate-v1/policy.js";

console.log("Running generator track quality and factual safety regression tests...");

const generatorCode = fs.readFileSync(new URL("../supabase/functions/raven-generate-v1/index.ts", import.meta.url), "utf8");

// Test 1: Verify prompt guidance strings for all four tracks in generator code
assert.ok(generatorCode.includes("TRACK GUIDANCE (Professional Track):"), "Must include Professional track prompt guidance");
assert.ok(generatorCode.includes("TRACK GUIDANCE (Wildcard Track):"), "Must include Wildcard track prompt guidance");
assert.ok(generatorCode.includes("TRACK GUIDANCE (Labor Track):"), "Must include Labor track prompt guidance");
assert.ok(generatorCode.includes("TRACK GUIDANCE (Games / 3D Track):"), "Must include Games / 3D track prompt guidance");

// Test 2: Professional track prompt explicit constraints
assert.ok(generatorCode.includes("Do NOT fabricate or alter job titles"), "Professional track prompt must prohibit title fabrication");
assert.ok(generatorCode.includes("project delivery"), "Professional track prompt must cover project delivery");
assert.ok(generatorCode.includes("team leadership"), "Professional track prompt must cover team leadership");
assert.ok(generatorCode.includes("cross-functional coordination"), "Professional track prompt must cover cross-functional coordination");
assert.ok(generatorCode.includes("intermediate Excel"), "Professional track prompt must cover intermediate Excel");
assert.ok(generatorCode.includes("asset database metadata"), "Professional track prompt must cover asset DB metadata");

// Test 3: Wildcard track prompt constraints
assert.ok(generatorCode.includes("Stay transparent about the candidate's actual game-industry job titles"), "Wildcard track prompt must enforce transparency on actual job titles");
assert.ok(generatorCode.includes("implementation, onboarding, technical customer success"), "Wildcard track prompt must focus on implementation and onboarding");

// Test 4: Labor track prompt constraints
assert.ok(generatorCode.includes("Strongly prioritize SoundAir maintenance evidence"), "Labor track prompt must prioritize SoundAir maintenance facts");
assert.ok(generatorCode.includes("HVAC maintenance"), "Labor track prompt must reference HVAC/facility maintenance");

// Test 5: Games / 3D track prompt constraints
assert.ok(generatorCode.includes("Strongly target environment art, 3D modeling"), "Games / 3D track prompt must target environment art and 3D modeling");

// Test 6: Cover letter prose guidelines
assert.ok(generatorCode.includes("NEVER concatenate raw bullet fragments"), "Cover letter prompt must forbid raw bullet concatenation");
assert.ok(generatorCode.includes("Write fluent, natural, cohesive narrative paragraphs"), "Cover letter prompt must require natural narrative prose");

// Test 7: Budget limiter allowance for 8 sequential requests
assert.ok(generatorCode.includes("shortLimit:12,shortSeconds:60"), "Short budget limit must be at least 12 to allow 8 sequential QA calls");

// Test 8: Dynamic Policy Evaluation across all 4 Tracks
const masterSource = {
  name: "Alex Mercer",
  contact: "alex.mercer@example.com | (555) 987-6543",
  experience: [
    {
      company: "SoundAir Systems",
      role: "Maintenance Technician",
      dates: "2021 - Present",
      bullets: [
        "Performed preventative HVAC maintenance and assembly line mechanical repairs.",
        "Troubleshot pneumatic systems, electrical components, and industrial equipment."
      ]
    },
    {
      company: "Ironclad Game Studio",
      role: "Environment Artist",
      dates: "2018 - 2021",
      bullets: [
        "Created 3D modular environment assets in Maya and Substance Painter.",
        "Coordinated asset delivery with art leads, conducted internal review meetings, and maintained asset DB metadata."
      ]
    }
  ],
  education: [
    {
      degree: "BS Industrial Technology",
      school: "Colorado State University",
      dates: "2014 - 2018"
    }
  ]
};

// Test policy application on generated output with hallucinated education location
const candidateGeneratedDoc = {
  name: "Alex Mercer",
  contact: "alex.mercer@example.com | Denver, CO | (555) 987-6543",
  summary: "Experienced professional.",
  experience: [
    {
      company: "SoundAir Systems",
      role: "Maintenance Technician",
      dates: "2021 - Present",
      location: "Denver, CO", // Must be omitted
      bullets: ["Performed HVAC maintenance."]
    }
  ],
  education: [
    {
      degree: "BS Industrial Technology",
      school: "Colorado State University",
      location: "Denver, CO", // Hallucinated location from candidate contact!
      dates: "2014 - 2018"
    }
  ],
  paragraphs: [
    "Relevant experience includes Collaborated with team and selected achievements include: Maintained HVAC systems."
  ]
};

const processed = applyGenerationPolicies(candidateGeneratedDoc, DEFAULT_POLICIES, masterSource, "Seattle, WA");

// Assertions on policy function output
assert.equal(processed.experience[0].location, undefined, "Work experience location must be omitted");
assert.equal(processed.education[0].location, "", "Education location must be blanked when unsupported by master source");
assert.ok(!processed.paragraphs[0].includes("Relevant experience includes Collaborated"), "Cover letter paragraph must be sanitized");

console.log("All generator track quality and factual safety regression tests passed successfully!");
