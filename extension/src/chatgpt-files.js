// Only Raven-named attachments associated with a recent request are downloaded.
(() => {
  const clicked=new Set();
  let scanning=false;
  async function scan(){
    if(scanning)return;scanning=true;
    try{
      const {ravenChatGptRequests:requests={}}=await chrome.storage.local.get("ravenChatGptRequests");
      for(const link of document.querySelectorAll('[data-message-author-role="assistant"] a')){
        const label=(link.textContent||"")+" "+(link.getAttribute("download")||"")+" "+(link.getAttribute("href")||"");
        for(const [id,createdAt] of Object.entries(requests)){
          if(Date.now()-createdAt>86400000||!label.includes("raven-"+id+".json")||clicked.has(id))continue;
          clicked.add(id);link.click();
        }
      }
    }finally{scanning=false;}
  }
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,750);});
  let timer;observer.observe(document.documentElement,{childList:true,subtree:true});scan();
})();
