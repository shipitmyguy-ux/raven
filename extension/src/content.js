(() => {
  const RAVEN_HOST="shipitmyguy-ux.github.io";
  const safeSelectors={
    firstName:['input[name*="first" i]','input[id*="first" i]'],
    lastName:['input[name*="last" i]','input[id*="last" i]'],
    email:['input[type="email"]','input[name*="email" i]'],
    phone:['input[type="tel"]','input[name*="phone" i]'],
    linkedin:['input[name*="linkedin" i]','input[id*="linkedin" i]'],
    portfolio:['input[name*="portfolio" i]','input[name*="website" i]','input[id*="portfolio" i]']
  };
  const setValue=(el,value)=>{ if(!el||!value||el.value) return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set; setter?setter.call(el,value):(el.value=value); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return true; };
  const find=(selectors)=>selectors.map(s=>document.querySelector(s)).find(Boolean);
  function banner(text){
    let el=document.getElementById("raven-assistant-banner");
    if(!el){ el=document.createElement("div"); el.id="raven-assistant-banner"; Object.assign(el.style,{position:"fixed",right:"16px",bottom:"16px",zIndex:"2147483647",maxWidth:"360px",padding:"12px 14px",background:"#111827",color:"#fff",border:"1px solid #4b5563",borderRadius:"10px",font:"13px system-ui",boxShadow:"0 8px 30px #0008"}); document.documentElement.appendChild(el); }
    el.textContent=text;
  }
  if(location.hostname===RAVEN_HOST){
    document.addEventListener("raven-application-packet",()=>{
      const bridge=document.getElementById("ravenExtensionBridge"); if(!bridge?.dataset.packet) return;
      try{ const packet=JSON.parse(bridge.dataset.packet); chrome.storage.local.set({ravenApplicationPacket:packet},()=>banner("Raven application packet sent to extension.")); }catch{}
    });
    return;
  }
  const normalizeQuestion=(s)=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const labelFor=(el)=>{ const id=el.id; const explicit=id?document.querySelector(`label[for="${CSS.escape(id)}"]`):null; return explicit?.innerText||el.closest("label")?.innerText||el.getAttribute("aria-label")||el.name||""; };
  chrome.storage.local.get(["ravenApplicationPacket"],({ravenApplicationPacket:p})=>{
    if(!p||!p.jobUrl) return;
    const profile=p.profile||{}; let count=0;
    count+=setValue(find(safeSelectors.firstName),profile.firstName);
    count+=setValue(find(safeSelectors.lastName),profile.lastName);
    count+=setValue(find(safeSelectors.email),profile.email);
    count+=setValue(find(safeSelectors.phone),profile.phone);
    count+=setValue(find(safeSelectors.linkedin),profile.linkedin);
    count+=setValue(find(safeSelectors.portfolio),profile.portfolio);
    const answers=p.answers||{}; let remembered=0;
    document.querySelectorAll("input[type=text],textarea,select").forEach(el=>{ const key=normalizeQuestion(labelFor(el)); const answer=answers[key]; if(!answer||el.value) return; if(el.tagName==="SELECT"){ const option=[...el.options].find(o=>normalizeQuestion(o.textContent)===normalizeQuestion(answer)); if(option){el.value=option.value;el.dispatchEvent(new Event("change",{bubbles:true}));remembered++;} } else if(setValue(el,String(answer))) remembered++; });
    count+=remembered;
    if(count) banner("Raven filled "+count+" known field"+(count===1?"":"s")+". Review every field before submitting. Approved documents are locked in Raven.");
    else banner("Raven application detected. Review the form; no safe known fields were available to autofill.");
  });
})();