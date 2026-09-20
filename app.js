(function () {
  const config = window.RAVEN_CONFIG || window.JOBTRACK_CONFIG;
  const state = {
    jobs: [],
    selectedId: null,
    activeTrack: "Games / 3D",
    runtime: { theme: {}, settings: {}, ui: [], statuses: [], features: {} },
    discovered: { Professional: [], Labor: [], Wildcard: [], "Games / 3D": [] },
    commutes: {},
    documentApprovals: {},
    viewedJobs: {},
    generatorJob: null,
    generatorType: null,
    returnScrollY: null
  };
  const columns = window.RavenCore?.JOB_FIELDS || ["id","added","track","title","company","location","remote","salaryMin","salaryMax","salaryText","url","source","status","viewed","appliedDate","followUp","resume","coverLetter","notes","lastUpdated"];
  const status = document.getElementById("syncStatus");
  const list = document.getElementById("jobList");
  const searchBox = document.getElementById("searchBox");
  const statusFilter = document.getElementById("statusFilter");
  const trackTabs = [...document.querySelectorAll(".track-tab")];
  const searchJobsButton = document.getElementById("searchJobsButton");

  const CACHE_JOBS_KEY="ravenJobsCacheV1";
  const CACHE_DISCOVERED_KEY="ravenDiscoveredCacheV1";
  const DOCUMENT_APPROVALS_KEY="ravenDocumentApprovalsV1";
  const VIEWED_JOBS_KEY="ravenViewedJobsV1";
  const GENERATOR_PREFS_KEY="ravenGeneratorPreferencesV1";
  const USER_SETTINGS_KEY="ravenUserSettingsV1";
  const MASTER_RESUMES_KEY="ravenMasterResumesV1";
  const MASTER_RESUME_DB="ravenMasterResumeFilesV1";
  const GENERATION_CACHE_KEY="ravenGenerationCacheV1";
  const CANDIDATE_PROFILE_CACHE_KEY="ravenCandidateProfileCacheV1";
  const JOB_ANALYSIS_CACHE_KEY="ravenJobAnalysisCacheV1";
  const RESUME_TEMPLATE_VERSION="modern-v1";
  let editingMasterResumeId=null;

  function setStatus(message) { status.textContent = message; }
  function readCache(key,fallback){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"null");
      return value===null ? fallback : value;
    }catch{return fallback;}
  }
  function writeCache(key,value){
    try{ localStorage.setItem(key,JSON.stringify(value)); }catch{}
  }
  function pruneObjectCache(key,maxEntries=60,maxAgeDays=45){
    const cache=readCache(key,{})||{};
    if(!cache || typeof cache!=="object" || Array.isArray(cache)) return;
    const cutoff=Date.now()-(maxAgeDays*86400000);
    const entries=Object.entries(cache).filter(([,value])=>{
      const stamp=Date.parse(value?.createdAt||value?.analyzedAt||value?.cachedAt||"");
      return !stamp || stamp>=cutoff;
    });
    entries.sort((a,b)=>Date.parse(b[1]?.createdAt||b[1]?.analyzedAt||b[1]?.cachedAt||0)-Date.parse(a[1]?.createdAt||a[1]?.analyzedAt||a[1]?.cachedAt||0));
    writeCache(key,Object.fromEntries(entries.slice(0,maxEntries)));
  }
  function maintainCaches(){
    pruneObjectCache(GENERATION_CACHE_KEY,40,45);
    pruneObjectCache(CANDIDATE_PROFILE_CACHE_KEY,12,120);
    pruneObjectCache(JOB_ANALYSIS_CACHE_KEY,120,45);
  }

  function readMasterResumes(){
    const items=readCache(MASTER_RESUMES_KEY,[]);
    return Array.isArray(items)?items:[];
  }
  function writeMasterResumes(items){
    writeCache(MASTER_RESUMES_KEY,items);
  }
  function openMasterResumeDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(MASTER_RESUME_DB,1);
      request.onupgradeneeded=()=>request.result.createObjectStore("files");
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function saveMasterResumeFile(id,file){
    const db=await openMasterResumeDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").put(file,id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }
  async function getMasterResumeFile(id){
    const db=await openMasterResumeDb();
    const file=await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readonly");
      const request=tx.objectStore("files").get(id);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error);
    });
    db.close();
    return file;
  }
  async function deleteMasterResumeFile(id){
    const db=await openMasterResumeDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").delete(id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }
  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function masterResumeForTrack(track){
    return readMasterResumes().find((item)=>Array.isArray(item.tracks)&&item.tracks.includes(track))||null;
  }
  async function masterResumeTaskInput(track){
    const item=masterResumeForTrack(track);
    if(!item) return null;
    const base={id:item.id,name:item.name||"Master resume",sourceType:item.sourceType,tracks:item.tracks||[]};
    if(item.sourceType==="drive") return {...base,url:item.url||""};
    const file=await getMasterResumeFile(item.id);
    if(!file) return {...base,fileName:item.fileName||"",missingLocalFile:true};
    return {...base,fileName:file.name,mimeType:file.type||"application/octet-stream",dataUrl:await fileToDataUrl(file)};
  }
  function renderMasterResumeList(){
    const host=document.getElementById("masterResumeList");
    if(!host) return;
    const items=readMasterResumes();
    if(!items.length){
      host.innerHTML='<p class="options-help">No master resumes added yet.</p>';
      return;
    }
    host.innerHTML=items.map((item)=>{
      const source=item.sourceType==="drive"?"Google Drive":("Local · "+(item.fileName||"file"));
      const tracks=(item.tracks||[]).join(", ")||"No tracks assigned";
      return '<article class="master-resume-item" data-master-resume-id="'+escapeAttr(item.id)+'">'+
        '<div><strong>'+escapeHtml(item.name||"Master resume")+'</strong><small>'+escapeHtml(source)+' · '+escapeHtml(tracks)+'</small></div>'+
        '<div class="master-resume-item-actions"><button type="button" data-master-edit>Edit</button><button type="button" data-master-delete>Delete</button></div>'+
      '</article>';
    }).join("");
  }
  function resetMasterResumeEditor(){
    editingMasterResumeId=null;
    const editor=document.getElementById("masterResumeEditor");
    if(!editor) return;
    editor.hidden=true;
    document.getElementById("masterResumeName").value="";
    document.getElementById("masterResumeSource").value="drive";
    document.getElementById("masterResumeDriveUrl").value="";
    document.getElementById("masterResumeFile").value="";
    document.getElementById("masterResumeLocalStatus").textContent="Stored on this device.";
    editor.querySelectorAll('.master-resume-tracks input[type="checkbox"]').forEach((input)=>input.checked=false);
    syncMasterResumeSourceRows();
  }
  function syncMasterResumeSourceRows(){
    const source=document.getElementById("masterResumeSource")?.value||"drive";
    const drive=document.getElementById("masterResumeDriveRow");
    const local=document.getElementById("masterResumeLocalRow");
    if(drive) drive.hidden=source!=="drive";
    if(local) local.hidden=source!=="local";
  }
  function openMasterResumeEditor(item=null){
    const editor=document.getElementById("masterResumeEditor");
    if(!editor) return;
    editingMasterResumeId=item?.id||null;
    editor.hidden=false;
    document.getElementById("masterResumeName").value=item?.name||"";
    document.getElementById("masterResumeSource").value=item?.sourceType||"drive";
    document.getElementById("masterResumeDriveUrl").value=item?.url||"";
    document.getElementById("masterResumeFile").value="";
    document.getElementById("masterResumeLocalStatus").textContent=item?.fileName?("Current: "+item.fileName):"Stored on this device.";
    editor.querySelectorAll('.master-resume-tracks input[type="checkbox"]').forEach((input)=>input.checked=(item?.tracks||[]).includes(input.value));
    syncMasterResumeSourceRows();
  }
  async function saveMasterResumeFromEditor(){
    const name=document.getElementById("masterResumeName").value.trim()||"Master resume";
    const sourceType=document.getElementById("masterResumeSource").value;
    const tracks=[...document.querySelectorAll('.master-resume-tracks input[type="checkbox"]:checked')].map((input)=>input.value);
    if(!tracks.length){ setStatus("Assign at least one track"); return; }
    const items=readMasterResumes();
    const existing=items.find((item)=>item.id===editingMasterResumeId);
    const id=existing?.id||("master-"+Date.now());
    const next={...(existing||{}),id,name,sourceType,tracks};
    if(sourceType==="drive"){
      const url=document.getElementById("masterResumeDriveUrl").value.trim();
      if(!url){ setStatus("Add a Google Drive URL"); return; }
      next.url=url;
      next.fileName="";
      try{ await deleteMasterResumeFile(id); }catch{}
    }else{
      const file=document.getElementById("masterResumeFile").files[0];
      if(file){
        await saveMasterResumeFile(id,file);
        next.fileName=file.name;
      }else if(!next.fileName){
        setStatus("Choose a local resume file");
        return;
      }
      next.url="";
    }
    const index=items.findIndex((item)=>item.id===id);
    if(index>=0) items[index]=next; else items.push(next);
    writeMasterResumes(items);
    renderMasterResumeList();
    resetMasterResumeEditor();
    setStatus("Master resume saved");
  }

  function hydrateImmediateData(){
    maintainCaches();
    const cachedJobs=readCache(CACHE_JOBS_KEY,null);
    if(Array.isArray(cachedJobs) && cachedJobs.length){
      state.jobs=cachedJobs;
      setStatus("Refreshing…");
    } else if(Array.isArray(window.RAVEN_SNAPSHOT?.jobs)){
      state.jobs=normalizeJobs(window.RAVEN_SNAPSHOT.jobs);
      setStatus("Refreshing…");
    }
    state.documentApprovals=readCache(DOCUMENT_APPROVALS_KEY,{})||{};
    state.viewedJobs=readCache(VIEWED_JOBS_KEY,{})||{};
    const cachedDiscovered=readCache(CACHE_DISCOVERED_KEY,{});
    if(cachedDiscovered && typeof cachedDiscovered==="object"){
      Object.keys(state.discovered).forEach((track)=>{
        if(Array.isArray(cachedDiscovered[track])) state.discovered[track]=cachedDiscovered[track];
      });
    }
    render();
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
    const userSettings=readCache(USER_SETTINGS_KEY,{})||{};
    state.runtime = {
      theme: runtime.theme || {},
      settings: { ...(runtime.settings || {}), ...userSettings },
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
    syncOptionsControls();
  }
  function syncOptionsControls() {
    document.querySelectorAll("[data-setting-key]").forEach((control)=>{
      const key=control.dataset.settingKey;
      const value=state.runtime.settings[key];
      if(control.type==="checkbox") control.checked=parseBool(value,false);
      else if(value!==undefined && value!==null) control.value=String(value);
    });
  }

  function applyUserSetting(key,value) {
    const current=readCache(USER_SETTINGS_KEY,{})||{};
    current[key]=value;
    writeCache(USER_SETTINGS_KEY,current);
    state.runtime.settings[key]=value;

    if(key==="sidebar-width") document.documentElement.style.setProperty("--sidebar-width",value);
    if(key==="detail-panel-width") document.documentElement.style.setProperty("--detail-panel-width",value);
    if(key==="card-density") document.documentElement.dataset.cardDensity=value||"compact";
    if(key==="show-sync-status") status.hidden=!parseBool(value,true);

    render();
  }

  function resetUserSettings() {
    try{ localStorage.removeItem(USER_SETTINGS_KEY); }catch{}
    loadRuntimeConfig().then(()=>render());
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
      // The add-job form has its own collapsed/open state.
      // Feature flags may disable it, but must never force it open.
      if (element.id === "captureForm") {
        if (!featureEnabled(element.dataset.feature, true)) element.hidden = true;
        return;
      }
      element.hidden = !featureEnabled(element.dataset.feature, true);
    });
    status.hidden = !settingEnabled("show-sync-status", true);
  }
  function buildStatusFilter() {
    const current = statusFilter.value;
    const statuses = state.runtime.statuses.filter((item) => parseBool(item.visible, true));
    statusFilter.innerHTML = '<option value="">All jobs</option>';
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
    if(window.RavenCore) return window.RavenCore.normalizeJobs(payload,columns);
    const rows = Array.isArray(payload) ? payload : payload.jobs || payload.rows || [];
    return rows.map((row)=>Array.isArray(row)?Object.fromEntries(columns.map((key,index)=>[key,row[index]||""])):row).filter((job)=>job.id||job.title||job.url);
  }
  function normalizeComparableUrl(value) {
    if(window.RavenCore) return window.RavenCore.normalizeUrl(value);
    try {
      const url = new URL(value || "");
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gh_src","source"].forEach((key)=>url.searchParams.delete(key));
      url.hash = "";
      return url.toString().replace(/\/$/,"");
    } catch { return String(value || "").trim(); }
  }

  function normalizeDiscovered(results) {
    if(window.RavenCore?.fromDiscoveredJob) return (results||[]).map(window.RavenCore.fromDiscoveredJob).filter((job)=>job.url);
    return (results||[]).filter((job)=>job?.url);
  }

  async function loadDiscovered(track = state.activeTrack) {
    try {
      const payload = await window.RavenAPI.listResults(track);
      state.discovered[track] = normalizeDiscovered(payload.results);
      writeCache(CACHE_DISCOVERED_KEY,state.discovered);
      render();
      return true;
    } catch (error) {
      console.warn("Discovered jobs unavailable.", error);
      return false;
    }
  }

  async function runJobSearch() {
    const original = searchJobsButton.textContent;
    const track = state.activeTrack;
    searchJobsButton.disabled = true;
    searchJobsButton.textContent = "Searching…";
    setStatus("Fast search…");
    try {
      const payload = await window.RavenAPI.searchJobs(track);
      state.discovered[track] = normalizeDiscovered(payload.results);
      writeCache(CACHE_DISCOVERED_KEY,state.discovered);
      state.selectedId = null;
      render();
      setStatus(payload.count + " results · background enrichment may continue");

      // Avoid timer-driven polling. Fresh data is loaded on explicit actions,
      // tab changes, or when the user returns to Raven after a minute away.
    } catch (error) {
      setStatus("Search failed: " + error.message);
    } finally {
      searchJobsButton.disabled = false;
      searchJobsButton.textContent = original;
    }
  }

  async function loadJobs() {
    setStatus("Syncing jobs...");
    try {
      const payload = await window.RavenAPI.listJobs();
      state.jobs = normalizeJobs(payload);
      writeCache(CACHE_JOBS_KEY,state.jobs);
      setStatus("Up to date");
      render();
    } catch (error) {
      setStatus("Offline cache");
      if(!state.jobs.length) list.innerHTML = '<p class="empty">No cached jobs available.</p>';
    }
  }
  function parseDate(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }
  function sortedJobs(jobs) {
    const mode = state.runtime.settings["default-sort"] || "added-desc";
    const compareWithinGroup=(a,b)=>{
      if (mode==="added-asc") return parseDate(a.added)-parseDate(b.added);
      if (mode==="title-asc") return String(a.title||"").localeCompare(String(b.title||""));
      if (mode==="company-asc") return String(a.company||"").localeCompare(String(b.company||""));
      return parseDate(b.added)-parseDate(a.added);
    };
    return [...jobs].sort((a,b)=>{
      const remoteOrder=Number(isRemoteJob(b))-Number(isRemoteJob(a));
      return remoteOrder || compareWithinGroup(a,b);
    });
  }
  function preferredDescription(primary, fallback) {
    const current = String(primary || "").trim();
    const refreshed = String(fallback || "").trim();
    return refreshed.length > current.length ? refreshed : current;
  }

  function combinedJobs() {
    const discovered = state.discovered[state.activeTrack] || [];
    const discoveredByUrl = new Map(discovered.map((job)=>[normalizeComparableUrl(job.url),job]));
    const saved = state.jobs
      .filter((job)=>String(job.track||"").trim().toLowerCase()===state.activeTrack.toLowerCase())
      .map((job)=>{
        const extra=discoveredByUrl.get(normalizeComparableUrl(job.url));
        if(!extra) return job;
        return {
          ...job,
          company:job.company||extra.company,
          location:job.location||extra.location,
          remote:job.remote||extra.remote,
          salaryText:job.salaryText||extra.salaryText,
          source:job.source||extra.source,
          notes:preferredDescription(job.notes,extra.notes),
          fitScore:job.fitScore||extra.fitScore
        };
      });
    const savedUrls = new Set(saved.map((job)=>normalizeComparableUrl(job.url)).filter(Boolean));
    const unsaved = discovered.filter((job)=>!savedUrls.has(normalizeComparableUrl(job.url)));
    return [...saved, ...unsaved];
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
  function matchScore(job) {
    if (Number(job.fitScore)) return Math.round(Number(job.fitScore));
    const title=String(job.title||"").toLowerCase();
    const notes=String(job.notes||"").toLowerCase();
    let score=66;
    if (job.remote) score+=4;
    if (job.salaryText || job.salaryMin || job.salaryMax) score+=3;
    if (job.company) score+=2;
    if (job.location) score+=1;
    const track=String(job.track||state.activeTrack);
    if (track==="Professional") {
      if (/implementation|project manager|program manager|operations manager|customer success|training|enablement|onboarding/.test(title)) score+=10;
      if (/senior|lead|manager/.test(title)) score+=4;
    } else if (track==="Labor") {
      if (/maintenance|technician|parks|grounds|warehouse|repair|field service|production|painter/.test(title)) score+=11;
      if (/mechanical|repair|maintenance|tools|equipment/.test(notes)) score+=4;
    } else if (track==="Games / 3D") {
      if (/environment artist|world artist|level artist|3d environment|3d artist|world builder/.test(title)) score+=14;
      if (/senior|lead|staff/.test(title)) score+=5;
    } else {
      if (/operations|training|implementation|customer success|project|program|service/.test(title)) score+=8;
    }
    return Math.max(55,Math.min(96,score));
  }
  function pipelineBucket(job) {
    const s=String(job.status||"Saved").toLowerCase();
    if (s.includes("ignored")) return "Ignored";
    if (s.includes("offer")) return "Offer";
    if (s.includes("interview")) return "Interview";
    if (s.includes("applied")) return "Applied";
    if (s.includes("interested")) return "Interested";
    if (s.includes("ready") || s.includes("tailor")) return "Tailoring";
    return "Saved";
  }
  function isRemoteJob(job) {
    if (job.remote===true) return true;
    const remote=String(job.remote||"").toLowerCase();
    const location=String(job.location||"").toLowerCase();
    return /\bremote\b/.test(remote) || /remote position|fully remote|work from home/.test(location);
  }
  function commuteCacheKey(location) {
    return String(location||"").trim().toLowerCase().replace(/\s+/g," ");
  }
  async function loadCommute(location) {
    const key=commuteCacheKey(location);
    if(!key || state.commutes[key] !== undefined) return;
    state.commutes[key]="loading";
    try{
      const payload=await window.RavenAPI.commute(location);
      state.commutes[key]=Number.isFinite(Number(payload.minutes)) ? Number(payload.minutes) : null;
    }catch{
      state.commutes[key]=null;
    }
    document.querySelectorAll('[data-commute-key="'+CSS.escape(key)+'"]').forEach((el)=>{
      const minutes=state.commutes[key];
      if(minutes) {
        el.textContent=minutes+" min";
        el.hidden=false;
      } else {
        el.remove();
      }
    });
  }

  function cleanJobDescription(value) {
    return String(value||"")
      .replace(/\[JOBTRACK_DATA\][\s\S]*?\[\/JOBTRACK_DATA\]/gi,"")
      .replace(/\[JOBTRACK_DATA\][\s\S]*$/gi,"")
      .trim();
  }
  function jobDetailSummary(job) {
    const description=cleanJobDescription(job.notes).replace(/\s+/g," ").trim();
    const role=String(job.title||"This role").trim();
    const company=String(job.company||"the employer").trim();
    const context=(isRemoteJob(job)?"This is a remote ":"This is a ")+role+" position at "+company+".";
    const sentences=description.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g)||[];
    const useful=sentences
      .map((sentence)=>sentence.trim())
      .filter((sentence)=>sentence.length>35)
      .filter((sentence)=>!/^Employer posting re-verified/i.test(sentence))
      .slice(0,3);
    if(useful.length<2 && description){
      const remainder=description.slice(0,520).replace(/\s+\S*$/,"").trim();
      if(remainder) useful.push(remainder+(remainder.endsWith(".")?"":"."));
    }
    return [context,...useful].slice(0,4).join(" ");
  }

  function jobSummary(job) {
    const role=String(job.title||"Role").trim();
    const company=String(job.company||"").trim();
    const remote=isRemoteJob(job)?"Remote ":"";
    let description=cleanJobDescription(job.notes)
      .replace(/Employer posting re-verified[^.]*\.\s*/i,"")
      .replace(/\s+/g," ")
      .trim();
    const sentence=(description.match(/^.*?[.!?](?:\s|$)/)||[])[0]||description;
    const context=remote+role+(company?" at "+company:"");
    const detail=sentence && !context.toLowerCase().includes(sentence.toLowerCase()) ? sentence : "";
    const combined=[context,detail].filter(Boolean).join(". ");
    return combined.length>190 ? combined.slice(0,187).replace(/\s+\S*$/,"")+"..." : combined;
  }

  function relativeAdded(value) {
    const t=parseDate(value);
    if(!t) return "Recently";
    const days=Math.floor((Date.now()-t)/86400000);
    if(days<=0) return "Today";
    if(days===1) return "Yesterday";
    if(days<7) return days+" days ago";
    if(days<30) return Math.floor(days/7)+"w ago";
    return Math.floor(days/30)+"mo ago";
  }
  function render() {
    renderJobs();
  }
  function renderJobs() {
    list.innerHTML="";
    const jobs=filteredJobs();
    const groups=[
      {bucket:"Interested",label:"Bookmarked"},
      {bucket:"Saved",label:"Active jobs"},
      {bucket:"Tailoring",label:"Tailoring"},
      {bucket:"Applied",label:"Applied"},
      {bucket:"Interview",label:"Interview"},
      {bucket:"Offer",label:"Offer"},
      {bucket:"Ignored",label:"Ignored"}
    ];
    groups.forEach((group)=>{
      const groupJobs=jobs.filter((job)=>pipelineBucket(job)===group.bucket);
      if(!groupJobs.length) return;
      const section=document.createElement("section");
      section.className="pipeline-stage";
      section.innerHTML='<header class="stage-header"><h2>'+escapeHtml(group.label)+'</h2><span>'+groupJobs.length+'</span></header>';
      const cards=document.createElement("div");
      cards.className="stage-cards";
      groupJobs.forEach((job)=>{
          const card=document.createElement("article");
          const viewed=hasViewed(job);
          card.className="job-card"+(job.id===state.selectedId?" active":"")+(isRemoteJob(job)?" is-remote":"")+(job.status==="Applied"?" is-applied":"")+(job.status==="Interested"?" is-interested":"")+(job.status==="Ignored"?" is-ignored":"")+(viewed?" is-viewed":" is-new");
          card.dataset.status=statusToken(job.status);
          card.dataset.jobId=String(job.id||"");
          const company=job.company||"Company not captured";
          const location=[job.location,job.remote].filter(Boolean).join(" · ")||"Location not captured";
          const salary=job.salaryText||"";
          const rawStatus=String(job.status||"Saved");
          const meaningfulStatus=!/^(saved|discovered)$/i.test(rawStatus);
          const statusLabel=rawStatus.toLowerCase()==="interested"?"Bookmarked":rawStatus;
          const attentionIndicator=!viewed
            ? '<span class="job-status is-new-status">New</span>'
            : (meaningfulStatus?'<span class="job-status">'+escapeHtml(statusLabel)+'</span>':'');
          const isIgnored=rawStatus.toLowerCase()==="ignored";
          const isBookmarked=rawStatus.toLowerCase()==="interested";
          const bookmarkStar=/^(applied|ignored)$/i.test(rawStatus) ? "" :
            '<button class="bookmark-star'+(isBookmarked?' is-bookmarked':'')+'" type="button" data-card-bookmark aria-pressed="'+String(isBookmarked)+'" aria-label="'+(isBookmarked?'Remove bookmark':'Bookmark job')+'" title="'+(isBookmarked?'Remove bookmark':'Bookmark job')+'">'+(isBookmarked?'★':'☆')+'</button>';
          const ignoreControl='<button class="ignore-job-button'+(isIgnored?' is-restore':'')+'" type="button" data-ignore-job aria-label="'+(isIgnored?'Restore job':'Ignore job')+'" title="'+(isIgnored?'Restore job':'Ignore job')+'">'+(isIgnored?'↩':'×')+'</button>';
          card.innerHTML=
            '<button class="job-card-summary" type="button" aria-expanded="'+String(job.id===state.selectedId)+'">'+
              '<span class="card-main">'+
                (attentionIndicator?'<span class="card-topline">'+attentionIndicator+'</span>':'')+
                '<span class="job-title">'+escapeHtml(job.title||"Untitled job")+'</span>'+
                '<span class="company-name">'+escapeHtml(company)+'</span>'+
                '<span class="job-location">'+escapeHtml(location)+'</span>'+
                '<span class="job-summary">'+escapeHtml(jobSummary(job))+'</span>'+
                (salary?'<span class="job-salary">'+escapeHtml(salary)+'</span>':'')+
                '<span class="job-age">'+escapeHtml(relativeAdded(job.added))+'</span>'+
              '</span>'+
              (!isRemoteJob(job) && job.location ? '<span class="commute-footer" data-commute-key="'+escapeAttr(commuteCacheKey(job.location))+'" hidden></span>' : '')+
            '</button>'+bookmarkStar+ignoreControl;
          if (job.id===state.selectedId) {
            const expanded=document.createElement("span");
            expanded.className="job-card-expanded";
            expanded.innerHTML=renderInlineDetail(job);
            card.appendChild(expanded);
            expanded.querySelectorAll("[data-approved-apply]").forEach((button)=>{ button.addEventListener("click",(event)=>{event.stopPropagation();beginApprovedApplication(job);}); });
            expanded.querySelectorAll("[data-apply-status]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                toggleApplied(job);
              });
            });
            expanded.querySelectorAll("[data-queue]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                enqueue(job,button.dataset.queue,button);
              });
            });
            expanded.querySelectorAll("[data-document-menu]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                const menu=button.nextElementSibling;
                const opening=menu.hidden;
                expanded.querySelectorAll(".document-menu").forEach((item)=>{ item.hidden=true; });
                menu.hidden=!opening;
                button.setAttribute("aria-expanded",String(opening));
              });
            });
            expanded.querySelectorAll("[data-document-revise]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                openDocumentReview(job,button.dataset.documentRevise);
              });
            });
            expanded.querySelectorAll("[data-document-delete]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                deleteGeneratedDocument(job,button.dataset.documentDelete);
              });
            });
            expanded.querySelectorAll("[data-description-toggle]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                const section=button.closest(".job-description");
                const summary=section.querySelector("[data-description-summary]");
                const full=section.querySelector("[data-description-full]");
                const expanding=button.getAttribute("aria-expanded")!=="true";
                summary.hidden=expanding;
                full.hidden=!expanding;
                button.setAttribute("aria-expanded",String(expanding));
                button.textContent=expanding?"Show summary":"Show more";
              });
            });
            expanded.querySelectorAll("[data-document-edit]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                const field=button.closest(".document-control");
                const editor=field.querySelector(".document-editor");
                editor.hidden=!editor.hidden;
                if(!editor.hidden) editor.querySelector("input").focus();
              });
            });
            expanded.querySelectorAll("[data-document-cancel]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                button.closest(".document-editor").hidden=true;
              });
            });
            expanded.querySelectorAll("[data-document-form]").forEach((form)=>{
              form.addEventListener("submit",(event)=>{
                event.preventDefault();
                event.stopPropagation();
                saveDocumentLink(job,form.dataset.documentForm,form.querySelector("input").value);
              });
            });
            expanded.querySelectorAll("[data-document-approve]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                toggleDocumentApproval(job,button.dataset.documentApprove);
              });
            });
            expanded.querySelectorAll("a").forEach((link)=>link.addEventListener("click",(event)=>event.stopPropagation()));
          }
          const summary=card.querySelector(".job-card-summary");
          let swipeStart=null;
          let suppressOpen=false;
          summary.addEventListener("pointerdown",(event)=>{
            if(event.pointerType==="touch") swipeStart={x:event.clientX,y:event.clientY};
          });
          summary.addEventListener("pointerup",(event)=>{
            if(!swipeStart || event.pointerType!=="touch") return;
            const dx=event.clientX-swipeStart.x;
            const dy=event.clientY-swipeStart.y;
            swipeStart=null;
            if(dx<-60 && Math.abs(dx)>Math.abs(dy)){
              suppressOpen=true;
              setJobIgnored(job,true);
            }
          });
          summary.addEventListener("pointercancel",()=>{ swipeStart=null; });
          summary.addEventListener("click",()=>{
            if(suppressOpen){
              suppressOpen=false;
              return;
            }
            const opening=state.selectedId!==job.id;
            if(opening) markViewed(job);
            state.selectedId = opening ? job.id : null;
            render();

            requestAnimationFrame(()=>{
              const anchor=document.querySelector('[data-job-id="'+CSS.escape(String(job.id||""))+'"]');
              if(anchor){
                anchor.scrollIntoView({behavior:"smooth",block:"start",inline:"nearest"});
                anchor.querySelector(".job-card-summary")?.focus({preventScroll:true});
              }
            });
          });
          card.querySelectorAll("[data-card-bookmark]").forEach((button)=>{
            button.addEventListener("click",()=>toggleBookmark(job));
          });
          card.querySelectorAll("[data-ignore-job]").forEach((button)=>{
            button.addEventListener("click",()=>setJobIgnored(job,!isIgnored));
          });
          cards.appendChild(card);
          if(!isRemoteJob(job) && job.location){
            const key=commuteCacheKey(job.location);
            const known=state.commutes[key];
            const footer=card.querySelector(".commute-footer");
            if(Number.isFinite(Number(known))){
              footer.textContent=Number(known)+" min";
              footer.hidden=false;
            } else if(known===undefined) {
              loadCommute(job.location);
            }
          }
        });
      section.appendChild(cards);
      list.appendChild(section);
    });
  }
  function statusToken(value) {
    return String(value||"saved").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"saved";
  }
  function fallbackDetailRows() {
    return [
      {key:"salaryText",label:"Salary",format:"text",visible:true,position:1},
      {key:"source",label:"Source",format:"text",visible:true,position:2},
      {key:"resume",label:"Resume",format:"link",visible:true,position:3},
      {key:"coverLetter",label:"Cover letter",format:"link",visible:true,position:4},
      {key:"notes",label:"Notes",format:"multiline",visible:true,position:5}
    ];
  }
  function fallbackActions() {
    return [
      {key:"apply",label:"Apply",format:"external-link",visible:true,position:1},
      {key:"resume",label:"Generate resume",format:"queue",visible:true,position:2},
      {key:"coverLetter",label:"Generate cover letter",format:"queue",visible:true,position:3}
    ];
  }
  function actionFeatureKey(key) {
    return ({resume:"resume-generation",coverLetter:"cover-letter-generation",applicationReview:"application-review"})[key]||"";
  }
  function renderInlineDetail(job) {
    const configured=uiRows("detail");
    const detailRows=(configured.length?configured:fallbackDetailRows()).filter(fieldAllowed);
    const detailHtml=detailRows.map((item)=>{
      const value=job[item.key];
      let rendered="Unknown";
      if (item.format==="link") rendered=documentControl(job,item.key,item.label||item.key);
      else if (value!==undefined && value!==null && value!=="") rendered=escapeHtml(value);
      return '<dt>'+escapeHtml(item.label||item.key)+'</dt><dd>'+rendered+'</dd>';
    }).join("");

    const isApplied=String(job.status||"").toLowerCase()==="applied";
    const docsReady=documentsReadyForApplication(job);
    const applyGate=job.url?'<button class="workflow-action application-gate'+(docsReady?' is-ready':'')+'" type="button" data-approved-apply aria-label="Open application with approved documents" title="'+(docsReady?'Open application':'Approve resume and cover letter first')+'"><span class="workflow-icon" aria-hidden="true">↗</span><span>'+(docsReady?'Apply':'Approve docs')+'</span></button>':"";
    const appliedAction='<button class="workflow-action'+(isApplied?' is-applied':'')+'" type="button" data-apply-status="'+(isApplied?'saved':'applied')+'" aria-pressed="'+String(isApplied)+'" aria-label="'+(isApplied?'Unmark as applied':'Mark as applied')+'" title="'+(isApplied?'Unmark as applied':'Mark as applied')+'"><span class="workflow-icon" aria-hidden="true">✓</span><span>Applied</span></button>';
    const configuredActions=uiRows("detail-action");
    const actions=(configuredActions.length?configuredActions:fallbackActions())
      .filter((item)=>{
        if (item.key==="apply") return false;
        if (item.key==="posting") return Boolean(job.url);
        return false;
      })
      .map((item)=>{
        const label=item.label||item.key;
        if (item.format==="external-link" || item.key==="posting" || item.key==="apply") {
          return '<a class="workflow-action" href="'+escapeAttr(job.url)+'" target="_blank" rel="noopener" aria-label="'+escapeAttr(label)+'" title="'+escapeAttr(label)+'"><span class="workflow-icon" aria-hidden="true">↗</span><span>'+escapeHtml(label)+'</span></a>';
        }
        const icon=item.key==="resume"?"R":item.key==="coverLetter"?"✉":"＋";
        const shortLabel=item.key==="resume"?"Resume":item.key==="coverLetter"?"Cover letter":label;
        return '<button class="workflow-action" type="button" data-queue="'+escapeAttr(item.key)+'" aria-label="'+escapeAttr(label)+'" title="'+escapeAttr(label)+'"><span class="workflow-icon" aria-hidden="true">'+icon+'</span><span>'+escapeHtml(shortLabel)+'</span></button>';
      }).join("");

    const fullDescription=cleanJobDescription(job.notes)||"Full job description not yet available.";
    const summary=jobDetailSummary(job);
    const canExpand=fullDescription.length>summary.length+40;
    return '<section class="inline-job-detail">'+
      '<section class="job-description"><h3>Job summary</h3>'+
        '<p class="job-description-text" data-description-summary>'+escapeHtml(summary)+'</p>'+
        (canExpand?'<p class="job-description-text full-description" data-description-full hidden>'+escapeHtml(fullDescription)+'</p>':'')+
        (canExpand?'<button class="description-toggle" type="button" data-description-toggle aria-expanded="false">Show more</button>':'')+
      '</section>'+
      '<dl>'+detailHtml+'</dl>'+
      '<div class="detail-actions">'+
        '<div class="workflow-actions" aria-label="Application actions">'+actions+applyGate+appliedAction+'</div>'+
      '</div>'+
    '</section>';
  }


  function candidateProfileCache(){ return readCache(CANDIDATE_PROFILE_CACHE_KEY,{})||{}; }
  function jobAnalysisCache(){ return readCache(JOB_ANALYSIS_CACHE_KEY,{})||{}; }
  function candidateProfileId(masterResume){
    const identity=[masterResume?.id||"",masterResume?.fileName||"",masterResume?.version||"",masterResume?.dataUrl||""].join("|");
    return window.RavenCore?.stableHash ? window.RavenCore.stableHash(identity) : identity;
  }
  function jobAnalysisId(job){
    const identity=(window.RavenCore?.jobFingerprint(job)||(job.id||job.url||""))+"|"+String(job.notes||"");
    return window.RavenCore?.stableHash ? window.RavenCore.stableHash(identity) : identity;
  }
  function analyzeJobLocally(job){
    const text=[job.title||"",job.notes||""].join(" ");
    return {keywords:resumeKeywords(text),title:job.title||"",company:job.company||"",analyzedAt:new Date().toISOString()};
  }
  function getJobAnalysis(job){
    const id=jobAnalysisId(job);
    const cache=jobAnalysisCache();
    if(cache[id]) return cache[id];
    const analysis=analyzeJobLocally(job);
    cache[id]={...analysis,cachedAt:new Date().toISOString()};
    writeCache(JOB_ANALYSIS_CACHE_KEY,cache);
    return analysis;
  }

  async function extractMasterResumeText(masterResume){
    if(!masterResume) return "";
    if(masterResume.sourceType==="drive") return "";
    const file=await getMasterResumeFile(masterResume.id);
    if(!file) return "";
    const type=(file.type||"").toLowerCase();
    if(type.includes("text") || /\.(txt|rtf)$/i.test(file.name||"")){
      return await file.text();
    }
    if(type==="application/pdf" || /\.pdf$/i.test(file.name||"")){
      if(!window.pdfjsLib){
        await new Promise((resolve,reject)=>{
          const script=document.createElement("script");
          script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload=resolve;
          script.onerror=reject;
          document.head.appendChild(script);
        }).catch(()=>{});
      }
      if(window.pdfjsLib){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const bytes=new Uint8Array(await file.arrayBuffer());
        const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
        const pages=[];
        for(let i=1;i<=pdf.numPages;i++){
          const page=await pdf.getPage(i);
          const content=await page.getTextContent();
          pages.push(content.items.map((item)=>item.str||"").join(" "));
        }
        return pages.join("\n");
      }
    }
    return "";
  }

  function resumeKeywords(text){
    const stop=new Set(["the","and","for","with","that","this","from","your","you","our","are","will","have","has","into","about","their","they","who","but","not","all","any","can","job","role","work","team","years","experience","skills","using","use","strong","ability","required","preferred"]);
    const words=String(text||"").toLowerCase().match(/[a-z][a-z0-9+#.\/-]{2,}/g)||[];
    const counts={};
    words.forEach((w)=>{ if(!stop.has(w)) counts[w]=(counts[w]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,45).map(([w])=>w);
  }

  function instantResumeHtml(job,masterText){
    const keywords=getJobAnalysis(job).keywords;
    const keywordSet=new Set(keywords);
    const cleaned=String(masterText||"").replace(/\r/g,"").replace(/[ \t]+/g," ").trim();
    const lines=cleaned.split(/\n+/).map((s)=>s.trim()).filter(Boolean);
    const scored=lines.map((line,index)=>{
      const tokens=(line.toLowerCase().match(/[a-z][a-z0-9+#.\/-]{2,}/g)||[]);
      const hits=tokens.reduce((n,w)=>n+(keywordSet.has(w)?1:0),0);
      const bulletish=/^[•●▪◦*\-–—]/.test(line) || line.length>55;
      return {line,index,score:hits*4+(bulletish?1:0)};
    });
    const best=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,18).sort((a,b)=>a.index-b.index);
    const fallback=scored.filter(x=>x.line.length>=35&&x.line.length<=260).slice(0,14);
    const selected=(best.length>=6?best:fallback).map(x=>x.line.replace(/^[•●▪◦*\-–—]\s*/,"")).filter(Boolean);
    const title=job.title||"Target Role";
    const company=job.company||"";
    const topKeywords=keywords.slice(0,16).join(" · ");
    const bullets=selected.slice(0,16).map(line=>"<li>"+escapeHtml(line)+"</li>").join("");
    const sourceNote=masterText ? "Prioritized directly from the assigned master resume." : "Master resume text could not be extracted locally; AI refinement queued.";
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>"+escapeHtml(title)+" Resume</title><style>"+
      "@page{size:letter;margin:.55in}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10.5pt;line-height:1.28;max-width:7.4in;margin:0 auto}"+
      "h1{font-size:19pt;margin:0 0 3px}h2{font-size:11.5pt;text-transform:uppercase;border-bottom:1px solid #333;margin:12px 0 5px;padding-bottom:2px}"+
      ".target{font-size:10pt;margin-bottom:8px}.keywords{font-size:9.5pt}.note{font-size:8.5pt;color:#555;margin-top:10px}ul{margin:4px 0 0 18px;padding:0}li{margin:0 0 4px}"+
      "</style></head><body><h1>Resume</h1><div class=\"target\"><strong>Target:</strong> "+escapeHtml(title)+(company?" · "+escapeHtml(company):"")+"</div>"+
      "<h2>ATS Focus</h2><div class=\"keywords\">"+escapeHtml(topKeywords)+"</div>"+
      "<h2>Relevant Experience & Qualifications</h2><ul>"+bullets+"</ul>"+
      "<div class=\"note\">"+escapeHtml(sourceNote)+" This instant draft preserves source wording and does not invent qualifications.</div></body></html>";
  }

  async function getCandidateProfile(masterResume){
    const id=candidateProfileId(masterResume);
    const cache=candidateProfileCache();
    if(cache[id]) return cache[id];
    const text=await extractMasterResumeText(masterResume);
    const profile={id,masterResumeId:masterResume?.id||"",text,createdAt:new Date().toISOString()};
    cache[id]={...profile,cachedAt:new Date().toISOString()};
    writeCache(CANDIDATE_PROFILE_CACHE_KEY,cache);
    return profile;
  }

  async function createInstantResume(job,masterResume){
    const profile=await getCandidateProfile(masterResume);
    const text=profile.text;
    const html=instantResumeHtml(job,text);
    const dataUrl="data:text/html;charset=utf-8,"+encodeURIComponent(html);
    if(!job._discovered){
      await window.RavenAPI.updateJob(job.id,{resume:dataUrl});
      job.resume=dataUrl;
      const saved=state.jobs.find((item)=>item.id===job.id);
      if(saved) saved.resume=dataUrl;
      writeCache(CACHE_JOBS_KEY,state.jobs);
    }
    return {url:dataUrl,extracted:Boolean(text)};
  }

  function documentLabel(type) {
    return type==="resume"?"resume":"cover letter";
  }
  function setGenerationButton(button,active,label="Generating…"){
    if(!button) return;
    if(active){
      button.classList.remove("generation-failed");
      button.removeAttribute("title");
      button.dataset.originalHtml=button.innerHTML;
      button.disabled=true;
      button.classList.add("is-generating");
      button.setAttribute("aria-busy","true");
      button.innerHTML='<span class="generation-spinner" aria-hidden="true"></span><span>'+escapeHtml(label)+'</span>';
    }else{
      button.disabled=false;
      button.classList.remove("is-generating");
      button.removeAttribute("aria-busy");
      if(button.dataset.originalHtml) button.innerHTML=button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function generatedResumeHtml(job,resume){
    const list=(items,tag="li")=>(Array.isArray(items)?items:[]).filter(Boolean).map((x)=>"<"+tag+">"+escapeHtml(String(x))+"</"+tag+">").join("");
    const experiences=(Array.isArray(resume.experience)?resume.experience:[]).map((item)=>{
      const role=escapeHtml(item.role||"");
      const company=escapeHtml(item.company||"");
      const dates=escapeHtml(item.dates||"");
      return '<section class="resume-job"><div class="resume-job-head"><div><strong class="resume-role">'+role+'</strong>'+(company?'<span class="resume-company">'+company+'</span>':'')+'</div>'+(dates?'<span class="resume-dates">'+dates+'</span>':'')+'</div><ul>'+list(item.bullets)+'</ul></section>';
    }).join("");
    const education=(Array.isArray(resume.education)?resume.education:[]).map((item)=>{
      const main=[item.degree,item.school].filter(Boolean).map(escapeHtml).join(" · ");
      const meta=[item.location,item.dates].filter(Boolean).map(escapeHtml).join(" | ");
      return '<div class="resume-education"><strong>'+main+'</strong><span>'+meta+'</span></div>';
    }).join("");
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHtml((resume.name||"Resume")+" — "+(job.title||"Role"))+'</title><style>'+
      '@page{size:letter;margin:.52in .58in}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#20242a;font-size:10.15pt;line-height:1.3;max-width:7.35in;margin:0 auto;background:#fff}'+
      '.resume-header{padding:0 0 10px;border-bottom:3px solid #294f7a;margin-bottom:10px}h1{font-size:24pt;line-height:1;margin:0;color:#17212b;letter-spacing:-.02em}'+
      '.headline{font-size:10.5pt;font-weight:700;color:#294f7a;margin:4px 0 0}.contact{font-size:9pt;color:#555f69;margin:4px 0 0}'+
      'h2{font-size:10.3pt;text-transform:uppercase;letter-spacing:.11em;color:#294f7a;margin:11px 0 5px;padding:0 0 3px;border-bottom:1px solid #cfd6dd}'+
      '.summary{margin:0;color:#30363d}.skills{display:grid;grid-template-columns:1fr 1fr;gap:1px 26px;margin:0;padding:0;list-style:none}.skills li{position:relative;padding-left:10px;margin:0 0 2px}.skills li:before{content:"•";position:absolute;left:0;color:#294f7a}'+
      'ul{margin:4px 0 0 17px;padding:0}li{margin:0 0 3px;break-inside:avoid}.resume-job{margin:0 0 9px;break-inside:avoid}.resume-job-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:2px}.resume-role{display:block;font-size:10.4pt;color:#17212b}.resume-company{display:block;font-size:9.3pt;font-weight:700;color:#4c5966;margin-top:1px}.resume-dates{font-size:8.9pt;color:#606b76;white-space:nowrap;padding-top:1px}.resume-education{display:flex;justify-content:space-between;gap:12px;margin:0 0 5px}.resume-education strong{color:#17212b}.resume-education span{font-size:8.8pt;color:#606b76;white-space:nowrap}.additional{margin:0;padding-left:17px}'+
      '@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'+
      '</style></head><body>'+
      '<header class="resume-header"><h1>'+escapeHtml(resume.name||"")+'</h1>'+
      (resume.headline?'<p class="headline">'+escapeHtml(resume.headline)+'</p>':'')+
      (resume.contact?'<p class="contact">'+escapeHtml(resume.contact)+'</p>':'')+
      '</header>'+
      '<h2>Professional Summary</h2><p class="summary">'+escapeHtml(resume.summary||"")+'</p>'+
      '<h2>Core Skills</h2><ul class="skills">'+list(resume.skills)+'</ul>'+
      '<h2>Professional Experience</h2>'+experiences+
      (education?'<h2>Education</h2>'+education:'')+
      ((resume.additional||[]).length?'<h2>Additional</h2><ul class="additional">'+list(resume.additional)+'</ul>':'')+
      '</body></html>';
  }

  function generationCache(){
    return readCache(GENERATION_CACHE_KEY,{})||{};
  }
  function generationCacheId(job,masterResume){
    return window.RavenCore?.generationFingerprint(job,masterResume,"resume",RESUME_TEMPLATE_VERSION) || [job.id||job.url,masterResume?.id||"",RESUME_TEMPLATE_VERSION].join("|");
  }
  async function generateResumeOnline(job,masterResume){
    const cacheId=generationCacheId(job,masterResume);
    const cached=generationCache()[cacheId];
    if(cached?.resume) return cached.resume;
    const resume=await generateDocumentOnline(job,masterResume,"resume","");
    const cache=generationCache();
    cache[cacheId]={resume,createdAt:new Date().toISOString()};
    writeCache(GENERATION_CACHE_KEY,cache);
    return resume;
  }

  async function enqueue(job,type,button=null) {
    if(type!=="resume" && job[type]) return openDocumentReview(job,type);
    if(type!=="resume"){
      setGenerationButton(button,true,"Generating…");
      try{
        await generateDocumentForJob(job,type,"");
        setGenerationButton(button,false);
        openDocumentReview(job,type);
      }catch(error){
        setGenerationButton(button,false);
        if(button){
          button.classList.add("generation-failed");
          button.title=String(error.message||"Document generation failed");
          const label=button.querySelector("span:last-child");
          if(label) label.textContent="Retry";
        }
      }
      return;
    }
    setGenerationButton(button,true,navigator.onLine?"Generating…":"Offline draft…");
    try{
      const masterResume=await masterResumeTaskInput(job.track||state.activeTrack);
      if(!masterResume) throw new Error("Assign a master resume to this job track first.");
      if(navigator.onLine===false){
        setStatus("Offline · building local resume…");
        const instant=await createInstantResume(job,masterResume);
        if(!instant?.url) throw new Error("Offline resume generation failed.");
        setStatus("Offline resume ready");
      }else{
        setStatus("Generating resume online…");
        const resume=await generateResumeOnline(job,masterResume);
        await saveGeneratedDocument(job,"resume",resume);
        setStatus("Resume ready");
      }
      setGenerationButton(button,false);
      openDocumentReview(job,type);
    }catch(error){
      setGenerationButton(button,false);
      if(button){
        button.classList.add("generation-failed");
        button.title=String(error.message||"Resume generation failed");
        const label=button.querySelector("span:last-child");
        if(label) label.textContent="Retry";
      }
      setStatus("Resume generation failed: "+error.message);
      console.error("Resume generation failed",error);
    }
  }

  function generatedCoverLetterHtml(job,letter){
    const paragraphs=(letter.paragraphs||[]).map((p)=>"<p>"+escapeHtml(String(p))+"</p>").join("");
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHtml("Cover Letter — "+(job.title||"Role"))+'</title><style>@page{size:letter;margin:.75in}body{font-family:Arial,Helvetica,sans-serif;color:#20242a;font-size:11pt;line-height:1.5;max-width:7in;margin:0 auto}p{margin:0 0 14px}.closing{margin-top:24px}</style></head><body><p>'+escapeHtml(letter.greeting||"Dear Hiring Manager,")+'</p>'+paragraphs+'<p class="closing">'+escapeHtml(letter.closing||"Sincerely,")+'<br>'+escapeHtml(letter.signature||"")+'</p></body></html>';
  }
  async function saveGeneratedDocument(job,type,document){
    const html=type==="resume"?generatedResumeHtml(job,document):generatedCoverLetterHtml(job,document);
    const dataUrl="data:text/html;charset=utf-8,"+encodeURIComponent(html);
    if(!job._discovered){
      await window.RavenAPI.updateJob(job.id,{[type]:dataUrl});
      job[type]=dataUrl;
      const saved=state.jobs.find((item)=>item.id===job.id); if(saved) saved[type]=dataUrl;
      writeCache(CACHE_JOBS_KEY,state.jobs);
    }
    return dataUrl;
  }
  async function generateDocumentOnline(job,masterResume,type="resume",instructions=""){
    if(!config?.generateApiUrl) throw new Error("Online document generator is not configured.");
    if(masterResume?.sourceType==="drive") throw new Error("Online generation currently requires a local master resume file.");
    if(!masterResume?.dataUrl){
      const file=await getMasterResumeFile(masterResume?.id);
      if(file) masterResume={...masterResume,fileName:file.name,mimeType:file.type||"application/octet-stream",dataUrl:await fileToDataUrl(file)};
    }
    if(!masterResume?.dataUrl) throw new Error("The assigned master resume file is not available on this device.");
    const response=await fetch(config.generateApiUrl,{method:"POST",headers:{"Content-Type":"application/json","X-Raven-Client":"raven-web-v1"},body:JSON.stringify({
      documentType:type==="coverLetter"?"coverLetter":"resume",instructions,jobId:job.id,jobTitle:job.title||"",company:job.company||"",track:job.track||state.activeTrack,sourceUrl:job.url||"",jobDescription:job.notes||"",jobAnalysis:getJobAnalysis(job),
      masterResume:{id:masterResume.id||"",name:masterResume.name||"",sourceType:masterResume.sourceType||"",fileName:masterResume.fileName||"",mimeType:masterResume.mimeType||"",dataUrl:masterResume.dataUrl||""}
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){ const error=new Error(payload.error||("Online generation failed ("+response.status+")")); error.code=payload.code||""; error.provider=payload.provider||""; error.retryable=Boolean(payload.retryable); error.upstreamStatus=payload.upstreamStatus||0; throw error; }
    const document=type==="coverLetter"?payload.coverLetter:payload.resume;
    if(!document) throw new Error("Online generator returned no "+documentLabel(type)+".");
    return document;
  }

  async function generateDocumentForJob(job,type,instructions) {
    const label=documentLabel(type);
    setStatus((instructions?"Revising ":"Generating ")+label+"...");
    try{
      const masterResume=await masterResumeTaskInput(job.track||state.activeTrack);
      if(!masterResume) throw new Error("Assign a master resume to this job track first.");
      const document=await generateDocumentOnline(job,masterResume,type,instructions);
      await saveGeneratedDocument(job,type,document);
      setDocumentApproved(job,type,false);
      setStatus(label[0].toUpperCase()+label.slice(1)+" ready · approval required");
      return document;
    }catch(error){
      setStatus("Could not generate "+label+": "+error.message);
      throw error;
    }
  }

  function documentApprovalKey(job,type){ return String(job.id||job.url||"")+"|"+type; }
  function isDocumentApproved(job,type){
    const record=state.documentApprovals[documentApprovalKey(job,type)];
    return Boolean(record && record.value===String(job[type]||""));
  }
  function setDocumentApproved(job,type,approved){
    const key=documentApprovalKey(job,type);
    if(approved) state.documentApprovals[key]={value:String(job[type]||""),approvedAt:new Date().toISOString()};
    else delete state.documentApprovals[key];
    writeCache(DOCUMENT_APPROVALS_KEY,state.documentApprovals);
  }
  function toggleDocumentApproval(job,type){
    const approved=!isDocumentApproved(job,type);
    setDocumentApproved(job,type,approved);
    setStatus(documentLabel(type)+(approved?" approved":" approval removed"));
    render();
  }
  function documentsReadyForApplication(job){ return Boolean(job.resume&&job.coverLetter&&isDocumentApproved(job,"resume")&&isDocumentApproved(job,"coverLetter")); }
  function beginApprovedApplication(job){
    if(!job.resume || !job.coverLetter){ setStatus("Generate both documents before applying"); return; }
    if(!isDocumentApproved(job,"resume") || !isDocumentApproved(job,"coverLetter")){ setStatus("Approve the resume and cover letter before applying"); return; }
    window.open(job.url,"_blank","noopener");
    setStatus("Approved documents locked · review the application before submitting");
  }

  function previewableDocumentUrl(value) {
    const url=String(value||"");
    return /drive\.google\.com\/file\/d\//.test(url) ? url.replace(/\/view(?:\?.*)?$/,"/preview") : url;
  }
  function openDocumentReview(job,type) {
    state.generatorJob=job;
    state.generatorType=type;
    const label=documentLabel(type);
    const value=String(job[type]||"");
    document.getElementById("reviewTitle").textContent="Review "+label;
    document.getElementById("reviewContext").textContent=(job.title||"Role")+(job.company?" at "+job.company:"");
    const link=document.getElementById("reviewOpenFile");
    link.href=value;
    link.textContent="Open "+label+" in a new tab";
    document.getElementById("reviewFrame").src=previewableDocumentUrl(value);
    document.getElementById("reviewInstructions").value="";
    const approve=document.getElementById("reviewApprove"); if(approve){ approve.textContent=isDocumentApproved(job,type)?"Approved ✓":"Approve document"; approve.classList.toggle("is-approved",isDocumentApproved(job,type)); }
    document.getElementById("documentReviewDialog").showModal();
  }
  function closeDocumentReview() {
    const dialog=document.getElementById("documentReviewDialog");
    if(dialog.open) dialog.close();
    document.getElementById("reviewFrame").src="about:blank";
    if(state.generatorType) {
      const label=documentLabel(state.generatorType);
      setStatus(label[0].toUpperCase()+label.slice(1)+" saved");
    }
    state.generatorJob=null;
    state.generatorType=null;
  }
  async function submitDocumentRevision(event) {
    event.preventDefault();
    const job=state.generatorJob;
    const type=state.generatorType;
    const instructions=document.getElementById("reviewInstructions").value.trim();
    if(!job||!type||!instructions) return;
    const button=document.getElementById("reviewSubmit");
    button.disabled=true;
    try{
      await generateDocumentForJob(job,type,instructions);
      const value=String(job[type]||"");
      document.getElementById("reviewOpenFile").href=value;
      document.getElementById("reviewFrame").src=previewableDocumentUrl(value);
      document.getElementById("reviewInstructions").value="";
    }finally{
      button.disabled=false;
    }
  }

  async function toggleApplied(job) {
    const isApplied=String(job.status||"").toLowerCase()==="applied";
    const nextStatus=isApplied?"Saved":"Applied";
    const appliedDate=isApplied?null:new Date().toISOString();
    setStatus(isApplied?"Unmarking applied...":"Marking applied...");
    try{
      if(job._discovered){
        await window.RavenAPI.addJob({
          track:job.track||state.activeTrack,
          title:job.title||"",
          company:job.company||"",
          location:job.location||"",
          remote:isRemoteJob(job),
          salaryText:job.salaryText||"",
          url:job.url||"",
          source:job.source||"",
          status:nextStatus,
          appliedDate,
          notes:job.notes||""
        });
      }else{
        await window.RavenAPI.updateJob(job.id,{status:nextStatus,appliedDate});
      }
      job.status=nextStatus;
      job.appliedDate=appliedDate||"";
      state.selectedId=null;
      if(job._discovered) await loadJobs(); else { writeCache(CACHE_JOBS_KEY,state.jobs); render(); }
      setStatus(isApplied?"Marked not applied":"Marked applied");
    }catch(error){
      setStatus("Update failed: "+error.message);
    }
  }

  function viewedKey(job) {
    return normalizeComparableUrl(job.url)||String(job.id||"");
  }
  function hasViewed(job) {
    const statusValue=String(job.status||"").toLowerCase();
    if(!["saved","discovered","interested",""].includes(statusValue)) return true;
    return parseBool(job.viewed,false) || Boolean(state.viewedJobs[viewedKey(job)]);
  }
  function markViewed(job) {
    if(hasViewed(job)) return;
    const key=viewedKey(job);
    if(key){
      state.viewedJobs[key]=true;
      writeCache(VIEWED_JOBS_KEY,state.viewedJobs);
    }
    job.viewed=true;
    if(!job._discovered){
      const saved=state.jobs.find((item)=>item.id===job.id);
      if(saved) saved.viewed=true;
      writeCache(CACHE_JOBS_KEY,state.jobs);
      window.RavenAPI.updateJob(job.id,{viewed:true}).catch((error)=>{
        console.warn("Viewed state could not be synced.",error);
      });
    }
  }

  async function setJobIgnored(job,ignored) {
    const nextStatus=ignored?"Ignored":"Saved";
    setStatus(ignored?"Ignoring job...":"Restoring job...");
    try{
      if(job._discovered){
        await window.RavenAPI.addJob({
          track:job.track||state.activeTrack,
          title:job.title||"",
          company:job.company||"",
          location:job.location||"",
          remote:isRemoteJob(job),
          salaryText:job.salaryText||"",
          url:job.url||"",
          source:job.source||"",
          status:nextStatus,
          viewed:true,
          notes:job.notes||""
        });
      }else{
        await window.RavenAPI.updateJob(job.id,{status:nextStatus,viewed:true});
      }
      job.status=nextStatus;
      job.viewed=true;
      state.selectedId=null;
      if(job._discovered) await loadJobs(); else { writeCache(CACHE_JOBS_KEY,state.jobs); render(); }
      setStatus(ignored?"Moved to ignored":"Job restored");
    }catch(error){
      setStatus("Ignore update failed: "+error.message);
    }
  }

  async function toggleBookmark(job) {
    const interested=String(job.status||"").toLowerCase()==="interested";
    const nextStatus=interested?"Saved":"Interested";
    setStatus(interested?"Removing bookmark...":"Saving bookmark...");
    try{
      if(job._discovered){
        await window.RavenAPI.addJob({
          track:job.track||state.activeTrack,
          title:job.title||"",
          company:job.company||"",
          location:job.location||"",
          remote:isRemoteJob(job),
          salaryText:job.salaryText||"",
          url:job.url||"",
          source:job.source||"",
          status:nextStatus,
          notes:job.notes||""
        });
      }else{
        await window.RavenAPI.updateJob(job.id,{status:nextStatus});
      }
      job.status=nextStatus;
      state.selectedId=null;
      if(job._discovered) await loadJobs(); else { writeCache(CACHE_JOBS_KEY,state.jobs); render(); }
      setStatus(interested?"Bookmark removed":"Bookmarked");
    }catch(error){
      setStatus("Bookmark failed: "+error.message);
    }
  }

  function escapeHtml(value) {
    return String(value||"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g,"&#96;"); }
  async function deleteGeneratedDocument(job,key) {
    const label=documentLabel(key);
    if(!window.confirm("Delete this "+label+" from the job?")) return;
    setStatus("Deleting "+label+"...");
    try{
      await window.RavenAPI.updateJob(job.id,{[key]:""});
      await loadJobs();
      setStatus(label[0].toUpperCase()+label.slice(1)+" deleted");
    }catch(error){
      setStatus("Could not delete "+label+": "+error.message);
    }
  }
  function documentControl(job,key,label) {
    const value=job[key];
    const fileLabel=String(label||"file").toLowerCase();
    if(!value){
      return '<span class="document-control is-empty">'+
        '<button class="document-primary" type="button" data-queue="'+escapeAttr(key)+'">Generate</button>'+
      '</span>';
    }
    return '<span class="document-control has-file">'+
      '<button class="document-primary" type="button" data-queue="'+escapeAttr(key)+'">Review</button>'+
      '<span class="document-overflow">'+
        '<button class="document-menu-button" type="button" data-document-menu aria-haspopup="menu" aria-expanded="false" aria-label="More '+escapeAttr(fileLabel)+' options" title="More options">…</button>'+
        '<span class="document-menu" role="menu" hidden>'+
          '<button type="button" role="menuitem" data-document-revise="'+escapeAttr(key)+'">Request changes</button>'+
          '<button class="danger-action" type="button" role="menuitem" data-document-delete="'+escapeAttr(key)+'">Delete</button>'+
        '</span>'+
      '</span>'+
    '</span>';
  }

  function bindEvents() {
    const optionsButton=document.getElementById("optionsButton");
    const optionsDialog=document.getElementById("optionsDialog");
    if(optionsButton && optionsDialog){
      const optionsHome=document.getElementById("optionsHome");
      const optionsCard=document.getElementById("optionsCard");
      const optionsCardTitle=document.getElementById("optionsCardTitle");
      const optionsBackButton=document.getElementById("optionsBackButton");
      const categoryTitles={"master-resumes":"Master resumes",layout:"Layout","job-info":"Job information",behavior:"Behavior"};

      const showOptionsHome=()=>{
        if(!optionsCard || optionsCard.hidden) return;
        optionsCard.classList.remove("is-entering","is-active");
        optionsCard.classList.add("is-leaving");
        const finish=()=>{
          optionsCard.classList.remove("is-leaving");
          optionsCard.hidden=true;
          optionsHome.hidden=false;
          optionsCard.removeEventListener("animationend",finish);
        };
        optionsCard.addEventListener("animationend",finish);
        setTimeout(finish,220);
      };

      const showOptionsCard=(key)=>{
        const panel=optionsDialog.querySelector('[data-options-panel="'+key+'"]');
        if(!panel) return;
        optionsDialog.querySelectorAll("[data-options-panel]").forEach((item)=>item.hidden=item!==panel);
        optionsCardTitle.textContent=categoryTitles[key]||"Options";
        optionsHome.hidden=true;
        optionsCard.hidden=false;
        optionsCard.classList.remove("is-leaving","is-active");
        void optionsCard.offsetWidth;
        optionsCard.classList.add("is-entering");
        const finish=()=>{
          optionsCard.classList.remove("is-entering");
          optionsCard.classList.add("is-active");
          optionsCard.removeEventListener("animationend",finish);
        };
        optionsCard.addEventListener("animationend",finish);
        setTimeout(finish,220);
      };

      optionsButton.addEventListener("click",()=>{
        syncOptionsControls();
        optionsHome.hidden=false;
        optionsCard.hidden=true;
        optionsCard.classList.remove("is-entering","is-leaving","is-active");
        renderMasterResumeList();
        resetMasterResumeEditor();
        document.documentElement.classList.add("options-open");
        document.body.classList.add("options-open");
        optionsDialog.showModal();
      });
      optionsDialog.addEventListener("click",(event)=>{
        if(event.target===optionsDialog) optionsDialog.close();
      });
      optionsDialog.addEventListener("close",()=>{
        document.documentElement.classList.remove("options-open");
        document.body.classList.remove("options-open");
      });
      optionsDialog.addEventListener("cancel",()=>{
        document.documentElement.classList.remove("options-open");
        document.body.classList.remove("options-open");
      });
      optionsDialog.querySelectorAll("[data-options-target]").forEach((button)=>{
        button.addEventListener("click",()=>showOptionsCard(button.dataset.optionsTarget));
      });
      if(optionsBackButton) optionsBackButton.addEventListener("click",showOptionsHome);
      optionsDialog.querySelectorAll("[data-setting-key]").forEach((control)=>{
        control.addEventListener("change",()=>{
          const value=control.type==="checkbox" ? control.checked : control.value;
          applyUserSetting(control.dataset.settingKey,value);
        });
      });
      const resetOptionsButton=document.getElementById("resetOptionsButton");
      if(resetOptionsButton) resetOptionsButton.addEventListener("click",resetUserSettings);

      const addMasterResumeButton=document.getElementById("addMasterResumeButton");
      const masterResumeQuickFile=document.getElementById("masterResumeQuickFile");
      const cancelMasterResumeButton=document.getElementById("cancelMasterResumeButton");
      const saveMasterResumeButton=document.getElementById("saveMasterResumeButton");
      const masterResumeSource=document.getElementById("masterResumeSource");
      if(addMasterResumeButton && masterResumeQuickFile){
        addMasterResumeButton.addEventListener("click",()=>{
          masterResumeQuickFile.value="";
          masterResumeQuickFile.click();
        });
        masterResumeQuickFile.addEventListener("change",()=>{
          const file=masterResumeQuickFile.files?.[0];
          if(!file) return;
          openMasterResumeEditor();
          document.getElementById("masterResumeSource").value="local";
          syncMasterResumeSourceRows();
          const editorFile=document.getElementById("masterResumeFile");
          const transfer=new DataTransfer();
          transfer.items.add(file);
          editorFile.files=transfer.files;
          document.getElementById("masterResumeName").value=file.name.replace(/\.[^.]+$/,"");
          document.getElementById("masterResumeLocalStatus").textContent="Selected: "+file.name;
        });
      }
      if(cancelMasterResumeButton) cancelMasterResumeButton.addEventListener("click",resetMasterResumeEditor);
      if(saveMasterResumeButton) saveMasterResumeButton.addEventListener("click",saveMasterResumeFromEditor);
      if(masterResumeSource) masterResumeSource.addEventListener("change",syncMasterResumeSourceRows);
      optionsDialog.addEventListener("click",async(event)=>{
        const itemEl=event.target.closest("[data-master-resume-id]");
        if(!itemEl) return;
        const id=itemEl.dataset.masterResumeId;
        const items=readMasterResumes();
        const item=items.find((entry)=>entry.id===id);
        if(event.target.closest("[data-master-edit]") && item) openMasterResumeEditor(item);
        if(event.target.closest("[data-master-delete]") && item){
          if(!window.confirm("Delete "+(item.name||"this master resume")+"?")) return;
          writeMasterResumes(items.filter((entry)=>entry.id!==id));
          try{ await deleteMasterResumeFile(id); }catch{}
          renderMasterResumeList();
          resetMasterResumeEditor();
          setStatus("Master resume deleted");
        }
      });
    }

    trackTabs.forEach((tab)=>{
      tab.addEventListener("click",async()=>{
        state.activeTrack=tab.dataset.track;
        state.selectedId=null;
        trackTabs.forEach((item)=>{
          const active=item===tab;
          item.classList.toggle("active",active);
          item.setAttribute("aria-selected",String(active));
        });
        render();
        loadDiscovered(state.activeTrack);
      });
    });
    searchJobsButton.addEventListener("click",runJobSearch);
    const toggleCaptureButton=document.getElementById("toggleCaptureButton");
    const captureForm=document.getElementById("captureForm");
    toggleCaptureButton.addEventListener("click",()=>{
      const opening=captureForm.hidden;
      captureForm.hidden=!opening;
      toggleCaptureButton.setAttribute("aria-expanded",String(opening));
      toggleCaptureButton.textContent=opening?"Cancel":"Add job";
      if(opening) document.getElementById("jobUrl").focus();
    });
    searchBox.addEventListener("input",render);
    statusFilter.addEventListener("change",render);
    document.getElementById("captureForm").addEventListener("submit",(event)=>{
      event.preventDefault();
      saveCapture(document.getElementById("jobUrl").value.trim());
    });
    document.getElementById("documentReviewForm").addEventListener("submit",submitDocumentRevision);
    document.getElementById("reviewApprove")?.addEventListener("click",()=>{ const job=state.generatorJob,type=state.generatorType;if(!job||!type)return;setDocumentApproved(job,type,true);document.getElementById("reviewApprove").textContent="Approved ✓";document.getElementById("reviewApprove").classList.add("is-approved");setStatus(documentLabel(type)+" approved"); });
    document.querySelectorAll("[data-review-close]").forEach((button)=>{
      button.addEventListener("click",closeDocumentReview);
    });
  }
  function applySharedParams() {
    const params=new URLSearchParams(window.location.search);
    const sharedUrl=params.get("url");
    if (sharedUrl) {
      const parts=sharedUrl.split(/\s+/);
      document.getElementById("jobUrl").value=parts.find((part)=>/^https?:\/\//.test(part))||sharedUrl;
    }
  }
  async function refreshCurrentTrack(options={}) {
    const includeDiscovered=options.includeDiscovered!==false;
    const tasks=[loadJobs()];
    if(includeDiscovered) tasks.push(loadDiscovered(state.activeTrack));
    await Promise.allSettled(tasks);
    render();
  }
  async function boot() {
    bindEvents();
    applySharedParams();
    hydrateImmediateData();

    const runtimePromise=loadRuntimeConfig();
    const refreshPromise=refreshCurrentTrack();
    await Promise.allSettled([runtimePromise,refreshPromise]);

    let lastRefresh=Date.now();
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden && Date.now()-lastRefresh>60000){
        lastRefresh=Date.now();
        refreshCurrentTrack({includeDiscovered:false});
      }
    });
  }
  boot();
}());
