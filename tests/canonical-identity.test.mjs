import fs from "node:fs";
import vm from "node:vm";

const store = new Map();
const sandbox = {
  URL,
  window: {},
  localStorage: {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../raven-core.js", import.meta.url), "utf8"), sandbox);
const core = sandbox.window.RavenCore;

const assert = (ok, msg) => {
  if (!ok) throw new Error(msg);
};

// Test 1: High-confidence company recovery from LinkedIn URLs
const linkedinExamples = [
  { url: "https://www.linkedin.com/jobs/view/senior-level-artist-at-cloud-chamber-4148928371", expected: "Cloud Chamber" },
  { url: "https://www.linkedin.com/jobs/view/unreal-generalist-at-swaybox-studios-4148928371", expected: "Swaybox Studios" },
  { url: "https://www.linkedin.com/jobs/view/senior-environment-artist-at-cd-projekt-red-4148928371", expected: "CD Projekt Red" },
  { url: "https://www.linkedin.com/jobs/view/senior-environment-artist-at-epic-games-4148928371", expected: "Epic Games" },
  { url: "https://www.linkedin.com/jobs/view/senior-environment-artist-at-eleventh-hour-games-4148928371", expected: "Eleventh Hour Games" },
  { url: "https://www.linkedin.com/jobs/view/implementation-specialist-at-comploy-4148928371", expected: "Comploy" },
  { url: "https://www.linkedin.com/jobs/view/payroll-implementation-specialist-hcm-at-cbiz-4148928371", expected: "CBIZ" },
  { url: "https://www.linkedin.com/jobs/view/implementation-specialist-at-dealerbuilt-4148928371", expected: "DealerBuilt" }
];

for (const example of linkedinExamples) {
  const recovered = core.recoverCompanyFromUrl(example.url);
  assert(recovered === example.expected, `LinkedIn recovery failed for ${example.url}: expected "${example.expected}", got "${recovered}"`);
}

// Test 2: High-confidence company recovery from ATS URLs
const atsExamples = [
  { url: "https://boards.greenhouse.io/emotainizioengage/jobs/123456", expected: "EmotaInizioEngage" },
  { url: "https://jobs.lever.co/1840company/abc-123", expected: "1840 & Company" },
  { url: "https://jobs.ashbyhq.com/stripe/def-456", expected: "Stripe" },
  { url: "https://jobs.smartrecruiters.com/acme/ghi-789", expected: "Acme" },
  { url: "https://nvidia.wd5.myworkdayjobs.com/Careers/job/R123", expected: "Nvidia" }
];

for (const example of atsExamples) {
  const recovered = core.recoverCompanyFromUrl(example.url);
  assert(recovered === example.expected, `ATS recovery failed for ${example.url}: expected "${example.expected}", got "${recovered}"`);
}

// Test 3: Ambiguous company remains blank
const ambiguousExamples = [
  "https://www.linkedin.com/jobs/view/4148928371",
  "https://www.linkedin.com/jobs/view/senior-software-engineer-4148928371",
  "https://example.com/careers/job/1001",
  "not-a-valid-url"
];

for (const url of ambiguousExamples) {
  const recovered = core.recoverCompanyFromUrl(url);
  assert(recovered === "", `Ambiguous URL should stay blank: ${url}, got "${recovered}"`);
}

// Test 4: Existing nonblank company is preserved and never overwritten
const existingJob = { company: "Original Inc.", url: "https://www.linkedin.com/jobs/view/artist-at-cloud-chamber-4148928371" };
const normalizedExisting = core.normalizeJob(existingJob);
assert(normalizedExisting.company === "Original Inc.", "Existing nonblank company must not be overwritten!");

// Test 5: Exact duplicate URLs / posting keys collapse to same canonical identity
const jobA = { url: "https://jobs.lever.co/1840company/abc-123?utm_source=test" };
const jobB = { url: "https://jobs.lever.co/1840company/abc-123" };
const idA = core.getCanonicalIdentity(jobA);
const idB = core.getCanonicalIdentity(jobB);
assert(idA.postingKey === idB.postingKey && idA.postingKey === "lever:1840company:abc-123", "Exact duplicate URLs must collapse to same postingKey");

// Test 6: Same title/company with distinct ATS/job IDs remain distinct
const leverJob1 = { title: "Sales Operations Admin", company: "1840 & Company", url: "https://jobs.lever.co/1840company/job-id-1" };
const leverJob2 = { title: "Sales Operations Admin", company: "1840 & Company", url: "https://jobs.lever.co/1840company/job-id-2" };
const id1 = core.getCanonicalIdentity(leverJob1);
const id2 = core.getCanonicalIdentity(leverJob2);
assert(id1.postingKey !== id2.postingKey, "Distinct Lever postings must have distinct postingKeys!");
assert(id1.titleCompanyKey === id2.titleCompanyKey, "Distinct Lever postings at same company must share titleCompanyKey!");

// Test 7: LinkedIn distinct job IDs remain distinct
const liJob1 = { title: "Environment Artist", company: "Epic Games", url: "https://www.linkedin.com/jobs/view/senior-artist-at-epic-games-1111111" };
const liJob2 = { title: "Environment Artist", company: "Epic Games", url: "https://www.linkedin.com/jobs/view/senior-artist-at-epic-games-2222222" };
const liId1 = core.getCanonicalIdentity(liJob1);
const liId2 = core.getCanonicalIdentity(liJob2);
assert(liId1.postingKey !== liId2.postingKey, "Distinct LinkedIn job IDs must have distinct postingKeys!");

// Test 7b: SmartRecruiters and iCIMS distinct postings have valid posting keys
const smJob1 = { title: "Engineer", company: "Acme", url: "https://jobs.smartrecruiters.com/acme/1111" };
const smJob2 = { title: "Engineer", company: "Acme", url: "https://jobs.smartrecruiters.com/acme/2222" };
const smId1 = core.getCanonicalIdentity(smJob1);
const smId2 = core.getCanonicalIdentity(smJob2);
assert(smId1.postingKey === "smartrecruiters:acme:1111", `SmartRecruiters postingKey failed, got "${smId1.postingKey}"`);
assert(smId2.postingKey === "smartrecruiters:acme:2222", `SmartRecruiters postingKey failed, got "${smId2.postingKey}"`);
assert(smId1.postingKey !== smId2.postingKey, "Distinct SmartRecruiters job IDs must have distinct postingKeys!");

const icJob1 = { title: "Specialist", company: "TechCorp", url: "https://techcorp-careers.icims.com/jobs/9901/job" };
const icId1 = core.getCanonicalIdentity(icJob1);
assert(icId1.postingKey === "icims:techcorp:9901", `iCIMS postingKey failed, got "${icId1.postingKey}"`);
assert(icId1.employerSlug === "techcorp" && icId1.postingId === "9901", "iCIMS employerSlug and postingId must be extracted correctly");

// Test 8: analyzeCanonicalIdentity diagnostic reporting
const dataset = [
  // Missing company recovered
  { id: "1", title: "Artist", company: "", url: "https://www.linkedin.com/jobs/view/senior-artist-at-cloud-chamber-4148928371" },
  // Missing company ambiguous
  { id: "2", title: "Dev", company: "", url: "https://example.com/job/2" },
  // Exact duplicate pair
  { id: "3", title: "Manager", company: "Acme", url: "https://jobs.lever.co/acme/mgr-1" },
  { id: "4", title: "Manager", company: "Acme", url: "https://jobs.lever.co/acme/mgr-1" },
  // Same title/company collision across 3 Lever URLs
  { id: "5", title: "Sales Admin", company: "1840 & Company", url: "https://jobs.lever.co/1840company/s1" },
  { id: "6", title: "Sales Admin", company: "1840 & Company", url: "https://jobs.lever.co/1840company/s2" },
  { id: "7", title: "Sales Admin", company: "1840 & Company", url: "https://jobs.lever.co/1840company/s3" },
  // Cross-source duplicate (LinkedIn + Greenhouse)
  { id: "8", title: "UX Designer", company: "Figma", url: "https://boards.greenhouse.io/figma/jobs/999" },
  { id: "9", title: "UX Designer", company: "Figma", url: "https://www.linkedin.com/jobs/view/ux-designer-at-figma-888888" }
];

const report = core.analyzeCanonicalIdentity(dataset);
assert(report.totalJobs === 9, "Total jobs count mismatch");
assert(report.missingCompanyCount === 2, "Missing company count mismatch");
assert(report.recoverableCompanyCount === 1, "Recoverable company count mismatch");
assert(report.ambiguousCompanyCount === 1, "Ambiguous company count mismatch");
assert(report.exactDuplicatesCount === 1, "Exact duplicates count mismatch");
assert(report.titleCompanyCollisionsCount === 1, "Same title/company collisions count mismatch");
assert(report.crossSourceDuplicatesCount === 1, "Cross-source duplicates count mismatch");

console.log("canonical-identity targeted tests passed!");
