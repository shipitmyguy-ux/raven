import assert from "node:assert/strict";
import {
  DEFAULT_POLICIES,
  verifyEducationLocation,
  applyGenerationPolicies,
  extractMasterText,
  extractCanonicalFactInventory,
  sanitizeCoverLetterProse
} from "../supabase/functions/raven-generate-v1/policy.js";

console.log("Running generation policy regression tests...");

// Test 1: Education entry with no location -> output location must be blank
{
  const rawDoc = {
    name: "Mike Rodriguez",
    contact: "mrodriguez@example.com | Fort Collins, CO | (555) 123-4567",
    summary: "Senior Game Designer with 8 years experience.",
    skills: ["Unreal Engine", "Level Design"],
    experience: [
      {
        role: "Senior Designer",
        company: "PUBG Studios",
        dates: "2020 - Present",
        location: "Seattle, WA", // Should be omitted by policy
        bullets: ["Designed multiplayer levels."]
      }
    ],
    education: [
      {
        degree: "BFA Game Design",
        school: "Savannah College of Art and Design",
        location: "", // Blank
        dates: "2014 - 2018"
      }
    ],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDoc, DEFAULT_POLICIES);
  assert.equal(processed.education[0].location, "");
  assert.equal(processed.experience[0].location, undefined, "Work experience location should be omitted");
}

// Test 2: Structured master resume object -> candidate location present ("Fort Collins, CO") but education location absent in master -> output location must still be blank ("")
{
  const structuredMasterResume = {
    name: "Mike Rodriguez",
    contact: "mrodriguez@example.com | Fort Collins, CO | (555) 123-4567",
    summary: "Game Designer based in Fort Collins, CO.",
    experience: [
      {
        company: "PUBG Studios",
        role: "Senior Designer",
        dates: "2020 - Present",
        bullets: ["Designed multiplayer levels."]
      }
    ],
    education: [
      {
        degree: "BFA Game Design",
        school: "Savannah College of Art and Design",
        dates: "2014 - 2018"
      }
    ]
  };

  const extractedText = extractMasterText(structuredMasterResume);
  assert.ok(extractedText.includes("PUBG Studios"), "extractMasterText must extract companies from structured object");
  assert.ok(extractedText.includes("Savannah College of Art and Design"), "extractMasterText must extract schools from structured object");

  const rawDocWithLeakedLocation = {
    name: "Mike Rodriguez",
    contact: "mrodriguez@example.com | Fort Collins, CO | (555) 123-4567",
    summary: "Senior Game Designer with 8 years experience.",
    skills: ["Unreal Engine", "Level Design"],
    experience: [
      {
        role: "Senior Designer",
        company: "PUBG Studios",
        dates: "2020 - Present",
        bullets: ["Designed multiplayer levels."]
      }
    ],
    education: [
      {
        degree: "BFA Game Design",
        school: "Savannah College of Art and Design",
        location: "Fort Collins, CO", // Hallucinated candidate location!
        dates: "2014 - 2018"
      }
    ],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDocWithLeakedLocation, DEFAULT_POLICIES, structuredMasterResume, "Seattle, WA");
  assert.equal(processed.education[0].location, "", "Leaked candidate location MUST be stripped to blank string even when masterResume is a structured object");
}

// Test 3: Cover letter prose sanitization & canonical fact inventory extraction
{
  const structuredMasterResume = {
    experience: [
      { company: "SoundAir Systems", role: "Maintenance Tech", bullets: ["Maintained HVAC units."] }
    ],
    education: [
      { school: "Colorado State University", degree: "BS Engineering" }
    ]
  };

  const inventory = extractCanonicalFactInventory(structuredMasterResume);
  assert.ok(inventory.companies.includes("SoundAir Systems"), "Fact inventory must extract companies");
  assert.ok(inventory.schools.includes("Colorado State University"), "Fact inventory must extract schools");

  const rawParagraph = "Relevant experience includes Collaborated with cross-functional teams and selected achievements include: Led workflow overhaul.";
  const cleaned = sanitizeCoverLetterProse(rawParagraph, inventory);
  assert.ok(!cleaned.includes("Relevant experience includes Collaborated"), "Must remove robotic lead-in");
  assert.ok(!cleaned.includes("selected achievements include:"), "Must remove raw lead-in header");
  assert.equal(cleaned, "My experience includes Collaborated with cross-functional teams and Led workflow overhaul.");
}

// Test 4: Explicit education location present in master resume -> exact factual location preserved
{
  const masterTextWithExplicitLocation = `
Mike Rodriguez
mrodriguez@example.com | Fort Collins, CO | (555) 123-4567

EDUCATION
Savannah College of Art and Design - Savannah, GA
BFA Game Design, 2014 - 2018
  `;

  const rawDocWithExplicitLocation = {
    name: "Mike Rodriguez",
    contact: "mrodriguez@example.com | Fort Collins, CO | (555) 123-4567",
    summary: "Senior Game Designer with 8 years experience.",
    skills: ["Unreal Engine", "Level Design"],
    experience: [
      {
        role: "Senior Designer",
        company: "PUBG Studios",
        dates: "2020 - Present",
        bullets: ["Designed multiplayer levels."]
      }
    ],
    education: [
      {
        degree: "BFA Game Design",
        school: "Savannah College of Art and Design",
        location: "Savannah, GA", // Explicitly present in master resume
        dates: "2014 - 2018"
      }
    ],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDocWithExplicitLocation, DEFAULT_POLICIES, masterTextWithExplicitLocation);
  assert.equal(processed.education[0].location, "Savannah, GA", "Explicit factual location MUST be preserved");
}

console.log("All generation policy regression tests passed successfully!");
