(function (global) {
  "use strict";

  const BLOCKED_QUESTION_RE = /\b(sponsor|sponsorship|visa|citizen|citizenship|authorized|authorization|salary|compensation|pay|gender|sex|race|ethnic|ethnicity|disab|veteran|attest|certif|background|criminal|conviction|age|date of birth|birth date|ssn|social security|captcha|assessment|drug|protected class)\b/i;
  const SUCCESS_TEXT_RE = /\b(application (?:has been |was )?(?:submitted|received)|we (?:have )?received your application|thank you for applying|application complete|application successfully submitted)\b/i;
  const SUCCESS_URL_RE = /(?:^|[\/_-])(thank(?:-?you)?|success|submitted|confirmation|complete)(?:[\/_-]|$)/i;

  const GENERIC = {
    id: "generic",
    profile: {
      firstName: ['input[name*="first" i]','input[id*="first" i]'],
      lastName: ['input[name*="last" i]','input[id*="last" i]'],
      fullName: ['input[name="name" i]','input[id="name" i]','input[name*="full_name" i]','input[id*="full-name" i]'],
      email: ['input[type="email"]','input[name*="email" i]'],
      phone: ['input[type="tel"]','input[name*="phone" i]'],
      linkedin: ['input[name*="linkedin" i]','input[id*="linkedin" i]'],
      portfolio: ['input[name*="portfolio" i]','input[name*="website" i]','input[id*="portfolio" i]','input[id*="website" i]'],
      address1: ['input[name*="address1" i]','input[name*="address_1" i]','input[id*="address1" i]','input[id*="address-line1" i]'],
      address2: ['input[name*="address2" i]','input[name*="address_2" i]','input[id*="address2" i]','input[id*="address-line2" i]'],
      city: ['input[name*="city" i]','input[id*="city" i]'],
      region: ['input[name*="state" i]','input[name*="region" i]','input[name*="province" i]','input[id*="state" i]','input[id*="region" i]'],
      postalCode: ['input[name*="postal" i]','input[name*="zip" i]','input[id*="postal" i]','input[id*="zip" i]'],
      country: ['select[name*="country" i]','input[name*="country" i]','select[id*="country" i]','input[id*="country" i]']
    },
    files: {
      resume: ['input[type="file"][name*="resume" i]','input[type="file"][id*="resume" i]'],
      coverLetter: ['input[type="file"][name*="cover" i]','input[type="file"][id*="cover" i]']
    },
    successSelectors: []
  };

  const ADAPTERS = [
    {
      id: "greenhouse",
      host: /(^|\.)(?:job-boards\.)?greenhouse\.io$/i,
      profile: {
        firstName: ['#first_name','input[name="job_application[first_name]"]'],
        lastName: ['#last_name','input[name="job_application[last_name]"]'],
        email: ['#email','input[name="job_application[email]"]'],
        phone: ['#phone','input[name="job_application[phone]"]']
      },
      files: {
        resume: ['#resume','input[type="file"][name*="resume" i]'],
        coverLetter: ['#cover_letter','input[type="file"][name*="cover_letter" i]']
      },
      successSelectors: ['#application_confirmation','.application--confirmation','[data-testid*="confirmation" i]']
    },
    {
      id: "lever",
      host: /(^|\.)jobs\.lever\.co$/i,
      profile: {
        fullName: ['input[name="name"]','input[data-qa="name-input"]'],
        email: ['input[name="email"]','input[data-qa="email-input"]'],
        phone: ['input[name="phone"]','input[data-qa="phone-input"]']
      },
      files: {
        resume: ['input[type="file"][name="resume"]','[data-qa*="resume" i] input[type="file"]'],
        coverLetter: ['input[type="file"][name*="cover" i]','[data-qa*="cover" i] input[type="file"]']
      },
      successSelectors: ['[data-qa="thank-you"]','.application-confirmation','.thank-you']
    },
    {
      id: "ashby",
      host: /(^|\.)jobs\.ashbyhq\.com$/i,
      profile: {},
      files: {
        resume: ['input[type="file"][name*="resume" i]'],
        coverLetter: ['input[type="file"][name*="cover" i]']
      },
      successSelectors: ['[data-testid*="application-success" i]','[data-testid*="confirmation" i]']
    },
    {
      id: "workday",
      host: /(^|\.)(?:my)?workdayjobs\.com$/i,
      profile: {},
      files: {
        resume: ['input[type="file"][data-automation-id*="resume" i]','input[type="file"][name*="resume" i]'],
        coverLetter: ['input[type="file"][data-automation-id*="cover" i]','input[type="file"][name*="cover" i]']
      },
      successSelectors: ['[data-automation-id*="applicationSubmitted" i]','[data-automation-id*="thankYou" i]']
    },
    {
      id: "icims",
      host: /(^|\.)[^.]*icims\.com$/i,
      profile: {},
      files: {
        resume: ['input[type="file"][name*="resume" i]','input[type="file"][id*="resume" i]'],
        coverLetter: ['input[type="file"][name*="cover" i]','input[type="file"][id*="cover" i]']
      },
      successSelectors: ['[class*="confirmation" i]','[id*="confirmation" i]']
    },
    {
      id: "taleo",
      host: /(^|\.)[^.]*taleo\.net$/i,
      profile: {},
      files: {
        resume: ['input[type="file"][name*="resume" i]','input[type="file"][id*="resume" i]'],
        coverLetter: ['input[type="file"][name*="cover" i]','input[type="file"][id*="cover" i]']
      },
      successSelectors: ['[id*="confirmation" i]','[class*="confirmation" i]']
    }
  ];

  function normalizeQuestion(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function isSensitiveQuestion(value) {
    return BLOCKED_QUESTION_RE.test(normalizeQuestion(value));
  }

  function detectAdapter(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/:\d+$/, "");
    return ADAPTERS.find((adapter) => adapter.host.test(host)) || GENERIC;
  }

  function selectorsFor(adapter, group, key) {
    const specific = adapter?.[group]?.[key] || [];
    const generic = GENERIC[group]?.[key] || [];
    return [...new Set([...specific, ...generic])];
  }

  function acceptsFile(accept, fileName, mimeType) {
    const raw = String(accept || "").trim().toLowerCase();
    if (!raw) return true;
    const name = String(fileName || "").toLowerCase();
    const type = String(mimeType || "").toLowerCase();
    return raw.split(",").map((part) => part.trim()).filter(Boolean).some((token) => {
      if (token === "*/*") return true;
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return token === type;
    });
  }

  function completionLooksSuccessful({ url = "", text = "", matchedSelector = false } = {}) {
    if (!SUCCESS_TEXT_RE.test(String(text || ""))) return false;
    if (matchedSelector) return true;
    try {
      const parsed = new URL(url);
      return SUCCESS_URL_RE.test(parsed.pathname + parsed.search + parsed.hash);
    } catch {
      return SUCCESS_URL_RE.test(String(url || ""));
    }
  }

  global.RavenAssistantCore = {
    ADAPTERS,
    GENERIC,
    normalizeQuestion,
    isSensitiveQuestion,
    detectAdapter,
    selectorsFor,
    acceptsFile,
    completionLooksSuccessful
  };
}(typeof globalThis !== "undefined" ? globalThis : window));
