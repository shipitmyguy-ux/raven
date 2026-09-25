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
    jobActivity: {},
    jobCoverage: {},
    analytics: null,
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
  const JOB_TRACKS = trackTabs.map((tab)=>tab.dataset.track).filter(Boolean);
  const searchJobsButton = document.getElementById("searchJobsButton");

  const CACHE_JOBS_KEY="ravenJobsCacheV1";
  const CACHE_DISCOVERED_KEY="ravenDiscoveredCacheV1";
  const DOCUMENT_APPROVALS_KEY="ravenDocumentApprovalsV1";
  const VIEWED_JOBS_KEY="ravenViewedJobsV1";
  const APPLICATION_PROFILE_KEY="ravenApplicationProfileV1";
  const ANSWER_MEMORY_KEY="ravenAnswerMemoryV1";
  const GENERATOR_PREFS_KEY="ravenGeneratorPreferencesV1";
  const USER_SETTINGS_KEY="ravenUserSettingsV1";
  const MASTER_RESUMES_KEY="ravenMasterResumesV1";
  const MASTER_RESUME_DB="ravenMasterResumeFilesV1";
  const GENERATION_CACHE_KEY="ravenGenerationCacheV1";
  const JOB_ANALYSIS_CACHE_KEY="ravenJobAnalysisCacheV1";
  const PENDING_DOCUMENT_SYNC_KEY="ravenPendingDocumentSyncV1";
  const DEVICE_BACKUP_KEYS=[
    MASTER_RESUMES_KEY,APPLICATION_PROFILE_KEY,ANSWER_MEMORY_KEY,GENERATOR_PREFS_KEY,
    USER_SETTINGS_KEY,DOCUMENT_APPROVALS_KEY,VIEWED_JOBS_KEY
  ];
  const RESUME_TEMPLATE_VERSION="modern-v11-zero-llm";
  const DEFAULT_FOLLOW_UP_DAYS=7;
  const activeGeneration=new Map();
  const generationErrors=new Map();
  let editingMasterResumeId=null;
  let editingAnswerMemoryKey=null;

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
    pruneObjectCache(JOB_ANALYSIS_CACHE_KEY,120,45);
  }

  function normalizeAnswerQuestion(value){
    return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }
  function isSensitiveAnswerQuestion(value){
    return /\b(sponsor|sponsorship|visa|citizen|citizenship|authorized|authorization|salary|compensation|pay|gender|sex|race|ethnic|ethnicity|disab|veteran|attest|certif|background|criminal|conviction|age|date of birth|birth date|ssn|social security|captcha|assessment|drug|protected class)\b/i.test(normalizeAnswerQuestion(value));
  }
  function readAnswerMemory(){
    const values=readCache(ANSWER_MEMORY_KEY,{});
    return values&&typeof values==="object"&&!Array.isArray(values)?values:{};
  }
  function resetAnswerMemoryEditor(){
    editingAnswerMemoryKey=null;
    const question=document.getElementById("answerMemoryQuestion");
    const answer=document.getElementById("answerMemoryAnswer");
    if(question) question.value="";
    if(answer) answer.value="";
    const save=document.getElementById("saveAnswerMemory");
    if(save) save.textContent="Save answer";
  }
  function renderAnswerMemoryList(){
    const host=document.getElementById("answerMemoryList");
    if(!host) return;
    const values=readAnswerMemory();
    const entries=Object.entries(values);
    if(!entries.length){
      host.innerHTML='<p class="options-help">No reusable answers saved yet.</p>';
      return;
    }
    host.innerHTML=entries.sort((a,b)=>a[0].localeCompare(b[0])).map(([question,answer])=>
      '<article class="answer-memory-item" data-answer-key="'+escapeAttr(question)+'">'+
        '<div><strong>'+escapeHtml(question.replace(/\b\w/g,(char)=>char.toUpperCase()))+'</strong><small>'+escapeHtml(String(answer))+'</small></div>'+
        '<div class="answer-memory-actions"><button type="button" data-answer-edit>Edit</button><button type="button" data-answer-delete>Delete</button></div>'+
      '</article>'
    ).join("");
  }
  function saveAnswerMemoryFromEditor(){
    const question=document.getElementById("answerMemoryQuestion")?.value.trim()||"";
    const answer=document.getElementById("answerMemoryAnswer")?.value.trim()||"";
    const key=normalizeAnswerQuestion(question);
    if(!key||!answer){ setStatus("Add both a question and an answer"); return; }
    if(isSensitiveAnswerQuestion(question)){ setStatus("Sensitive, legal, demographic, salary, sponsorship, CAPTCHA, and assessment answers are not stored in Answer Memory"); return; }
    const values=readAnswerMemory();
    if(editingAnswerMemoryKey&&editingAnswerMemoryKey!==key) delete values[editingAnswerMemoryKey];
    values[key]=answer;
    writeCache(ANSWER_MEMORY_KEY,values);
    renderAnswerMemoryList();
    resetAnswerMemoryEditor();
    setStatus("Reusable answer saved");
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
  async function exportDeviceBackup(){
    setStatus("Preparing device backup...");
    try{
      const storage={};
      for(const key of DEVICE_BACKUP_KEYS){
        const value=localStorage.getItem(key);
        if(value!==null) storage[key]=value;
      }
      const files={};
      for(const item of readMasterResumes()){
        if(item.sourceType==="drive") continue;
        const file=await getMasterResumeFile(item.id);
        if(!file) continue;
        files[item.id]={
          name:file.name||item.fileName||"master-resume",
          type:file.type||"application/octet-stream",
          lastModified:Number(file.lastModified||Date.now()),
          dataUrl:await fileToDataUrl(file)
        };
      }
      const payload={
        format:"raven-device-backup",
        version:1,
        exportedAt:new Date().toISOString(),
        storage,
        masterResumeFiles:files
      };
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download="raven-device-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      setStatus("Device backup exported");
    }catch(error){
      setStatus("Device backup failed: "+error.message);
    }
  }
  async function restoreDeviceBackup(file){
    setStatus("Restoring device backup...");
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.format!=="raven-device-backup"||Number(payload?.version)!==1) throw new Error("Unsupported Raven backup file.");
      const storage=payload.storage&&typeof payload.storage==="object"?payload.storage:{};
      for(const key of DEVICE_BACKUP_KEYS){
        if(Object.prototype.hasOwnProperty.call(storage,key)){
          JSON.parse(storage[key]);
          localStorage.setItem(key,storage[key]);
        }
      }
      const files=payload.masterResumeFiles&&typeof payload.masterResumeFiles==="object"?payload.masterResumeFiles:{};
      for(const [id,entry] of Object.entries(files)){
        const dataUrl=String(entry?.dataUrl||"");
        if(!dataUrl.startsWith("data:")) continue;
        const response=await fetch(dataUrl);
        const blob=await response.blob();
        const restored=new File([blob],String(entry?.name||"master-resume"),{
          type:String(entry?.type||blob.type||"application/octet-stream"),
          lastModified:Number(entry?.lastModified||Date.now())
        });
        await saveMasterResumeFile(id,restored);
      }
      renderMasterResumeList();
      const profile=readCache(APPLICATION_PROFILE_KEY,{})||{};
      document.querySelectorAll("[data-profile-key]").forEach(input=>input.value=profile[input.dataset.profileKey]||"");
      renderAnswerMemoryList();
      syncOptionsControls();
      setStatus("Device backup restored");
    }catch(error){
      setStatus("Restore failed: "+error.message);
    }
  }
  function masterResumeForTrack(track){
    return readMasterResumes().find((item)=>Array.isArray(item.tracks)&&item.tracks.includes(track))||null;
  }
  async function masterResumeTaskInput(track){
    const item=masterResumeForTrack(track);
    if(!item) return null;
    const base={id:item.id,name:item.name||"Master resume",sourceType:item.sourceType,tracks:item.tracks||[],version:item.version||"",url:item.url||""};
    if(item.sourceType==="drive") return base;
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
    const next={...(existing||{}),id,name,sourceType,tracks,version:String(Date.now())};
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
    // A track has exactly one master resume. Reassigning it here removes the
    // same track from older masters instead of relying on "first one wins".
    items.forEach((item)=>{
      if(item.id===id || !Array.isArray(item.tracks)) return;
      item.tracks=item.tracks.filter((track)=>!tracks.includes(track));
    });
    const index=items.findIndex((item)=>item.id===id);
    if(index>=0) items[index]=next; else items.push(next);
    writeMasterResumes(items);
    renderMasterResumeList();
    resetMasterResumeEditor();
    setStatus("Master resume saved");
  }

  async function loadControlPanelData() {
    const jobsEl=document.getElementById("controlMetricJobs");
    const shortEl=document.getElementById("controlMetricShort");
    const failEl=document.getElementById("controlMetricFailures");
    const diagEl=document.getElementById("controlSourceDiagnosticsList");
    const eventsEl=document.getElementById("controlEventsFeed");
    const policyEl=document.getElementById("controlPolicyView");
    try{
      const [health,config,events]=await Promise.all([
        window.RavenAPI.controlHealth(),
        window.RavenAPI.getControlConfig(),
        window.RavenAPI.getControlEvents()
      ]);
      if(jobsEl) jobsEl.textContent=String(health?.jobs?.total ?? "—");
      if(shortEl) shortEl.textContent=String(health?.jobs?.short_descriptions ?? "—");
      if(failEl) failEl.textContent=String(health?.tasks?.current_failures ?? "—");
      if(diagEl){
        const rows=Array.isArray(health?.latest_diagnostics)?health.latest_diagnostics:[];
        diagEl.innerHTML=rows.length?rows.slice(0,12).map((row)=>
          '<div class="control-item"><span>'+escapeHtml(row.source||"source")+'</span><strong>'+escapeHtml(row.status||"")+' · '+escapeHtml(String(row.jobs_parsed??0))+'</strong></div>'
        ).join(""):'<p class="options-help">No source diagnostics recorded.</p>';
      }
      if(eventsEl){
        const rows=Array.isArray(events?.events)?events.events:[];
        eventsEl.innerHTML=rows.length?rows.slice(0,10).map((row)=>
          '<div class="control-event-item"><span><strong>'+escapeHtml(row.action||"event")+'</strong> · '+escapeHtml(row.status||"")+'</span><small>'+escapeHtml(relativeAdded(row.created_at))+'</small></div>'
        ).join(""):'<p class="options-help">No control events recorded.</p>';
      }
      if(policyEl) policyEl.textContent=JSON.stringify({
        writable_from_browser:config?.writable_from_browser===true,
        generation_policy:config?.generation_policy||[],
        source_policy:config?.source_policy||[],
        feature_flags:config?.feature_flags||[]
      },null,2);
    }catch(error){
      if(jobsEl) jobsEl.textContent="Offline";
      if(shortEl) shortEl.textContent="—";
      if(failEl) failEl.textContent="—";
      if(diagEl) diagEl.innerHTML='<p class="options-help">Control service unavailable.</p>';
      if(eventsEl) eventsEl.innerHTML='<p class="options-help">'+escapeHtml(error.message||String(error))+'</p>';
      if(policyEl) policyEl.textContent="Read-only control data unavailable.";
    }
  }

  async function loadAnalyticsData(){
    const applications=document.getElementById("analyticsApplications");
    const interviews=document.getElementById("analyticsInterviews");
    const offers=document.getElementById("analyticsOffers");
    const response=document.getElementById("analyticsResponse");
    const byTrack=document.getElementById("analyticsByTrack");
    const bySource=document.getElementById("analyticsBySource");
    const renderBreakdown=(host,record)=>{
      if(!host) return;
      const rows=Object.entries(record||{}).sort((a,b)=>Number(b[1]?.applications||0)-Number(a[1]?.applications||0));
      host.innerHTML=rows.length?rows.map(([name,value])=>{
        const rate=Math.round(Number(value?.interview_rate||0)*100);
        return '<div class="analytics-row"><span>'+escapeHtml(name)+'</span><strong>'+escapeHtml(String(value?.applications||0))+' apps · '+rate+'% interview</strong></div>';
      }).join(""):'<p class="options-help">No application outcomes yet.</p>';
    };
    try{
      const payload=await window.RavenAPI.analytics();
      const data=payload.analytics||{};
      state.analytics=data;
      if(applications) applications.textContent=String(data.applications??0);
      if(interviews) interviews.textContent=String(data.interviews??0);
      if(offers) offers.textContent=String(data.offers??0);
      if(response) response.textContent=Number.isFinite(Number(data.average_response_days))?Number(data.average_response_days).toFixed(1)+"d":"—";
      renderBreakdown(byTrack,data.by_track);
      renderBreakdown(bySource,data.by_source);
      renderBreakdown(document.getElementById("analyticsByResume"),data.by_resume_variant);
    }catch(error){
      if(applications) applications.textContent="—";
      if(interviews) interviews.textContent="—";
      if(offers) offers.textContent="—";
      if(response) response.textContent="—";
      if(byTrack) byTrack.innerHTML='<p class="options-help">Outcome analytics unavailable.</p>';
      if(bySource) bySource.innerHTML='<p class="options-help">'+escapeHtml(error.message||String(error))+'</p>';
    }
  }

  function hydrateImmediateData(){
    maintainCaches();
    const cachedJobs=readCache(CACHE_JOBS_KEY,null);
    if(Array.isArray(cachedJobs) && cachedJobs.length){
      state.jobs=normalizeJobs(cachedJobs);
      if(state.jobs.length!==cachedJobs.length) writeCache(CACHE_JOBS_KEY,state.jobs);
      setStatus("Refreshing…");
    } else if(Array.isArray(window.RAVEN_SNAPSHOT?.jobs)){
      state.jobs=normalizeJobs(window.RAVEN_SNAPSHOT.jobs);
      setStatus("Refreshing…");
    }
    state.documentApprovals=readCache(DOCUMENT_APPROVALS_KEY,{})||{};
    state.viewedJobs=readCache(VIEWED_JOBS_KEY,{})||{};
    const cachedDiscovered=readCache(CACHE_DISCOVERED_KEY,{});
    if(cachedDiscovered && typeof cachedDiscovered==="object"){
      let pruned=false;
      Object.keys(state.discovered).forEach((track)=>{
        if(!Array.isArray(cachedDiscovered[track])) return;
        const rows=cachedDiscovered[track].filter((job)=>{
          if(window.RavenCore?.isRenderableJob) return window.RavenCore.isRenderableJob(job);
          return !/^ATS:/i.test(String(job?.source||"")) || /^https?:\/\//i.test(String(job?.url||""));
        });
        state.discovered[track]=rows;
        if(rows.length!==cachedDiscovered[track].length) pruned=true;
      });
      if(pruned) writeCache(CACHE_DISCOVERED_KEY,state.discovered);
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
    if(window.RavenCore?.fromDiscoveredJob) {
      return (results||[])
        .map(window.RavenCore.fromDiscoveredJob)
        .filter((job)=>job.url && (!window.RavenCore.isRenderableJob || window.RavenCore.isRenderableJob(job)));
    }
    return (results||[]).filter((job)=>job?.url && (!/^ATS:/i.test(String(job.source||"")) || /^https?:\/\//i.test(String(job.url||""))));
  }

  async function loadAllDiscovered() {
    const results=await Promise.allSettled(JOB_TRACKS.map(async(track)=>{
      const payload=await window.RavenAPI.listResults(track);
      return {track,rows:normalizeDiscovered(payload.results)};
    }));
    let loaded=0;
    for(const result of results){
      if(result.status!=="fulfilled"){
        console.warn("Discovered jobs unavailable.",result.reason);
        continue;
      }
      state.discovered[result.value.track]=result.value.rows;
      loaded+=result.value.rows.length;
    }
    writeCache(CACHE_DISCOVERED_KEY,state.discovered);
    render();
    return loaded;
  }

  async function runJobSearch() {
    const original=searchJobsButton.textContent;
    searchJobsButton.disabled=true;
    searchJobsButton.textContent="Refreshing all…";
    state.selectedId=null;
    let total=0;
    const failed=[];
    const limited=[];
    for(let i=0;i<JOB_TRACKS.length;i++){
      const track=JOB_TRACKS[i];
      setStatus("Refreshing all jobs · "+(i+1)+"/"+JOB_TRACKS.length+" · "+track);
      try{
        const payload=await window.RavenAPI.searchJobs(track);
        state.discovered[track]=normalizeDiscovered(payload.results);
        total+=Number(payload.count||state.discovered[track].length||0);
        if(payload.budget_limited) limited.push(track);
        writeCache(CACHE_DISCOVERED_KEY,state.discovered);
        render();
      }catch(error){
        failed.push(track);
        console.warn("Job refresh failed for "+track,error);
      }
    }
    searchJobsButton.disabled=false;
    searchJobsButton.textContent=original;
    if(failed.length) setStatus(total+" refreshed · failed: "+failed.join(", "));
    else if(limited.length) setStatus("Refresh cooldown · showing cached jobs for "+limited.join(", ")+" · try again shortly");
    else setStatus(total+" jobs refreshed across all tabs · background enrichment may continue");
  }

  function pendingDocumentSync(){
    const value=readCache(PENDING_DOCUMENT_SYNC_KEY,{});
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }
  function rememberPendingDocument(job,type,value){
    if(!job?.id||!value) return;
    const pending=pendingDocumentSync();
    pending[job.id]={...(pending[job.id]||{}),[type]:{value,updatedAt:new Date().toISOString()}};
    writeCache(PENDING_DOCUMENT_SYNC_KEY,pending);
  }
  function mergePendingDocuments(jobs){
    const pending=pendingDocumentSync();
    return jobs.map((job)=>{
      const docs=pending[job.id]||{};
      const serverStamp=Date.parse(job.lastUpdated||"")||0;
      const pendingResumeStamp=Date.parse(docs.resume?.updatedAt||"")||0;
      const pendingCoverStamp=Date.parse(docs.coverLetter?.updatedAt||"")||0;
      return {
        ...job,
        resume:docs.resume?.value && pendingResumeStamp>serverStamp ? docs.resume.value : job.resume,
        coverLetter:docs.coverLetter?.value && pendingCoverStamp>serverStamp ? docs.coverLetter.value : job.coverLetter
      };
    });
  }
  async function flushPendingDocuments(){
    if(navigator.onLine===false) return;
    const pending=pendingDocumentSync();
    let changed=false;
    for(const [jobId,docs] of Object.entries(pending)){
      const job=state.jobs.find((item)=>String(item.id)===String(jobId));
      const serverStamp=Date.parse(job?.lastUpdated||"")||0;
      const patch={};
      if(docs?.resume?.value){
        const pendingStamp=Date.parse(docs.resume.updatedAt||"")||0;
        if(pendingStamp>serverStamp) patch.resume=docs.resume.value;
        else { delete docs.resume; changed=true; }
      }
      if(docs?.coverLetter?.value){
        const pendingStamp=Date.parse(docs.coverLetter.updatedAt||"")||0;
        if(pendingStamp>serverStamp) patch.coverLetter=docs.coverLetter.value;
        else { delete docs.coverLetter; changed=true; }
      }
      if(!Object.keys(patch).length){
        if(!docs.resume&&!docs.coverLetter) delete pending[jobId];
        changed=true;
        continue;
      }
      try{
        const updated=await window.RavenAPI.updateJob(jobId,patch);
        if(job && updated?.last_updated) job.lastUpdated=updated.last_updated;
        delete pending[jobId];
        changed=true;
      }catch{}
    }
    if(changed) writeCache(PENDING_DOCUMENT_SYNC_KEY,pending);
  }
  async function loadJobs() {
    setStatus("Syncing jobs...");
    try {
      const payload = await window.RavenAPI.listJobs();
      state.jobs = mergePendingDocuments(normalizeJobs(payload));
      writeCache(CACHE_JOBS_KEY,state.jobs);
      setStatus("Up to date");
      render();
      flushPendingDocuments().catch(()=>{});
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
      .filter((job)=>{
        if(String(job.track||"").trim().toLowerCase()!==state.activeTrack.toLowerCase()) return false;
        const legacyAutoDiscovered=/^DISC-/i.test(String(job.id||""))
          && String(job.status||"Saved").toLowerCase()==="saved"
          && !parseBool(job.viewed,false)
          && !job.resume && !job.coverLetter && !job.appliedDate;
        // Older deep-search builds copied discovered rows into raven_jobs.
        // Keep them visible only while the posting is still in the fresh
        // discovered set. Any explicit user action changes status/identity and
        // therefore preserves the job.
        if(legacyAutoDiscovered && !discoveredByUrl.has(normalizeComparableUrl(job.url))) return false;
        return true;
      })
      .map((job)=>{
        const extra=discoveredByUrl.get(normalizeComparableUrl(job.url));
        if(!extra) return job;
        return {
          ...job,
          company:job.company||extra.company,
          location:job.location||extra.location,
          remote:extra.remote,
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
    let score=66;
    if (isRemoteJob(job)) score+=4;
    if (job.salaryText || job.salaryMin || job.salaryMax) score+=3;
    if (job.company) score+=2;
    if (job.location) score+=1;
    if (String(job.notes||"").trim().length>=180) score+=4;
    if (String(job.title||"").trim()) score+=3;
    return Math.max(55,Math.min(96,score));
  }
  function pipelineBucket(job) {
    const s=String(job.status||"Saved").toLowerCase();
    if (s.includes("ignored")) return "Ignored";
    if (s.includes("rejected")) return "Rejected";
    if (s.includes("offer")) return "Offer";
    if (s.includes("interview")) return "Interview";
    if (s.includes("applied")) return "Applied";
    if (s.includes("interested")) return "Interested";
    if (s.includes("ready") || s.includes("tailor")) return "Tailoring";
    return "Saved";
  }
  function lifecycleStatuses() {
    const configured=Array.isArray(state.runtime.statuses)?state.runtime.statuses:[];
    const fallback=["Saved","Ready","Applied","Interview","Offer","Rejected","Ignored"];
    const rows=configured.length
      ? configured.filter((item)=>parseBool(item.visible,true)).sort((a,b)=>Number(a.order||0)-Number(b.order||0))
      : fallback.map((key,index)=>({key,label:key,order:index}));
    return rows.map((item)=>({key:String(item.key||item.label||""),label:String(item.label||item.key||"")})).filter((item)=>item.key);
  }
  function followUpDays() {
    const configured=Number(state.runtime.settings["follow-up-days"]);
    return Number.isFinite(configured)&&configured>0 ? Math.min(30,Math.round(configured)) : DEFAULT_FOLLOW_UP_DAYS;
  }
  function defaultFollowUpDate(fromValue) {
    const parsed=Date.parse(fromValue||"");
    const date=new Date(Number.isFinite(parsed)?parsed:Date.now());
    date.setDate(date.getDate()+followUpDays());
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,"0");
    const day=String(date.getDate()).padStart(2,"0");
    return year+"-"+month+"-"+day;
  }
  function followUpSummary(job) {
    const value=String(job.followUp||"").trim();
    if(!value) return "";
    const due=/^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value+"T12:00:00") : Date.parse(value);
    if(!Number.isFinite(due)) return "";
    const now=new Date();
    const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(due);
    const targetDay=Date.UTC(target.getFullYear(),target.getMonth(),target.getDate());
    const days=Math.round((targetDay-today)/86400000);
    if(days<0) return "Follow up overdue by "+Math.abs(days)+" day"+(Math.abs(days)===1?"":"s");
    if(days===0) return "Follow up today";
    if(days===1) return "Follow up tomorrow";
    return "Follow up in "+days+" days";
  }

  const ACTIVITY_TYPES=[
    ["note","Note"],
    ["recruiter_contact","Recruiter contact"],
    ["follow_up_sent","Follow-up sent"],
    ["assessment","Assessment"],
    ["interview_requested","Interview requested"],
    ["interview_scheduled","Interview scheduled"],
    ["interview_completed","Interview completed"],
    ["offer_received","Offer received"],
    ["rejected","Rejected"]
  ];
  function activityLabel(type){
    const found=ACTIVITY_TYPES.find(([key])=>key===String(type||""));
    if(found) return found[1];
    return String(type||"Activity").replace(/^signal_/,"").replace(/_/g," ").replace(/\b\w/g,(char)=>char.toUpperCase());
  }
  function formatActivityDate(value){
    const time=Date.parse(value||"");
    if(!Number.isFinite(time)) return "";
    return new Date(time).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
  }
  async function loadJobActivity(job,force=false){
    if(!job||job._discovered||!job.id) return;
    const key=String(job.id);
    const current=state.jobActivity[key];
    if(current?.loading || (!force&&current?.loaded)) return;
    state.jobActivity[key]={...(current||{}),loading:true,loaded:false};
    try{
      const [eventsPayload,snapshotsPayload]=await Promise.all([
        window.RavenAPI.listJobEvents(key),
        window.RavenAPI.listJobSnapshots(key)
      ]);
      state.jobActivity[key]={loading:false,loaded:true,events:eventsPayload.events||[],snapshots:snapshotsPayload.snapshots||[]};
    }catch(error){
      state.jobActivity[key]={loading:false,loaded:true,events:[],snapshots:[],error:String(error.message||error)};
    }
    if(state.selectedId===job.id) render();
  }
  async function loadJobCoverage(job,force=false){
    if(!job||job._discovered||!job.id) return;
    const key=String(job.id);
    const current=state.jobCoverage[key];
    if(current?.loading || (!force&&current?.loaded)) return;
    state.jobCoverage[key]={...(current||{}),loading:true,loaded:false};
    try{
      const payload=await window.RavenAPI.coverage(key);
      state.jobCoverage[key]={loading:false,loaded:true,data:payload.coverage||null};
    }catch(error){
      state.jobCoverage[key]={loading:false,loaded:true,data:null,error:String(error.message||error)};
    }
    if(state.selectedId===job.id) render();
  }
  function renderCoverage(job){
    if(job._discovered) return "";
    const record=state.jobCoverage[String(job.id)]||{};
    if(!record.loaded) return '<section class="evidence-coverage"><h3>Evidence coverage</h3><p class="activity-empty">Analyzing verified evidence…</p></section>';
    if(record.error||!record.data) return '<section class="evidence-coverage"><h3>Evidence coverage</h3><p class="activity-empty">Evidence coverage unavailable.</p></section>';
    const data=record.data;
    if(!Number(data.total||0)) return '<section class="evidence-coverage"><h3>Evidence coverage</h3><p class="activity-empty">No clear requirements could be extracted from this posting.</p></section>';
    const pct=Math.round(Number(data.supported_ratio||0)*100);
    const missing=(data.requirements||[]).filter((item)=>item.status==="missing").slice(0,4);
    const partial=(data.requirements||[]).filter((item)=>item.status==="partial").slice(0,3);
    const issues=[...missing,...partial].map((item)=>
      '<li class="coverage-'+escapeAttr(item.status)+'"><span>'+escapeHtml(item.requirement)+'</span><strong>'+escapeHtml(item.status==="missing"?"No evidence found":"Partial evidence")+'</strong></li>'
    ).join("");
    return '<section class="evidence-coverage"><div class="coverage-heading"><h3>Evidence coverage</h3><strong>'+pct+'% supported</strong></div>'+
      '<p class="coverage-summary">'+escapeHtml(String(data.supported||0))+' supported · '+escapeHtml(String(data.partial||0))+' partial · '+escapeHtml(String(data.missing||0))+' missing</p>'+
      (issues?'<ul class="coverage-issues">'+issues+'</ul>':'<p class="activity-empty">No unsupported requirements detected in the extracted set.</p>')+
    '</section>';
  }
  async function addJobActivity(job,type,summary){
    if(!job||job._discovered||!job.id) return;
    const impliedSignal=["interview_requested","interview_scheduled","offer_received","rejected"].includes(type);
    setStatus("Saving activity...");
    try{
      if(impliedSignal){
        await window.RavenAPI.receiveApplicationSignal({
          jobId:job.id,
          type,
          confidence:1,
          source:"manual",
          summary
        });
        await loadJobs();
      }else{
        await window.RavenAPI.addJobEvent(job.id,{eventType:type,source:"manual",summary});
      }
      await loadJobActivity(job,true);
      setStatus("Activity saved");
    }catch(error){
      setStatus("Could not save activity: "+error.message);
    }
  }
  function renderJobActivity(job){
    if(job._discovered) return "";
    const activity=state.jobActivity[String(job.id)]||{};
    const events=Array.isArray(activity.events)?activity.events:[];
    const snapshots=Array.isArray(activity.snapshots)?activity.snapshots:[];
    const latestSnapshot=snapshots.find((item)=>item.snapshot_type==="application")||snapshots[0]||null;
    const interviewMode=String(job.status||"").toLowerCase()==="interview";
    const rows=events.slice(0,10).map((event)=>{
      const suggested=String(event?.metadata?.suggested_status||"");
      const autoApplied=event?.metadata?.auto_applied===true;
      const suggestion=suggested&&!autoApplied&&suggested!==String(job.status||"")
        ? '<button type="button" class="activity-suggestion" data-apply-suggested-status="'+escapeAttr(suggested)+'">Move to '+escapeHtml(suggested)+'</button>'
        : '';
      return '<li><div><strong>'+escapeHtml(activityLabel(event.event_type))+'</strong>'+
        (event.summary?'<span>'+escapeHtml(event.summary)+'</span>':'')+suggestion+'</div>'+
        '<time>'+escapeHtml(formatActivityDate(event.occurred_at))+'</time></li>';
    }).join("");
    const loading=!activity.loaded
      ? '<p class="activity-empty">Loading activity…</p>'
      : (activity.error?'<p class="activity-empty">Activity unavailable.</p>':(rows?'<ol class="activity-list">'+rows+'</ol>':'<p class="activity-empty">No activity recorded yet.</p>'));
    const typeOptions=ACTIVITY_TYPES.map(([key,label])=>'<option value="'+escapeAttr(key)+'">'+escapeHtml(label)+'</option>').join("");
    const addForm='<form class="activity-add" data-add-activity><select name="type" aria-label="Activity type">'+typeOptions+'</select><input name="summary" type="text" maxlength="500" placeholder="Optional detail"><button type="submit">Add</button></form>';
    let interview="";
    if(interviewMode){
      const snapshot=latestSnapshot?.snapshot||{};
      const description=cleanJobDescription(snapshot.notes||job.notes||"").replace(/\s+/g," ").trim();
      const excerpt=description.length>420?description.slice(0,417).replace(/\s+\S*$/,"")+"…":description;
      interview='<section class="interview-context"><h3>Interview prep</h3>'+
        (latestSnapshot?'<p class="snapshot-meta">Application snapshot · '+escapeHtml(formatActivityDate(latestSnapshot.captured_at))+'</p>':'<p class="snapshot-meta">No application snapshot is available yet.</p>')+
        (excerpt?'<p>'+escapeHtml(excerpt)+'</p>':'')+
        '<div class="snapshot-links">'+
          (snapshot.resume?'<a href="'+escapeAttr(snapshot.resume)+'" target="_blank" rel="noopener">Submitted resume</a>':'')+
          (snapshot.cover_letter?'<a href="'+escapeAttr(snapshot.cover_letter)+'" target="_blank" rel="noopener">Submitted cover letter</a>':'')+
          (snapshot.url?'<a href="'+escapeAttr(snapshot.url)+'" target="_blank" rel="noopener">Original posting</a>':'')+
        '</div></section>';
    }
    return interview+'<section class="job-activity"><h3>Activity</h3>'+loading+addForm+'</section>';
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

  const SUMMARY_JARGON=/\b(?:about us|who we are|why join|what makes us|our mission|our vision|our culture|we are (?:a|an|the)|at the core|prides itself|award[- ]winning|world[- ]class|industry[- ]leading|fast[- ]growing|passionate people|equal opportunity|affirmative action|benefits include|in return,? we offer|ideal candidate|successful candidate|excited to|opportunity to|dynamic|innovative|collaborative environment|business goals|strategic|stakeholder engagement|operational excellence|best[- ]in[- ]class|measurable impact|drive results|cross[- ]functional collaboration)\b/i;
  const SUMMARY_ACTION=/\b(?:manage|lead|coordinate|build|create|develop|deliver|design|maintain|support|train|implement|oversee|produce|model|texture|light|schedule|repair|service|operate|facilitate|analyze|own|plan|execute|mentor|supervise|dispatch|install|troubleshoot|track|report|budget|hire|onboard|document|procure|review|monitor)\w*\b/i;
  const SUMMARY_REQUIREMENT=/\b(?:experience|proficien|knowledge|skill|unreal|unity|zbrush|substance|excel|project management|customer|maintenance|training|operations|3d|modeling|texturing|leadership|agile|scrum|jira|asana|cad|revit)\b/i;

  function normalizedPostingLines(value){
    return cleanJobDescription(value)
      .replace(/Employer posting re-verified[^.]*\.\s*/gi," ")
      .replace(/&amp;/gi,"&")
      .split(/\n+/)
      .map(line=>line.replace(/^[\s•●▪◦*\-–—]+/,"").replace(/\s+/g," ").trim())
      .filter(Boolean);
  }

  function summaryClauses(value){
    const lines=normalizedPostingLines(value);
    const heading=/^(?:job description|description|about(?: us)?|who we are|why join.*|what we offer|benefits|qualifications?|requirements?|preferred qualifications?|education|compensation|salary|location|work schedule|employment type|position summary|job summary|summary|responsibilities|primary responsibilities(?: and duties)?|specific responsibilities(?: and duties)?|key responsibilities|what you(?:'|’)ll do|what you'll own|duties|essential duties.*)$/i;
    const clauses=[];
    for(const line of lines){
      if(heading.test(line)) continue;
      for(const part of line.split(/(?<=[.!?;])\s+|\s+[|]\s+/)){
        const sentence=part.trim();
        if(sentence.length<24||sentence.length>280) continue;
        if(SUMMARY_JARGON.test(sentence)) continue;
        if(/\b(?:benefits?|pto|401\(?k\)?|insurance|equal opportunity|accommodation|applicant|salary range|compensation|tuition|holidays?)\b/i.test(sentence)) continue;
        clauses.push(sentence);
      }
    }
    return clauses;
  }

  function plainLanguageClause(sentence){
    return String(sentence||"")
      .replace(/^(?:the\s+)?(?:successful|ideal) candidate\s+(?:will|should)\s+/i,"")
      .replace(/^(?:this|the)\s+(?:position|role)\s+(?:is responsible for|will be responsible for|will)\s+/i,"")
      .replace(/^you\s+(?:will|are expected to)\s+/i,"")
      .replace(/^(?:responsible for|responsibilities include)\s+/i,"")
      .replace(/\b(?:in order to|with the ability to|while ensuring|to ensure|ensuring)\b/gi,",")
      .replace(/\b(?:successful|seamless|effective|efficient|strategic)\s+(?=project|program|delivery|execution|operations?)/gi,"")
      .replace(/\s+/g," ")
      .replace(/\s+,/g,",")
      .trim()
      .replace(/^[a-z]/,m=>m.toUpperCase());
  }

  function conciseJobSummary(job){
    const clauses=summaryClauses(job.notes);
    const scored=clauses.map((sentence,index)=>{
      let score=0;
      if(SUMMARY_ACTION.test(sentence)) score+=6;
      if(SUMMARY_REQUIREMENT.test(sentence)) score+=2;
      if(/^\s*(?:manage|lead|coordinate|build|create|develop|deliver|design|maintain|support|train|implement|oversee|plan|execute|track|monitor|hire|schedule|review|analyze)\b/i.test(sentence)) score+=4;
      if(/\b(?:responsibilit|you will|role will|job summary|what you'll do|duties)\b/i.test(sentence)) score+=1;
      if(SUMMARY_JARGON.test(sentence)) score-=8;
      score-=Math.min(3,index*.04);
      return {sentence,score};
    }).sort((a,b)=>b.score-a.score);
    const chosen=[];
    for(const item of scored){
      if(item.score<5) continue;
      const text=plainLanguageClause(item.sentence);
      const normalized=text.toLowerCase().replace(/[^a-z0-9 ]/g,"");
      if(text.length<20||chosen.some(x=>x.normalized===normalized)) continue;
      chosen.push({text,normalized});
      if(chosen.length===2) break;
    }
    let summary=chosen.map(x=>x.text).join(" ");
    if(!summary){
      const role=String(job.title||"Role").trim();
      summary=(isRemoteJob(job)?"Remote ":"")+role+(job.company?" at "+job.company:"");
    }
    return summary.length>190?summary.slice(0,187).replace(/\s+\S*$/,"")+"…":summary;
  }

  function degreeAlert(job){
    const text=cleanJobDescription(job.notes).replace(/\s+/g," ");
    if(!text) return "";
    const matches=text.match(/[^.!?\n]{0,90}\b(?:bachelor(?:'s|’s)?|master(?:'s|’s)?|associate(?:'s|’s)?|ph\.?d\.?|doctorate)\b[^.!?\n]{0,150}/gi)||[];
    for(const raw of matches){
      const phrase=raw.trim();
      if(/\b(?:tuition|education benefit|degree program|pursu(?:e|ing)|student|reimbursement)\b/i.test(phrase)) continue;
      if(/\b(?:or equivalent (?:work )?experience|equivalent experience|experience in lieu|in lieu of (?:a )?degree|degree (?:is )?not required|preferred but not required)\b/i.test(phrase)) continue;
      const degree=(phrase.match(/\b(?:bachelor(?:'s|’s)?|master(?:'s|’s)?|associate(?:'s|’s)?|ph\.?d\.?|doctorate)\b/i)||[])[0]||"Degree";
      const fieldMatch=phrase.match(/\b(?:in|of)\s+([A-Za-z][A-Za-z &/\-]{2,70}?)(?=\s*(?:,|\.|;|or a related|or related|preferred|required|and \d|with \d|$))/i);
      const field=fieldMatch?.[1]?.trim()||"";
      const required=/\b(?:required|requirement|must|minimum|qualifications?)\b/i.test(phrase)||!/\bpreferred\b/i.test(phrase);
      const lowerDegree=degree.toLowerCase();
      const missingLevel=/master|ph\.?d|doctorate/i.test(lowerDegree);
      const differentBachelor=/bachelor/i.test(lowerDegree)&&field&&!/\b(?:video game art|game art|3d art|art|fine art|digital art|visual art)\b/i.test(field);
      const differentAssociate=/associate/i.test(lowerDegree);
      if(!(missingLevel||differentBachelor||differentAssociate)) continue;
      return {
        label:"DEGREE GAP",
        text:(degree+(field?" in "+field:"")+(required?" required":" mentioned")).replace(/\s+/g," ").trim(),
        required
      };
    }
    return "";
  }

  function jobSummary(job) {
    return conciseJobSummary(job);
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
  function generationKey(job){ return String(job?.id??""); }
  function generationSession(job){ return activeGeneration.get(generationKey(job))||null; }
  function knownJobById(id){
    if(id===null||id===undefined) return null;
    const discovered=Object.values(state.discovered||{}).flat();
    return [...state.jobs,...discovered].find(item=>String(item?.id)===String(id))||null;
  }
  function suppressGenerationAutoOpen(jobId){
    const job=knownJobById(jobId);
    const session=job&&generationSession(job);
    if(session) session.autoOpen=false;
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
      {bucket:"Rejected",label:"Rejected"},
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
          const generating=generationSession(job);
          card.className="job-card"+(job.id===state.selectedId?" active":"")+(isRemoteJob(job)?" is-remote":"")+(job.status==="Applied"?" is-applied":"")+(job.status==="Interested"?" is-interested":"")+(job.status==="Ignored"?" is-ignored":"")+(viewed?" is-viewed":" is-new")+(generating?" is-generating-document":"");
          card.dataset.status=statusToken(job.status);
          card.dataset.jobId=String(job.id||"");
          const company=job.company||"Company not captured";
          const location=[job.location,job.remote].filter(Boolean).join(" · ")||"Location not captured";
          const salary=job.salaryText||"";
          const degreeGap=degreeAlert(job);
          const rawStatus=String(job.status||"Saved");
          const meaningfulStatus=!/^(saved|discovered|interested)$/i.test(rawStatus);
          const statusLabel=rawStatus;
          const attentionIndicator=meaningfulStatus
            ? '<span class="job-status">'+escapeHtml(statusLabel)+'</span>'
            : '';
          const generationIndicator=generating
            ? '<span class="generation-card-status" role="status" aria-live="polite"><span class="generation-spinner" aria-hidden="true"></span><span>AI is generating '+escapeHtml(documentLabel(generating.type))+'…</span></span>'
            : '';
          const isIgnored=rawStatus.toLowerCase()==="ignored";
          const isBookmarked=rawStatus.toLowerCase()==="interested";
          const bookmarkStar=/^(applied|interview|offer|rejected|ignored)$/i.test(rawStatus) ? "" :
            '<button class="bookmark-star'+(isBookmarked?' is-bookmarked':'')+'" type="button" data-card-bookmark aria-pressed="'+String(isBookmarked)+'" aria-label="'+(isBookmarked?'Remove bookmark':'Bookmark job')+'" title="'+(isBookmarked?'Remove bookmark':'Bookmark job')+'">'+(isBookmarked?'★':'☆')+'</button>';
          const remoteWatermark=isRemoteJob(job)
            ? '<span class="remote-watermark" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path d="M14 46 50 16l36 30v38H60V60H40v24H14V46Zm50-23h13v15L64 27V23Z"/></svg></span>'
            : '';
          const ignoreControl='<button class="ignore-job-button'+(isIgnored?' is-restore':'')+'" type="button" data-ignore-job aria-label="'+(isIgnored?'Restore job':'Ignore job')+'" title="'+(isIgnored?'Restore job':'Ignore job')+'">'+(isIgnored?'↩':'×')+'</button>';
          card.innerHTML=
            '<button class="job-card-summary" type="button" aria-expanded="'+String(job.id===state.selectedId)+'">'+
              '<span class="card-main">'+
                (attentionIndicator?'<span class="card-topline">'+attentionIndicator+'</span>':'')+
                generationIndicator+
                '<span class="job-title">'+escapeHtml(job.title||"Untitled job")+'</span>'+
                '<span class="company-name">'+escapeHtml(company)+'</span>'+
                '<span class="job-location-line"><span class="job-location">'+escapeHtml(location)+'</span>'+
                  (degreeGap?'<span class="degree-gap-icon'+(degreeGap.required?' is-required':'')+'" role="img" aria-label="'+escapeAttr(degreeGap.text)+'" title="'+escapeAttr(degreeGap.text)+'"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.2 8.2 14.8 3l4 2.2-9.6 5.2-4-2.2Zm4 2.2v5.3l5.6 3.1v-5.3l-5.6-3.1Zm5.6 3.1 4-2.2V6l-4 2.2v5.3ZM5.2 8.2v5.3l4 2.2v-5.3l-4-2.2Zm2.1 8.7 2.5 1.4 2.5-1.4 1.5.8-4 2.3-4-2.3 1.5-.8Z"/></svg></span>':'')+
                '</span>'+
                '<span class="job-summary">'+escapeHtml(jobSummary(job))+'</span>'+
                (salary?'<span class="job-salary">'+escapeHtml(salary)+'</span>':'')+
                '<span class="job-age">'+escapeHtml(relativeAdded(job.added))+'</span>'+
              '</span>'+
              (!isRemoteJob(job) && job.location ? '<span class="commute-footer" data-commute-key="'+escapeAttr(commuteCacheKey(job.location))+'" hidden></span>' : '')+
            '</button>'+remoteWatermark+bookmarkStar+ignoreControl;
          if (job.id===state.selectedId) {
            const expanded=document.createElement("span");
            expanded.className="job-card-expanded";
            expanded.innerHTML=renderInlineDetail(job);
            card.appendChild(expanded);
            expanded.querySelectorAll("[data-approved-apply]").forEach((button)=>{ button.addEventListener("click",(event)=>{ event.stopPropagation(); beginApprovedApplication(job); }); });
            expanded.querySelectorAll("[data-apply-status]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                toggleApplied(job);
              });
            });
            expanded.querySelectorAll("[data-lifecycle-status]").forEach((select)=>{
              select.addEventListener("change",(event)=>{
                event.stopPropagation();
                transitionJob(job,select.value,{statusMessage:"Moved to "+select.options[select.selectedIndex]?.text});
              });
            });
            expanded.querySelectorAll("[data-follow-up-date]").forEach((input)=>{
              input.addEventListener("change",(event)=>{
                event.stopPropagation();
                transitionJob(job,"Applied",{followUp:input.value,statusMessage:input.value?"Follow-up scheduled":"Follow-up cleared"});
              });
            });
            expanded.querySelectorAll("[data-add-activity]").forEach((form)=>{
              form.addEventListener("submit",(event)=>{
                event.preventDefault();
                event.stopPropagation();
                const data=new FormData(form);
                addJobActivity(job,String(data.get("type")||"note"),String(data.get("summary")||"").trim());
              });
            });
            expanded.querySelectorAll("[data-apply-suggested-status]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                transitionJob(job,button.dataset.applySuggestedStatus,{source:"signal-review",statusMessage:"Signal suggestion applied"});
              });
            });
            expanded.querySelectorAll("[data-generate]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                generateForJob(job,button.dataset.generate,button);
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
            expanded.querySelectorAll("[data-document-regenerate]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                const type=button.dataset.documentRegenerate;
                generateForJob(job,type,null,{force:true});
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
            const nextSelectedId=opening?job.id:null;
            if(state.selectedId!==nextSelectedId) suppressGenerationAutoOpen(state.selectedId);
            if(opening) markViewed(job);
            state.selectedId=nextSelectedId;
            render();
            if(opening){
              loadJobActivity(job,true);
              loadJobCoverage(job,true);
            }

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
      {key:"resume",label:"Generate resume",format:"generate",visible:true,position:2},
      {key:"coverLetter",label:"Generate cover letter",format:"generate",visible:true,position:3}
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
    const currentStatus=String(job.status||"Saved");
    const lifecycleRows=lifecycleStatuses().filter((item)=>item.key!=="Discovered");
    const currentIsDiscovered=currentStatus==="Discovered";
    const lifecycleOptions=(currentIsDiscovered?'<option value="Discovered" selected disabled>Discovered</option>':"")+
      lifecycleRows.map((item)=>'<option value="'+escapeAttr(item.key)+'"'+(item.key===currentStatus?' selected':'')+'>'+escapeHtml(item.label)+'</option>').join("");
    const nextAction=followUpSummary(job);
    const followUpValue=String(job.followUp||"").slice(0,10);
    const followUpControl=isApplied?'<label class="follow-up-control"><span>Follow up</span><input type="date" data-follow-up-date value="'+escapeAttr(followUpValue)+'" aria-label="Follow-up date"></label>':"";
    const lifecycleControl='<div class="job-lifecycle-row"><label class="lifecycle-control"><span>Status</span><select data-lifecycle-status aria-label="Job status">'+lifecycleOptions+'</select></label>'+
      followUpControl+(nextAction?'<span class="next-action">'+escapeHtml(nextAction)+'</span>':'')+'</div>';
    const docsReady=documentsReadyForApplication(job);
    const statusLower=currentStatus.toLowerCase();
    const postApplication=["applied","interview","offer","rejected"].includes(statusLower);
    const applyGate=job.url&&!postApplication?'<button class="workflow-action application-gate'+(docsReady?' is-ready':'')+'" type="button" data-approved-apply aria-label="Open application with approved documents" title="'+(docsReady?'Open application':'Approve resume and cover letter first')+'"><span class="workflow-icon" aria-hidden="true">↗</span><span>'+(docsReady?'Apply with docs':'Approve docs')+'</span></button>':"";
    const appliedAction=!["interview","offer","rejected","ignored"].includes(statusLower)?'<button class="workflow-action'+(isApplied?' is-applied':'')+'" type="button" data-apply-status="'+(isApplied?'saved':'applied')+'" aria-pressed="'+String(isApplied)+'" aria-label="'+(isApplied?'Unmark as applied':'Mark as applied')+'" title="'+(isApplied?'Unmark as applied':'Mark as applied')+'"><span class="workflow-icon" aria-hidden="true">✓</span><span>Applied</span></button>':"";
    const postingUrl=/^https?:\/\//i.test(String(job.url||""))?job.url:"";
    const actions=postingUrl
      ? '<a class="workflow-action" href="'+escapeAttr(postingUrl)+'" target="_blank" rel="noopener" aria-label="View listing"><span class="workflow-icon" aria-hidden="true">↗</span><span>View listing</span></a>'+
        (!postApplication?'<a class="workflow-action" href="'+escapeAttr(postingUrl)+'" target="_blank" rel="noopener" aria-label="Apply on site"><span class="workflow-icon" aria-hidden="true">↗</span><span>Apply on site</span></a>':'')
      : '<span class="posting-unavailable">Listing link unavailable</span>';

    const fullDescription=cleanJobDescription(job.notes)||"Full job description not yet available.";
    const summary=jobDetailSummary(job);
    const canExpand=fullDescription.length>summary.length+40;
    return '<section class="inline-job-detail">'+
      lifecycleControl+
      '<section class="job-description"><h3>Job summary</h3>'+
        '<p class="job-description-text" data-description-summary>'+escapeHtml(summary)+'</p>'+
        (canExpand?'<p class="job-description-text full-description" data-description-full hidden>'+escapeHtml(fullDescription)+'</p>':'')+
        (canExpand?'<button class="description-toggle" type="button" data-description-toggle aria-expanded="false">Show more</button>':'')+
      '</section>'+
      '<dl>'+detailHtml+'</dl>'+
      '<div class="detail-actions">'+
        '<div class="workflow-actions" aria-label="Application actions">'+actions+applyGate+appliedAction+'</div>'+
      '</div>'+
      renderCoverage(job)+
      renderJobActivity(job)+
    '</section>';
  }


  function jobAnalysisCache(){ return readCache(JOB_ANALYSIS_CACHE_KEY,{})||{}; }
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

  function resumeKeywords(text){
    const stop=new Set(["the","and","for","with","that","this","from","your","you","our","are","will","have","has","into","about","their","they","who","but","not","all","any","can","job","role","work","team","years","experience","skills","using","use","strong","ability","required","preferred"]);
    const words=String(text||"").toLowerCase().match(/[a-z][a-z0-9+#.\/-]{2,}/g)||[];
    const counts={};
    words.forEach((w)=>{ if(!stop.has(w)) counts[w]=(counts[w]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,45).map(([w])=>w);
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

  function safeResumeLink(value){
    const raw=String(value||"").trim();
    if(!raw) return "";
    try{
      const normalized=/^https?:\/\//i.test(raw)?raw:"https://"+raw;
      const url=new URL(normalized);
      if(!/^https?:$/i.test(url.protocol)) return "";
      return url.toString();
    }catch{return "";}
  }

  function resumeContactHtml(resume){
    const profile=readCache(APPLICATION_PROFILE_KEY,{})||{};
    const linkedin=safeResumeLink(profile.linkedin);
    const portfolio=safeResumeLink(profile.portfolio);
    const base=String(resume?.contact||"")
      .split(/\s*\/\/\s*/)
      .map(part=>part.trim())
      .filter(Boolean)
      .filter(part=>!(/^linkedin$/i.test(part)&&linkedin))
      .filter(part=>!(/^portfolio$/i.test(part)&&portfolio));
    const renderPart=(part)=>{
      const raw=String(part||"").trim();
      const looksLikeWeb=!raw.includes("@") && /^(?:https?:\/\/|www\.|linkedin\.com\/|[a-z0-9.-]+\.[a-z]{2,}\/)/i.test(raw);
      const href=looksLikeWeb?safeResumeLink(raw):"";
      if(!href) return escapeHtml(raw);
      const display=href.replace(/^https?:\/\//i,"").replace(/\/$/,"");
      return '<a href="'+escapeAttr(href)+'" target="_blank" rel="noopener">'+escapeHtml(display)+'</a>';
    };
    const rendered=base.map(renderPart);
    if(linkedin){
      const display=linkedin.replace(/^https?:\/\//i,"").replace(/\/$/,"");
      const already=base.some(part=>part.toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"")===display.toLowerCase());
      if(!already) rendered.push('<a href="'+escapeAttr(linkedin)+'" target="_blank" rel="noopener">'+escapeHtml(display)+'</a>');
    }
    if(portfolio){
      const display=portfolio.replace(/^https?:\/\//i,"").replace(/\/$/,"");
      const already=base.some(part=>part.toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"")===display.toLowerCase());
      if(!already) rendered.push('<a href="'+escapeAttr(portfolio)+'" target="_blank" rel="noopener">'+escapeHtml(display)+'</a>');
    }
    return rendered.join(" &nbsp;·&nbsp; ");
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
      '.headline{font-size:10.5pt;font-weight:700;color:#294f7a;margin:4px 0 0}.contact{font-size:9pt;color:#555f69;margin:4px 0 0}.contact a{color:#294f7a;text-decoration:none}'+
      'h2{font-size:10.3pt;text-transform:uppercase;letter-spacing:.11em;color:#294f7a;margin:11px 0 5px;padding:0 0 3px;border-bottom:1px solid #cfd6dd}'+
      '.summary{margin:0;color:#30363d}.skills{display:grid;grid-template-columns:1fr 1fr;gap:1px 26px;margin:0;padding:0;list-style:none}.skills li{position:relative;padding-left:10px;margin:0 0 2px}.skills li:before{content:"•";position:absolute;left:0;color:#294f7a}'+
      'ul{margin:4px 0 0 17px;padding:0}li{margin:0 0 3px;break-inside:avoid}.resume-job{margin:0 0 9px;break-inside:avoid}.resume-job-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:2px}.resume-role{display:block;font-size:10.4pt;color:#17212b}.resume-company{display:block;font-size:9.3pt;font-weight:700;color:#4c5966;margin-top:1px}.resume-dates{font-size:8.9pt;color:#606b76;white-space:nowrap;padding-top:1px}.resume-education{display:flex;justify-content:space-between;gap:12px;margin:0 0 5px}.resume-education strong{color:#17212b}.resume-education span{font-size:8.8pt;color:#606b76;white-space:nowrap}.additional{margin:0;padding-left:17px}'+
      '@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'+
      '</style></head><body>'+
      '<header class="resume-header"><h1>'+escapeHtml(resume.name||"")+'</h1>'+
      (resume.headline?'<p class="headline">'+escapeHtml(resume.headline)+'</p>':'')+
      (resume.contact||readCache(APPLICATION_PROFILE_KEY,{})?.linkedin||readCache(APPLICATION_PROFILE_KEY,{})?.portfolio?'<p class="contact">'+resumeContactHtml(resume)+'</p>':'')+
      '</header>'+
      '<h2>Professional Summary</h2><p class="summary">'+escapeHtml(resume.summary||"")+'</p>'+
      '<h2>Core Skills</h2><ul class="skills">'+list(resume.skills)+'</ul>'+
      '<h2>'+(job.track==="Games / 3D"?"Professional Experience":"Relevant Experience")+'</h2>'+experiences+
      (education?'<h2>Education</h2>'+education:'')+
      ((resume.additional||[]).length?'<h2>'+(job.track==="Games / 3D"?"Career Highlights":"Transferable Qualifications")+'</h2><ul class="additional">'+list(resume.additional)+'</ul>':'')+
      '</body></html>';
  }

  function generationCache(){
    return readCache(GENERATION_CACHE_KEY,{})||{};
  }
  function generationCacheId(job,masterResume,type="resume"){
    return window.RavenCore?.generationFingerprint(job,masterResume,type,RESUME_TEMPLATE_VERSION) || [type,job.id||job.url,masterResume?.id||"",masterResume?.version||masterResume?.url||"",RESUME_TEMPLATE_VERSION].join("|");
  }
  async function generateDocumentCached(job,masterResume,type="resume"){
    const key=type==="coverLetter"?"coverLetter":"resume";
    const cacheId=generationCacheId(job,masterResume,type);
    const cached=generationCache()[cacheId];
    if(cached?.[key]) return cached[key];
    const document=await generateDocumentOnline(job,masterResume,type,"");
    const cache=generationCache();
    cache[cacheId]={[key]:document,createdAt:new Date().toISOString()};
    writeCache(GENERATION_CACHE_KEY,cache);
    return document;
  }
  async function generateResumeOnline(job,masterResume){
    return generateDocumentCached(job,masterResume,"resume");
  }

  const generationPreparation=new WeakMap();
  async function prepareJobForGeneration(job){
    if(generationPreparation.has(job)) return generationPreparation.get(job);
    const pending=(async()=>{
      if(job._discovered){
        if(navigator.onLine===false) throw new Error("Connect to the internet once to save this job before generating documents.");
        setStatus("Saving job and retrieving its description...");
        const previousId=job.id;
        const saved=await window.RavenAPI.addJob({
          track:job.track||"Professional",title:job.title||"",company:job.company||"",
          location:job.location||"",remote:isRemoteJob(job),salaryText:job.salaryText||"",
          url:job.url||"",source:job.source||"",status:"Saved",viewed:true,notes:job.notes||""
        });
        if(!saved?.id) throw new Error("The job could not be saved. Please retry.");
        const normalized=window.RavenCore?.fromApiJob?window.RavenCore.fromApiJob(saved):saved;
        Object.assign(job,normalized,{_discovered:false});
        const session=activeGeneration.get(String(previousId));
        if(session){
          activeGeneration.delete(String(previousId));
          activeGeneration.set(generationKey(job),session);
        }
        const index=state.jobs.findIndex((item)=>String(item.id)===String(job.id));
        if(index>=0) state.jobs[index]=job;
        else state.jobs.push(job);
        if(state.selectedId===previousId) state.selectedId=job.id;
        writeCache(CACHE_JOBS_KEY,state.jobs);
      }
      if(navigator.onLine!==false && !String(job.notes||"").trim()){
        setStatus("Retrieving job description...");
        const result=await window.RavenAPI.describeJob({
          url:job.url,title:job.title,company:job.company,track:job.track,
          location:job.location,source:job.source
        });
        if(result.expired) throw new Error("This listing has expired. Open View listing to check it.");
        const description=String(result.description||"").trim();
        if(!description) throw new Error("The listing did not provide a job description. Open View listing to check the source.");
        await window.RavenAPI.updateJob(job.id,{notes:description});
        job.notes=description;
        const saved=state.jobs.find((item)=>String(item.id)===String(job.id));
        if(saved) saved.notes=description;
        writeCache(CACHE_JOBS_KEY,state.jobs);
      }
      return job;
    })();
    generationPreparation.set(job,pending);
    try{ return await pending; }
    finally{ generationPreparation.delete(job); }
  }

  async function generateForJob(job,type,button=null,options={}) {
    const existing=generationSession(job);
    if(existing){
      if(Date.now()-Number(existing.startedAt||0)<180000) return;
      activeGeneration.delete(generationKey(job));
    }
    try{
      generationErrors.delete(documentApprovalKey(job,type));
      if(job[type]&&!options.force) return openDocumentReview(job,type);
      const session={type,autoOpen:state.selectedId===job.id,startedAt:Date.now(),phase:"Writing with AI"};
      activeGeneration.set(generationKey(job),session);
      setGenerationButton(button,true,type==="resume"?"Generating resume…":"AI generating cover letter…");
      setStatus(type==="resume"?"Building your tailored resume…":"AI is preparing your cover letter…");
      render();
      await generateDocumentForJob(job,type,"",options);
      const shouldOpen=session.autoOpen&&state.selectedId===job.id;
      activeGeneration.delete(generationKey(job));
      render();
      if(shouldOpen) openDocumentReview(job,type);
    }catch(error){
      activeGeneration.delete(generationKey(job));
      const message=(type==="resume"?"Resume":"Cover letter")+" generation failed: "+error.message;
      generationErrors.set(documentApprovalKey(job,type),message);
      setStatus(message);
      console.error(documentLabel(type)+" generation failed",error);
      setGenerationButton(button,false);
      try{ render(); }catch(renderError){ console.error("Could not render generation feedback",renderError); }
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
      job[type]=dataUrl;
      const saved=state.jobs.find((item)=>item.id===job.id); if(saved) saved[type]=dataUrl;
      writeCache(CACHE_JOBS_KEY,state.jobs);
      try{
        const updated=await window.RavenAPI.updateJob(job.id,{[type]:dataUrl});
        if(updated?.last_updated) job.lastUpdated=updated.last_updated;
        const pending=pendingDocumentSync();
        if(pending[job.id]?.[type]){
          delete pending[job.id][type];
          if(!pending[job.id].resume&&!pending[job.id].coverLetter) delete pending[job.id];
          writeCache(PENDING_DOCUMENT_SYNC_KEY,pending);
        }
      }catch{ rememberPendingDocument(job,type,dataUrl); }
    }
    setDocumentApproved(job,type,false);
    return dataUrl;
  }
  async function refreshSavedResumeContact(job){
    const value=String(job?.resume||"");
    if(!value.startsWith("data:text/html;charset=utf-8,")) return false;
    const profile=readCache(APPLICATION_PROFILE_KEY,{})||{};
    const linkedin=safeResumeLink(profile.linkedin);
    const portfolio=safeResumeLink(profile.portfolio);
    if(!linkedin&&!portfolio) return false;
    try{
      const html=decodeURIComponent(value.slice(value.indexOf(",")+1));
      const doc=new DOMParser().parseFromString(html,"text/html");
      const contact=doc.querySelector(".contact");
      if(!contact) return false;
      const resumeLike={contact:contact.textContent||""};
      const next=resumeContactHtml(resumeLike);
      if(contact.innerHTML===next) return false;
      contact.innerHTML=next;
      const dataUrl="data:text/html;charset=utf-8,"+encodeURIComponent("<!doctype html>"+doc.documentElement.outerHTML);
      job.resume=dataUrl;
      const saved=state.jobs.find(item=>String(item.id)===String(job.id));
      if(saved) saved.resume=dataUrl;
      writeCache(CACHE_JOBS_KEY,state.jobs);
      if(!job._discovered){
        window.RavenAPI.updateJob(job.id,{resume:dataUrl}).catch(()=>rememberPendingDocument(job,"resume",dataUrl));
      }
      return true;
    }catch{return false;}
  }

  function currentDocumentText(job,type){
    const value=String(job[type]||"");
    if(!value.startsWith("data:text/html;charset=utf-8,")) return "";
    try{
      const html=decodeURIComponent(value.slice(value.indexOf(",")+1));
      const doc=new DOMParser().parseFromString(html,"text/html");
      doc.querySelectorAll("style,script").forEach(node=>node.remove());
      return (doc.body.textContent||"").trim();
    }catch{ return ""; }
  }
  async function generateDocumentOnline(job,masterResume,type="resume",instructions=""){
    if(!config?.generateApiUrl) throw new Error("Online document generator is not configured.");
    // The existing service loads the verified canonical profile server-side.
    // Device-local master files are not inputs to this generation engine.
    const response=await fetch(config.generateApiUrl,{method:"POST",headers:{"Content-Type":"application/json","X-Raven-Client":"raven-web-v1"},body:JSON.stringify({
      documentType:type==="coverLetter"?"coverLetter":"resume",instructions,currentDocument:instructions?currentDocumentText(job,type):"",jobId:job.id,jobTitle:job.title||"",company:job.company||"",track:job.track||"Professional",sourceUrl:job.url||"",jobDescription:job.notes||"",jobAnalysis:getJobAnalysis(job)
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const details=Array.isArray(payload.provider_failures)&&payload.provider_failures.length
        ? payload.provider_failures.map((item)=>{
            const provider=String(item?.provider||"provider");
            const code=String(item?.code||"");
            const status=Number(item?.status||0);
            if(code==="PROVIDER_BILLING") return provider+" billing/credits unavailable";
            if(code==="PROVIDER_AUTH") return provider+" authentication rejected";
            if(code==="PROVIDER_RATE_LIMIT") return provider+" rate limited";
            if(code==="PROVIDER_TIMEOUT") return provider+" timed out";
            if(code==="PROVIDER_UPSTREAM") return provider+" upstream error"+(status?" "+status:"");
            return provider+(status?" error "+status:" unavailable");
          }).join("; ")
        : "";
      const message=payload.error||details||("Online generation failed ("+response.status+")");
      const error=new Error(message);
      error.code=payload.code||"";
      error.provider=payload.provider||"";
      error.retryable=Boolean(payload.retryable);
      error.upstreamStatus=payload.upstreamStatus||0;
      error.httpStatus=response.status;
      error.providerAttempts=Number(payload.provider_attempts||0);
      error.providerFailures=Array.isArray(payload.provider_failures)?payload.provider_failures:[];
      throw error;
    }
    const document=type==="coverLetter"?payload.coverLetter:payload.resume;
    if(!document) throw new Error("Online generator returned no "+documentLabel(type)+".");
    return document;
  }

  async function generateDocumentForJob(job,type,instructions,options={}) {
    const label=documentLabel(type);
    setStatus((instructions?"Revising ":"Generating ")+label+"...");
    try{
      if(navigator.onLine===false) throw new Error("An internet connection is required for AI "+label+" generation.");
      const masterResume=null;
      await prepareJobForGeneration(job);
      const document=instructions||options.force
        ? await generateDocumentOnline(job,masterResume,type,instructions)
        : await generateDocumentCached(job,masterResume,type);
      await saveGeneratedDocument(job,type,document);
      setDocumentApproved(job,type,false);
      setStatus(label[0].toUpperCase()+label.slice(1)+" ready · approval required");
      return document;
    }catch(error){
      let message=String(error?.message||"Generation failed.");
      if(error?.code==="LLM_PROVIDER_ACCOUNT_ERROR") message="AI provider account problem: "+message;
      else if(error?.code==="LLM_RATE_LIMITED") message="AI providers are rate limited: "+message;
      else if(error?.code==="LLM_CALL_BUDGET_EXHAUSTED") message="Raven stopped after its two-call AI safety limit.";
      else if(error?.code==="PROVIDER_AUTH") message="AI provider authentication failed: "+message;
      setStatus("Could not generate "+label+": "+message);
      throw error;
    }
  }

  function documentApprovalKey(job,type){ return String(job.id||job.url||"")+"|"+type; }
  function isDocumentApproved(job,type){
    const record=state.documentApprovals[documentApprovalKey(job,type)];
    return Boolean(record&&record.value===String(job[type]||""));
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
  function documentsReadyForApplication(job){
    return Boolean(job.resume&&job.coverLetter&&isDocumentApproved(job,"resume")&&isDocumentApproved(job,"coverLetter"));
  }
  function beginApprovedApplication(job){
    if(!documentsReadyForApplication(job)){ setStatus("Approve the resume and cover letter before applying"); return; }
    const packet={version:1,createdAt:new Date().toISOString(),jobId:job.id||"",jobUrl:job.url||"",title:job.title||"",company:job.company||"",profile:readCache(APPLICATION_PROFILE_KEY,{})||{},answers:readAnswerMemory(),resume:job.resume,coverLetter:job.coverLetter};
    const bridge=document.getElementById("ravenExtensionBridge");
    if(bridge){ bridge.dataset.packet=JSON.stringify(packet); document.dispatchEvent(new CustomEvent("raven-application-packet")); }
    setTimeout(()=>window.open(job.url,"_blank","noopener"),120);
    setStatus("Approved documents locked · Raven assistant prepared · review before submitting");
  }

  function previewableDocumentUrl(value) {
    const url=String(value||"");
    return /drive\.google\.com\/file\/d\//.test(url) ? url.replace(/\/view(?:\?.*)?$/,"/preview") : url;
  }
  async function openDocumentReview(job,type) {
    if(type==="resume") await refreshSavedResumeContact(job);
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
    const feedback=document.getElementById("reviewFeedback");
    if(feedback) feedback.textContent="";
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
    render();
  }
  function normalizedDocumentText(value){
    return String(value||"").replace(/\s+/g," ").trim();
  }
  function documentRevisionChanged(type,before,after){
    if(type==="resume"){
      const fields=["headline","summary"];
      if(fields.some(key=>normalizedDocumentText(before?.[key])!==normalizedDocumentText(after?.[key]))) return true;
      const beforeSkills=(before?.skills||[]).map(normalizedDocumentText).join("|");
      const afterSkills=(after?.skills||[]).map(normalizedDocumentText).join("|");
      if(beforeSkills!==afterSkills) return true;
      const flatten=(doc)=>(doc?.experience||[]).flatMap(x=>[x.role,x.company,x.dates,...(x.bullets||[])]).map(normalizedDocumentText).join("|");
      if(flatten(before)!==flatten(after)) return true;
      return (before?.additional||[]).map(normalizedDocumentText).join("|")!==(after?.additional||[]).map(normalizedDocumentText).join("|");
    }
    return [before?.greeting,...(before?.paragraphs||[]),before?.closing]
      .map(normalizedDocumentText).join("|")!==[after?.greeting,...(after?.paragraphs||[]),after?.closing].map(normalizedDocumentText).join("|");
  }

  async function submitDocumentRevision(event) {
    event.preventDefault();
    const job=state.generatorJob;
    const type=state.generatorType;
    const instructions=document.getElementById("reviewInstructions").value.trim();
    if(!job||!type||!instructions) return;
    const button=document.getElementById("reviewSubmit");
    button.disabled=true;
    button.classList.add("is-generating");
    button.setAttribute("aria-busy","true");
    button.dataset.originalLabel=button.textContent;
    button.innerHTML='<span class="generation-spinner" aria-hidden="true"></span><span>AI applying changes…</span>';
    const feedback=document.getElementById("reviewFeedback");
    if(feedback){
      feedback.classList.add("is-processing");
      feedback.innerHTML='<span class="generation-spinner" aria-hidden="true"></span><span>AI is rewriting and fact-checking your '+escapeHtml(documentLabel(type))+'… This may take a moment.</span>';
    }
    setStatus("AI is applying requested changes to your "+documentLabel(type)+"…");
    try{
      const beforeValue=String(job[type]||"");
      const beforeText=currentDocumentText(job,type);
      const updated=await generateDocumentForJob(job,type,instructions);
      const value=String(job[type]||"");
      const afterText=currentDocumentText(job,type);
      if(!documentRevisionChanged(type,{summary:beforeText,paragraphs:[beforeText]},{...updated,summary:updated?.summary||afterText,paragraphs:updated?.paragraphs||[afterText]}) && normalizedDocumentText(beforeText)===normalizedDocumentText(afterText)){
        throw new Error("AI returned the same document without applying the requested change. Please retry or make the request more specific.");
      }
      document.getElementById("reviewOpenFile").href=value;
      document.getElementById("reviewFrame").src=previewableDocumentUrl(value);
      document.getElementById("reviewInstructions").value="";
      const approve=document.getElementById("reviewApprove");
      if(approve){ approve.textContent="Approve document"; approve.classList.remove("is-approved"); }
      if(feedback){
        feedback.classList.remove("is-processing");
        feedback.textContent="Updated draft saved. Please review it before approving.";
      }
      setStatus(documentLabel(type)[0].toUpperCase()+documentLabel(type).slice(1)+" changes applied");
      render();
    }catch(error){
      if(feedback){
        feedback.classList.remove("is-processing");
        feedback.textContent=error.message+" Your previous document is unchanged.";
      }
      setStatus("Could not apply "+documentLabel(type)+" changes: "+error.message);
    }finally{
      button.disabled=false;
      button.classList.remove("is-generating");
      button.removeAttribute("aria-busy");
      button.textContent=button.dataset.originalLabel||"Apply requested changes";
      delete button.dataset.originalLabel;
    }
  }

  async function transitionJob(job,nextStatus,options={}) {
    const allowed=new Set(lifecycleStatuses().map((item)=>item.key));
    if(!allowed.has(nextStatus) && nextStatus!=="Discovered"){
      setStatus("Unsupported job status");
      return;
    }
    const occurredAt=options.occurredAt||new Date().toISOString();
    setStatus(options.pendingMessage||("Updating status to "+nextStatus+"..."));
    try{
      let targetId=job.id;
      if(job._discovered){
        const saved=await window.RavenAPI.addJob({
          track:job.track||"Professional",
          title:job.title||"",
          company:job.company||"",
          location:job.location||"",
          remote:isRemoteJob(job),
          salaryText:job.salaryText||"",
          url:job.url||"",
          source:job.source||"",
          status:"Saved",
          viewed:true,
          notes:job.notes||""
        });
        targetId=saved.id||targetId;
      }
      if(!targetId) throw new Error("Job could not be persisted.");
      await window.RavenAPI.transitionJob(targetId,nextStatus,{
        occurredAt,
        followUp:Object.prototype.hasOwnProperty.call(options,"followUp")?options.followUp:undefined,
        followUpDays:followUpDays(),
        source:options.source||"raven-ui",
        summary:options.summary||""
      });
      if(options.collapse) state.selectedId=null;
      await loadJobs();
      const refreshed=state.jobs.find((item)=>String(item.id)===String(targetId));
      if(refreshed&&!options.collapse) state.selectedId=refreshed.id;
      if(refreshed) await loadJobActivity(refreshed,true);
      setStatus(options.statusMessage||("Moved to "+nextStatus));
    }catch(error){
      setStatus("Status update failed: "+error.message);
    }
  }

  async function toggleApplied(job) {
    const isApplied=String(job.status||"").toLowerCase()==="applied";
    await transitionJob(job,isApplied?"Saved":"Applied",{
      collapse:true,
      pendingMessage:isApplied?"Unmarking applied...":"Marking applied...",
      statusMessage:isApplied?"Marked not applied":"Marked applied"
    });
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
    await transitionJob(job,ignored?"Ignored":"Saved",{
      collapse:true,
      pendingMessage:ignored?"Ignoring job...":"Restoring job...",
      statusMessage:ignored?"Moved to ignored":"Job restored"
    });
  }

  async function toggleBookmark(job) {
    const interested=String(job.status||"").toLowerCase()==="interested";
    await transitionJob(job,interested?"Saved":"Interested",{
      collapse:true,
      pendingMessage:interested?"Removing bookmark...":"Saving bookmark...",
      statusMessage:interested?"Bookmark removed":"Bookmarked"
    });
  }

  function escapeHtml(value) {
    return String(value||"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g,"&#96;"); }
  async function deleteGeneratedDocument(job,key) {
    const label=documentLabel(key);
    if(!window.confirm("Delete this "+label+" from the job?")) return;
    setStatus("Deleting "+label+"...");

    const previousValue=job[key]||"";
    const pending=pendingDocumentSync();
    const previousPending=pending[job.id]?.[key]||null;

    // A failed document save can leave a newer pending copy in local storage.
    // Clear it before deleting or loadJobs/flushPendingDocuments can resurrect
    // the document immediately after the server has removed it.
    if(pending[job.id]?.[key]){
      delete pending[job.id][key];
      if(!pending[job.id].resume&&!pending[job.id].coverLetter) delete pending[job.id];
      writeCache(PENDING_DOCUMENT_SYNC_KEY,pending);
    }

    // Deleting a document also invalidates its generated-content cache so a
    // later Generate action creates a fresh document instead of restoring the
    // deleted version.
    const cache=generationCache();
    const cacheId=generationCacheId(job,null,key);
    if(cache[cacheId]){
      delete cache[cacheId];
      writeCache(GENERATION_CACHE_KEY,cache);
    }

    job[key]="";
    const saved=state.jobs.find((item)=>String(item.id)===String(job.id));
    if(saved) saved[key]="";
    writeCache(CACHE_JOBS_KEY,state.jobs);
    setDocumentApproved(job,key,false);
    generationErrors.delete(documentApprovalKey(job,key));
    render();

    try{
      if(!job._discovered){
        const updated=await window.RavenAPI.updateJob(job.id,{[key]:""});
        if(updated?.last_updated){
          job.lastUpdated=updated.last_updated;
          if(saved) saved.lastUpdated=updated.last_updated;
        }
      }
      writeCache(CACHE_JOBS_KEY,state.jobs);
      setStatus(label[0].toUpperCase()+label.slice(1)+" deleted");
    }catch(error){
      // Restore only when the server explicitly rejected the deletion.
      job[key]=previousValue;
      if(saved) saved[key]=previousValue;
      writeCache(CACHE_JOBS_KEY,state.jobs);
      if(previousPending){
        const restored=pendingDocumentSync();
        restored[job.id]={...(restored[job.id]||{}),[key]:previousPending};
        writeCache(PENDING_DOCUMENT_SYNC_KEY,restored);
      }
      render();
      setStatus("Could not delete "+label+": "+error.message);
    }
  }
  function documentControl(job,key,label) {
    const value=job[key];
    const error=generationErrors.get(documentApprovalKey(job,key));
    const feedback=error?'<span class="document-generation-error" role="alert">'+escapeHtml(error)+'</span>':"";
    const fileLabel=String(label||"file").toLowerCase();
    const generating=generationSession(job);
    if(generating?.type===key){
      return '<span class="document-control is-empty is-generating">'+
        '<button class="document-primary is-generating" type="button" disabled aria-busy="true"><span class="generation-spinner" aria-hidden="true"></span><span>AI generating…</span></button>'+
      '</span>';
    }
    if(!value){
      return '<span class="document-control is-empty">'+
        '<button class="document-primary" type="button" data-generate="'+escapeAttr(key)+'">Generate</button>'+feedback+
      '</span>';
    }
    return '<span class="document-control has-file">'+
      '<button class="document-primary" type="button" data-generate="'+escapeAttr(key)+'">Review</button>'+feedback+
      '<span class="document-overflow">'+
        '<button class="document-menu-button" type="button" data-document-menu aria-haspopup="menu" aria-expanded="false" aria-label="More '+escapeAttr(fileLabel)+' options" title="More options">…</button>'+
        '<span class="document-menu" role="menu" hidden>'+
          '<button type="button" role="menuitem" data-document-revise="'+escapeAttr(key)+'">Request changes</button>'+
          '<button type="button" role="menuitem" data-document-regenerate="'+escapeAttr(key)+'">Regenerate</button>'+
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
      const categoryTitles={"control-panel":"Control panel",analytics:"Outcomes","master-resumes":"Master resumes","application-profile":"Application profile","answer-memory":"Answer memory","device-backup":"Device backup",layout:"Layout","job-info":"Job information",behavior:"Behavior"};

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
        if(key==="control-panel") loadControlPanelData();
        if(key==="analytics") loadAnalyticsData();
      };

      optionsButton.addEventListener("click",()=>{
        syncOptionsControls();
        optionsHome.hidden=false;
        optionsCard.hidden=true;
        optionsCard.classList.remove("is-entering","is-leaving","is-active");
        renderMasterResumeList();
        resetMasterResumeEditor();
        renderAnswerMemoryList();
        resetAnswerMemoryEditor();
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
      document.getElementById("ctrlRefreshAllButton")?.addEventListener("click",async()=>{
        setStatus("Refreshing all tracks…");
        try{
          await window.RavenAPI.refreshAllControl();
          await refreshAllJobs({includeDiscovered:true});
          await loadControlPanelData();
          setStatus("All tracks refreshed");
        }catch(error){setStatus("Refresh failed: "+error.message);}
      });
      document.getElementById("ctrlRunSourceDiagnosticsButton")?.addEventListener("click",async()=>{
        const track=document.getElementById("ctrlSourceTrack")?.value||"all";
        setStatus("Running source diagnostics…");
        try{await window.RavenAPI.runSourceDiagnostics(track);await loadControlPanelData();setStatus("Source diagnostics complete");}
        catch(error){setStatus("Diagnostics failed: "+error.message);}
      });
      document.getElementById("ctrlRepairDescriptionsButton")?.addEventListener("click",async()=>{
        const track=document.getElementById("ctrlRepairTrack")?.value||"";
        const limit=Number(document.getElementById("ctrlRepairLimit")?.value||6);
        setStatus("Repairing descriptions…");
        try{await window.RavenAPI.repairDescriptionsControl(limit,0,track);await loadControlPanelData();setStatus("Description repair complete");}
        catch(error){setStatus("Description repair failed: "+error.message);}
      });
      document.getElementById("ctrlSmokeAtsButton")?.addEventListener("click",async()=>{
        const track=document.getElementById("ctrlSmokeTrack")?.value||"Professional";
        setStatus("Running ATS smoke test…");
        try{await window.RavenAPI.smokeAts(track);await loadControlPanelData();setStatus("ATS smoke test complete");}
        catch(error){setStatus("ATS smoke test failed: "+error.message);}
      });
      optionsDialog.querySelectorAll("[data-setting-key]").forEach((control)=>{
        control.addEventListener("change",()=>{
          const value=control.type==="checkbox" ? control.checked : control.value;
          applyUserSetting(control.dataset.settingKey,value);
        });
      });
      const profile=readCache(APPLICATION_PROFILE_KEY,{})||{}; optionsDialog.querySelectorAll("[data-profile-key]").forEach(input=>input.value=profile[input.dataset.profileKey]||"");
      document.getElementById("saveApplicationProfile")?.addEventListener("click",()=>{ const next={}; optionsDialog.querySelectorAll("[data-profile-key]").forEach(input=>next[input.dataset.profileKey]=input.value.trim()); writeCache(APPLICATION_PROFILE_KEY,next); setStatus("Application profile saved"); });
      document.getElementById("saveAnswerMemory")?.addEventListener("click",saveAnswerMemoryFromEditor);
      document.getElementById("cancelAnswerMemory")?.addEventListener("click",resetAnswerMemoryEditor);
      document.getElementById("answerMemoryList")?.addEventListener("click",(event)=>{
        const item=event.target.closest("[data-answer-key]");
        if(!item) return;
        const key=item.dataset.answerKey;
        const values=readAnswerMemory();
        if(event.target.closest("[data-answer-delete]")){
          delete values[key];
          writeCache(ANSWER_MEMORY_KEY,values);
          if(editingAnswerMemoryKey===key) resetAnswerMemoryEditor();
          renderAnswerMemoryList();
          setStatus("Reusable answer deleted");
        }else if(event.target.closest("[data-answer-edit]")){
          editingAnswerMemoryKey=key;
          document.getElementById("answerMemoryQuestion").value=key;
          document.getElementById("answerMemoryAnswer").value=String(values[key]||"");
          document.getElementById("saveAnswerMemory").textContent="Update answer";
          document.getElementById("answerMemoryQuestion").focus();
        }
      });
      const resetOptionsButton=document.getElementById("resetOptionsButton");
      if(resetOptionsButton) resetOptionsButton.addEventListener("click",resetUserSettings);
      const exportDeviceBackupButton=document.getElementById("exportDeviceBackup");
      const importDeviceBackupButton=document.getElementById("importDeviceBackup");
      const deviceBackupFile=document.getElementById("deviceBackupFile");
      if(exportDeviceBackupButton) exportDeviceBackupButton.addEventListener("click",exportDeviceBackup);
      if(importDeviceBackupButton&&deviceBackupFile){
        importDeviceBackupButton.addEventListener("click",()=>{deviceBackupFile.value="";deviceBackupFile.click();});
        deviceBackupFile.addEventListener("change",()=>{const file=deviceBackupFile.files?.[0];if(file) restoreDeviceBackup(file);});
      }

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
      tab.addEventListener("click",()=>{
        state.activeTrack=tab.dataset.track;
        state.selectedId=null;
        trackTabs.forEach((item)=>{
          const active=item===tab;
          item.classList.toggle("active",active);
          item.setAttribute("aria-selected",String(active));
        });
        // Tabs are filters only. Switching tabs never triggers a separate
        // search, parser, enrichment, or generation path.
        render();
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
    document.getElementById("reviewApprove")?.addEventListener("click",()=>{ const job=state.generatorJob,type=state.generatorType; if(!job||!type)return; setDocumentApproved(job,type,true); const button=document.getElementById("reviewApprove"); button.textContent="Approved ✓"; button.classList.add("is-approved"); setStatus(documentLabel(type)+" approved"); render(); });
    document.querySelectorAll("[data-review-close]").forEach((button)=>{
      button.addEventListener("click",closeDocumentReview);
    });
    document.addEventListener("raven-application-complete",async()=>{
      const bridge=document.getElementById("ravenExtensionBridge");
      if(!bridge?.dataset.completion) return;
      let completion;
      try{ completion=JSON.parse(bridge.dataset.completion); }catch{return;}
      delete bridge.dataset.completion;
      const age=Date.now()-Date.parse(completion?.completedAt||0);
      if(!completion?.jobId||!Number.isFinite(age)||age<0||age>24*60*60*1000) return;
      const job=state.jobs.find((item)=>String(item.id)===String(completion.jobId));
      if(!job||job._discovered) return;
      let jobHost="",completionHost=String(completion.host||"").toLowerCase();
      try{jobHost=new URL(job.url).hostname.toLowerCase();}catch{}
      if(!jobHost||jobHost!==completionHost) return;
      if(String(job.status||"").toLowerCase()==="applied") return;
      const appliedDate=completion.completedAt||new Date().toISOString();
      await transitionJob(job,"Applied",{
        occurredAt:appliedDate,
        pendingMessage:"Application completion confirmed · updating status...",
        statusMessage:"Application completion confirmed · marked Applied"
      });
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
  async function refreshAllJobs(options={}) {
    const includeDiscovered=options.includeDiscovered!==false;
    const tasks=[loadJobs()];
    if(includeDiscovered) tasks.push(loadAllDiscovered());
    await Promise.allSettled(tasks);
    render();
  }
  async function boot() {
    bindEvents();
    applySharedParams();
    hydrateImmediateData();

    const runtimePromise=loadRuntimeConfig();
    const refreshPromise=refreshAllJobs();
    await Promise.allSettled([runtimePromise,refreshPromise]);

    let lastRefresh=Date.now();
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden && Date.now()-lastRefresh>60000){
        lastRefresh=Date.now();
        refreshAllJobs({includeDiscovered:true});
      }
    });
  }
  boot();
}());
