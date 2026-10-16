(() => {
  "use strict";
  if (location.protocol !== "https:" || location.hostname === "shipitmyguy-ux.github.io" ||
      !globalThis.RavenPrepareDom) return;
  const dom = globalThis.RavenPrepareDom;
  let context = null;
  const same = (a, b) => {
    try { return new URL(a).href === new URL(b).href; } catch { return false; }
  };
  function reportInspection() {
    if (!context || !same(location.href, context.expectedUrl)) return;
    const inspected = dom.inspect({ title: context.title, company: context.company });
    const status = inspected.status === "ready" ? "ready" : inspected.retryable ? "waiting_fields" : "needs_user";
    chrome.runtime.sendMessage({ type: "raven-apply-v3-inspection", requestId: context.requestId,
      attemptId: context.attemptId, jobId: context.jobId, revision: context.revision,
      status, reason: inspected.reason || "" }, () => void chrome.runtime.lastError);
    if (status === "waiting_fields") {
      const deadline = Date.now() + 10000;
      const again = () => {
        if (Date.now() > deadline || !context) return;
        const next = dom.inspect({ title: context.title, company: context.company });
        if (next.status === "ready" || !next.retryable) reportInspection();
        else setTimeout(again, 250);
      };
      setTimeout(again, 250);
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "raven-apply-v3-rebind") {
      context = null;
      chrome.runtime.sendMessage({ type: "raven-apply-v3-context", url: location.href }, value => {
        void chrome.runtime.lastError;
        if (value && same(location.href, value.expectedUrl)) { context = value; reportInspection(); }
      });
      respond({ accepted: true });
      return false;
    }
    if (!context || !same(location.href, context.expectedUrl) ||
        message?.requestId !== context.requestId || message?.attemptId !== context.attemptId ||
        message?.jobId !== context.jobId || message?.revision !== context.revision) return false;
    if (message.type === "raven-apply-v3-inspect") {
      respond({ accepted: true });
      reportInspection();
      return false;
    }
    if (message.type !== "raven-apply-v3-deliver") return false;
    if (!same(message.expectedUrl, context.expectedUrl) ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(message.operationId || "") ||
        !["profile", "resume", "coverLetter", "coverLetterText"].includes(message.kind)) {
      respond({ accepted: false }); return false;
    }
    // The service worker owns durable deduplication. This in-document guard closes
    // a second dispatch race while the original operation is still processing.
    if (!globalThis.__ravenApplyV3Operations) globalThis.__ravenApplyV3Operations = new Set();
    if (globalThis.__ravenApplyV3Operations.has(message.operationId)) {
      respond({ accepted: false }); return false;
    }
    globalThis.__ravenApplyV3Operations.add(message.operationId);
    respond({ accepted: true });
    void (async () => {
      let outcome;
      try { outcome = await dom.applyOperation(message.kind, message.payload || {}); }
      catch (error) { outcome = { state: "failed", result: { reason: error?.message || "Employer form operation failed." } }; }
      chrome.runtime.sendMessage({ type: "raven-apply-v3-result", requestId: context.requestId,
        attemptId: context.attemptId, jobId: context.jobId, revision: context.revision,
        operationId: message.operationId, kind: message.kind, state: outcome.state,
        result: outcome.result }, () => void chrome.runtime.lastError);
    })();
    return false;
  });
  chrome.runtime.sendMessage({ type: "raven-apply-v3-context", url: location.href }, value => {
    void chrome.runtime.lastError;
    if (!value || !same(location.href, value.expectedUrl)) return;
    context = value;
    reportInspection();
  });
})();