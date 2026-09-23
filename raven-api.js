(() => {
  "use strict";

  const config = window.RAVEN_CONFIG || {};
  const API_VERSION = 3;

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

  async function controlWrite(action, payload = {}) {
    if (!config.controlApiUrl) throw new Error("Raven control API is not configured.");
    const response = await fetch(config.controlApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-raven-client": "raven-web-v1" },
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
      const data = await read(config.searchApiUrl, "jobs");
      return { ...data, jobs: (data.jobs || []).map(normalizeJob) };
    },
    addJob(job) { return write(config.searchApiUrl, "addJob", job); },
    updateJob(id, patch) { return write(config.searchApiUrl, "updateJob", { id, ...patch }); },
    transitionJob(id, status, options = {}) { return write(config.searchApiUrl, "transitionJob", { id, status, ...options }); },
    listJobEvents(jobId) { return read(config.searchApiUrl, "jobEvents", { jobId }); },
    addJobEvent(jobId, event = {}) { return write(config.searchApiUrl, "addJobEvent", { jobId, ...event }); },
    listJobSnapshots(jobId) { return read(config.searchApiUrl, "jobSnapshots", { jobId }); },
    receiveApplicationSignal(signal = {}) { return write(config.searchApiUrl, "receiveApplicationSignal", signal); },
    analytics() { return read(config.searchApiUrl, "analytics"); },
    coverage(jobId) { return read(config.searchApiUrl, "coverage", { jobId }); },
    describeJob(job) { return read(config.enrichApiUrl, "describe", job || {}); },
    commute(location) { return read(config.commuteApiUrl, "commute", { location }); },
    controlHealth() { return read(config.controlApiUrl, "health"); },
    getControlConfig() { return read(config.controlApiUrl, "getConfig"); },
    getControlEvents() { return read(config.controlApiUrl, "recent"); },
    refreshAllControl() { return controlWrite("refreshAll"); },
    runSourceDiagnostics(track = "all") { return controlWrite("runSourceDiagnostics", { track }); },
    repairDescriptionsControl(limit = 6, offset = 0, track = "") {
      return controlWrite("repairDescriptions", { limit, offset, track });
    },
    smokeAts(track = "Professional") { return controlWrite("smokeAts", { track }); }
  });
})();
