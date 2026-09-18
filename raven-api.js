(() => {
  "use strict";

  // Raven API contract v1.
  // UI code should call these methods and never construct Supabase requests directly.
  const config = window.RAVEN_CONFIG || {};
  const API_VERSION = 1;

  async function request(action, payload = {}) {
    if (!config.searchApiUrl || !config.searchAnonKey) {
      throw new Error("Raven search API is not configured.");
    }

    const response = await fetch(config.searchApiUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.searchAnonKey,
        "apikey": config.searchAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...payload })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Search backend returned an unreadable response.");
    }

    if (!response.ok || data.ok === false || data.error) {
      throw new Error(data.error || "Search backend failed.");
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
