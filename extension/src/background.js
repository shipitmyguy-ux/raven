const RAVEN_URL = "https://shipitmyguy-ux.github.io/raven/";
const RAVEN_MATCH = "https://shipitmyguy-ux.github.io/raven/*";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-to-raven",
      title: "Save to Raven",
      contexts: ["page", "link", "selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-to-raven") return;

  const sourceUrl = info.linkUrl || info.pageUrl || tab?.url || "";
  const title = (tab?.title || "").trim();

  const target = new URL(RAVEN_URL);
  if (sourceUrl) target.searchParams.set("url", sourceUrl);
  if (title) target.searchParams.set("title", title);

  chrome.tabs.create({ url: target.toString() });
});

chrome.runtime.onMessage.addListener((message) => {
  if(message?.type!=="raven-application-complete"||!message.completion) return;
  chrome.tabs.query({url:RAVEN_MATCH},(tabs)=>{
    tabs.forEach((tab)=>{
      if(!tab.id) return;
      chrome.tabs.sendMessage(tab.id,{type:"raven-application-complete",completion:message.completion},()=>void chrome.runtime.lastError);
    });
  });
});
