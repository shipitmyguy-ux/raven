(() => {
  "use strict";
  const KEY = "ravenApplyAttemptsV3";
  const ID = /^[A-Za-z0-9_-]{1,160}$/;
  const LIFE = 2 * 60 * 60 * 1000;
  let chain = Promise.resolve();
  const serial = work => { const result = chain.then(work); chain = result.catch(() => {}); return result; };
  const reply = (send, value) => { try { send(value); } catch {} };
  const same = (a, b) => {
    try { return new URL(a).href === new URL(b).href; } catch { return false; }
  };
  function sameDoverRouteForInspection(expected, current) {
    try {
      const a = new URL(expected), b = new URL(current);
      if (a.protocol !== "https:" || b.protocol !== "https:" || a.origin !== b.origin ||
          a.hostname !== "app.dover.com" || b.hostname !== "app.dover.com" ||
          a.hash !== b.hash) return false;
      const route = url => {
        const match = url.pathname.match(/^\/apply\/([^/]+)\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i);
        return match ? [match[1].toLowerCase(), match[2].toLowerCase()] : null;
      };
      const left = route(a), right = route(b);
      if (!left || !right || left[0] !== right[0] || left[1] !== right[1]) return false;
      const params = url => [...url.searchParams.entries()]
        .filter(([key]) => key.toLowerCase() !== "rs" && !/^utm_[a-z0-9_]+$/i.test(key))
        .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
      return JSON.stringify(params(a)) === JSON.stringify(params(b));
    } catch { return false; }
  }
  const trusted = sender => {
    try {
      const url = new URL(sender?.url || "");
      return sender?.frameId === 0 && url.protocol === "https:" &&
        url.hostname === "shipitmyguy-ux.github.io" && url.pathname.startsWith("/raven/") &&
        !url.username && !url.password && same(sender.url, sender.tab?.url);
    } catch { return false; }
  };
  function safeUrl(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048)
      throw Error("Application URL must be bounded HTTPS without credentials.");
    return url.href;
  }
  function targetOf(value) {
    const raw = value?.payload?.targetUrl;
    if (typeof raw !== "string") throw Error("Target URL is required.");
    const url = new URL(safeUrl(raw));
    if (url.hostname === "jobs.ashbyhq.com" &&
        /^\/[a-z0-9-]+\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(url.pathname))
      url.pathname = url.pathname.replace(/\/$/, "") + "/application";
    return url.href;
  }
  function cleanPayload(message) {
    if (message?.version !== 3 || !ID.test(message.requestId || "") ||
        !ID.test(message.attemptId || "") || !ID.test(message.jobId || "") ||
        !["open", "inspect", "deliver", "status", "cancel"].includes(message.action) ||
        message.tabId !== undefined || message.payload?.tabId !== undefined)
      throw Error("Invalid protocol 3 request.");
    return message;
  }
  async function read() {
    const all = (await chrome.storage.local.get(KEY))[KEY] || {};
    for (const [id, item] of Object.entries(all)) if (!item || Date.now() - item.createdAt > LIFE)
      delete all[id];
    return all;
  }
  const save = all => chrome.storage.local.set({ [KEY]: all });
  const snapshot = (item, requestId = item.requestId) => ({
    ok: true, kind: "snapshot", version: 3, requestId, attemptId: item.attemptId,
    jobId: item.jobId, status: item.status, phase: item.phase, bindingRevision: item.revision,
    sequence: item.sequence, observedUrl: item.observedUrl || item.expectedUrl || item.listingUrl,
    tabId: item.tabId, formReady: Boolean(item.formReady && item.readyRevision === item.revision &&
      item.readyDocumentId === item.documentId), documents: item.documents, operations: item.operations,
    reason: item.reason || ""
  });
  const error = (message, reason) => ({
    ok: false, kind: "error", version: 3, requestId: message?.requestId,
    attemptId: message?.attemptId, jobId: message?.jobId, error: reason, reason
  });
  const tab = id => new Promise((resolve, reject) => chrome.tabs.get(id, value =>
    chrome.runtime.lastError || !value ? reject(Error(chrome.runtime.lastError?.message || "Application tab closed.")) : resolve(value)));
  const create = () => new Promise((resolve, reject) => chrome.tabs.create({ url: "about:blank", active: true }, value =>
    chrome.runtime.lastError || !value?.id ? reject(Error(chrome.runtime.lastError?.message || "Could not open application tab.")) : resolve(value)));
  const navigate = (id, url) => new Promise((resolve, reject) => chrome.tabs.update(id, { url }, value =>
    chrome.runtime.lastError || !value ? reject(Error(chrome.runtime.lastError?.message || "Could not open application page.")) : resolve(value)));
  const send = (id, message) => new Promise((resolve, reject) => chrome.tabs.sendMessage(id, message, { frameId: 0 }, response =>
    chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve(response)));
  function owner(message, all) {
    const item = all[message.attemptId];
    if (!item || item.jobId !== message.jobId)
      throw Error("Attempt identity does not match.");
    return item;
  }
  function boundSender(item, sender) {
    return sender?.frameId === 0 && sender?.tab?.id === item.tabId &&
      sender?.documentId && item.documentId === sender.documentId &&
      same(sender.url, item.expectedUrl) && same(sender.tab?.url, item.expectedUrl);
  }
  async function operationOf(payload) {
    const id = payload?.operationId;
    if (!ID.test(id || "") || JSON.stringify(payload).length > 4 * 1024 * 1024)
      throw Error("Invalid or oversized delivery operation.");
    const document = payload.document;
    const kind = document?.kind || (payload.coverLetterText ? "coverLetterText" : "profile");
    if (!["resume", "coverLetter", "coverLetterText", "profile"].includes(kind))
      throw Error("Unknown delivery kind.");
    if (document) {
      if (!["resume", "coverLetter"].includes(document.kind) ||
          !/^[0-9a-f]{64}$/i.test(document.pdfSha256 || "") ||
          !/^[0-9a-f]{64}$/i.test(document.documentSha256 || "") ||
          !/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/i.test(document.dataUrl || "") ||
          document.dataUrl.length > 2796250 ||
          typeof document.filename !== "string" || document.filename.length > 160 ||
          !/\.pdf$/i.test(document.filename))
        throw Error("Invalid PDF operation.");
    } else if (kind === "coverLetterText") {
      if (typeof payload.coverLetterText?.text !== "string" || payload.coverLetterText.text.length > 20000 ||
          !/^[0-9a-f]{64}$/i.test(payload.coverLetterText.documentSha256 || ""))
        throw Error("Invalid cover-letter text operation.");
    } else if (kind === "profile") {
      if (!payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile) ||
          payload.answers && (typeof payload.answers !== "object" || Array.isArray(payload.answers)))
        throw Error("Invalid profile operation.");
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    return { id, kind, hash, pdfSha256: document?.pdfSha256 || null };
  }
  async function digestDocument(document) {
    if (!document) return;
    const binary = atob(document.dataUrl.split(",")[1]);
    if (!binary.startsWith("%PDF-") || binary.length > 2 * 1024 * 1024) throw Error("PDF bytes are invalid.");
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    if (actual !== document.pdfSha256.toLowerCase()) throw Error("PDF hash mismatch.");
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "raven-apply-v3-context") {
      serial(async () => {
        const all = await read();
        const item = Object.values(all).find(value => value.tabId === sender?.tab?.id && value.phase !== "cancelled");
        if (!item || sender?.frameId !== 0 || !same(sender.url, item.expectedUrl) ||
            !same(sender.tab?.url, item.expectedUrl) || !same(message.url, item.expectedUrl) ||
            !sender.documentId) return reply(sendResponse, null);
        if (item.documentId !== sender.documentId) {
          item.formReady = false;
          item.readyDocumentId = null;
          item.readyRevision = null;
          item.documentId = sender.documentId;
          item.sequence++;
          await save(all);
        }
        reply(sendResponse, { attemptId: item.attemptId, requestId: item.requestId, jobId: item.jobId,
          revision: item.revision, title: item.title, company: item.company, expectedUrl: item.expectedUrl });
      }).catch(() => reply(sendResponse, null));
      return true;
    }
    if (message?.type === "raven-apply-v3-authority") {
      serial(async () => {
        const all = await read(), item = all[message.attemptId];
        const op = item?.operations?.[message.operationId];
        const valid = Boolean(item && op && op.state === "dispatching" &&
          item.jobId === message.jobId && item.revision === message.revision &&
          item.formReady && item.readyRevision === item.revision &&
          item.readyDocumentId === item.documentId && boundSender(item, sender) &&
          same(message.expectedUrl, item.expectedUrl) &&
          same((await tab(item.tabId)).url, item.expectedUrl));
        reply(sendResponse, { authorized: valid });
      }).catch(() => reply(sendResponse, { authorized: false }));
      return true;
    }
    if (message?.type === "raven-apply-v3-inspection" || message?.type === "raven-apply-v3-result") {
      serial(async () => {
        const all = await read(), item = all[message.attemptId];
        if (!item || !boundSender(item, sender) || item.revision !== message.revision ||
            item.jobId !== message.jobId) return;
        if (message.type === "raven-apply-v3-inspection") {
          item.observedUrl = sender.url;
          item.phase = message.status === "ready" ? "ready" : message.status === "waiting_fields" ? "waiting_fields" : "needs_user";
          item.status = item.phase;
          item.formReady = message.status === "ready";
          item.readyRevision = item.formReady ? item.revision : null;
          item.readyDocumentId = item.formReady ? item.documentId : null;
          item.reason = String(message.reason || "").slice(0, 240);
        } else {
          const op = item.operations[message.operationId];
          if (!op || op.state !== "dispatching" || op.kind !== message.kind) return;
          op.state = message.state;
          op.result = message.result || {};
          item.phase = message.state === "page_confirmed" ? "page_confirmed" :
            message.state === "selected" ? "unconfirmed" :
            message.state === "rejected" || message.state === "no_control" ? "needs_user" :
            message.state === "filled" ? "ready" : "failed";
          item.status = item.phase;
          if (message.kind === "resume" || message.kind === "coverLetter")
            item.documents[message.kind] = { state: message.state, operationId: message.operationId,
              documentSha256: op.documentSha256, pdfSha256: op.pdfSha256, evidence: message.result?.evidence || "" };
        }
        item.sequence++;
        await save(all);
      }).catch(() => {});
      return false;
    }
    if (message?.type !== "raven-apply-attempt") return false;
    if (!trusted(sender)) {
      reply(sendResponse, error(message, "Untrusted Raven sender.")); return false;
    }
    serial(async () => {
      cleanPayload(message);
      const all = await read();
      if (message.action === "open") {
        const expectedUrl = message.payload?.targetUrl ? targetOf(message) : null;
        const title = message.payload?.title, company = message.payload?.company;
        if (typeof title !== "string" || !title.trim() || title.length > 300 ||
            typeof company !== "string" || !company.trim() || company.length > 300)
          throw Error("Invalid job title or company.");
        const listingUrl = message.payload?.listingUrl ? safeUrl(message.payload.listingUrl) : expectedUrl;
        if (!listingUrl) throw Error("Listing URL is required to reserve a tab.");
        const prior = all[message.attemptId];
        if (prior) {
          owner(message, all);
          if (prior.title !== title || prior.company !== company || !same(prior.listingUrl, listingUrl) ||
              (prior.expectedUrl && expectedUrl && !same(prior.expectedUrl, expectedUrl)))
            throw Error("Attempt ID belongs to another destination.");
          if (!prior.expectedUrl && expectedUrl) {
            prior.expectedUrl = expectedUrl;
            prior.observedUrl = expectedUrl;
            prior.phase = prior.status = "opening";
            prior.sequence++; await save(all);
            await navigate(prior.tabId, expectedUrl);
          }
          return reply(sendResponse, snapshot(prior, message.requestId));
        }
        const item = {
          requestId: message.requestId, attemptId: message.attemptId, jobId: message.jobId,
          listingUrl, expectedUrl, title, company, createdAt: Date.now(), tabId: null,
          documentId: null, formReady: false, readyRevision: null, readyDocumentId: null,
          revision: 1, sequence: 1, phase: expectedUrl ? "opening" : "reserved",
          status: expectedUrl ? "opening" : "reserved", observedUrl: expectedUrl || listingUrl, documents: { resume: { state: "not_requested" }, coverLetter: { state: "not_requested" } },
          operations: {}, reason: ""
        };
        all[item.attemptId] = item; await save(all);
        try {
          const opened = await create();
          item.tabId = opened.id; item.sequence++; await save(all);
          if (expectedUrl) await navigate(opened.id, expectedUrl);
        } catch (e) {
          item.phase = item.status = "failed"; item.reason = e.message; item.sequence++; await save(all);
          throw e;
        }
        return reply(sendResponse, snapshot(item, message.requestId));
      }
      const item = owner(message, all);
      if (message.action === "status") return reply(sendResponse, snapshot(item, message.requestId));
      if (message.action === "cancel") {
        item.phase = item.status = "cancelled"; item.revision++; item.documentId = null;
        item.formReady = false; item.readyRevision = null; item.readyDocumentId = null;
        item.sequence++; await save(all); return reply(sendResponse, snapshot(item, message.requestId));
      }
      if (message.bindingRevision !== item.revision)
        throw Error("Binding revision changed. Inspect the current tab.");
      if (item.phase === "cancelled" || !item.tabId) throw Error("Application attempt is unavailable.");
      const current = await tab(item.tabId);
      if (!same(current.url, item.expectedUrl)) {
        const explicitlyReinspected = message.action === "inspect" && message.payload?.useCurrentPage === true;
        const equivalentDoverRoute = message.action === "inspect" &&
          message.payload?.allowEquivalentRoute === true &&
          sameDoverRouteForInspection(item.expectedUrl, current.url);
        if (!explicitlyReinspected && !equivalentDoverRoute)
          throw Error("Application tab navigated. Inspect this tab before delivery.");
        item.expectedUrl = safeUrl(current.url);
        item.observedUrl = item.expectedUrl;
        item.documentId = null;
        item.formReady = false; item.readyRevision = null; item.readyDocumentId = null;
        item.phase = item.status = "waiting_fields";
        item.reason = "Inspecting the current page in the same tab.";
        item.sequence++; await save(all);
        try { await send(item.tabId, { type: "raven-apply-v3-rebind" }); } catch {}
        return reply(sendResponse, snapshot(item, message.requestId));
      }
      if (message.action === "inspect") {
        item.formReady = false; item.readyRevision = null; item.readyDocumentId = null;
        item.phase = item.status = "waiting_fields"; item.sequence++; await save(all);
        if (!item.documentId) return reply(sendResponse, snapshot(item, message.requestId));
        try { await send(item.tabId, { type: "raven-apply-v3-inspect", requestId: item.requestId,
          attemptId: item.attemptId, jobId: item.jobId, revision: item.revision }); }
        catch (e) { item.phase = item.status = "waiting_fields"; item.reason = e.message; item.sequence++; await save(all); }
        return reply(sendResponse, snapshot(item, message.requestId));
      }
      if (!item.formReady || item.readyRevision !== item.revision ||
          !item.documentId || item.readyDocumentId !== item.documentId)
        throw Error("A ready inspection of the current bound form is required before delivery.");
      await digestDocument(message.payload?.document);
      const op = await operationOf(message.payload);
      const prior = item.operations[op.id];
      if (prior) {
        if (prior.hash !== op.hash || prior.kind !== op.kind)
          throw Error("Operation ID was already used with different content.");
        return reply(sendResponse, snapshot(item, message.requestId));
      }
      if (op.kind === "resume" || op.kind === "coverLetter") {
        const existingFile = Object.entries(item.operations).find(([, value]) =>
          value.kind === op.kind && value.pdfSha256 === op.pdfSha256 &&
          ["dispatching", "selected", "page_confirmed", "uncertain"].includes(value.state));
        if (existingFile) throw Error("This PDF may already be selected. Inspect the employer page before another operation.");
      }
      item.operations[op.id] = { kind: op.kind, hash: op.hash, pdfSha256: op.pdfSha256,
        documentSha256: message.payload?.document?.documentSha256 || null,
        revision: item.revision, state: "dispatching", startedAt: Date.now() };
      item.phase = item.status = op.kind === "profile" || op.kind === "coverLetterText" ? "filling" : "selecting";
      item.sequence++; await save(all);
      // Persist before dispatch. Silence leaves an uncertain operation that may only be inspected.
      try {
        const ack = await send(item.tabId, { type: "raven-apply-v3-deliver", requestId: item.requestId,
          attemptId: item.attemptId, jobId: item.jobId, revision: item.revision,
          operationId: op.id, kind: op.kind, expectedUrl: item.expectedUrl, payload: message.payload });
        if (!ack?.accepted) throw Error("Bound document did not acknowledge delivery.");
      } catch (e) {
        item.reason = "Delivery acknowledgement uncertain: " + e.message;
        item.sequence++; await save(all);
      }
      reply(sendResponse, { ...snapshot(item, message.requestId), kind: "ack", operationId: op.id, status: "dispatching", phase: "dispatching" });
    }).catch(e => reply(sendResponse, error(message, e.message || "Apply attempt failed.")));
    return true;
  });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (!info.url && info.status !== "loading") return;
    serial(async () => {
      const all = await read();
      for (const item of Object.values(all)) {
        if (item.tabId !== tabId || item.phase === "cancelled") continue;
        // The first navigation belongs to open. Every later document load revokes old authority.
        if (item.phase === "reserved" && (!info.url || info.url === "about:blank")) continue;
        if (item.phase === "opening" && (!info.url || info.url === "about:blank" || same(info.url, item.expectedUrl))) continue;
        item.revision++;
        item.sequence++;
        item.documentId = null;
        item.formReady = false; item.readyRevision = null; item.readyDocumentId = null;
        item.observedUrl = info.url || item.observedUrl;
        item.phase = item.status = "navigated";
        item.reason = "Page navigation requires inspection before further delivery.";
        for (const op of Object.values(item.operations))
          if (op.state === "dispatching") op.state = "uncertain";
      }
      await save(all);
    }).catch(() => {});
  });
  chrome.tabs.onRemoved.addListener(tabId => serial(async () => {
    const all = await read();
    for (const item of Object.values(all)) if (item.tabId === tabId) {
      item.revision++; item.sequence++; item.documentId = null;
      item.formReady = false; item.readyRevision = null; item.readyDocumentId = null;
      item.phase = item.status = "needs_user"; item.reason = "Application tab closed.";
    }
    await save(all);
  }).catch(() => {}));
})();