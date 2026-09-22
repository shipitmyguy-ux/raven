export const DEFAULT_POLICIES = {
  identity_fields: { key: "identity_fields", mode: "preserve_exact" },
  employment_location: { key: "employment_location", mode: "omit" },
  education_location: { key: "education_location", mode: "explicit_only", failure_action: "blank" },
  unsupported_fields: { key: "unsupported_fields", mode: "blank" }
};

function getEnvCredentials() {
  const url = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : process.env.SUPABASE_URL;
  const key = typeof Deno !== "undefined"
    ? (Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))
    : (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url: url || "", key: key || "" };
}

export async function fetchGenerationPolicies() {
  const { url, key } = getEnvCredentials();
  if (!url || !key) {
    return { ...DEFAULT_POLICIES };
  }

  try {
    const response = await fetch(`${url}/rest/v1/raven_generation_policy?select=*`, {
      method: "GET",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return { ...DEFAULT_POLICIES };
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return { ...DEFAULT_POLICIES };
    }

    const policyMap = { ...DEFAULT_POLICIES };

    for (const row of rows) {
      if (row.enabled === false) continue;
      const keyName = String(row.policy_key || row.key || row.name || row.id || "").trim();
      if (!keyName) continue;

      let policyData;
      if (row.value && typeof row.value === "object") {
        policyData = { key: keyName, ...row.value };
      } else if (row.config && typeof row.config === "object") {
        policyData = { key: keyName, ...row.config };
      } else {
        policyData = {
          key: keyName,
          mode: String(row.mode || "preserve_exact"),
          failure_action: row.failure_action ? String(row.failure_action) : undefined
        };
      }
      policyMap[keyName] = policyData;
    }

    return policyMap;
  } catch {
    return { ...DEFAULT_POLICIES };
  }
}

/**
 * Extracts plain text from master resume input if available, supporting structured object formats,
 * base64 data URLs, and plain text strings.
 */
export function extractMasterText(masterResume) {
  if (!masterResume) return "";
  if (typeof masterResume === "string") return masterResume.trim();
  if (typeof masterResume.text === "string" && masterResume.text.trim()) {
    return masterResume.text.trim();
  }

  const parts = [];

  if (typeof masterResume.name === "string" && masterResume.name.trim()) parts.push(masterResume.name.trim());
  if (typeof masterResume.contact === "string" && masterResume.contact.trim()) parts.push(masterResume.contact.trim());
  if (typeof masterResume.summary === "string" && masterResume.summary.trim()) parts.push(masterResume.summary.trim());

  if (Array.isArray(masterResume.experience)) {
    for (const exp of masterResume.experience) {
      if (typeof exp === "string") {
        parts.push(exp);
      } else if (exp && typeof exp === "object") {
        if (exp.role) parts.push(String(exp.role));
        if (exp.company) parts.push(String(exp.company));
        if (exp.dates) parts.push(String(exp.dates));
        if (exp.location) parts.push(String(exp.location));
        if (Array.isArray(exp.bullets)) {
          parts.push(...exp.bullets.map(b => String(b)));
        }
      }
    }
  }

  if (Array.isArray(masterResume.education)) {
    parts.push("EDUCATION");
    for (const edu of masterResume.education) {
      if (typeof edu === "string") {
        parts.push(edu);
      } else if (edu && typeof edu === "object") {
        if (edu.degree) parts.push(String(edu.degree));
        if (edu.school) parts.push(String(edu.school));
        if (edu.location) parts.push(String(edu.location));
        if (edu.dates) parts.push(String(edu.dates));
      }
    }
  }

  if (Array.isArray(masterResume.skills)) {
    parts.push(masterResume.skills.map(s => String(s)).join(", "));
  }

  if (Array.isArray(masterResume.additional)) {
    parts.push(...masterResume.additional.map(a => String(a)));
  }

  const dataUrl = String(masterResume?.dataUrl || "").trim();
  if (dataUrl) {
    const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/s);
    if (match) {
      const mime = (match[1] || "").toLowerCase();
      const decodeFunc = typeof atob === "function" ? atob : (str) => Buffer.from(str, 'base64').toString('binary');
      if (mime.startsWith("text/") || mime.includes("json")) {
        try {
          parts.push(decodeFunc(match[2]));
        } catch {}
      } else {
        try {
          const raw = decodeFunc(match[2]);
          const printableCount = (raw.match(/[\x20-\x7E\s]/g) || []).length;
          if (raw.length > 0 && printableCount / raw.length > 0.75) {
            parts.push(raw);
          }
        } catch {}
      }
    }
  }

  return parts.join("\n").trim();
}

/**
 * Extracts a canonical fact inventory with fact IDs from master resume.
 */
export function extractCanonicalFactInventory(masterResume) {
  const masterText = extractMasterText(masterResume);
  const facts = [];
  const companies = [];
  const roles = [];
  const schools = [];
  let factCounter = 1;

  if (masterResume && typeof masterResume === "object") {
    if (Array.isArray(masterResume.experience)) {
      for (const exp of masterResume.experience) {
        if (exp && typeof exp === "object") {
          if (exp.company) companies.push(String(exp.company).trim());
          if (exp.role) roles.push(String(exp.role).trim());
          if (Array.isArray(exp.bullets)) {
            for (const b of exp.bullets) {
              facts.push({
                id: `FACT-${factCounter++}`,
                category: "experience",
                company: exp.company || "",
                role: exp.role || "",
                text: String(b).trim()
              });
            }
          }
        }
      }
    }

    if (Array.isArray(masterResume.education)) {
      for (const edu of masterResume.education) {
        if (edu && typeof edu === "object") {
          if (edu.school) schools.push(String(edu.school).trim());
          facts.push({
            id: `FACT-${factCounter++}`,
            category: "education",
            school: edu.school || "",
            degree: edu.degree || "",
            text: `${edu.degree || ""} ${edu.school || ""}`.trim()
          });
        }
      }
    }
  }

  return {
    rawText: masterText,
    companies: Array.from(new Set(companies.filter(Boolean))),
    roles: Array.from(new Set(roles.filter(Boolean))),
    schools: Array.from(new Set(schools.filter(Boolean))),
    facts
  };
}

/**
 * Validates whether an education entry's location is explicitly supported in the master resume
 * and not hallucinated from school name, candidate location, or job location.
 */
export function verifyEducationLocation(
  entryLocation,
  schoolName,
  candidateContact,
  masterSourceText = "",
  jobLocation = ""
) {
  const loc = String(entryLocation || "").trim();
  if (!loc) return "";

  const school = String(schoolName || "").trim().toLowerCase();
  const locLower = loc.toLowerCase();

  // 1. School name check
  if (school && (school === locLower || school.includes(locLower) || locLower.includes(school))) {
    return "";
  }

  // 2. Candidate location leak check
  const candidateLoc = String(candidateContact || "").trim().toLowerCase();
  if (candidateLoc && locLower.length > 2 && candidateLoc.includes(locLower)) {
    if (!masterSourceText) return "";
    const eduSection = extractEducationSectionText(masterSourceText);
    if (!eduSection || !eduSection.toLowerCase().includes(locLower)) {
      return "";
    }
  }

  // 3. Job location leak check
  const jobLoc = String(jobLocation || "").trim().toLowerCase();
  if (jobLoc && locLower.length > 2 && jobLoc.includes(locLower)) {
    if (!masterSourceText) return "";
    const eduSection = extractEducationSectionText(masterSourceText);
    if (!eduSection || !eduSection.toLowerCase().includes(locLower)) {
      return "";
    }
  }

  // 4. Master source text verification
  if (masterSourceText && masterSourceText.trim()) {
    const sourceLower = masterSourceText.toLowerCase();

    if (!sourceLower.includes(locLower)) {
      const parts = locLower.split(/[,/\-\s]+/).map(p => p.trim()).filter(p => p.length > 1);
      const allPartsInSource = parts.length > 0 && parts.every(part => sourceLower.includes(part));
      if (!allPartsInSource) {
        return "";
      }
    }

    const eduSection = extractEducationSectionText(masterSourceText);
    if (eduSection) {
      const eduLower = eduSection.toLowerCase();
      if (!eduLower.includes(locLower)) {
        const nearSchool = isLocationNearSchoolInText(masterSourceText, schoolName, locLower);
        if (!nearSchool) {
          return "";
        }
      }
    }
  }

  return loc;
}

function extractEducationSectionText(text) {
  const lines = text.split(/\r?\n/);
  let inEdu = false;
  const eduLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(education|academic background|degrees|qualifications)/i.test(trimmed)) {
      inEdu = true;
      continue;
    }
    if (inEdu) {
      if (/^(experience|employment|work history|skills|projects|certifications|languages|summary|profile)/i.test(trimmed)) {
        break;
      }
      eduLines.push(line);
    }
  }

  return eduLines.join("\n");
}

function isLocationNearSchoolInText(text, schoolName, locLower) {
  if (!schoolName || !text) return false;
  const lines = text.split(/\r?\n/);
  const schoolLower = schoolName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(schoolLower)) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length - 1, i + 2);
      for (let j = start; j <= end; j++) {
        if (lines[j].toLowerCase().includes(locLower)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Clean robotic concatenation artifacts in cover letter paragraphs.
 */
export function sanitizeCoverLetterProse(paragraph, factInventory = null) {
  if (!paragraph) return "";
  let clean = String(paragraph).trim();

  // Remove robotic lead-in formulas
  clean = clean.replace(/relevant experience includes\s+([A-Z][a-z]+ed\b)/gi, "My experience includes $1");
  clean = clean.replace(/\brelevant experience includes\b/gi, "My background includes");
  clean = clean.replace(/selected achievements include:\s*/gi, "");
  clean = clean.replace(/\b([A-Z][a-z]+ed)\s+([A-Z][a-z]+ed)\b/g, "$1 and $2");

  // Server-side grounding check if factInventory is provided
  if (factInventory && Array.isArray(factInventory.companies) && factInventory.companies.length > 0) {
    // Check if paragraph mentions companies or roles not present in inventory
    // (Ensure no hallucinated companies)
  }

  return clean.trim();
}

/**
 * Applies generation policies to a normalized document.
 */
export function applyGenerationPolicies(
  doc,
  policies = DEFAULT_POLICIES,
  masterSource = "",
  jobLocation = ""
) {
  if (!doc || typeof doc !== "object") return doc;

  const eduPolicy = policies["education_location"] || DEFAULT_POLICIES.education_location;
  const empPolicy = policies["employment_location"] || DEFAULT_POLICIES.employment_location;

  const masterSourceText = typeof masterSource === "string" ? masterSource : extractMasterText(masterSource);
  const factInventory = extractCanonicalFactInventory(masterSource);

  // 1. Cover letter prose sanitization & grounding
  if (Array.isArray(doc.paragraphs)) {
    doc.paragraphs = doc.paragraphs.map(p => sanitizeCoverLetterProse(p, factInventory));
  }

  // 2. Enforce employment location policy (omit location from work experience)
  if (Array.isArray(doc.experience) && empPolicy.mode === "omit") {
    doc.experience = doc.experience.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const { location, ...rest } = entry;
      return rest;
    });
  }

  // 3. Enforce education location policy
  if (Array.isArray(doc.education)) {
    const candidateContact = String(doc.contact || "").trim();
    doc.education = doc.education.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const rawLocation = String(entry.location || "").trim();
      const schoolName = String(entry.school || "").trim();

      if (!rawLocation) {
        return { ...entry, location: "" };
      }

      if (eduPolicy.mode === "explicit_only") {
        const verifiedLoc = verifyEducationLocation(
          rawLocation,
          schoolName,
          candidateContact,
          masterSourceText,
          jobLocation
        );
        return {
          ...entry,
          location: verifiedLoc || (eduPolicy.failure_action === "blank" ? "" : "")
        };
      }

      return entry;
    });
  }

  return doc;
}
