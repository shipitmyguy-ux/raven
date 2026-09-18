(() => {
  "use strict";

  const config = window.RAVEN_CONFIG || {};
  const API_VERSION = 2;

  async function read(baseUrl, action, payload = {}) {
    if (!baseUrl) throw new Error("Raven API is not configured.");
    const url = new URL(baseUrl);
    if (action) url.searchParams.set("action", action);
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    return parse(response);
  }

  async function write(action, payload = {}) {
    if (!config.searchApiUrl) throw new Error("Raven API is not configured.");
    const response = await fetch(config.searchApiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store"
    });
    return parse(response);
  }

  async function parse(response) {
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Raven service returned an unreadable response (" + response.status + ")."); }
    if (!response.ok || data.ok === false || data.error) {
      throw new Error(data.error || ("Raven service failed (" + response.status + ")."));
    }
    return data;
  }

  function normalizeJob(row) {
    if (!row || Array.isArray(row)) return row;
    return {
      id: row.id || "",
      added: row.added || "",
      track: row.track || "",
      title: row.title || "",
      company: row.company || "",
      location: row.location || "",
      remote: row.remote ? "Remote" : "",
      salaryMin: row.salary_min ?? "",
      salaryMax: row.salary_max ?? "",
      salaryText: row.salary_text || "",
      url: row.url || "",
      source: row.source || "",
      status: row.status || "Saved",
      viewed: Boolean(row.viewed),
      appliedDate: row.applied_date || "",
      followUp: row.follow_up || "",
      resume: row.resume || "",
      coverLetter: row.cover_letter || "",
      notes: row.notes || "",
      lastUpdated: row.last_updated || ""
    };
  }

  window.RavenAPI = Object.freeze({
    version: API_VERSION,
    health() { return read(config.searchApiUrl, "health"); },
    searchJobs(track) { return read(config.searchApiUrl, "search", { track }); },
    listResults(track) { return read(config.searchApiUrl, "listResults", { track }); },
    async listJobs() {
      const data = await read(config.searchApiUrl, "jobs");
      return { ...data, jobs: (data.jobs || []).map(normalizeJob) };
    },
    addJob(job) { return write("addJob", job); },
    updateJob(id, patch) { return write("updateJob", { id, ...patch }); },
    async listTasks() { return read(config.searchApiUrl, "tasks"); },
    enqueueTask(task) { return write("enqueueTask", task); },
    updateTask(taskId, patch) { return write("updateTask", { taskId, ...patch }); },
    describeJob(job) { return read(config.enrichApiUrl, "describe", job || {}); },
    commute(location) { return read(config.commuteApiUrl, "commute", { location }); }
  });
})();
