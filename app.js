(function () {
  const config = window.RAVEN_CONFIG || window.JOBTRACK_CONFIG;
  const state = {
    jobs: [],
    selectedId: null,
    activeTrack: "Professional",
    queue: JSON.parse(localStorage.getItem("ravenQueue") || localStorage.getItem("jobtrackQueue") || "[]"),
    runtime: { theme: {}, settings: {}, ui: [], statuses: [], features: {} },
    discovered: { Professional: [], Labor: [], Wildcard: [] }
  };
  const columns = ["id","added","track","title","company","location","remote","salaryMin","salaryMax","salaryText","url","source","status","viewed","appliedDate","followUp","resume","coverLetter","notes","lastUpdated"];
  const status = document.getElementById("syncStatus");
  const list = document.getElementById("jobList");
  const detail = document.getElementById("jobDetail");
  const template = document.getElementById("jobTemplate");
  const searchBox = document.getElementById("searchBox");
  const statusFilter = document.getElementById("statusFilter");
  const queueList = document.getElementById("queueList");
  const trackTabs = [...document.querySelectorAll(".track-tab")];
  const searchJobsButton = document.getElementById("searchJobsButton");

  function setStatus(message) { status.textContent = message; }
  function gatewayUrl(params = {}) {
    const url = new URL(config.gatewayUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return url.toString();
  }
  async function callGateway(params) {
    const getActions = new Set(["listJobs"]);
    const response = getActions.has(params.action)
      ? await fetch(gatewayUrl(params), { cache: "no-store" })
      : await fetch(config.gatewayUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify(params)
        });
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Google could not complete this request.");
      return payload;
    } catch (error) {
      throw new Error(error instanceof SyntaxError ? "Google returned an unreadable response." : error.message);
    }
  }
  function parseBool(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return fallback;
  }
  function applyRuntimeConfig(runtime) {
    state.runtime = {
      theme: runtime.theme || {},
      settings: runtime.settings || {},
      ui: Array.isArray(runtime.ui) ? runtime.ui : [],
      statuses: Array.isArray(runtime.statuses) ? runtime.statuses : [],
      features: runtime.features || {}
    };
    Object.entries(state.runtime.theme).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        document.documentElement.style.setProperty("--" + key, String(value));
      }
    });
    const settings = state.runtime.settings;
    if (settings["sidebar-width"]) document.documentElement.style.setProperty("--sidebar-width", settings["sidebar-width"]);
    if (settings["detail-panel-width"]) document.documentElement.style.setProperty("--detail-panel-width", settings["detail-panel-width"]);
    document.documentElement.dataset.cardDensity = settings["card-density"] || "compact";
    applyFeatureFlags();
    buildStatusFilter();
  }
  function featureEnabled(key, fallback = true) {
    const feature = state.runtime.features[key];
    if (feature === undefined) return fallback;
    if (typeof feature === "object" && feature !== null && "enabled" in feature) return parseBool(feature.enabled, fallback);
    return parseBool(feature, fallback);
  }
  function settingEnabled(key, fallback = true) {
    if (!(key in state.runtime.settings)) return fallback;
    return parseBool(state.runtime.settings[key], fallback);
  }
  function applyFeatureFlags() {
    document.querySelectorAll("[data-feature]").forEach((element) => {
      element.hidden = !featureEnabled(element.dataset.feature, true);
    });
    status.hidden = !settingEnabled("show-sync-status", true);
  }
  function buildStatusFilter() {
    const current = statusFilter.value;
    const statuses = state.runtime.statuses.filter((item) => parseBool(item.visible, true));
    statusFilter.innerHTML = '<option value="">All statuses</option>';
    statuses.sort((a,b)=>Number(a.order||0)-Number(b.order||0)).forEach((item)=>{
      const option=document.createElement("option");
      option.value=item.key||item.label||"";
      option.textContent=item.label||item.key||"";
      statusFilter.appendChild(option);
    });
    if ([...statusFilter.options].some((o)=>o.value===current)) statusFilter.value=current;
  }
  async function loadRuntimeConfig() {
    try {
      const response = await fetch("./runtime-config.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Runtime config file could not be loaded.");
      const payload = await response.json();
      applyRuntimeConfig(payload);
      return true;
    } catch (error) {
      console.warn("Runtime config unavailable; using bundled defaults.", error);
      return false;
    }
  }
  function normalizeJobs(payload) {
    const rows = Array.isArray(payload) ? payload : payload.jobs || payload.rows || [];
    return rows.map((row)=>{
      if (!Array.isArray(row)) return row;
      return Object.fromEntries(columns.map((key,index)=>[key,row[index]||""]));
    }).filter((job)=>job.id||job.title||job.url);
  }
  async function callSearchApi(payload) {
    const response = await fetch(config.searchApiUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.searchAnonKey,
        "apikey": config.searchAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Search backend returned an unreadable response."); }
    if (!response.ok || data.ok === false || data.error) throw new Error(data.error || "Search backend failed.");
    return data;
  }

  function normalizeComparableUrl(value) {
    try {
      const url = new URL(value || "");
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gh_src","source"].forEach((key)=>url.searchParams.delete(key));
      url.hash = "";
      return url.toString().replace(/\/$/,"");
    } catch { return String(value || "").trim(); }
  }

  function normalizeDiscovered(results) {
    return (results || []).map((job)=>({
      id: "DISC-" + job.id,
      added: job.created_at || job.last_seen || "",
      track: job.track,
      title: job.title || "Untitled job",
      company: job.company || "",
      location: job.location || "",
      remote: job.remote ? "Remote" : "",
      salaryMin: "",
      salaryMax: "",
      salaryText: job.salary_text || "",
      url: job.url || "",
      source: job.source || "Web",
      status: "Discovered",
      viewed: false,
      appliedDate: "",
      followUp: "",
      resume: "",
      coverLetter: "",
      notes: job.snippet || "",
      lastUpdated: job.last_seen || "",
      _discovered: true
    })).filter((job)=>job.url);
  }

  async function loadDiscovered(track = state.activeTrack) {
    try {
      const payload = await callSearchApi({ action: "listResults", track });
      state.discovered[track] = normalizeDiscovered(payload.results);
      return true;
    } catch (error) {
      console.warn("Discovered jobs unavailable.", error);
      return false;
    }
  }

  async function runJobSearch() {
    const original = searchJobsButton.textContent;
    searchJobsButton.disabled = true;
    searchJobsButton.textContent = "Searching…";
    setStatus("Searching " + state.activeTrack + " jobs...");
    try {
      const payload = await callSearchApi({ action: "search", track: state.activeTrack });
      state.discovered[state.activeTrack] = normalizeDiscovered(payload.results);
      state.selectedId = null;
      render();
      setStatus(payload.count + " " + state.activeTrack.toLowerCase() + " candidates found");
    } catch (error) {
      setStatus("Search failed: " + error.message);
    } finally {
      searchJobsButton.disabled = false;
      searchJobsButton.textContent = original;
    }
  }

  async function loadJobs() {
    setStatus("Syncing with Google Sheet...");
    try {
      const payload = await callGateway({ action: "listJobs" });
      state.jobs = normalizeJobs(payload);
      setStatus(state.jobs.length + " saved jobs from Google Sheet");
      render();
    } catch (error) {
      setStatus("Could not sync: " + error.message);
      list.innerHTML = '<p class="empty">Open the Apps Script gateway or try refresh again.</p>';
    }
  }
  function parseDate(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }
  function sortedJobs(jobs) {
    const mode = state.runtime.settings["default-sort"] || "added-desc";
    const copy=[...jobs];
    if (mode==="added-asc") return copy.sort((a,b)=>parseDate(a.added)-parseDate(b.added));
    if (mode==="title-asc") return copy.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
    if (mode==="company-asc") return copy.sort((a,b)=>String(a.company||"").localeCompare(String(b.company||"")));
    return copy.sort((a,b)=>parseDate(b.added)-parseDate(a.added));
  }
  function combinedJobs() {
    const saved = state.jobs.filter((job)=>String(job.track||"").trim().toLowerCase()===state.activeTrack.toLowerCase());
    const savedUrls = new Set(saved.map((job)=>normalizeComparableUrl(job.url)).filter(Boolean));
    const discovered = (state.discovered[state.activeTrack] || []).filter((job)=>!savedUrls.has(normalizeComparableUrl(job.url)));
    return [...saved, ...discovered];
  }
  function filteredJobs() {
    const query=searchBox.value.trim().toLowerCase();
    const selectedStatus=statusFilter.value;
    return sortedJobs(combinedJobs().filter((job)=>{
      const haystack=[job.title,job.company,job.location,job.notes,job.url].join(" ").toLowerCase();
      return (!query||haystack.includes(query)) && (!selectedStatus||job.status===selectedStatus);
    }));
  }
  function uiRows(surface) {
    return state.runtime.ui.filter((item)=>item.surface===surface && parseBool(item.visible,true))
      .sort((a,b)=>Number(a.position||0)-Number(b.position||0));
  }
  function fieldAllowed(item) {
    if (item.key==="salaryText" && !settingEnabled("show-salary",true)) return false;
    if (item.key==="remote" && !settingEnabled("show-remote",true)) return false;
    if (item.key==="source" && !settingEnabled("show-source",true)) return false;
    if (item.key==="notes" && !settingEnabled("show-notes",true)) return false;
    return true;
  }
  function render() {
    renderJobs();
    renderQueue();
    const selected=combinedJobs().find((job)=>job.id===state.selectedId)||filteredJobs()[0];
    renderDetail(selected);
  }
  function fallbackCardRows() {
    return [
      {key:"title",label:"Title",format:"text",visible:true,position:1},
      {key:"company",label:"Company",format:"text",visible:true,position:2},
      {key:"location",label:"Location",format:"text",visible:true,position:3},
      {key:"salaryText",label:"Salary",format:"text",visible:true,position:4},
      {key:"status",label:"Status",format:"status",visible:true,position:5}
    ];
  }
  function renderJobs() {
    list.innerHTML="";
    const jobs=filteredJobs();
    if (!jobs.length) {
      list.innerHTML='<p class="empty">'+escapeHtml(state.runtime.settings["empty-list-text"]||"No matching jobs.")+'</p>';
      return;
    }
    const configured=uiRows("job-card");
    const cardRows=(configured.length?configured:fallbackCardRows()).filter(fieldAllowed);
    jobs.forEach((job)=>{
      const node=template.content.firstElementChild.cloneNode(true);
      node.classList.toggle("active",job.id===state.selectedId);
      node.dataset.status=statusToken(job.status);
      const content=node.querySelector(".job-row-content");
      const statusElement=node.querySelector(".job-status");
      content.innerHTML="";
      const meta=[];
      cardRows.forEach((item)=>{
        if (item.format==="status" || item.key==="status") {
          statusElement.textContent=job[item.key]||item.label||"Saved";
          statusElement.hidden=false;
          return;
        }
        const value=job[item.key];
        if (!value) return;
        if (item.key==="title") {
          const title=document.createElement("span");
          title.className="job-title";
          title.textContent=value||"Untitled job";
          content.appendChild(title);
        } else meta.push(String(value));
      });
      if (!content.querySelector(".job-title")) {
        const title=document.createElement("span");
        title.className="job-title";
        title.textContent=job.title||"Untitled job";
        content.prepend(title);
      }
      if (meta.length) {
        const metaElement=document.createElement("span");
        metaElement.className="job-meta";
        metaElement.textContent=meta.join(" | ");
        content.appendChild(metaElement);
      }
      node.addEventListener("click",()=>{ state.selectedId=job.id; render(); });
      list.appendChild(node);
    });
  }
  function statusToken(value) {
    return String(value||"saved").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"saved";
  }
  function fallbackDetailRows() {
    return [
      {key:"status",label:"Status",format:"text",visible:true,position:1},
      {key:"salaryText",label:"Salary",format:"text",visible:true,position:2},
      {key:"source",label:"Source",format:"text",visible:true,position:3},
      {key:"resume",label:"Resume",format:"link",visible:true,position:4},
      {key:"coverLetter",label:"Cover letter",format:"link",visible:true,position:5},
      {key:"notes",label:"Notes",format:"multiline",visible:true,position:6}
    ];
  }
  function fallbackActions() {
    return [
      {key:"posting",label:"Open posting",format:"external-link",visible:true,position:1},
      {key:"resume",label:"Draft resume",format:"queue",visible:true,position:2},
      {key:"coverLetter",label:"Draft cover letter",format:"queue",visible:true,position:3},
      {key:"applicationReview",label:"Application review",format:"queue",visible:true,position:4}
    ];
  }
  function actionFeatureKey(key) {
    return ({resume:"resume-generation",coverLetter:"cover-letter-generation",applicationReview:"application-review"})[key]||"";
  }
  function renderDetail(job) {
    if (!job) {
      detail.innerHTML='<h2>'+escapeHtml(state.runtime.settings["empty-detail-title"]||"Select a job")+'</h2><p>'+escapeHtml(state.runtime.settings["empty-detail-text"]||"Choose a row to review source data, notes, document links, and next actions.")+'</p>';
      return;
    }
    state.selectedId=job.id;
    const configured=uiRows("detail");
    const detailRows=(configured.length?configured:fallbackDetailRows()).filter(fieldAllowed);
    const detailHtml=detailRows.map((item)=>{
      const value=job[item.key];
      let rendered="Unknown";
      if (item.format==="link") rendered=linkOrText(value);
      else if (value!==undefined && value!==null && value!=="") rendered=escapeHtml(value);
      return '<dt>'+escapeHtml(item.label||item.key)+'</dt><dd>'+rendered+'</dd>';
    }).join("");
    const configuredActions=uiRows("detail-action");
    let actions;
    if (job._discovered) {
      actions = (job.url ? '<a href="'+escapeAttr(job.url)+'" target="_blank" rel="noopener">Open posting</a>' : "") +
        '<button type="button" data-save-discovered>Save to tracker</button>';
    } else {
      actions=(configuredActions.length?configuredActions:fallbackActions())
        .filter((item)=>{
          if (item.key==="posting") return Boolean(job.url);
          const feature=actionFeatureKey(item.key);
          return !feature || featureEnabled(feature,true);
        })
        .map((item)=>{
          if (item.format==="external-link" || item.key==="posting") {
            return '<a href="'+escapeAttr(job.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.label||"Open posting")+'</a>';
          }
          return '<button type="button" data-queue="'+escapeAttr(item.key)+'">'+escapeHtml(item.label||item.key)+'</button>';
        }).join("");
    }
    detail.innerHTML='<h2>'+escapeHtml(job.title||"Untitled job")+'</h2><p>'+escapeHtml([job.company,job.location,settingEnabled("show-remote",true)?job.remote:""].filter(Boolean).join(" | "))+'</p><dl>'+detailHtml+'</dl><div class="detail-actions">'+actions+'</div>';
    detail.querySelectorAll("[data-queue]").forEach((button)=>{
      button.addEventListener("click",()=>enqueue(job,button.dataset.queue));
    });
    const saveButton = detail.querySelector("[data-save-discovered]");
    if (saveButton) saveButton.addEventListener("click",()=>saveDiscovered(job));
  }
  function renderQueue() {
    queueList.innerHTML="";
    if (!state.queue.length) { queueList.innerHTML="<li>No pending tasks.</li>"; return; }
    state.queue.forEach((task)=>{
      const item=document.createElement("li");
      item.textContent=task.type+": "+task.title+" ("+task.status+")";
      queueList.appendChild(item);
    });
  }
  function enqueue(job,type) {
    const task={
      id:Date.now()+"-"+type+"-"+(job.id||"job"),
      jobId:job.id,
      title:job.title||job.url||"Untitled job",
      type,
      status:"needs worker",
      createdAt:new Date().toISOString()
    };
    state.queue.unshift(task);
    localStorage.setItem("ravenQueue",JSON.stringify(state.queue));
    renderQueue();
  }
  async function saveDiscovered(job) {
    setStatus("Saving discovered job...");
    try {
      const saved = await callGateway({ action:"addJob", title:job.title, url:job.url, track:job.track });
      if (!saved.id) throw new Error("Google did not confirm a saved job.");
      await loadJobs();
      render();
      setStatus("Saved to tracker");
    } catch (error) {
      setStatus("Save needs review: " + error.message);
    }
  }

  async function saveCapture(title,url) {
    setStatus("Saving captured job...");
    try {
      const parsed=new URL(url);
      if (!["https:","http:"].includes(parsed.protocol)) throw new Error("Enter a web address starting with https:// or http://.");
      const saved=await callGateway({action:"addJob",title:String(title||"").trim(),url,track:state.activeTrack});
      if (!saved.id) throw new Error("Google did not confirm a saved job.");
      document.getElementById("jobTitle").value="";
      document.getElementById("jobUrl").value="";
      await loadJobs();
    } catch (error) {
      setStatus("Capture needs review: "+error.message);
    }
  }
  function escapeHtml(value) {
    return String(value||"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g,"&#96;"); }
  function linkOrText(value) {
    if (!value) return "Not generated";
    if (/^https?:\/\//.test(value)) return '<a href="'+escapeAttr(value)+'" target="_blank" rel="noopener">Open file</a>';
    return escapeHtml(value);
  }
  function bindEvents() {
    trackTabs.forEach((tab)=>{
      tab.addEventListener("click",async()=>{
        state.activeTrack=tab.dataset.track;
        state.selectedId=null;
        trackTabs.forEach((item)=>{
          const active=item===tab;
          item.classList.toggle("active",active);
          item.setAttribute("aria-selected",String(active));
        });
        await loadDiscovered(state.activeTrack);
        render();
      });
    });
    searchJobsButton.addEventListener("click",runJobSearch);
    document.getElementById("refreshButton").addEventListener("click",async()=>{ await loadRuntimeConfig(); await loadJobs(); await loadDiscovered(state.activeTrack); render(); });
    searchBox.addEventListener("input",render);
    statusFilter.addEventListener("change",render);
    document.getElementById("captureForm").addEventListener("submit",(event)=>{
      event.preventDefault();
      saveCapture(document.getElementById("jobTitle").value.trim(),document.getElementById("jobUrl").value.trim());
    });
  }
  function applySharedParams() {
    const params=new URLSearchParams(window.location.search);
    const sharedUrl=params.get("url");
    const sharedTitle=params.get("title");
    if (sharedTitle) document.getElementById("jobTitle").value=sharedTitle.trim();
    if (sharedUrl) {
      const parts=sharedUrl.split(/\s+/);
      document.getElementById("jobUrl").value=parts.find((part)=>/^https?:\/\//.test(part))||sharedUrl;
      if (!sharedTitle) {
        const inferred=parts.filter((part)=>!/^https?:\/\//.test(part)).join(" ").trim();
        if (inferred) document.getElementById("jobTitle").value=inferred;
      }
    }
  }
  async function boot() {
    bindEvents();
    applySharedParams();
    await loadRuntimeConfig();
    await loadJobs();
    await loadDiscovered(state.activeTrack);
    render();
  }
  boot();
}());
