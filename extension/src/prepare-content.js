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
  function labelFor(el, allowPlaceholder = true) {
    const id = el.id;
    let explicit = null;
    try { explicit = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null; } catch {}
    const described = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map(ref => document.getElementById(ref)?.innerText || "").join(" ");
    const primary = [explicit?.innerText, el.closest("label")?.innerText, el.getAttribute("aria-label"), described].find(value => String(value || "").trim());
    return String(primary || (allowPlaceholder && el.getAttribute("placeholder")) || "").trim();
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
  function setValue(el, value, comboSearch = false) {
    if (!safeControl(el) || el.value || value == null || String(value).trim() === "") return false;
    if (el.getAttribute("role") === "combobox" && !comboSearch) return false;
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
  function countryNames(value) {
    const name = normalized(value);
    if (["us", "usa", "united states", "united states of america"].includes(name)) return ["united states", "united states of america", "usa", "us"];
    return [name];
  }
  function selectedLocation(el) {
    const selected = el.closest(".select__control")?.querySelector(".select__single-value");
    // Greenhouse renders a US flag and dialing code after selecting the country.
    if (el.id === "country" && selected?.querySelector(".iti__us")) return "United States";
    return selected?.textContent?.trim() || "";
  }
  async function setLocationCombo(el, key, value, profile) {
    // Only these two known Greenhouse contact controls may select options. Legal choices stay manual.
    if (!((key === "country" && el.id === "country") || (key === "city" && el.id === "candidate-location")) ||
        el.getAttribute("role") !== "combobox" || el.value || selectedLocation(el) || !safeControl(el) || sensitive(el, labelFor(el))) return false;
    const countries = countryNames(profile.country);
    const query = key === "country" && countries.includes("united states") ? "United States" : key === "city" ? [value, profile.region, profile.country].filter(Boolean).join(", ") : value;
    const matches = text => {
      if (key === "country") return countries.includes(normalized(text.replace(/\s*\+[\d\s()-]+$/, "")));
      const parts = text.split(",").map(normalized);
      const city = normalized(value);
      const region = normalized(profile.region);
      return normalized(text) === normalized(query) ||
        (parts[0] === city && (!region || parts.includes(region)) && countries.some(country => country && parts.includes(country)));
    };
    el.focus();
    // Open before typing: React Select may reset its query when opening a closed menu.
    if (el.getAttribute("aria-expanded") !== "true") {
      el.dispatchEvent(new MouseEvent("mousedown", {bubbles: true, button: 0}));
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!setValue(el, query, true)) return false;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && el.isConnected && el.value === query) {
      const list = document.getElementById(el.getAttribute("aria-controls") || "");
      const options = list?.getAttribute("role") === "listbox" ? [...list.querySelectorAll('[role="option"]')].filter(option =>
        option.getAttribute("aria-disabled") !== "true" && option.getClientRects().length && matches(option.innerText || "")) : [];
      if (options.length === 1) {
        const option = options[0];
        option.dispatchEvent(new MouseEvent("mousedown", {bubbles: true, button: 0}));
        option.dispatchEvent(new MouseEvent("mouseup", {bubbles: true, button: 0}));
        option.dispatchEvent(new MouseEvent("click", {bubbles: true, button: 0}));
        await new Promise(resolve => setTimeout(resolve, 150));
        if (el.getAttribute("aria-expanded") === "false" && matches(selectedLocation(el))) return true;
        break;
      }
      if (options.length > 1) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    // A typed query is not a committed city/country. Clear only our own unfinished search.
    if (el.isConnected && el.value === query && !selectedLocation(el)) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "");
      el.dispatchEvent(new Event("input", {bubbles: true}));
      el.dispatchEvent(new Event("change", {bubbles: true}));
      el.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
    }
    return false;
  }
  function allFields() { return [...document.querySelectorAll('input:not([type="file"]):not([type="hidden"]),textarea,select')]; }
  function requiredLabels() {
    const labels = new Set();
    const controls = [...document.querySelectorAll('input,textarea,select')];
    for (const el of controls) {
      if (!(el.required || el.getAttribute("required") !== null || el.getAttribute("aria-required") === "true")) continue;
      if (el.disabled || el.closest('[hidden],[aria-hidden="true"]')) continue;
      const type = String(el.type || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button") continue;
      // File controls are often visually hidden behind a styled upload button.
      if (type !== "file" && typeof el.getClientRects === "function" && el.getClientRects().length === 0) continue;
      const raw = labelFor(el, false) || el.closest("fieldset")?.querySelector("legend")?.innerText || "";
      const label = String(raw).replace(/\s+/g, " ").trim().slice(0, 120);
      if (!label) { labels.add("Unlabeled required field"); continue; }
      if (type === "radio") {
        const group = el.closest("fieldset")?.querySelector("legend")?.innerText || label || "Unlabeled required choice";
        const members = el.form && el.name ? controls.filter(control => control.type === "radio" && control.form === el.form && control.name === el.name) : [el];
        if (!members.some(control => control.checked)) labels.add(String(group).replace(/\s+/g, " ").trim().slice(0, 120));
      } else if (type === "checkbox") {
        if (!el.checked) labels.add(label);
      } else if (type === "file") {
        if (!el.files?.length) labels.add(label);
      } else if (!String(el.value || "").trim() && !(el.getAttribute("role") === "combobox" && selectedLocation(el))) labels.add(label);
    }
    return [...labels];
  }
  function visibleGateElement(el) {
    if (!el || el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let node = el; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) return false;
    }
    return [...el.getClientRects()].some(rect => rect.width > 0 && rect.height > 0);
  }
  function activeChallengeFrame() {
    return [...document.querySelectorAll('iframe[src]')].some(frame => {
      if (!visibleGateElement(frame)) return false;
      try {
        const url = new URL(frame.src, location.href);
        // Invisible reCAPTCHA anchors and badges can be present on a usable form.
        if (/(?:^|\.)google\.com$|(?:^|\.)recaptcha\.net$/i.test(url.hostname) &&
            /\/recaptcha\/(?:api2|enterprise)\/(?:anchor|bframe)(?:\/|$)/i.test(url.pathname))
          return url.pathname.includes("/bframe") || /^(?:normal|compact)$/i.test(url.searchParams.get("size") || "");
        if (/(?:^|\.)hcaptcha\.com$/i.test(url.hostname) && /\/captcha\//i.test(url.pathname))
          return url.searchParams.get("size") !== "invisible";
      } catch {}
      return false;
    });
  }
  function visibleCompanyLabel(company) {
    const expected = normalized(company);
    if (!expected) return false;
    return [...document.querySelectorAll('a[aria-label],img[alt],[role="img"][aria-label]')].some(el => {
      if (!visibleGateElement(el)) return false;
      const label = el.getAttribute("aria-label") || el.getAttribute("alt") || "";
      return normalized(label).includes(expected);
    });
  }
  function inspection(context) {
    const path = location.pathname.toLowerCase();
    const text = String(document.body?.innerText || "").slice(0, 10000);
    if (/\/(?:login|log-in|signin|sign-in|register|signup|sign-up)(?:\/|$)/.test(path) ||
        [...document.querySelectorAll('input[type="password"]')].some(visibleGateElement)) return { status: "manual", reason: "Application requires sign-in or an account." };
    if (/\b(?:verify you are human|confirm you are human|i am not a robot|i'm not a robot|complete (?:the )?captcha|solve (?:the )?captcha|two.factor authentication|multi.factor authentication|access denied)\b/i.test(text) ||
        activeChallengeFrame())
      return { status: "manual", reason: "Application has a challenge or access gate." };
    if (/\b(?:job is closed|position is closed|no longer accepting applications|job posting has expired|this job is no longer available)\b/i.test(text))
      return { status: "blocked", reason: "Listing is closed or unavailable." };
    const pageWords = normalized(text);
    if (!context?.title || !context?.company ||
        !pageWords.includes(normalized(context.title)) ||
        !(pageWords.includes(normalized(context.company)) || visibleCompanyLabel(context.company)))
      return { status: "manual", retryable: true, reason: "Selected job title or company is not visible on the destination. Review the route manually." };
    if (/(^|\.)ingamejob\.com$/i.test(location.hostname))
      return { status: "manual", reason: "This listing does not expose a verified application form. Open its application route manually." };
    const adapter = core.detectAdapter(location.hostname);
    const fields = allFields();
    const profileCount = Object.keys(profileTerms).filter(key => candidateFor(adapter, key, fields)).length;
    const knownFile = fileCandidate(adapter, "resume") || fileCandidate(adapter, "coverLetter");
    const known = knownFile || profileCount >= (adapter.id === "generic" ? 2 : 1);
    return known ? { status: "ready" } : { status: "manual", retryable: true, reason: "No recognized application controls. Open the application route manually, then retry Prepare." };
  }
  function valueFor(profile, key) { return key === "fullName" ? profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") : profile[key] || ""; }
  function matchesTerms(el, terms) {
    const label = normalized(labelFor(el, false));
    if (terms === profileTerms.fullName) return label === "name" || label === "full name";
    if (terms === profileTerms.address1 && /\b(address line 2|apartment|suite)\b/.test(label)) return false;
    return label && terms.some(term => label.includes(normalized(term)));
  }
  function candidateFor(adapter, key, fields) {
    for (const selector of adapter?.id !== "generic" ? (adapter?.profile?.[key] || []) : []) {
      try {
        const el = document.querySelector(selector);
        if (el && fields.includes(el) && safeControl(el) && !sensitive(el, labelFor(el))) return el;
      } catch {}
    }
    for (const selector of core.GENERIC.profile?.[key] || []) {
      try {
        const el = document.querySelector(selector);
        if (el && fields.includes(el) && safeControl(el) && !sensitive(el, labelFor(el)) && matchesTerms(el, profileTerms[key])) return el;
      } catch {}
    }
    return fields.find(el => safeControl(el) && !sensitive(el, labelFor(el)) && matchesTerms(el, profileTerms[key])) || null;
  }
  function isExcludedUpload(el) { return /\b(autofill|auto fill|import from|parse resume)\b/i.test(labelFor(el)) || sensitive(el, labelFor(el)); }
  function fileCandidate(adapter, key) {
    const fields = [...document.querySelectorAll('input[type="file"]')];
    for (const selector of adapter?.id !== "generic" ? (adapter?.files?.[key] || []) : []) {
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
      const container = input.closest(".ashby-file-upload,.file-upload,.upload-field,[data-testid*='resume' i],[data-testid*='cover' i]") || input.parentElement;
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
    const requested = new Set();
    const profileKeys = adapter.id === "greenhouse" ? ["country", "city", ...Object.keys(profileTerms).filter(key => !["country", "city"].includes(key))] : Object.keys(profileTerms);
    for (const key of profileKeys) {
      const value = valueFor(packet.profile || {}, key);
      if (!value) continue;
      const el = candidateFor(adapter, key, allFields());
      if (!el || !safeControl(el) || sensitive(el, labelFor(el))) continue;
      requested.add(key);
      if (used.has(el)) continue;
      const changed = adapter.id === "greenhouse" && ["country", "city"].includes(key) && el.getAttribute("role") === "combobox"
        ? await setLocationCombo(el, key, value, packet.profile || {}) : setValue(el, value);
      if (!changed) continue;
      used.add(el); filled.push(key);
    }
    // Remembered answers are only applied when their exact label is one of the known profile fields.
    for (const el of fields) {
      const label = labelFor(el);
      if (!safeControl(el) || sensitive(el, label)) continue;
      const answer = packet.answers?.[normalized(label)];
      if (answer == null || !String(answer).trim() || !Object.values(profileTerms).some(terms => terms.some(term => normalized(label) === normalized(term)))) continue;
      if (setValue(el, answer)) filled.push("remembered answer");
    }
    const attached = [];
    const selected = [];
    const notRequested = [];
    // Accepted uploads may replace/remove their input. Record availability before dispatch.
    const availableUploads = new Set(["resume", "coverLetter"].filter(key => fileCandidate(adapter, key)));
    const [resumeResult, coverResult] = await Promise.all([attach(packet, "resume"), attach(packet, "coverLetter")]);
    for (const [key, value] of [["resume", resumeResult], ["coverLetter", coverResult]]) {
      if (value.accepted) attached.push(key);
      if (value.selected) selected.push(key);
      if (!availableUploads.has(key) && !value.selected && !value.accepted) notRequested.push(key);
    }
    for (const key of Object.keys(profileTerms)) if (!requested.has(key) && !candidateFor(adapter, key, fields)) notRequested.push(key);
    const selectedUnconfirmed = selected.filter(key => !attached.includes(key));
    const requiredUnanswered = requiredLabels();
    const result = { filled, attached, selected, selectedUnconfirmed, notRequested, requiredUnanswered };
    const filledText = filled.length ? filled.join(", ") : "none";
    const attachedText = attached.length ? attached.join(", ") : "none confirmed";
    const unconfirmedText = selectedUnconfirmed.length ? " Selected, upload not confirmed: " + selectedUnconfirmed.join(", ") + "." : "";
    const requiredText = requiredUnanswered.length ? " Required fields for you: " + requiredUnanswered.join(", ") + "." : "";
    const absentDocuments = notRequested.filter(key => key === "resume" || key === "coverLetter");
    const absentText = absentDocuments.length ? " No upload field for: " + absentDocuments.map(key => key === "coverLetter" ? "cover letter" : "resume").join(", ") + "." : "";
    banner("Raven prepared this application. Fields filled: " + filledText + ". PDFs accepted by form: " + attachedText + "." + unconfirmedText + requiredText + absentText + " Review every field and attachment, then submit manually.");
    chrome.runtime.sendMessage({ type: "raven-prepare-result", result });
  }
  if (location.protocol !== "https:") return;
  let delivered = false;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "raven-prepare-deliver") return false;
    if (delivered || !message.packet || message.packet.version !== 2 || message.packet.mode !== "prepare" ||
        !message.preflightId || !message.expectedUrl) { respond({ accepted: false }); return false; }
    try {
      const here = new URL(location.href), expected = new URL(message.expectedUrl);
      here.hash = expected.hash = "";
      if (here.href !== expected.href || inspection({ title: message.packet.title, company: message.packet.company }).status !== "ready") { respond({ accepted: false }); return false; }
    } catch { respond({ accepted: false }); return false; }
    delivered = true;
    respond({ accepted: true });
    void run(message.packet);
    return false;
  });
  const deadline = Date.now() + 10000;
  const inspectWhenReady = context => {
    const result = inspection(context);
    if (result.retryable && Date.now() < deadline) return setTimeout(() => inspectWhenReady(context), 250);
    const { retryable, ...reported } = result;
    chrome.runtime.sendMessage({ type: "raven-preflight-result", url: location.href, ...reported }, () => void chrome.runtime.lastError);
  };
  chrome.runtime.sendMessage({ type: "raven-preflight-context", url: location.href }, context => {
    void chrome.runtime.lastError;
    if (context) inspectWhenReady(context);
  });
})();
