export interface GenerationPolicy {
  key: string;
  mode: string;
  failure_action?: string;
  [key: string]: unknown;
}

export type GenerationPolicyMap = Record<string, GenerationPolicy>;

export const DEFAULT_POLICIES: GenerationPolicyMap = {
  identity_fields: { key: "identity_fields", mode: "preserve_exact" },
  employment_location: { key: "employment_location", mode: "omit" },
  education_location: { key: "education_location", mode: "explicit_only", failure_action: "blank" },
  unsupported_fields: { key: "unsupported_fields", mode: "blank" }
};

function getEnvCredentials() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return { url, key };
}

export async function fetchGenerationPolicies(): Promise<GenerationPolicyMap> {
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
      console.warn(`Failed to fetch raven_generation_policy (${response.status}), using default policies.`);
      return { ...DEFAULT_POLICIES };
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return { ...DEFAULT_POLICIES };
    }

    const policyMap: GenerationPolicyMap = { ...DEFAULT_POLICIES };

    for (const row of rows) {
      if (row.enabled === false) continue;
      const keyName = String(row.policy_key || row.key || row.name || row.id || "").trim();
      if (!keyName) continue;

      let policyData: GenerationPolicy;
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
  } catch (err) {
    console.warn("Error fetching raven_generation_policy:", err);
    return { ...DEFAULT_POLICIES };
  }
}

/**
 * Extracts plain text from master resume input if available (e.g. utf-8 text from base64 dataUrl or plain text).
 */
export function extractMasterText(masterResume: { dataUrl?: string; text?: string; [key: string]: unknown }): string {
  if (typeof masterResume?.text === "string" && masterResume.text.trim()) {
    return masterResume.text;
  }
  const dataUrl = String(masterResume?.dataUrl || "").trim();
  if (dataUrl) {
    const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/s);
    if (match) {
      const mime = (match[1] || "").toLowerCase();
      if (mime.startsWith("text/") || mime.includes("json")) {
        try {
          return atob(match[2]);
        } catch {
          // Ignore decoding errors
        }
      } else {
        try {
          const raw = atob(match[2]);
          const printableCount = (raw.match(/[\x20-\x7E\s]/g) || []).length;
          if (raw.length > 0 && printableCount / raw.length > 0.75) {
            return raw;
          }
        } catch {
          // Ignore decoding errors
        }
      }
    }
  }
  return "";
}

/**
 * Validates whether an education entry's location is explicitly supported in the master resume
 * and not hallucinated from school name, candidate location, or job location.
 */
export function verifyEducationLocation(
  entryLocation: string,
  schoolName: string,
  candidateContact: string,
  masterSourceText: string = "",
  jobLocation: string = ""
): string {
  const loc = String(entryLocation || "").trim();
  if (!loc) return "";

  const school = String(schoolName || "").trim().toLowerCase();
  const locLower = loc.toLowerCase();

  // 1. School name check: if location is identical to or part of school name
  if (school && (school === locLower || school.includes(locLower) || locLower.includes(school))) {
    return "";
  }

  // 2. Candidate location leak check
  const candidateLoc = String(candidateContact || "").trim().toLowerCase();
  if (candidateLoc && locLower.length > 2 && candidateLoc.includes(locLower)) {
    // Location matches candidate contact header. Only keep if explicitly present in Education section.
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

    // Must appear in masterSourceText
    if (!sourceLower.includes(locLower)) {
      // Direct string not found. Try component parts e.g. "Savannah, GA" -> "savannah" and "ga"
      const parts = locLower.split(/[,/\-\s]+/).map(p => p.trim()).filter(p => p.length > 1);
      const allPartsInSource = parts.length > 0 && parts.every(part => sourceLower.includes(part));
      if (!allPartsInSource) {
        return "";
      }
    }

    // Verify it is tied to education / school name, not just candidate contact at the top
    const eduSection = extractEducationSectionText(masterSourceText);
    if (eduSection) {
      const eduLower = eduSection.toLowerCase();
      if (!eduLower.includes(locLower)) {
        // Also check if location appears in 3 lines surrounding schoolName
        const nearSchool = isLocationNearSchoolInText(masterSourceText, schoolName, locLower);
        if (!nearSchool) {
          return "";
        }
      }
    }
  }

  return loc;
}

/**
 * Helper to extract Education section from master resume text.
 */
function extractEducationSectionText(text: string): string {
  const lines = text.split(/\r?\n/);
  let inEdu = false;
  const eduLines: string[] = [];

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

/**
 * Helper to check if a location appears near the school name in master resume text.
 */
function isLocationNearSchoolInText(text: string, schoolName: string, locLower: string): boolean {
  if (!schoolName || !text) return false;
  const lines = text.split(/\r?\n/);
  const schoolLower = schoolName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(schoolLower)) {
      // Check lines i-2 to i+2
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
 * Applies generation policies to a normalized resume document.
 */
export function applyGenerationPolicies(
  doc: any,
  policies: GenerationPolicyMap,
  masterSourceText = "",
  jobLocation = ""
): any {
  if (!doc || typeof doc !== "object") return doc;

  const eduPolicy = policies["education_location"] || DEFAULT_POLICIES.education_location;
  const empPolicy = policies["employment_location"] || DEFAULT_POLICIES.employment_location;

  // 1. Enforce employment location policy (omit location from work experience)
  if (Array.isArray(doc.experience) && empPolicy.mode === "omit") {
    doc.experience = doc.experience.map((entry: any) => {
      if (!entry || typeof entry !== "object") return entry;
      const { location, ...rest } = entry;
      return rest;
    });
  }

  // 2. Enforce education location policy
  if (Array.isArray(doc.education)) {
    const candidateContact = String(doc.contact || "").trim();
    doc.education = doc.education.map((entry: any) => {
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
