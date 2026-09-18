(function () {
  const config = window.RAVEN_CONFIG || window.JOBTRACK_CONFIG;
  const state = {
    jobs: [],
    selectedId: null,
    activeTrack: "Games / 3D",
    runtime: { theme: {}, settings: {}, ui: [], statuses: [], features: {} },
    discovered: { Professional: [], Labor: [], Wildcard: [], "Games / 3D": [] },
    commutes: {},
    returnScrollY: null
  };
  const columns = ["id","added","track","title","company","location","remote","salaryMin","salaryMax","salaryText","url","source","status","viewed","appliedDate","followUp","resume","coverLetter","notes","lastUpdated"];
  const status = document.getElementById("syncStatus");
  const list = document.getElementById("jobList");
  const template = document.getElementById("jobTemplate");
  const searchBox = document.getElementById("searchBox");
  const statusFilter = document.getElementById("statusFilter");
  const trackTabs = [...document.querySelectorAll(".track-tab")];
  const searchJobsButton = document.getElementById("searchJobsButton");

  const CACHE_JOBS_KEY="ravenJobsCacheV1";
  const CACHE_DISCOVERED_KEY="ravenDiscoveredCacheV1";

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
  function hydrateImmediateData(){
    const cachedJobs=readCache(CACHE_JOBS_KEY,null);
    if(Array.isArray(cachedJobs) && cachedJobs.length){
      state.jobs=cachedJobs;
      setStatus("Refreshing…");
    } else if(Array.isArray(window.RAVEN_SNAPSHOT?.jobs)){
      state.jobs=normalizeJobs(window.RAVEN_SNAPSHOT.jobs);
      setStatus("Refreshing…");
    }
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
    const rows = Array.isArray(payload) ? payload : payload.jobs || payload.rows || [];
    return rows.map((row)=>{
      if (!Array.isArray(row)) return row;
      return Object.fromEntries(columns.map((key,index)=>[key,row[index]||""]));
    }).filter((job)=>job.id||job.title||job.url);
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
      fitScore: Math.max(55, Math.min(96, 50 + Number(job.score || 7) * 3)),
      _discovered: true
    })).filter((job)=>job.url);
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
      setStatus(payload.count + " results · deeper search continuing");

      // The backend continues broad search/enrichment after returning the fast pass.
      // Refresh quietly so new results appear without blocking the user.
      setTimeout(()=>{ loadDiscovered(track); },8000);
      setTimeout(()=>{ Promise.allSettled([loadDiscovered(track),loadJobs()]); },22000);
      setTimeout(()=>{ loadDiscovered(track); },45000);
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
    const copy=[...jobs];
    if (mode==="added-asc") return copy.sort((a,b)=>parseDate(a.added)-parseDate(b.added));
    if (mode==="title-asc") return copy.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
    if (mode==="company-asc") return copy.sort((a,b)=>String(a.company||"").localeCompare(String(b.company||"")));
    return copy.sort((a,b)=>parseDate(b.added)-parseDate(a.added));
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
      const payload=await callSearchApi({action:"commute",location});
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
      {bucket:"Offer",label:"Offer"}
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
          const card=document.createElement("button");
          card.type="button";
          card.className="job-card"+(job.id===state.selectedId?" active":"")+(isRemoteJob(job)?" is-remote":"")+(job.status==="Applied"?" is-applied":"")+(job.status==="Interested"?" is-interested":"");
          card.dataset.status=statusToken(job.status);
          const company=job.company||"Company not captured";
          const location=[job.location,job.remote].filter(Boolean).join(" · ")||"Location not captured";
          const salary=job.salaryText||"";
          const score=matchScore(job);
          card.innerHTML=
            '<span class="card-main">'+
              '<span class="card-topline"><span class="match-line"><strong>'+score+'%</strong> match</span><span class="job-status">'+escapeHtml(job.status||"Saved")+'</span></span>'+
              '<span class="job-title">'+escapeHtml(job.title||"Untitled job")+'</span>'+
              '<span class="company-name">'+escapeHtml(company)+'</span>'+
              '<span class="job-location">'+escapeHtml(location)+'</span>'+
              (salary?'<span class="job-salary">'+escapeHtml(salary)+'</span>':'')+
              '<span class="job-age">'+escapeHtml(relativeAdded(job.added))+'</span>'+
            '</span>'+
            (!isRemoteJob(job) && job.location ? '<span class="commute-footer" data-commute-key="'+escapeAttr(commuteCacheKey(job.location))+'" hidden></span>' : '');
          if (job.id===state.selectedId) {
            const expanded=document.createElement("span");
            expanded.className="job-card-expanded";
            expanded.innerHTML=renderInlineDetail(job);
            card.appendChild(expanded);
            expanded.querySelectorAll("[data-bookmark]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                toggleBookmark(job);
              });
            });
            expanded.querySelectorAll("[data-apply-status]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                toggleApplied(job);
              });
            });
            expanded.querySelectorAll("[data-queue]").forEach((button)=>{
              button.addEventListener("click",(event)=>{
                event.stopPropagation();
                enqueue(job,button.dataset.queue);
              });
            });
            expanded.querySelectorAll("a").forEach((link)=>link.addEventListener("click",(event)=>event.stopPropagation()));
          }
          card.addEventListener("click",()=>{
            const opening=state.selectedId!==job.id;
            if(opening) state.returnScrollY=window.scrollY;
            state.selectedId = opening ? job.id : null;
            render();

            requestAnimationFrame(()=>{
              if(opening){
                const active=document.querySelector(".job-card.active");
                if(active){
                  active.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
                  active.focus({preventScroll:true});
                }
              } else if(Number.isFinite(state.returnScrollY)){
                window.scrollTo({top:state.returnScrollY,behavior:"smooth"});
                state.returnScrollY=null;
              }
            });
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
      if (item.format==="link") rendered=documentLink(value,item.label||item.key);
      else if (value!==undefined && value!==null && value!=="") rendered=escapeHtml(value);
      return '<dt>'+escapeHtml(item.label||item.key)+'</dt><dd>'+rendered+'</dd>';
    }).join("");

    const isApplied=String(job.status||"").toLowerCase()==="applied";
    const bookmarkAction=String(job.status||"").toLowerCase()==="interested"
      ? '<button type="button" data-bookmark="remove">★ Bookmarked</button>'
      : (isApplied ? "" : '<button type="button" data-bookmark="add">☆ Bookmark</button>');
    const appliedAction='<button class="workflow-action'+(isApplied?' is-applied':'')+'" type="button" data-apply-status="'+(isApplied?'saved':'applied')+'" aria-pressed="'+String(isApplied)+'" aria-label="'+(isApplied?'Unmark as applied':'Mark as applied')+'" title="'+(isApplied?'Unmark as applied':'Mark as applied')+'">✓</button>';
    const configuredActions=uiRows("detail-action");
    const actions=(configuredActions.length?configuredActions:fallbackActions())
      .filter((item)=>{
        if (item.key==="posting" || item.key==="apply") return Boolean(job.url);
        const feature=actionFeatureKey(item.key);
        return !feature || featureEnabled(feature,true);
      })
      .map((item)=>{
        const label=item.label||item.key;
        if (item.format==="external-link" || item.key==="posting" || item.key==="apply") {
          return '<a class="workflow-action" href="'+escapeAttr(job.url)+'" target="_blank" rel="noopener" aria-label="'+escapeAttr(label)+'" title="'+escapeAttr(label)+'">↗</a>';
        }
        const icon=item.key==="resume"?"R":item.key==="coverLetter"?"✉":"＋";
        return '<button class="workflow-action" type="button" data-queue="'+escapeAttr(item.key)+'" aria-label="'+escapeAttr(label)+'" title="'+escapeAttr(label)+'">'+icon+'</button>';
      }).join("");

    const description=job.notes||"Job description not yet available.";
    return '<section class="inline-job-detail">'+
      '<section class="job-description"><h3>Job description</h3><p>'+escapeHtml(description)+'</p></section>'+
      '<dl>'+detailHtml+'</dl>'+
      '<div class="detail-actions">'+
        (bookmarkAction?'<div class="bookmark-action">'+bookmarkAction+'</div>':'')+
        '<div class="workflow-actions" aria-label="Application actions">'+appliedAction+actions+'</div>'+
      '</div>'+
    '</section>';
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
      state.selectedId=null;
      await loadJobs();
      setStatus(isApplied?"Marked not applied":"Marked applied");
    }catch(error){
      setStatus("Update failed: "+error.message);
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
      state.selectedId=null;
      await loadJobs();
      setStatus(interested?"Bookmark removed":"Bookmarked");
    }catch(error){
      setStatus("Bookmark failed: "+error.message);
    }
  }

  function escapeHtml(value) {
    return String(value||"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g,"&#96;"); }
  function documentLink(value,label) {
    if (!value) return "Not generated";
    if (/^https?:\/\//.test(value)) return '<a href="'+escapeAttr(value)+'" target="_blank" rel="noopener">Open '+escapeHtml(String(label||"file").toLowerCase())+'</a>';
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
  }
  function applySharedParams() {
    const params=new URLSearchParams(window.location.search);
    const sharedUrl=params.get("url");
    if (sharedUrl) {
      const parts=sharedUrl.split(/\s+/);
      document.getElementById("jobUrl").value=parts.find((part)=>/^https?:\/\//.test(part))||sharedUrl;
    }
  }
  async function refreshCurrentTrack() {
    await Promise.allSettled([loadJobs(),loadDiscovered(state.activeTrack)]);
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
        refreshCurrentTrack();
      }
    });
  }
  boot();
}());
