(() => {
  "use strict";
  if (location.hostname !== "shipitmyguy-ux.github.io") return;
  const RAVEN_URL = "https://shipitmyguy-ux.github.io/raven/";
  if (!location.href.startsWith(RAVEN_URL)) return;
  const bridge = document.getElementById("ravenExtensionBridge");
  if (!bridge) return;
  function capability() {
    bridge.dataset.prepareCapability = "2";
    bridge.dispatchEvent(new CustomEvent("raven-prepare-capability"));
    bridge.dataset.applyCapability = "3";
    bridge.dispatchEvent(new CustomEvent("raven-apply-capability"));
  }
  capability();
  bridge.addEventListener("raven-prepare-probe", capability);
  bridge.addEventListener("raven-apply-probe", capability);
  function relay(eventName, requestKey, type, responseKey, responseEvent) {
    bridge.addEventListener(eventName, () => {
      let request;
      try { request = JSON.parse(bridge.dataset[requestKey] || ""); } catch { return; }
      chrome.runtime.sendMessage({ type, ...request }, response => {
        const failure = chrome.runtime.lastError;
        bridge.dataset[responseKey] = JSON.stringify(response || {
          requestId: request.requestId, attemptId: request.attemptId, jobId: request.jobId,
          ok: false, error: failure?.message || "Extension did not respond."
        });
        bridge.dispatchEvent(new CustomEvent(responseEvent));
      });
    });
  }
  relay("raven-prepare-application", "prepareRequest", "raven-prepare-application",
    "prepareResponse", "raven-prepare-response");
  relay("raven-preflight-application", "preparePreflightRequest", "raven-preflight-application",
    "preparePreflightResponse", "raven-preflight-response");
  relay("raven-apply-request", "applyRequest", "raven-apply-attempt",
    "applyResponse", "raven-apply-response");
  // Older web builds can still navigate and use downloaded PDFs. Their version 1
  // personal packet is never stored or broadcast to arbitrary employer tabs.
    document.addEventListener("raven-chatgpt-request",()=>{
      const value=document.getElementById("ravenExtensionBridge")?.dataset.chatgptRequest;
      try{chrome.runtime.sendMessage({type:"raven-chatgpt-request",...JSON.parse(value)},()=>void chrome.runtime.lastError);}catch{}
    });
    document.addEventListener("raven-chatgpt-ack",()=>{
      const requestId=document.getElementById("ravenExtensionBridge")?.dataset.chatgptAck;
      if(requestId)chrome.runtime.sendMessage({type:"raven-chatgpt-ack",requestId},()=>void chrome.runtime.lastError);
    });
    const deliverResults=()=>chrome.storage.local.get("ravenChatGptResults",values=>{
      const bridge=document.getElementById("ravenExtensionBridge");if(!bridge)return;
      for(const text of Object.values(values.ravenChatGptResults||{})){
        bridge.dataset.chatgptResult=text;
        document.dispatchEvent(new CustomEvent("raven-chatgpt-result"));
      }
    });
    // Retry after Raven has loaded jobs, and retain files until Raven acknowledges saving.
    setInterval(deliverResults,15000);
    chrome.storage.onChanged.addListener(changes=>{
      if(changes.ravenChatGptResults)deliverResults();
      if(changes.ravenChatGptError?.newValue)banner(changes.ravenChatGptError.newValue);
    });
    deliverResults();
})();