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

  async function write(baseUrl, action, payload = {}) {
    if (!baseUrl) throw new Error("Raven API is not configured.");
    const response = await fetch(baseUrl, {
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
    return window.RavenCore?.fromApiJob ? window.RavenCore.fromApiJob(row) : row;
  }

  window.RavenAPI = Object.freeze({
    version: API_VERSION,
    health() { return read(config.searchApiUrl, "health"); },
    searchJobs(track) { return read(config.searchApiUrl, "search", { track }); },
    listResults(track) { return read(config.searchApiUrl, "listResults", { track }); },
    async listJobs() {
      const data = await read(config.dataApiUrl, "jobs");
      return { ...data, jobs: (data.jobs || []).map(normalizeJob) };
    },
    addJob(job) { return write(config.searchApiUrl, "addJob", job); },
    updateJob(id, patch) { return write(config.searchApiUrl, "updateJob", { id, ...patch }); },
    describeJob(job) { return read(config.enrichApiUrl, "describe", job || {}); },
    commute(location) { return read(config.commuteApiUrl, "commute", { location }); }
  });
})();
