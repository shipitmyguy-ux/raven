import assert from "node:assert/strict";
import {
  DEFAULT_POLICIES,
  verifyEducationLocation,
  applyGenerationPolicies,
  extractMasterText,
  buildRequirementEvidenceMatrix,
  validateAndCriticGeneratedDocument,
  toJsonResumeFormat
} from "../supabase/functions/raven-generate-v1/policy.ts";

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

// Test 2: Candidate/current location present ("Fort Collins, CO") but education location absent in master -> output location must still be blank ("")
// (This was the real Raven bug: Fort Collins, CO leaking into SCAD education location)
{
  const masterText = `
Mike Rodriguez
mrodriguez@example.com | Fort Collins, CO | (555) 123-4567

SUMMARY
Game Designer based in Fort Collins, CO.

EXPERIENCE
PUBG Studios - Senior Designer (2020 - Present)

EDUCATION
Savannah College of Art and Design
BFA Game Design, 2014 - 2018
  `;

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
        location: "Fort Collins, CO", // Hallucinated / leaked candidate location!
        dates: "2014 - 2018"
      }
    ],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDocWithLeakedLocation, DEFAULT_POLICIES, masterText, "Seattle, WA");
  assert.equal(processed.education[0].location, "", "Leaked candidate location MUST be stripped to blank string");
}

// Test 3: Synthetic test: no education location in master resume, but generated output used school name as location
{
  const masterText = `
Jane Doe
jane@example.com

EDUCATION
University of Washington
BS Computer Science, 2018 - 2022
  `;

  const rawDocWithSchoolNameLocation = {
    name: "Jane Doe",
    contact: "jane@example.com",
    summary: "Software Engineer",
    skills: ["JavaScript", "Python"],
    experience: [
      {
        role: "Engineer",
        company: "Tech Corp",
        dates: "2022 - Present",
        bullets: ["Built APIs."]
      }
    ],
    education: [
      {
        degree: "BS Computer Science",
        school: "University of Washington",
        location: "University of Washington", // School name used as location!
        dates: "2018 - 2022"
      }
    ],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDocWithSchoolNameLocation, DEFAULT_POLICIES, masterText);
  assert.equal(processed.education[0].location, "", "School name used as location MUST be stripped to blank string");
}

// Test 4: Explicit education location present in master resume -> exact factual location may be preserved
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

// Test 5: Custom policy override (e.g. if education_location mode = preserve_exact)
{
  const customPolicies = {
    ...DEFAULT_POLICIES,
    education_location: { key: "education_location", mode: "preserve_exact" }
  };

  const rawDoc = {
    name: "Jane Doe",
    contact: "jane@example.com",
    summary: "Software Engineer",
    skills: ["JavaScript"],
    experience: [{ role: "Engineer", company: "Tech Corp", dates: "2022", bullets: ["Built APIs."] }],
    education: [{ degree: "BS CS", school: "MIT", location: "Cambridge, MA", dates: "2020" }],
    additional: []
  };

  const processed = applyGenerationPolicies(rawDoc, customPolicies);
  assert.equal(processed.education[0].location, "Cambridge, MA");
}

// Test 6: Text extraction helper test
{
  const textSample = "Candidate Profile\nName: Alex Smith";
  const b64DataUrl = "data:text/plain;base64," + Buffer.from(textSample).toString("base64");

  const extractedFromDataUrl = extractMasterText({ dataUrl: b64DataUrl });
  assert.equal(extractedFromDataUrl, textSample);

  const extractedFromText = extractMasterText({ text: textSample });
  assert.equal(extractedFromText, textSample);
}

// Test 7: Requirement-to-evidence matrix and keyword support test
{
  const normReqs = {
    responsibilities: ["Lead Unreal Engine game development."],
    requiredQualifications: ["6+ years C++ experience."],
    preferredQualifications: ["Houdini workflows."],
    keywords: { all: ["unreal", "c++", "houdini", "react"] }
  };

  const masterText = `
Experienced Game Engineer with 8 years C++ and Unreal Engine experience.
Shipped multiple AAA titles.
  `;

  const matrix = buildRequirementEvidenceMatrix(normReqs, masterText);
  assert.equal(matrix.supportedKeywordCount, 2, "unreal and c++ must be supported");
  assert.equal(matrix.unsupportedKeywordCount, 2, "houdini and react must be unsupported");
  assert(matrix.coverageRatio === 0.5, "coverage ratio must be 0.5");

  const unrealItem = matrix.items.find(i => i.requirement === "unreal");
  assert.equal(unrealItem.matchType, "direct");
  assert.equal(unrealItem.state, "supported");

  const houdiniItem = matrix.items.find(i => i.requirement === "houdini");
  assert.equal(houdiniItem.matchType, "none");
  assert.equal(houdiniItem.state, "unsupported");
}

// Test 8: Factual Validator and ATS Critic pass test
{
  const masterText = `
Alex Mercer
Senior Environment Artist at Epic Games (2020 - Present)
Unreal Engine, Maya, PBR Shaders
  `;

  const validDoc = {
    name: "Alex Mercer",
    experience: [{ role: "Senior Environment Artist", company: "Epic Games", dates: "2020 - Present", bullets: ["Built Unreal Engine environments."] }]
  };

  const reportValid = validateAndCriticGeneratedDocument(validDoc, masterText, ["unreal", "maya"]);
  assert(reportValid.valid === true, "Valid document must pass critic");
  assert.equal(reportValid.unsupportedKeywordsInjected.length, 0);

  const invalidDocWithHallucinatedTitle = {
    name: "Alex Mercer",
    experience: [{ role: "Chief Game Architect", company: "Epic Games", dates: "2020 - Present", bullets: ["Invented Houdini workflows."] }]
  };

  const reportInvalid = validateAndCriticGeneratedDocument(invalidDocWithHallucinatedTitle, masterText, ["houdini"]);
  assert(reportInvalid.valid === false, "Doc with hallucinated title/keyword must fail critic");
  assert(reportInvalid.titleViolations.includes("Chief Game Architect"));
  assert(reportInvalid.unsupportedKeywordsInjected.includes("houdini"));
}

// Test 9: JSON Resume format export with Raven provenance extensions
{
  const doc = {
    name: "Alex Mercer",
    contact: "alex@example.com | (555) 123-4567",
    headline: "Senior Environment Artist",
    summary: "Senior Environment Artist with 8 years experience in Unreal Engine.",
    skills: ["Unreal Engine", "Maya"],
    experience: [{ role: "Senior Environment Artist", company: "Epic Games", dates: "2020 - Present", bullets: ["Built Unreal Engine environments."] }],
    education: [{ school: "Savannah College of Art and Design", degree: "BFA Game Design", dates: "2014 - 2018", location: "" }]
  };

  const jsonResume = toJsonResumeFormat(doc);
  assert(jsonResume.$schema.includes("jsonresume"), "Schema must be JSON Resume");
  assert.equal(jsonResume.basics.name, "Alex Mercer");
  assert.equal(jsonResume.work[0]._raven.immutable, true);
  assert.equal(jsonResume._raven.provenance_enforced, true);
}

console.log("All generation policy regression tests passed successfully!");
