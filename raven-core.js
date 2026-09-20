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
  function normalizeJob(row, fields = JOB_FIELDS) {
    const raw = Array.isArray(row) ? Object.fromEntries(fields.map((key,index)=>[key,row[index] || ""])) : (row || {});
    return {...raw,id:text(raw.id),track:text(raw.track),title:text(raw.title)||"Untitled job",company:text(raw.company),location:text(raw.location),url:text(raw.url),source:text(raw.source)||"Web",status:text(raw.status)||"Saved",notes:text(raw.notes),_canonicalUrl:normalizeUrl(raw.url)};
  }
  function normalizeJobs(payload, fields = JOB_FIELDS) {
    const rows = Array.isArray(payload) ? payload : (payload?.jobs || payload?.rows || []);
    return rows.map((row)=>normalizeJob(row, fields)).filter((job)=>job.id || job.title !== "Untitled job" || job.url);
  }
  function jobFingerprint(job) {
    const canonical=normalizeJob(job);
    return [canonical._canonicalUrl,canonical.title.toLowerCase(),canonical.company.toLowerCase()].join("|");
  }
  function generationFingerprint(job, masterResume, type="resume", templateVersion="modern-v1") {
    const canonical=normalizeJob(job);
    return [type,templateVersion,canonical.id||canonical._canonicalUrl,text(canonical.notes),text(masterResume?.id),text(masterResume?.version||masterResume?.fileName)].join("|");
  }
  function createCache(namespace="raven") {
    const key=(name)=>namespace+":"+name;
    return {
      read(name,fallback=null){try{const value=JSON.parse(localStorage.getItem(key(name))||"null");return value===null?fallback:value;}catch{return fallback;}},
      write(name,value){try{localStorage.setItem(key(name),JSON.stringify(value));return true;}catch{return false;}},
      remove(name){try{localStorage.removeItem(key(name));}catch{}}
    };
  }
  global.RavenCore={JOB_FIELDS,normalizeUrl,normalizeJob,normalizeJobs,jobFingerprint,generationFingerprint,createCache};
}(window));
