(() => {
  "use strict";
  const core = globalThis.RavenAssistantCore;
  if (!core || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  const profileTerms = {
    firstName: ["first name", "given name"], lastName: ["last name", "surname", "family name"], fullName: ["full name", "name"],
    email: ["email", "email address"], phone: ["phone", "phone number", "mobile"], linkedin: ["linkedin"],
    portfolio: ["portfolio", "website", "personal website"], address1: ["address line 1", "street address", "address"],
    address2: ["address line 2", "apartment", "suite"], city: ["city"], region: ["state", "province", "region"],
    postalCode: ["zip", "postal code", "postcode"], country: ["country"]
  };
  const sensitiveRe = /\b(sponsor|sponsorship|visa|citizen|citizenship|authorized|authorization|salary|compensation|pay|gender|sex|race|ethnic|ethnicity|disab|veteran|attest|certif|background|criminal|conviction|age|date of birth|birth date|ssn|social security|captcha|assessment|drug|protected class)\b/i;
  function normalized(value) { return core.normalizeQuestion(value); }
  function banner(text) {
    let el = document.getElementById("raven-assistant-banner");
    if (!el) {
      el = document.createElement("div"); el.id = "raven-assistant-banner";
      Object.assign(el.style, { position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647", maxWidth: "420px", padding: "12px 14px", background: "#111827", color: "#fff", border: "1px solid #4b5563", borderRadius: "10px", font: "13px system-ui", boxShadow: "0 8px 30px #0008" });
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
  }
  function labelFor(el) {
    const id = el.id;
    let explicit = null;
    try { explicit = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null; } catch {}
    const described = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map(ref => document.getElementById(ref)?.innerText || "").join(" ");
    return [...new Set([explicit?.innerText, el.closest("label")?.innerText, el.getAttribute("aria-label"), described, el.getAttribute("placeholder")].filter(Boolean))].join(" ");
  }
  function sensitive(el, label) {
    const metadata = [label, el.name, el.id, el.getAttribute("autocomplete"), el.getAttribute("placeholder"), el.getAttribute("data-testid")].filter(Boolean).join(" ");
    return core.isSensitiveQuestion(metadata) || sensitiveRe.test(metadata);
  }
  function safeControl(el) {
    if (!el || el.disabled || el.readOnly || el.hidden || el.getAttribute("hidden") !== null || el.getAttribute("aria-hidden") === "true") return false;
    if (typeof el.getClientRects === "function" && el.getClientRects().length === 0) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.tagName !== "INPUT") return false;
    return ["text", "email", "tel", "url"].includes(String(el.type || "text").toLowerCase());
  }
  function setValue(el, value) {
    if (!safeControl(el) || el.value || value == null || String(value).trim() === "") return false;
    if (el.tagName === "SELECT") {
      const key = normalized(value);
      const option = [...el.options].find(item => normalized(item.textContent) === key || normalized(item.value) === key);
      if (!option) return false;
      el.value = option.value;
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter ? setter.call(el, String(value)) : (el.value = String(value));
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function allFields() { return [...document.querySelectorAll('input:not([type="file"]):not([type="hidden"]),textarea,select')]; }
  function valueFor(profile, key) { return key === "fullName" ? profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") : profile[key] || ""; }
  function matchesTerms(el, terms) {
    const label = normalized(labelFor(el));
    if (terms === profileTerms.fullName) return label === "name" || label === "full name";
    if (terms === profileTerms.address1 && /\b(address line 2|apartment|suite)\b/.test(label)) return false;
    return label && terms.some(term => label.includes(normalized(term)));
  }
  function candidateFor(adapter, key, fields) {
    for (const selector of core.selectorsFor(adapter, "profile", key)) {
      try {
        const el = document.querySelector(selector);
        if (el && fields.includes(el) && safeControl(el) && !sensitive(el, labelFor(el))) return el;
      } catch {}
    }
    return fields.find(el => safeControl(el) && !sensitive(el, labelFor(el)) && matchesTerms(el, profileTerms[key])) || null;
  }
  function isExcludedUpload(el) { return /\b(autofill|auto fill|import from|parse resume)\b/i.test(labelFor(el)) || sensitive(el, labelFor(el)); }
  function fileCandidate(adapter, key) {
    const fields = [...document.querySelectorAll('input[type="file"]')];
    for (const selector of core.selectorsFor(adapter, "files", key)) {
      try {
        const matches = document.querySelectorAll(selector);
        for (const el of matches) {
          if (!fields.includes(el) || isExcludedUpload(el)) continue;
          return el;
        }
      } catch {}
    }
    const terms = key === "resume" ? ["resume", "cv"] : ["cover letter", "cover"];
    return fields.find(el => matchesTerms(el, terms) && !isExcludedUpload(el)) || null;
  }
  function makePdfFile(data, key, packet) {
    const match = String(data || "").match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return null;
    try {
      const binary = atob(match[1]);
      if (!binary.startsWith("%PDF-") || binary.length > 8 * 1024 * 1024) return null;
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const stem = String(packet.company || packet.title || "Raven").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "Raven";
      const suffix = key === "resume" ? "resume" : "cover-letter";
      return new File([bytes], stem + "-" + suffix + ".pdf", { type: "application/pdf", lastModified: Date.now() });
    } catch { return null; }
  }
  async function attach(packet, key) {
    const file = makePdfFile(packet[key === "resume" ? "resume" : "coverLetter"], key, packet);
    if (!file) return { accepted: false, selected: false };
    const input = fileCandidate(core.detectAdapter(location.hostname), key);
    if (!input || input.files?.length || !core.acceptsFile(input.accept, file.name, file.type)) return { accepted: false, selected: false };
    try {
      const container = input.closest("[data-testid],.ashby-application-form,.application-form") || input.parentElement;
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
      const selected = [...(input.files || [])].some(attached => attached.name === file.name && attached.type === "application/pdf");
      if (!selected) return { accepted: false, selected: false };
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const statusText = String(container?.innerText || "");
        if (/\b(upload failed|file rejected|unsupported file|invalid file|could not upload)\b/i.test(statusText)) return { accepted: false, selected: true };
        if (statusText.includes(file.name) && !/\b(uploading|upload in progress|processing upload|pending upload)\b/i.test(statusText)) return { accepted: true, selected: true };
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return { accepted: false, selected: true };
    } catch { return { accepted: false, selected: false }; }
  }
  async function run(packet) {
    const adapter = core.detectAdapter(location.hostname);
    const fields = allFields();
    const used = new Set();
    const filled = [];
    const missing = [];
    for (const key of Object.keys(profileTerms)) {
      const value = valueFor(packet.profile || {}, key);
      if (!value) continue;
      const el = candidateFor(adapter, key, fields);
      if (!el || !safeControl(el) || sensitive(el, labelFor(el))) { missing.push(key); continue; }
      if (used.has(el) || !setValue(el, value)) continue;
      used.add(el); filled.push(key);
    }
    // Remembered answers are only applied when their exact label is one of the known profile fields.
    for (const el of fields) {
      const label = labelFor(el);
      if (!safeControl(el) || sensitive(el, label)) continue;
      const answer = packet.answers?.[normalized(label)];
      if (answer == null || !String(answer).trim() || !Object.values(profileTerms).some(terms => terms.some(term => normalized(label).includes(normalized(term))))) continue;
      if (setValue(el, answer)) filled.push("remembered answer");
    }
    const attached = [];
    const selected = [];
    const missingFiles = [];
    const [resumeResult, coverResult] = await Promise.all([attach(packet, "resume"), attach(packet, "coverLetter")]);
    for (const [key, value] of [["resume", resumeResult], ["coverLetter", coverResult]]) {
      if (value.accepted) attached.push(key);
      if (value.selected) selected.push(key);
      if (!value.selected) missingFiles.push(key);
    }
    if (filled.includes("fullName")) {
      for (const key of ["firstName", "lastName"]) { const index = missing.indexOf(key); if (index >= 0) missing.splice(index, 1); }
    }
    const result = { filled, attached, selected, missing: [...missing, ...missingFiles] };
    const filledText = filled.length ? filled.join(", ") : "none";
    const attachedText = attached.length ? attached.join(", ") : "none confirmed";
    const unconfirmedText = selected.some(key => !attached.includes(key)) ? " Selected, upload not confirmed: " + selected.filter(key => !attached.includes(key)).join(", ") + "." : "";
    const missingText = result.missing.length ? " Missing: " + [...new Set(result.missing)].join(", ") + "." : "";
    banner("Raven prepared this application. Fields filled: " + filledText + ". PDFs accepted by form: " + attachedText + "." + unconfirmedText + " Review every field and attachment, then submit manually." + missingText);
    chrome.runtime.sendMessage({ type: "raven-prepare-result", result });
  }
  const adapter = core.detectAdapter(location.hostname);
  if (location.protocol !== "https:") return;
  chrome.runtime.sendMessage({ type: "raven-prepare-ready", url: location.href }, response => {
    void chrome.runtime.lastError;
    if (!response?.packet || response.packet.version !== 2 || response.packet.mode !== "prepare") return;
    const deadline = Date.now() + 10_000;
    const waitForForm = () => {
      const fields = allFields();
      const foundProfile = Object.keys(profileTerms).some(key => candidateFor(adapter, key, fields));
      const foundUpload = fileCandidate(adapter, "resume") || fileCandidate(adapter, "coverLetter");
      if (foundProfile || foundUpload) return run(response.packet);
      if (Date.now() < deadline) return setTimeout(waitForForm, 250);
      run(response.packet);
    };
    waitForForm();
  });
})();
