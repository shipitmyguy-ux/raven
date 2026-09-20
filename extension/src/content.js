(() => {
  const RAVEN_HOST="shipitmyguy-ux.github.io";
  const PACKET_KEY="ravenApplicationPacket";
  const SESSION_KEY="ravenApplicationSession";
  const COMPLETION_KEY="ravenApplicationCompletion";
  const core=globalThis.RavenAssistantCore;
  if(!core) return;

  function banner(text){
    let el=document.getElementById("raven-assistant-banner");
    if(!el){
      el=document.createElement("div");
      el.id="raven-assistant-banner";
      Object.assign(el.style,{position:"fixed",right:"16px",bottom:"16px",zIndex:"2147483647",maxWidth:"380px",padding:"12px 14px",background:"#111827",color:"#fff",border:"1px solid #4b5563",borderRadius:"10px",font:"13px system-ui",boxShadow:"0 8px 30px #0008"});
      document.documentElement.appendChild(el);
    }
    el.textContent=text;
  }

  function dispatchCompletionToRaven(completion){
    const bridge=document.getElementById("ravenExtensionBridge");
    if(!bridge||!completion) return;
    bridge.dataset.completion=JSON.stringify(completion);
    document.dispatchEvent(new CustomEvent("raven-application-complete"));
  }

  if(location.hostname===RAVEN_HOST){
    document.addEventListener("raven-application-packet",()=>{
      const bridge=document.getElementById("ravenExtensionBridge");
      if(!bridge?.dataset.packet) return;
      try{
        const packet=JSON.parse(bridge.dataset.packet);
        chrome.storage.local.set({[PACKET_KEY]:packet},()=>banner("Raven application packet sent to extension."));
      }catch{}
    });
    chrome.runtime.onMessage.addListener((message)=>{
      if(message?.type!=="raven-application-complete"||!message.completion) return;
      dispatchCompletionToRaven(message.completion);
      chrome.storage.local.remove(COMPLETION_KEY);
    });
    chrome.storage.local.get([COMPLETION_KEY],(values)=>{
      const completion=values[COMPLETION_KEY];
      const age=Date.now()-Date.parse(completion?.completedAt||0);
      if(completion&&Number.isFinite(age)&&age>=0&&age<24*60*60*1000){
        dispatchCompletionToRaven(completion);
        chrome.storage.local.remove(COMPLETION_KEY);
      }else if(completion){
        chrome.storage.local.remove(COMPLETION_KEY);
      }
    });
    return;
  }

  const adapter=core.detectAdapter(location.hostname);
  const profileTerms={
    firstName:["first name","given name"],
    lastName:["last name","surname","family name"],
    fullName:["full name","name"],
    email:["email","email address"],
    phone:["phone","phone number","mobile"],
    linkedin:["linkedin"],
    portfolio:["portfolio","website","personal website"],
    address1:["address line 1","street address","address"],
    address2:["address line 2","apartment","suite"],
    city:["city"],
    region:["state","province","region"],
    postalCode:["zip","postal code","postcode"],
    country:["country"]
  };

  function setControlValue(el,value){
    if(!el||value==null||String(value).trim()===""||el.disabled||el.readOnly) return false;
    if(String(el.value||"").trim()) return false;
    const next=String(value);
    if(el.tagName==="SELECT"){
      const normalized=core.normalizeQuestion(next);
      const option=[...el.options].find((item)=>core.normalizeQuestion(item.textContent)===normalized||core.normalizeQuestion(item.value)===normalized);
      if(!option) return false;
      el.value=option.value;
    }else{
      const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
      setter?setter.call(el,next):(el.value=next);
    }
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    return true;
  }

  function queryFirst(selectors){
    for(const selector of selectors||[]){
      try{
        const el=document.querySelector(selector);
        if(el) return el;
      }catch{}
    }
    return null;
  }

  function labelFor(el){
    const id=el.id;
    let explicit=null;
    try{ explicit=id?document.querySelector('label[for="'+CSS.escape(id)+'"]'):null; }catch{}
    const described=(el.getAttribute("aria-labelledby")||"").split(/\s+/).filter(Boolean).map((id)=>document.getElementById(id)?.innerText||"").join(" ");
    return [explicit?.innerText,el.closest("label")?.innerText,el.getAttribute("aria-label"),described,el.name,el.id].filter(Boolean).join(" ");
  }

  function findByTerms(terms,{files=false}={}){
    const selector=files?'input[type="file"]':'input:not([type="file"]),textarea,select';
    for(const el of document.querySelectorAll(selector)){
      const label=core.normalizeQuestion(labelFor(el));
      if(!label) continue;
      if((terms||[]).some((term)=>label.includes(core.normalizeQuestion(term)))) return el;
    }
    return null;
  }

  function profileValue(profile,key){
    if(key==="fullName") return profile.fullName||[profile.firstName,profile.lastName].filter(Boolean).join(" ");
    return profile[key]||"";
  }

  function fillProfile(profile){
    let count=0;
    for(const key of Object.keys(profileTerms)){
      const value=profileValue(profile,key);
      if(!value) continue;
      const el=queryFirst(core.selectorsFor(adapter,"profile",key))||findByTerms(profileTerms[key]);
      if(setControlValue(el,value)) count++;
    }
    return count;
  }

  function fillRememberedAnswers(answers){
    let count=0;
    document.querySelectorAll('input:not([type="file"]):not([type="hidden"]),textarea,select').forEach((el)=>{
      const label=labelFor(el);
      if(core.isSensitiveQuestion(label)) return;
      const key=core.normalizeQuestion(label);
      const answer=answers?.[key];
      if(answer==null||String(answer).trim()==="") return;
      if(setControlValue(el,answer)) count++;
    });
    return count;
  }

  function extensionForMime(type){
    return ({"application/pdf":"pdf","application/msword":"doc","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","text/plain":"txt","text/html":"html"})[String(type||"").toLowerCase()]||"bin";
  }

  function dataUrlToFile(value,kind,packet){
    const raw=String(value||"");
    const match=raw.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i);
    if(!match) return null;
    const mime=(match[1]||"application/octet-stream").toLowerCase();
    let bytes;
    try{
      if(match[2]){
        const binary=atob(match[3]);
        bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));
      }else{
        bytes=new TextEncoder().encode(decodeURIComponent(match[3]));
      }
    }catch{return null;}
    const stem=String(packet?.company||packet?.title||"Raven").replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,48)||"Raven";
    const suffix=kind==="coverLetter"?"cover-letter":"resume";
    const ext=extensionForMime(mime);
    return new File([bytes],stem+"-"+suffix+"."+ext,{type:mime,lastModified:Date.now()});
  }

  function fileInputFor(kind){
    const explicit=queryFirst(core.selectorsFor(adapter,"files",kind));
    if(explicit) return explicit;
    return findByTerms(kind==="resume"?["resume","cv"]:["cover letter","cover"],{files:true});
  }

  function uploadApprovedDocument(packet,kind){
    const value=kind==="resume"?packet.resume:packet.coverLetter;
    const file=dataUrlToFile(value,kind,packet);
    if(!file) return {uploaded:false,reason:"unavailable"};
    const input=fileInputFor(kind);
    if(!input) return {uploaded:false,reason:"missing-input"};
    if(input.files?.length) return {uploaded:false,reason:"already-filled"};
    if(!core.acceptsFile(input.accept,file.name,file.type)) return {uploaded:false,reason:"format"};
    try{
      const transfer=new DataTransfer();
      transfer.items.add(file);
      input.files=transfer.files;
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
      return {uploaded:true};
    }catch{
      return {uploaded:false,reason:"browser"};
    }
  }

  function completionEvidence(){
    let matched=null;
    for(const selector of adapter.successSelectors||[]){
      try{
        const el=document.querySelector(selector);
        if(el){matched=el;break;}
      }catch{}
    }
    const text=(matched?.innerText||document.querySelector("main")?.innerText||document.body?.innerText||"").slice(0,16000);
    return core.completionLooksSuccessful({url:location.href,text,matchedSelector:Boolean(matched)});
  }

  function reportCompletion(session){
    if(!session||!completionEvidence()) return false;
    const completion={version:1,jobId:session.jobId||"",jobUrl:session.jobUrl||"",host:location.hostname,adapter:session.adapter||adapter.id,completedAt:new Date().toISOString()};
    chrome.storage.local.set({[COMPLETION_KEY]:completion});
    chrome.storage.local.remove(SESSION_KEY);
    chrome.runtime.sendMessage({type:"raven-application-complete",completion},()=>void chrome.runtime.lastError);
    banner("Raven detected a submitted application. It will mark the matching job Applied when Raven is available.");
    return true;
  }

  function watchCompletion(session){
    if(!session) return;
    let target;
    try{target=new URL(session.jobUrl);}catch{return;}
    const age=Date.now()-Date.parse(session.createdAt||0);
    if(target.hostname!==location.hostname||!Number.isFinite(age)||age<0||age>6*60*60*1000){
      chrome.storage.local.remove(SESSION_KEY);
      return;
    }
    if(reportCompletion(session)) return;
    const root=document.body||document.documentElement;
    if(!root) return;
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued) return;
      queued=true;
      setTimeout(()=>{
        queued=false;
        if(reportCompletion(session)) observer.disconnect();
      },250);
    });
    observer.observe(root,{childList:true,subtree:true,characterData:true});
    setTimeout(()=>observer.disconnect(),30*60*1000);
  }

  chrome.storage.local.get([PACKET_KEY,SESSION_KEY],async(values)=>{
    let session=values[SESSION_KEY]||null;
    const packet=values[PACKET_KEY];
    if(packet?.jobUrl){
      let target;
      try{target=new URL(packet.jobUrl);}catch{target=null;}
      const age=Date.now()-Date.parse(packet.createdAt||0);
      if(!target||target.hostname!==location.hostname||!Number.isFinite(age)||age<0||age>2*60*60*1000){
        if(!Number.isFinite(age)||age>2*60*60*1000) chrome.storage.local.remove(PACKET_KEY);
      }else{
        const profileCount=fillProfile(packet.profile||{});
        const answerCount=fillRememberedAnswers(packet.answers||{});
        const resumeResult=uploadApprovedDocument(packet,"resume");
        const coverResult=uploadApprovedDocument(packet,"coverLetter");
        const uploadCount=Number(resumeResult.uploaded)+Number(coverResult.uploaded);
        const skippedFormat=[resumeResult,coverResult].filter((result)=>result.reason==="format").length;
        session={version:1,createdAt:new Date().toISOString(),jobId:packet.jobId||"",jobUrl:packet.jobUrl||"",host:location.hostname,adapter:adapter.id};
        chrome.storage.local.set({[SESSION_KEY]:session});
        chrome.storage.local.remove(PACKET_KEY);
        const filled=profileCount+answerCount;
        let message="Raven application assistant: "+filled+" known field"+(filled===1?"":"s")+" filled";
        if(uploadCount) message+=" · "+uploadCount+" approved document"+(uploadCount===1?"":"s")+" attached";
        if(skippedFormat) message+=" · approved document format not accepted by this upload field";
        message+=". Review every field and attachment before submitting.";
        banner(message);
      }
    }
    watchCompletion(session);
  });
})();