(() => {
  "use strict";
  const core = globalThis.RavenAssistantCore;
  if (!core || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  const profileTerms = {
    firstName: ["first name", "given name"], lastName: ["last name", "surname", "family name"], fullName: ["full name", "name"],
    email: ["email", "email address"], phone: ["phone", "phone number", "mobile"], linkedin: ["linkedin"],
    portfolio: ["portfolio", "website", "personal website", "previous work"], discord: ["discord"], address1: ["address line 1", "street address", "address"],
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
  function doverFieldContext(el) {
    if (location.hostname.toLowerCase() !== "app.dover.com") return "";
    const pieces = [];
    for (let node = el.parentElement, depth = 0; node && node !== el.form && depth < 6; node = node.parentElement, depth++) {
      const controls = node.querySelectorAll('input:not([type="file"]):not([type="hidden"]),textarea,select');
      if (controls.length > 1) break;
      const text = String(node.innerText || "").replace(/\s+/g, " ").trim().slice(0, 250);
      if (text) pieces.push(text);
    }
    return pieces.join(" ").slice(0, 500);
  }
  function sensitive(el, label) {
    const metadata = [label, doverFieldContext(el), el.name, el.id, el.getAttribute("autocomplete"), el.getAttribute("placeholder"), el.getAttribute("data-testid")].filter(Boolean).join(" ");
    return core.isSensitiveQuestion(metadata) || sensitiveRe.test(metadata);
  }
  function safeControl(el) {
    if (!el || el.disabled || el.readOnly || el.hidden || el.getAttribute("hidden") !== null || el.getAttribute("aria-hidden") === "true") return false;
    if (typeof el.getClientRects === "function" && el.getClientRects().length === 0) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.tagName !== "INPUT") return false;
    return ["text", "email", "tel", "url"].includes(String(el.type || "text").toLowerCase());
  }
  function setValue(el, value, comboSearch = false, localAuthority = () => true) {
    if (!localAuthority() || !safeControl(el) || el.value || value == null || String(value).trim() === "") return false;
    if (el.getAttribute("role") === "combobox" && !comboSearch) return false;
    if (el.tagName === "SELECT") {
      const key = normalized(value);
      const option = [...el.options].find(item => normalized(item.textContent) === key || normalized(item.value) === key);
      if (!option) return false;
      if (!localAuthority()) return false;
      el.value = option.value;
    } else {
      if (!localAuthority()) return false;
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter ? setter.call(el, String(value)) : (el.value = String(value));
    }
    if (!localAuthority()) return false;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (!localAuthority()) return false;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return localAuthority();
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
  async function setLocationCombo(el, key, value, profile, authorize = async () => true) {
    const localAuthority = authorize.local || (() => true);
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
    if (!await authorize() || !localAuthority()) return false;
    el.focus();
    // Greenhouse controls menuIsOpen through its Control onMouseUp, not onMouseDown.
    // Complete that bounded input gesture before typing so the controlled menu can render.
    if (el.getAttribute("aria-expanded") !== "true") {
      if (!await authorize() || !localAuthority()) return false;
      el.dispatchEvent(new MouseEvent("mousedown", {bubbles: true, button: 0}));
      if (!await authorize() || !localAuthority()) return false;
      el.dispatchEvent(new MouseEvent("mouseup", {bubbles: true, button: 0}));
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!await authorize() || !localAuthority()) return false;
    }
    if (!await authorize() || !setValue(el, query, true, localAuthority)) return false;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && el.isConnected && el.value === query) {
      if (!await authorize() || !localAuthority()) return false;
      const list = document.getElementById(el.getAttribute("aria-controls") || "");
      const options = list?.getAttribute("role") === "listbox" ? [...list.querySelectorAll('[role="option"]')].filter(option =>
        option.getAttribute("aria-disabled") !== "true" && option.getClientRects().length && matches(option.innerText || "")) : [];
      if (options.length === 1) {
        const option = options[0];
        if (!await authorize() || !localAuthority()) return false;
        option.dispatchEvent(new MouseEvent("mousedown", {bubbles: true, button: 0}));
        if (!await authorize() || !localAuthority()) return false;
        option.dispatchEvent(new MouseEvent("mouseup", {bubbles: true, button: 0}));
        if (!await authorize() || !localAuthority()) return false;
        option.dispatchEvent(new MouseEvent("click", {bubbles: true, button: 0}));
        // City selection resolves location details asynchronously before rendering its value.
        const commitDeadline = Date.now() + 6000;
        while (Date.now() < commitDeadline && el.isConnected) {
          if (!await authorize() || !localAuthority()) return false;
          if (el.getAttribute("aria-expanded") === "false" && matches(selectedLocation(el))) return true;
          await new Promise(resolve => setTimeout(resolve, 150));
          if (!await authorize() || !localAuthority()) return false;
        }
        break;
      }
      if (options.length > 1) break;
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!await authorize() || !localAuthority()) return false;
    }
    // A typed query is not a committed city/country. Clear only our own unfinished search.
    if (el.isConnected && el.value === query && !selectedLocation(el)) {
      if (!await authorize() || !localAuthority()) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "");
      if (!await authorize() || !localAuthority()) return false;
      el.dispatchEvent(new Event("input", {bubbles: true}));
      if (!await authorize() || !localAuthority()) return false;
      el.dispatchEvent(new Event("change", {bubbles: true}));
      if (!await authorize() || !localAuthority()) return false;
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
      let missing = false;
      if (type === "radio") {
        const members = el.name ? controls.filter(control => control.type === "radio" && control.form === el.form && control.name === el.name) : [el];
        missing = !members.some(control => control.checked);
      } else if (type === "checkbox") {
        missing = !el.checked;
      } else if (type === "file") {
        missing = !(el.files?.length || String(el.value || "").trim());
      } else missing = !String(el.value || "").trim() && !(el.getAttribute("role") === "combobox" && selectedLocation(el));
      if (missing) labels.add(type === "radio" ? String(el.closest("fieldset")?.querySelector("legend")?.innerText || label || "Unlabeled required field").replace(/\s+/g," ").trim().slice(0,120) : label || "Unlabeled required field");
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
  function visibleDoverCompanyRoute(company) {
    if (location.hostname.toLowerCase() !== "app.dover.com") return false;
    const match = location.pathname.match(/^\/apply\/([^/]+)\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i);
    return Boolean(match && normalized(match[1]) === normalized(company));
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
        !(pageWords.includes(normalized(context.company)) || visibleCompanyLabel(context.company) ||
          visibleDoverCompanyRoute(context.company)))
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
    const field = el.closest(".form-group,.form-field,[role='group']");
    const labels = [labelFor(el), String(field?.innerText || "").slice(0, 500), doverFieldContext(el)]
      .map(normalized).filter(Boolean);
    if (terms === profileTerms.fullName)
      return labels.some(label => label === "name" || label === "full name");
    if (terms === profileTerms.address1 && labels.some(label => /\b(address line 2|apartment|suite)\b/.test(label))) return false;
    return labels.some(label => terms.some(term => label.includes(normalized(term))));
  }
  function doverCountryCandidate(value) {
    if (location.hostname.toLowerCase() !== "app.dover.com" || !String(value || "").trim()) return null;
    const wanted = normalized(value);
    const aliases = {
      us: "united states", usa: "united states", "united states of america": "united states",
      "united states": "united states", uk: "united kingdom", "united kingdom": "united kingdom",
      france: "france", ireland: "ireland"
    };
    const expected = aliases[wanted];
    if (!expected) return null;
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    const groups = new Map();
    for (const radio of radios) {
      const name = radio.name;
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(radio);
    }
    const supported = new Set(["france", "ireland", "united kingdom", "united states"]);
    for (const group of groups.values()) {
      const labels = group.map(radio => normalized(radio.labels?.[0]?.innerText || radio.closest("label")?.innerText || ""));
      if (group.length !== 4 || new Set(labels).size !== 4 || labels.some(label => !supported.has(label))) continue;
      const scope = group[0].closest("label");
      let labeled = false;
      for (let node = scope, depth = 0; node && node !== group[0].form && depth < 8; node = node.parentElement, depth++) {
        const text = normalized(node.innerText || "");
        if (text.startsWith("your location country") &&
            node.querySelectorAll('input[type="radio"]').length === 4) { labeled = true; break; }
      }
      if (!labeled) continue;
      const matches = group.filter((radio, index) => labels[index] === expected && !radio.disabled && radio.getClientRects().length);
      if (matches.length === 1) return matches[0];
    }
    return null;
  }
  function setDoverCountry(radio, localAuthority = () => true) {
    if (!radio || radio.disabled || !localAuthority()) return false;
    const peers = [...document.querySelectorAll('input[type="radio"]')].filter(peer =>
      peer !== radio && peer.name === radio.name && peer.form === radio.form);
    if (radio.checked || peers.some(peer => peer.checked)) return false;
    radio.click();
    return Boolean(localAuthority() && radio.checked);
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
  function fileContext(el) {
    // A form-level fallback can include unrelated sensitive questions and suppress every upload.
    // Use only field-local context; Dover renders upload labels in short MUI wrappers rather than
    // label/fieldset nodes, so walk only up to (never including) the form for that host.
    const field = el.closest(".form-group,.form-field,[role='group']");
    const localDoverLabel = location.hostname.toLowerCase() === "app.dover.com" ? (() => {
      for (let node = el.parentElement, depth = 0; node && node !== el.form && depth < 6; node = node.parentElement, depth++) {
        if (node.querySelectorAll('input[type="file"]').length > 1) break;
        const text = String(node.innerText || "").replace(/\s+/g, " ").trim().slice(0, 350);
        if (text && /\b(?:autofill|resume|cv|cover letter)\b/i.test(text)) return text;
      }
      return "";
    })() : "";
    return [labelFor(el, false), el.name, el.id, el.getAttribute("aria-label"),
      String(field?.innerText || "").slice(0, 500), localDoverLabel].filter(Boolean).join(" ");
  }
  function isExcludedUpload(el) {
    const label = fileContext(el);
    return /\b(autofill|auto fill|import from|parse resume)\b/i.test(label) || sensitive(el, label);
  }
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
    return fields.find(el => terms.some(term =>
      normalized(fileContext(el)).includes(normalized(term))) && !isExcludedUpload(el)) || null;
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
      const el = key === "country" ? doverCountryCandidate(value) || candidateFor(adapter, key, allFields()) :
        candidateFor(adapter, key, allFields());
      const radioCountry = key === "country" && el?.type === "radio" && location.hostname.toLowerCase() === "app.dover.com";
      if (!el || (!radioCountry && !safeControl(el)) || sensitive(el, labelFor(el))) continue;
      requested.add(key);
      if (used.has(el)) continue;
      const changed = radioCountry ? setDoverCountry(el) :
        adapter.id === "greenhouse" && ["country", "city"].includes(key) && el.getAttribute("role") === "combobox"
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
    // Some employers accept cover letters only as text. Use the exact saved
    // document text supplied by Raven; never infer or generate an answer.
    const coverFields = [...document.querySelectorAll('textarea')].filter(el => safeControl(el) && !sensitive(el,labelFor(el)) &&
      (/^cover letter$/i.test(labelFor(el)) || /^(?:cCoverLetter|cover[_-]?letter)$/i.test(el.name) || /^cover[_-]?letter$/i.test(el.id)));
    let coverTextFilled = false;
    if (!fileCandidate(adapter,'coverLetter') && coverFields.length === 1 && typeof packet.coverLetterText === 'string' && packet.coverLetterText.trim() && packet.coverLetterText.length <= 20000) {
      const el=coverFields[0],max=el.maxLength;
      if ((max < 0 || packet.coverLetterText.length <= max) && setValue(el,packet.coverLetterText)) { filled.push('cover letter');coverTextFilled=true; }
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
      if (!availableUploads.has(key) && !value.selected && !value.accepted && !(key === "coverLetter" && coverTextFilled)) notRequested.push(key);
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

  // Shared DOM adapter for protocol 3. The version 2 preparation path below remains intact.
  async function applyAttemptOperation(kind, payload, authorize = async () => true) {
    const localAuthority = authorize.local || (() => true);
    const aborted = () => ({ state: "aborted", result: { reason: "Application binding changed during operation." } });
    if (!await authorize() || !localAuthority()) return aborted();
    if (kind === "profile") {
      const profile = payload.profile || {}, answers = payload.answers || {};
      const adapter = core.detectAdapter(location.hostname), filled = [];
      for (const key of Object.keys(profileTerms)) {
        if (!await authorize() || !localAuthority()) return aborted();
        const value = valueFor(profile, key);
        if (!value) continue;
        const el = key === "country" ? doverCountryCandidate(value) || candidateFor(adapter, key, allFields()) :
          candidateFor(adapter, key, allFields());
        if (!el) continue;
        const radioCountry = key === "country" && el?.type === "radio" && location.hostname.toLowerCase() === "app.dover.com";
        if (!radioCountry && !safeControl(el)) continue;
        if (!await authorize() || !localAuthority()) return aborted();
        const changed = radioCountry ? setDoverCountry(el, localAuthority) :
          adapter.id === "greenhouse" && ["country", "city"].includes(key) &&
          el.getAttribute("role") === "combobox" ? await setLocationCombo(el, key, value, profile, authorize) :
          setValue(el, value, false, localAuthority);
        if (!localAuthority()) return aborted();
        if (changed) filled.push(key);
      }
      for (const el of allFields()) {
        if (!await authorize() || !localAuthority()) return aborted();
        const label = labelFor(el), answer = answers[normalized(label)];
        if (!safeControl(el) || sensitive(el, label) || answer == null ||
            !Object.values(profileTerms).some(terms => terms.some(term => normalized(label) === normalized(term)))) continue;
        if (!await authorize() || !localAuthority()) return aborted();
        if (setValue(el, answer, false, localAuthority)) filled.push("remembered answer");
        if (!localAuthority()) return aborted();
      }
      if (!await authorize() || !localAuthority()) return aborted();
      return { state: "filled", result: { filled, requiredUnanswered: requiredLabels() } };
    }
    if (kind === "coverLetterText") {
      const text = payload.coverLetterText?.text || "";
      const adapter = core.detectAdapter(location.hostname);
      const fields = [...document.querySelectorAll("textarea")].filter(el => safeControl(el) && !sensitive(el, labelFor(el)) &&
        (/^cover letter$/i.test(labelFor(el)) || /^(?:cCoverLetter|cover[_-]?letter)$/i.test(el.name) ||
         /^cover[_-]?letter$/i.test(el.id)));
      if (fileCandidate(adapter, "coverLetter") || fields.length !== 1)
        return { state: "no_control", result: { reason: "No unique cover-letter text field." } };
      const el = fields[0];
      if (el.value) return { state: "filled", result: { preserved: true } };
      if (!text || text.length > 20000 || el.maxLength >= 0 && text.length > el.maxLength)
        return { state: "no_control", result: { reason: "Cover text does not fit the employer field." } };
      if (!await authorize() || !localAuthority()) return aborted();
      const changed = setValue(el, text, false, localAuthority);
      if (!localAuthority()) return aborted();
      return { state: changed ? "filled" : "no_control", result: { filled: ["cover letter"] } };
    }
    const pdfDocument = payload.document;
    if (!pdfDocument || pdfDocument.kind !== kind) return { state: "failed", result: { reason: "Document identity mismatch." } };
    const adapter = core.detectAdapter(location.hostname);
    const deadline = Date.now() + 10000;
    let input = fileCandidate(adapter, kind);
    while (!input && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (!await authorize() || !localAuthority()) return aborted();
      input = fileCandidate(adapter, kind);
    }
    if (!await authorize() || !localAuthority()) return aborted();
    if (!input) return { state: "no_control", result: { reason: "No matching file input on this page." } };
    if (input.files?.length) return { state: "no_control", result: { reason: "Existing attachment preserved." } };
    const packet = { company: payload.company || "Raven", title: payload.title || "Application" };
    const file = makePdfFile(pdfDocument.dataUrl, kind, packet);
    if (!file || !core.acceptsFile(input.accept, file.name, file.type))
      return { state: "rejected", result: { reason: "Employer file type does not accept PDF." } };
    const container = input.closest(".ashby-file-upload,.file-upload,.upload-field,[data-testid*='resume' i],[data-testid*='cover' i]") || input.parentElement;
    const beforeText = String(container?.innerText || "").slice(0, 500);
    try {
      if (!await authorize() || !localAuthority()) return aborted();
      const transfer = new DataTransfer(); transfer.items.add(file);
      if (!localAuthority()) return aborted();
      input.files = transfer.files;
      if (!await authorize() || !localAuthority()) return aborted();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      if (!await authorize() || !localAuthority()) return aborted();
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (!await authorize() || !localAuthority()) return aborted();
      if (![...(input.files || [])].some(value => value.name === file.name && value.type === "application/pdf"))
        return { state: "rejected", result: { reason: "Browser did not retain selected file." } };
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (!await authorize() || !localAuthority()) return aborted();
        const evidence = String(container?.innerText || "").slice(0, 500);
        if (/\b(upload failed|file rejected|unsupported file|invalid file|could not upload)\b/i.test(evidence))
          return { state: "rejected", result: { evidence } };
        if (evidence !== beforeText && evidence.includes(file.name) &&
            /\b(attached|uploaded|upload complete|successfully added)\b/i.test(evidence) &&
            !/\b(uploading|upload in progress|processing upload|pending upload)\b/i.test(evidence))
          return { state: "page_confirmed", result: { evidence: evidence.slice(0, 240) } };
        await new Promise(resolve => setTimeout(resolve, 250));
        if (!await authorize() || !localAuthority()) return aborted();
      }
      return { state: "selected", result: { evidence: "File selected; employer acceptance unconfirmed." } };
    } catch (error) {
      if (!localAuthority()) return aborted();
      return { state: "rejected", result: { reason: error?.message || "File selection failed." } };
    }
  }
  globalThis.RavenPrepareDom = { inspect: inspection, applyOperation: applyAttemptOperation };

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
