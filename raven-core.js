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
  function normalizeJob(row, fields = JOB_FIELDS) {
    const raw = Array.isArray(row) ? Object.fromEntries(fields.map((key,index)=>[key,row[index] || ""])) : (row || {});
    return {...raw,id:text(raw.id),track:text(raw.track),title:text(raw.title)||"Untitled job",company:text(raw.company),location:text(raw.location),url:text(raw.url),source:text(raw.source)||"Web",status:text(raw.status)||"Saved",notes:text(raw.notes),_canonicalUrl:normalizeUrl(raw.url)};
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
  function classifyTask(task) {
    const raw = task || {};
    const id = text(raw.id || raw.task_id || raw.taskId || raw.job_id || raw.jobId);
    const status = text(raw.status).toUpperCase();
    const source = text(raw.source || raw.task_type || raw.type || raw.workflow).toLowerCase();
    const title = text(raw.title || raw.name).toLowerCase();
    const track = text(raw.track).toLowerCase();
    const notes = text(raw.notes || raw.error || raw.blocked_reason || raw.detail).toLowerCase();
    const isTestFlag = Boolean(raw.is_test || raw.isTest || raw._test);

    if (
      isTestFlag ||
      /^(test-|e2e-|playwright-)/i.test(id) ||
      /\b(integration-test|e2e|playwright|test-job|disposable)\b/i.test(title + " " + source + " " + track)
    ) {
      return { category: "disposable_test", isSystemFailure: false, description: "Disposable integration test record" };
    }

    if (
      ["BLOCKED_USER_INPUT", "BLOCKED_USER_CONFIRMATION", "BLOCKED_MANUAL_REVIEW", "WAITING_FOR_USER", "AWAITING_USER_CONFIRMATION", "USER_CONFIRMATION_REQUIRED"].includes(status) ||
      /^BLOCKED_USER/i.test(status) ||
      /^BLOCKED_MANUAL/i.test(status) ||
      /\b(user confirmation|manual review|blocked by user|never submit without|awaiting user)\b/i.test(notes)
    ) {
      return { category: "manual_blocked", isSystemFailure: false, description: "Expected manual state waiting for user action" };
    }

    if (
      ["FAILED_FINAL", "BLOCKED_TOOLING", "RETIRED", "ARCHIVED", "EXPIRED_LEGACY"].includes(status) ||
      Boolean(raw.retired || raw.legacy) ||
      /\b(drive_upload|google_drive|gdrive|apps_script|raven_tasks_v1|retired_queue)\b/i.test(source + " " + notes)
    ) {
      return { category: "historical_legacy", isSystemFailure: false, description: "Historical or legacy terminal task state" };
    }

    const isFailure = ["FAILED", "ERROR", "CRASHED", "SYSTEM_FAILURE"].includes(status) || (Boolean(raw.http_status) && Number(raw.http_status) >= 500);
    return {
      category: "operational_active",
      isSystemFailure: isFailure,
      description: isFailure ? "Active operational system failure" : "Active operational task"
    };
  }

  function filterActiveSystemFailures(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    return list.filter((task) => {
      const cls = classifyTask(task);
      return cls.category === "operational_active" && cls.isSystemFailure;
    });
  }

  function evaluateRavenHealth(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    const counts = { total: list.length, operationalActive: 0, activeFailures: 0, manualBlocked: 0, historicalLegacy: 0, disposableTest: 0 };

    list.forEach((task) => {
      const cls = classifyTask(task);
      if (cls.category === "disposable_test") counts.disposableTest++;
      else if (cls.category === "manual_blocked") counts.manualBlocked++;
      else if (cls.category === "historical_legacy") counts.historicalLegacy++;
      else {
        counts.operationalActive++;
        if (cls.isSystemFailure) counts.activeFailures++;
      }
    });

    const isHealthy = counts.activeFailures === 0;
    return {
      status: isHealthy ? "healthy" : "degraded",
      healthy: isHealthy,
      counts
    };
  }

  global.RavenCore={
    JOB_FIELDS,
    normalizeUrl,
    fromApiJob,
    fromDiscoveredJob,
    normalizeJob,
    normalizeJobs,
    isRenderableJob,
    jobFingerprint,
    stableHash,
    generationFingerprint,
    createCache,
    classifyTask,
    filterActiveSystemFailures,
    evaluateRavenHealth
  };
}(typeof window !== "undefined" ? window : globalThis));
