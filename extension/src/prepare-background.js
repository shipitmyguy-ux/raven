// Explicit destination inspection followed by one-time delivery to the inspected tab.
(() => {
  "use strict";
  const KEY = "ravenPreparedApplications", AGE = 15 * 60000, ID = /^[A-Za-z0-9_-]{1,160}$/;
  let chain = Promise.resolve();
  const pending = new Map(), initializing = new Map();
  const serial = fn => { const result = chain.then(fn); chain = result.catch(() => {}); return result; };
  const reply = (fn, value) => { try { fn(value); } catch {} };
  function same(a, b) {
    try { const x = new URL(a), y = new URL(b); x.hash = y.hash = ""; return x.href === y.href; } catch { return false; }
  }
  function trusted(sender) {
    try {
      const u = new URL(sender?.url || "");
      return sender?.frameId === 0 && u.protocol === "https:" && u.hostname === "shipitmyguy-ux.github.io" &&
        u.pathname.startsWith("/raven/") && !u.username && !u.password && same(sender.url, sender.tab?.url);
    } catch { return false; }
  }
  function targetOf(value) {
    if (!value || !ID.test(value.jobId || "") || typeof value.title !== "string" || value.title.length > 300 ||
        typeof value.company !== "string" || value.company.length > 300 || typeof value.jobUrl !== "string") throw Error("Invalid job identity.");
    const url = new URL(value.jobUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048) throw Error("Application URL must be bounded HTTPS without credentials.");
    if (url.hostname === "jobs.ashbyhq.com" && /^\/[a-z0-9-]+\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(url.pathname))
      url.pathname = url.pathname.replace(/\/$/, "") + "/application";
    return url.href;
  }
  function validPdf(data) {
    const match = String(data || "").match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match || match[1].length > 2796212) return false;
    try { const bytes = atob(match[1]); return bytes.startsWith("%PDF-") && bytes.length <= 2 * 1024 * 1024; } catch { return false; }
  }
  function packetCheck(packet) {
    if (packet?.version !== 2 || packet.mode !== "prepare") throw Error("Invalid prepare packet.");
    targetOf(packet);
    if(packet.coverLetterText !== undefined && (typeof packet.coverLetterText !== "string" || packet.coverLetterText.length > 20000))throw Error("Invalid saved cover-letter text.");
    const age = Date.now() - Date.parse(packet.createdAt);
    if (!Number.isFinite(age) || age < -30000 || age > 300000) throw Error("Prepare packet expired.");
    if (!packet.profile || typeof packet.profile !== "object" || Array.isArray(packet.profile) ||
        !packet.answers || typeof packet.answers !== "object" || Array.isArray(packet.answers) ||
        JSON.stringify(packet).length > 8 * 1024 * 1024 || !validPdf(packet.resume) || !validPdf(packet.coverLetter))
      throw Error("Prepare packet or PDF files are invalid.");
  }
  async function get() {
    const all = (await chrome.storage.local.get(KEY))[KEY] || {};
    for (const [id, item] of Object.entries(all)) if (!item || Date.now() - item.createdAt > AGE) delete all[id];
    return all;
  }
  const save = all => chrome.storage.local.set({ [KEY]: all });
  const tab = id => new Promise((resolve, reject) => chrome.tabs.get(id, value =>
    chrome.runtime.lastError || !value ? reject(Error(chrome.runtime.lastError?.message || "Application tab closed.")) : resolve(value)));
  const create = () => new Promise((resolve, reject) => chrome.tabs.create({ url: "about:blank", active: true }, value =>
    chrome.runtime.lastError || !value?.id ? reject(Error(chrome.runtime.lastError?.message || "Could not open application tab.")) : resolve(value)));
  const navigate = (id, url) => new Promise((resolve, reject) => chrome.tabs.update(id, { url }, value =>
    chrome.runtime.lastError || !value ? reject(Error(chrome.runtime.lastError?.message || "Could not open application page.")) : resolve()));
  const deliver = (id, message) => new Promise((resolve, reject) => chrome.tabs.sendMessage(id, message, { frameId: 0 }, response =>
    chrome.runtime.lastError || !response?.accepted ? reject(Error(chrome.runtime.lastError?.message || "Inspected page did not accept the packet.")) : resolve()));
  function finish(id, outcome) {
    const wait = pending.get(id);
    if (!wait) return;
    pending.delete(id); clearTimeout(wait.timer);
    reply(wait.callback, { requestId: id, ...outcome });
  }
  function fail(id, reason) {
    finish(id, { ok: false, status: "blocked", reason });
    serial(async () => { const all = await get(); if (all[id]) { delete all[id]; await save(all); } });
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "raven-preflight-application" || message?.type === "raven-prepare-application") {
      reply(sendResponse, { requestId: message.requestId, ok: false, status: "unsupported",
        reason: "Protocol 2 form delivery is retired. Update Raven and use Apply protocol 3." });
      return false;
    }
    if (message?.type === "raven-preflight-context") {
      serial(async () => {
        const all = await get();
        const item = Object.values(all).find(value => value.tabId === sender?.tab?.id && value.stage === "opening");
        reply(sendResponse, item && sender?.frameId === 0 && same(sender.url, item.expectedUrl) &&
          same(sender.tab?.url, item.expectedUrl) && same(message.url, item.expectedUrl)
          ? { title: item.title, company: item.company } : null);
      }).catch(() => reply(sendResponse, null));
      return true;
    }
    if (message?.type === "raven-preflight-application") {
      const id = message.requestId;
      if (!trusted(sender) || !ID.test(id || "")) {
        reply(sendResponse, { requestId: id, ok: false, status: "blocked", reason: "Untrusted Raven sender or request ID." }); return false;
      }
      let expectedUrl;
      try { expectedUrl = targetOf(message); } catch (e) {
        reply(sendResponse, { requestId: id, ok: false, status: "blocked", reason: e.message }); return false;
      }
      serial(async () => {
        const all = await get();
        const prior = all[id];
        if (prior?.stage === "opening") {
          reply(sendResponse, { requestId: id, ok: false, status: "blocked", reason: "Inspection is already running." });
          return;
        }
        if (prior && ["delivering", "delivered", "complete"].includes(prior.stage)) {
          const sameJob = prior.jobId === message.jobId && prior.jobUrl === message.jobUrl &&
            prior.title === message.title && prior.company === message.company && same(prior.expectedUrl, expectedUrl);
          if (!sameJob) {
            reply(sendResponse, { requestId: id, ok: false, status: "blocked", reason: "This request ID belongs to a different application." });
            return;
          }
          if (prior.stage === "delivering") {
            reply(sendResponse, { requestId: id, ok: false, status: "manual", reason: "The previous preparation may already be open. Review the existing application tab before retrying." });
            return;
          }
          try {
            const existing = await tab(prior.tabId);
            if (same(existing.url, prior.expectedUrl)) {
              reply(sendResponse, { requestId: id, ok: true, status: "ready", alreadyPrepared: true,
                preflightId: prior.preflightId, tabId: prior.tabId, observedUrl: prior.expectedUrl });
              return;
            }
          } catch {}
        }
        // An explicit retry replaces the prior binding. Its old tab can no longer receive a packet.
        delete all[id];
        const item = { createdAt: Date.now(), tabId: null, preflightId: crypto.randomUUID(), jobId: message.jobId,
          jobUrl: message.jobUrl, expectedUrl, title: message.title, company: message.company, stage: "opening" };
        all[id] = item; await save(all);
        pending.set(id, { callback: sendResponse, timer: setTimeout(() => fail(id, "Destination inspection timed out. Retry Prepare."), 15000) });
        const opened = await create();
        initializing.set(opened.id, expectedUrl);
        item.tabId = opened.id; await save(all);
        await navigate(opened.id, expectedUrl);
      }).catch(e => fail(id, e.message || "Could not inspect destination."));
      return true;
    }
    if (message?.type === "raven-preflight-result") {
      serial(async () => {
        const all = await get();
        const [id, item] = Object.entries(all).find(([, value]) => value.tabId === sender?.tab?.id && value.stage === "opening") || [];
        if (!item || sender?.frameId !== 0 || !same(sender.url, item.expectedUrl) ||
            !same(sender.tab?.url, item.expectedUrl) || !same(message.url, item.expectedUrl)) return;
        if (message.status !== "ready") {
          delete all[id]; await save(all);
          finish(id, { ok: false, status: message.status === "manual" ? "manual" : "blocked",
            reason: String(message.reason || "Destination needs manual review.").slice(0, 240), observedUrl: message.url });
          return;
        }
        item.stage = "ready"; await save(all);
        finish(id, { ok: true, status: "ready", preflightId: item.preflightId, tabId: item.tabId, observedUrl: message.url });
      }).catch(() => {});
      return false;
    }
    if (message?.type === "raven-prepare-application") {
      const id = message.requestId;
      if (!trusted(sender) || !ID.test(id || "")) {
        reply(sendResponse, { requestId: id, ok: false, error: "Untrusted Raven sender or request ID." }); return false;
      }
      serial(async () => {
        packetCheck(message.packet);
        const all = await get(), item = all[id];
        if (!item || item.stage !== "ready" || item.preflightId !== message.preflightId ||
            item.jobId !== message.packet.jobId || item.jobUrl !== message.packet.jobUrl ||
            item.title !== message.packet.title || item.company !== message.packet.company)
          throw Error("Preflight binding changed or expired. Retry Prepare.");
        const current = await tab(item.tabId);
        if (!same(current.url, item.expectedUrl)) throw Error("Application tab navigated. Retry Prepare.");
        item.stage = "delivering"; await save(all);
        try { await deliver(item.tabId, { type: "raven-prepare-deliver", packet: message.packet,
          expectedUrl: item.expectedUrl, preflightId: item.preflightId }); }
        catch (e) { delete all[id]; await save(all); throw e; }
        item.stage = "delivered"; await save(all);
        reply(sendResponse, { requestId: id, ok: true, tabId: item.tabId });
      }).catch(e => reply(sendResponse, { requestId: id, ok: false, error: e.message || "Delivery failed. Retry Prepare." }));
      return true;
    }
    if (message?.type === "raven-prepare-status") {
      serial(async () => { const all = await get(); reply(sendResponse, { prepared: Object.values(all).some(item =>
        item.tabId === sender?.tab?.id && same(sender?.url, item.expectedUrl) && same(sender?.tab?.url, item.expectedUrl)) }); })
        .catch(() => reply(sendResponse, { prepared: false }));
      return true;
    }
    if (message?.type === "raven-prepare-result") serial(async () => {
      const all = await get();
      const [id] = Object.entries(all).find(([, item]) => item.tabId === sender?.tab?.id && item.stage === "delivered" &&
        sender?.frameId === 0 && same(sender?.url, item.expectedUrl) && same(sender?.tab?.url, item.expectedUrl)) || [];
      if (id) { all[id].stage = "complete"; all[id].completedAt = Date.now(); await save(all); }
    });
    return false;
  });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (!info.url) return;
    const initial = initializing.get(tabId);
    if (initial && (info.url === "about:blank" || same(info.url, initial))) {
      if (info.url !== "about:blank") initializing.delete(tabId);
      return;
    }
    initializing.delete(tabId);
    serial(async () => {
      const all = await get();
      for (const [id, item] of Object.entries(all)) if (item.tabId === tabId && !same(info.url, item.expectedUrl)) {
        delete all[id];
        finish(id, { ok: false, status: item.stage === "opening" ? "manual" : "blocked",
          reason: "Application redirected or navigated. Review its access requirements before resuming form preparation.", observedUrl: info.url });
      }
      await save(all);
    });
  });
  chrome.tabs.onRemoved.addListener(tabId => {
    initializing.delete(tabId);
    serial(async () => {
      const all = await get();
      for (const [id, item] of Object.entries(all)) if (item.tabId === tabId) {
        delete all[id]; finish(id, { ok: false, status: "blocked", reason: "Application tab closed. Retry Prepare." });
      }
      await save(all);
    });
  });
})();
