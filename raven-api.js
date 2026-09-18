(() => {
  "use strict";

  // Raven API contract v1.
  // UI code should call these methods and never construct Supabase requests directly.
  const config = window.RAVEN_CONFIG || {};
  const API_VERSION = 1;

  async function request(action, payload = {}) {
    if (!config.searchApiUrl) {
      throw new Error("Raven search API is not configured.");
    }

    const url = new URL(config.searchApiUrl);
    url.searchParams.set("action", action);
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Search backend returned an unreadable response (" + response.status + ").");
    }

    if (!response.ok || data.ok === false || data.error) {
      throw new Error(data.error || ("Search backend failed (" + response.status + ")."));
    }

    return data;
  }

  window.RavenAPI = Object.freeze({
    version: API_VERSION,
    searchJobs(track) {
      return request("search", { track });
    },
    listResults(track) {
      return request("listResults", { track });
    },
    describeJob(job) {
      return request("describe", job || {});
    },
    commute(location) {
      return request("commute", { location });
    }
  });
})();
