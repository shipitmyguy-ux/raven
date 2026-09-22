import assert from "node:assert/strict";
import {
  DEFAULT_POLICIES,
  verifyEducationLocation,
  applyGenerationPolicies,
  extractMasterText
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

console.log("All generation policy regression tests passed successfully!");
