(function (global) {
  "use strict";
  const JOB_FIELDS = ["id","added","track","title","company","location","remote","salaryMin","salaryMax","salaryText","url","source","status","viewed","appliedDate","followUp","resume","coverLetter","notes","lastUpdated"];
  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalizeUrl(value) {
    try {
      const url = new URL(text(value));
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gh_src","source"].forEach((key)=>url.searchParams.delete(key));
      url.hash = "";
      return url.toString().replace(/\/$/,"");
    } catch { return text(value); }
  }
  function fromApiJob(row) {
    if (!row || Array.isArray(row)) return row;
    return {
      id: row.id || "", added: row.added || "", track: row.track || "", title: row.title || "",
      company: row.company || "", location: row.location || "", remote: row.remote ? "Remote" : "",
      salaryMin: row.salary_min ?? row.salaryMin ?? "", salaryMax: row.salary_max ?? row.salaryMax ?? "",
      salaryText: row.salary_text || row.salaryText || "", url: row.url || "", source: row.source || "",
      status: row.status || "Saved", viewed: Boolean(row.viewed), appliedDate: row.applied_date || row.appliedDate || "",
      followUp: row.follow_up || row.followUp || "", resume: row.resume || "", coverLetter: row.cover_letter || row.coverLetter || "",
      notes: row.notes || "", lastUpdated: row.last_updated || row.lastUpdated || ""
    };
  }
  function fromDiscoveredJob(job) {
    const raw=job||{};
    return normalizeJob({
      id: "DISC-" + text(raw.id), added: raw.created_at || raw.last_seen || "", track: raw.track,
      title: raw.title, company: raw.company, location: raw.location, remote: raw.remote ? "Remote" : "",
      salaryText: raw.salary_text || "", url: raw.url, source: raw.source || "Web", status: "Discovered",
      viewed: false, notes: raw.snippet || "", lastUpdated: raw.last_seen || "",
      fitScore: Math.max(55, Math.min(96, 50 + Number(raw.score || 7) * 3)), _discovered: true
    });
  }
  const KNOWN_COMPANY_CASING = {
    "cbiz": "CBIZ",
    "cd-projekt-red": "CD Projekt Red",
    "dealerbuilt": "DealerBuilt",
    "1840company": "1840 & Company",
    "1840-company": "1840 & Company",
    "emotainizioengage": "EmotaInizioEngage",
    "cloud-chamber": "Cloud Chamber",
    "swaybox-studios": "Swaybox Studios",
    "epic-games": "Epic Games",
    "eleventh-hour-games": "Eleventh Hour Games",
    "comploy": "Comploy",
    "icims": "iCIMS",
    "smartrecruiters": "SmartRecruiters",
    "greenhouse": "Greenhouse",
    "lever": "Lever",
    "ashby": "Ashby"
  };

  function formatCompanyName(rawSlug) {
    if (!rawSlug) return "";
    let cleanStr = "";
    try { cleanStr = decodeURIComponent(rawSlug); } catch { cleanStr = rawSlug; }
    cleanStr = cleanStr.trim();
    if (!cleanStr) return "";

    const rawKey = cleanStr.toLowerCase();
    if (KNOWN_COMPANY_CASING[rawKey]) return KNOWN_COMPANY_CASING[rawKey];

    const hyphenKey = rawKey.replace(/[\s_]+/g, "-");
    if (KNOWN_COMPANY_CASING[hyphenKey]) return KNOWN_COMPANY_CASING[hyphenKey];

    const noSepKey = rawKey.replace(/[^a-z0-9]+/g, "");
    if (KNOWN_COMPANY_CASING[noSepKey]) return KNOWN_COMPANY_CASING[noSepKey];

    const words = cleanStr.replace(/[-_]+/g, " ").split(/\s+/);
    const capitalized = words.map((word) => {
      if (!word) return "";
      const lower = word.toLowerCase();
      if (["and", "of", "the", "for", "in", "on", "at"].includes(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

    let result = capitalized.join(" ").trim();
    if (result) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }

  function recoverCompanyFromUrl(value) {
    const rawUrl = text(value);
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return "";

    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      const path = u.pathname;

      if (host.includes("linkedin.com")) {
        const viewMatch = path.match(/\/jobs\/view\/([^/?#]+)/i);
        if (viewMatch) {
          let slug = viewMatch[1];
          slug = slug.replace(/-\d{6,}$/, "");
          const atIndex = slug.lastIndexOf("-at-");
          if (atIndex !== -1) {
            const companySlug = slug.slice(atIndex + 4).trim();
            if (companySlug && !/^\d+$/.test(companySlug)) {
              return formatCompanyName(companySlug);
            }
          }
        }
        return "";
      }

      if (host.includes("greenhouse.io")) {
        const ghMatch = path.match(/\/(?:job-boards\/|boards\/)?([^\/]+)\/jobs\/[^\/?#]+/i);
        if (ghMatch && ghMatch[1] && ghMatch[1] !== "embed") {
          return formatCompanyName(ghMatch[1]);
        }
        return "";
      }

      if (host.includes("lever.co")) {
        const levMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
        if (levMatch && levMatch[1] && levMatch[1] !== "jobs") {
          return formatCompanyName(levMatch[1]);
        }
        return "";
      }

      if (host.includes("ashbyhq.com")) {
        const ashMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
        if (ashMatch && ashMatch[1]) {
          return formatCompanyName(ashMatch[1]);
        }
        return "";
      }

      if (host.includes("smartrecruiters.com")) {
        const smMatch = path.match(/\/([^\/]+)\/[^\/]+/i);
        if (smMatch && smMatch[1]) {
          return formatCompanyName(smMatch[1]);
        }
        return "";
      }

      if (host.includes("myworkdayjobs.com")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("workable.com")) {
        let companySlug = "";
        if (host.startsWith("apply.")) {
          const parts = path.split("/").filter(Boolean);
          if (parts.length >= 1) companySlug = parts[0];
        } else {
          companySlug = host.split(".")[0];
        }
        if (companySlug && companySlug !== "apply" && companySlug !== "www") {
          return formatCompanyName(companySlug);
        }
        return "";
      }

      if (host.includes("icims.com")) {
        const companySubdomain = host.replace("-careers", "").split(".")[0];
        if (companySubdomain && companySubdomain !== "www" && companySubdomain !== "careers") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("taleo.net")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("recruitee.com")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www" && companySubdomain !== "careers") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("breezy.hr")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("bamboohr.com")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      if (host.includes("personio.com") || host.includes("personio.de")) {
        const companySubdomain = host.split(".")[0];
        if (companySubdomain && companySubdomain !== "www") {
          return formatCompanyName(companySubdomain);
        }
        return "";
      }

      return "";
    } catch {
      return "";
    }
  }

  function recoverCompany(job) {
    const existing = text(job?.company);
    if (existing) return existing;
    return recoverCompanyFromUrl(job?.url);
  }

  function normalizeJob(row, fields = JOB_FIELDS) {
    const raw = Array.isArray(row) ? Object.fromEntries(fields.map((key,index)=>[key,row[index] || ""])) : (row || {});
    const existingCompany = text(raw.company);
    const company = existingCompany || recoverCompanyFromUrl(raw.url);
    return {...raw,id:text(raw.id),track:text(raw.track),title:text(raw.title)||"Untitled job",company:text(company),location:text(raw.location),url:text(raw.url),source:text(raw.source)||"Web",status:text(raw.status)||"Saved",notes:text(raw.notes),_canonicalUrl:normalizeUrl(raw.url)};
  }

  function getCanonicalIdentity(job) {
    const canonical = normalizeJob(job);
    const normalizedUrl = canonical._canonicalUrl || normalizeUrl(canonical.url);
    const title = text(canonical.title);
    const company = text(canonical.company);

    let provider = "web";
    let employerSlug = "";
    let postingId = "";
    let postingKey = "";

    if (normalizedUrl && /^https?:\/\//i.test(normalizedUrl)) {
      try {
        const u = new URL(normalizedUrl);
        const host = u.hostname.toLowerCase();
        const path = u.pathname;

        if (host.includes("linkedin.com")) {
          provider = "linkedin";
          const liMatch = path.match(/\/jobs\/view\/(?:[^\/]+-)?(\d{6,})/i) || path.match(/\/jobs\/view\/(\d{6,})/i) || [null, u.searchParams.get("currentJobId")];
          const id = liMatch && liMatch[1] ? liMatch[1] : "";
          if (id) {
            postingId = id;
            postingKey = `linkedin:${id}`;
          }
        } else if (host.includes("greenhouse.io")) {
          provider = "greenhouse";
          const ghMatch = path.match(/\/(?:job-boards\/|boards\/)?([^\/]+)\/jobs\/(\d+)/i);
          if (ghMatch) {
            employerSlug = ghMatch[1].toLowerCase();
            postingId = ghMatch[2];
            postingKey = `greenhouse:${employerSlug}:${postingId}`;
          }
        } else if (host.includes("lever.co")) {
          provider = "lever";
          const levMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
          if (levMatch && levMatch[1] !== "jobs") {
            employerSlug = levMatch[1].toLowerCase();
            postingId = levMatch[2];
            postingKey = `lever:${employerSlug}:${postingId}`;
          }
        } else if (host.includes("ashbyhq.com")) {
          provider = "ashby";
          const ashMatch = path.match(/\/([^\/]+)\/([^\/?#]+)/i);
          if (ashMatch) {
            employerSlug = ashMatch[1].toLowerCase();
            postingId = ashMatch[2];
            postingKey = `ashby:${employerSlug}:${postingId}`;
          }
        } else if (host.includes("smartrecruiters.com")) {
          provider = "smartrecruiters";
          const smMatch = path.match(/\/([^\/]+)\/([^\/]+)/i);
          if (smMatch && smMatch[2]) {
            employerSlug = smMatch[1].toLowerCase();
            postingId = smMatch[2];
            postingKey = `smartrecruiters:${employerSlug}:${postingId}`;
          }
        } else if (host.includes("myworkdayjobs.com")) {
          provider = "workday";
          employerSlug = host.split(".")[0];
          const reqMatch = path.match(/(R\d{4,}|JR\d{4,})/i) || path.match(/\/([A-Za-z0-9_-]+)$/);
          if (reqMatch) {
            postingId = reqMatch[1] || reqMatch[0];
            postingKey = `workday:${employerSlug}:${postingId.toLowerCase()}`;
          }
        } else if (host.includes("workable.com")) {
          provider = "workable";
          employerSlug = host.startsWith("apply.") ? (path.split("/")[1] || "").toLowerCase() : host.split(".")[0];
          const wkMatch = path.match(/\/j\/([A-Za-z0-9]+)/i);
          if (wkMatch) {
            postingId = wkMatch[1];
            postingKey = `workable:${employerSlug}:${postingId}`;
          }
        } else if (host.includes("icims.com")) {
          provider = "icims";
          employerSlug = host.replace("-careers", "").split(".")[0];
          const icMatch = path.match(/\/jobs\/(\d+)/i);
          if (icMatch) {
            postingId = icMatch[1];
            postingKey = `icims:${employerSlug}:${postingId}`;
          }
        }
      } catch {}
    }

    if (!postingKey && normalizedUrl) {
      postingKey = `url:${normalizedUrl}`;
    }

    const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const normCompany = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const titleCompanyKey = (normTitle && normCompany) ? `${normCompany} | ${normTitle}` : "";

    const crossSourceKey = titleCompanyKey ? `${titleCompanyKey}${postingId ? " | req:" + postingId : ""}` : "";

    return {
      canonicalUrl: normalizedUrl,
      postingKey: postingKey || (titleCompanyKey ? `weak:${titleCompanyKey}` : `id:${canonical.id || ""}`),
      titleCompanyKey,
      crossSourceKey,
      provider,
      employerSlug,
      postingId
    };
  }

  function analyzeCanonicalIdentity(rawJobs) {
    const rawList = Array.isArray(rawJobs) ? rawJobs : [];

    const exactDuplicateGroups = [];
    const crossSourceDuplicateGroups = [];
    const titleCompanyCollisionGroups = [];
    const missingCompanyRows = [];
    const recoverableCompanyRows = [];
    const ambiguousRows = [];

    const postingKeyMap = new Map();
    const titleCompanyMap = new Map();

    for (const rawItem of rawList) {
      const originalCompany = text(Array.isArray(rawItem) ? rawItem[4] : rawItem?.company);
      const job = normalizeJob(rawItem);
      const recovered = recoverCompanyFromUrl(job.url);

      if (!originalCompany) {
        missingCompanyRows.push(job);
        if (recovered) {
          recoverableCompanyRows.push({
            id: job.id,
            title: job.title,
            url: job.url,
            recoveredCompany: recovered
          });
        } else {
          ambiguousRows.push(job);
        }
      }

      const identity = getCanonicalIdentity(job);

      if (identity.postingKey) {
        if (!postingKeyMap.has(identity.postingKey)) postingKeyMap.set(identity.postingKey, []);
        postingKeyMap.get(identity.postingKey).push(job);
      }

      if (identity.titleCompanyKey) {
        if (!titleCompanyMap.has(identity.titleCompanyKey)) titleCompanyMap.set(identity.titleCompanyKey, []);
        titleCompanyMap.get(identity.titleCompanyKey).push(job);
      }
    }

    for (const [key, group] of postingKeyMap.entries()) {
      if (group.length > 1) {
        exactDuplicateGroups.push({ postingKey: key, count: group.length, jobs: group });
      }
    }

    for (const [key, group] of titleCompanyMap.entries()) {
      if (group.length > 1) {
        const uniquePostingKeys = new Set(group.map((j) => getCanonicalIdentity(j).postingKey));
        const uniqueProviders = new Set(group.map((j) => getCanonicalIdentity(j).provider));

        if (uniquePostingKeys.size > 1) {
          if (uniqueProviders.size > 1) {
            crossSourceDuplicateGroups.push({ titleCompanyKey: key, count: group.length, providers: [...uniqueProviders], jobs: group });
          } else {
            titleCompanyCollisionGroups.push({ titleCompanyKey: key, count: group.length, provider: [...uniqueProviders][0], jobs: group });
          }
        }
      }
    }

    return {
      totalJobs: rawList.length,
      missingCompanyCount: missingCompanyRows.length,
      recoverableCompanyCount: recoverableCompanyRows.length,
      ambiguousCompanyCount: ambiguousRows.length,
      exactDuplicatesCount: exactDuplicateGroups.length,
      crossSourceDuplicatesCount: crossSourceDuplicateGroups.length,
      titleCompanyCollisionsCount: titleCompanyCollisionGroups.length,
      exactDuplicates: exactDuplicateGroups,
      crossSourceDuplicates: crossSourceDuplicateGroups,
      titleCompanyCollisions: titleCompanyCollisionGroups,
      recoverableCompanies: recoverableCompanyRows,
      ambiguousRows
    };
  }
  function isRenderableJob(job) {
    const canonical=job?._canonicalUrl!==undefined ? job : normalizeJob(job);
    const hasIdentity=Boolean(canonical.id || canonical.title !== "Untitled job" || canonical.url);
    if(!hasIdentity) return false;
    if(/^ATS:/i.test(text(canonical.source)) && !/^https?:\/\//i.test(text(canonical._canonicalUrl || canonical.url))) return false;
    return true;
  }
  function normalizeJobs(payload, fields = JOB_FIELDS) {
    const rows = Array.isArray(payload) ? payload : (payload?.jobs || payload?.rows || []);
    return rows.map((row)=>normalizeJob(row, fields)).filter(isRenderableJob);
  }
  function jobFingerprint(job) {
    const canonical=normalizeJob(job);
    return [canonical._canonicalUrl,canonical.title.toLowerCase(),canonical.company.toLowerCase()].join("|");
  }
  function stableHash(value) {
    const input=text(value); let hash=2166136261;
    for(let i=0;i<input.length;i++){ hash^=input.charCodeAt(i); hash=Math.imul(hash,16777619); }
    return (hash>>>0).toString(36);
  }
  function generationFingerprint(job, masterResume, type="resume", templateVersion="modern-v1") {
    const canonical=normalizeJob(job);
    return stableHash([type,templateVersion,canonical.id||canonical._canonicalUrl,text(canonical.notes),text(masterResume?.id),text(masterResume?.version||masterResume?.fileName),text(masterResume?.url),text(masterResume?.dataUrl)].join("|"));
  }
  function createCache(namespace="raven") {
    const key=(name)=>namespace+":"+name;
    return {
      read(name,fallback=null){try{const value=JSON.parse(localStorage.getItem(key(name))||"null");return value===null?fallback:value;}catch{return fallback;}},
      write(name,value){try{localStorage.setItem(key(name),JSON.stringify(value));return true;}catch{return false;}},
      remove(name){try{localStorage.removeItem(key(name));}catch{}}
    };
  }
  global.RavenCore={JOB_FIELDS,normalizeUrl,fromApiJob,fromDiscoveredJob,normalizeJob,normalizeJobs,isRenderableJob,jobFingerprint,stableHash,generationFingerprint,createCache,KNOWN_COMPANY_CASING,formatCompanyName,recoverCompanyFromUrl,recoverCompany,getCanonicalIdentity,analyzeCanonicalIdentity};
}(window));
