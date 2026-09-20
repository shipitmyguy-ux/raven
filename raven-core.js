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
    return stableHash([type,templateVersion,canonical.id||canonical._canonicalUrl,text(canonical.notes),text(masterResume?.id),text(masterResume?.version||masterResume?.fileName),text(masterResume?.dataUrl)].join("|"));
  }
  function createCache(namespace="raven") {
    const key=(name)=>namespace+":"+name;
    return {
      read(name,fallback=null){try{const value=JSON.parse(localStorage.getItem(key(name))||"null");return value===null?fallback:value;}catch{return fallback;}},
      write(name,value){try{localStorage.setItem(key(name),JSON.stringify(value));return true;}catch{return false;}},
      remove(name){try{localStorage.removeItem(key(name));}catch{}}
    };
  }
  global.RavenCore={JOB_FIELDS,normalizeUrl,fromApiJob,fromDiscoveredJob,normalizeJob,normalizeJobs,isRenderableJob,jobFingerprint,stableHash,generationFingerprint,createCache};
}(window));
