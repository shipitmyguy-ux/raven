// Explicit, one-tab application preparation bridge. Loaded after background.js.
(() => {
  "use strict";
  const RAVEN_HOST = "shipitmyguy-ux.github.io";
  const RAVEN_PATH = "/raven/";
  const KEY = "ravenPreparedApplications";
  const MAX_AGE = 15 * 60 * 1000;
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_PACKET_CHARS = 8 * 1024 * 1024;
  const UUID = /^[A-Za-z0-9_-]{1,160}$/;
  let storageQueue = Promise.resolve();
  const initializingTabs = new Map();
  const preparedTabs = new Set();
  const serialize = operation => {
    const result = storageQueue.then(operation);
    storageQueue = result.catch(() => {});
    return result;
  };

  function trustedRaven(sender) {
    try {
      const url = new URL(sender?.url || "");
      return sender?.frameId === 0 && url.protocol === "https:" && url.hostname === RAVEN_HOST && url.pathname.startsWith(RAVEN_PATH) && !url.username && !url.password;
    } catch { return false; }
  }
  function sameInitialUrl(actual, expected) {
    try {
      const a = new URL(actual), e = new URL(expected);
      a.hash = ""; e.hash = "";
      return a.href === e.href;
    } catch { return false; }
  }
  function applicationTarget(jobUrl) {
    try {
      const target = new URL(jobUrl);
      if (target.protocol === "https:" && target.hostname === "jobs.ashbyhq.com" && /^\/[a-z0-9-]+\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(target.pathname)) {
        target.pathname = target.pathname.replace(/\/$/, "") + "/application";
      }
      return target.href;
    } catch { return jobUrl; }
  }
  function pdfBytes(dataUrl) {
    const match = String(dataUrl || "").match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match || match[1].length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4) return null;
    try {
      const binary = atob(match[1]);
      if (!binary.startsWith("%PDF-") || binary.length > MAX_FILE_BYTES) return null;
      return binary.length;
    } catch { return null; }
  }
  function validatePacket(packet) {
    if (!packet || packet.version !== 2 || packet.mode !== "prepare" || !UUID.test(packet.jobId || "")) return "Invalid prepare packet identity.";
    const created = Date.parse(packet.createdAt);
    if (!Number.isFinite(created) || created > Date.now() + 30_000 || Date.now() - created > 5 * 60_000) return "Prepare packet is expired or has an invalid date.";
    if (typeof packet.jobUrl !== "string" || packet.jobUrl.length > 2048) return "Application URL is invalid.";
    try {
      const target = new URL(packet.jobUrl);
      if (target.protocol !== "https:" || target.username || target.password || target.hostname.length > 253) return "Application URL must be a bounded HTTPS URL without credentials.";
    } catch { return "Application URL is invalid."; }
    if (typeof packet.title !== "string" || packet.title.length > 300 || typeof packet.company !== "string" || packet.company.length > 300) return "Job details exceed the allowed size.";
    if (!packet.profile || typeof packet.profile !== "object" || Array.isArray(packet.profile) || !packet.answers || typeof packet.answers !== "object" || Array.isArray(packet.answers)) return "Profile or answer data is invalid.";
    if (JSON.stringify(packet).length > MAX_PACKET_CHARS) return "Prepare packet exceeds the size limit.";
    if (!pdfBytes(packet.resume) || !pdfBytes(packet.coverLetter)) return "Generated resume and cover letter must be valid PDF files under 2 MB.";
    return "";
  }
  async function getRequests() {
    const values = await chrome.storage.local.get(KEY);
    const requests = values[KEY] || {};
    const now = Date.now();
    for (const [id, item] of Object.entries(requests)) if (!item || now - item.createdAt > MAX_AGE) delete requests[id];
    return requests;
  }
  async function saveRequests(requests) { await chrome.storage.local.set({ [KEY]: requests }); }
  function sendResponseSafe(sendResponse, value) { try { sendResponse(value); } catch {} }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "raven-prepare-application") {
      if (!trustedRaven(sender)) { sendResponseSafe(sendResponse, { requestId: message.requestId, ok: false, error: "Untrusted Raven sender." }); return false; }
      const requestId = message.requestId;
      const packet = message.packet;
      if (!UUID.test(requestId || "")) { sendResponseSafe(sendResponse, { requestId, ok: false, error: "Invalid request ID." }); return false; }
      const error = validatePacket(packet);
      if (error) { sendResponseSafe(sendResponse, { requestId, ok: false, error }); return false; }
      serialize(async () => {
        const requests = await getRequests();
        if (requests[requestId]) throw new Error("Request ID was already used.");
        // Persist the complete bounded packet before opening any employer tab.
        const targetUrl = applicationTarget(packet.jobUrl);
        requests[requestId] = { createdAt: Date.now(), tabId: null, jobUrl: targetUrl, delivered: false, initializing: true, packet };
        await saveRequests(requests);
        const tab = await new Promise((resolve, reject) => chrome.tabs.create({ url: "about:blank", active: true }, created => {
          const lastError = chrome.runtime.lastError;
          if (lastError || !created?.id) reject(new Error(lastError?.message || "Could not create application tab.")); else resolve(created);
        }));
        initializingTabs.set(tab.id, targetUrl);
        requests[requestId].tabId = tab.id;
        await saveRequests(requests);
        await new Promise((resolve, reject) => chrome.tabs.update(tab.id, { url: targetUrl }, updated => {
          const lastError = chrome.runtime.lastError;
          if (lastError || !updated) reject(new Error(lastError?.message || "Could not open application page.")); else resolve();
        }));
        initializingTabs.delete(tab.id);
        preparedTabs.add(tab.id);
        const current = await getRequests();
        if (current[requestId]) { current[requestId].initializing = false; await saveRequests(current); }
        sendResponseSafe(sendResponse, { requestId, ok: true, tabId: tab.id });
      }).catch(async e => {
        await serialize(async () => { const requests = await getRequests(); delete requests[requestId]; await saveRequests(requests); });
        sendResponseSafe(sendResponse, { requestId, ok: false, error: e.message || "Could not prepare application." });
      });
      return true;
    }
    if (message?.type === "raven-prepare-ready") {
      serialize(async () => {
        const requests = await getRequests();
        const item = Object.values(requests).find(entry => entry.tabId === sender?.tab?.id);
        if (!item || item.delivered || !item.packet || !sameInitialUrl(sender?.tab?.url, item.jobUrl) || !sameInitialUrl(message.url, item.jobUrl)) return sendResponseSafe(sendResponse, null);
        item.delivered = true;
        await saveRequests(requests);
        sendResponseSafe(sendResponse, { packet: item.packet });
      }).catch(() => sendResponseSafe(sendResponse, null));
      return true;
    }
    if (message?.type === "raven-prepare-status") {
      serialize(async () => {
        const requests = await getRequests();
        const prepared = Object.values(requests).some(item => item.tabId === sender?.tab?.id && sameInitialUrl(sender?.tab?.url, item.jobUrl));
        sendResponseSafe(sendResponse, { prepared });
      }).catch(() => sendResponseSafe(sendResponse, { prepared: false }));
      return true;
    }
    if (message?.type === "raven-prepare-result") {
      serialize(async () => {
        const requests = await getRequests();
        const item = Object.values(requests).find(entry => entry.tabId === sender?.tab?.id);
        if (item) { item.finished = true; item.packet = null; await saveRequests(requests); }
      });
    }
    return false;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    const initialTarget = initializingTabs.get(tabId);
    if (initialTarget && changeInfo.url === "about:blank") return;
    if (initialTarget && sameInitialUrl(changeInfo.url, initialTarget)) {
      initializingTabs.delete(tabId);
      preparedTabs.add(tabId);
      serialize(async () => {
        const requests = await getRequests();
        const item = Object.values(requests).find(entry => entry.tabId === tabId);
        if (item) { item.initializing = false; await saveRequests(requests); }
      });
      return;
    }
    if (changeInfo.url === "about:blank" && !preparedTabs.has(tabId)) return;
    initializingTabs.delete(tabId);
    preparedTabs.delete(tabId);
    serialize(async () => {
      const requests = await getRequests();
      let changed = false;
      for (const [id, item] of Object.entries(requests)) {
        if (item.tabId !== tabId || sameInitialUrl(changeInfo.url, item.jobUrl)) continue;
        if (item.initializing && changeInfo.url === "about:blank") continue;
        delete requests[id]; changed = true;
      }
      if (changed) await saveRequests(requests);
    });
  });
  chrome.tabs.onRemoved.addListener(tabId => {
    initializingTabs.delete(tabId);
    preparedTabs.delete(tabId);
    serialize(async () => {
      const requests = await getRequests();
      for (const [id, item] of Object.entries(requests)) if (item.tabId === tabId) delete requests[id];
      await saveRequests(requests);
    });
  });
})();
