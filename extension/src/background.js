const RAVEN_URL = "https://shipitmyguy-ux.github.io/raven/";
const RAVEN_MATCH = "https://shipitmyguy-ux.github.io/raven/*";

const trustedRaven=sender=>sender?.tab?.url?.startsWith(RAVEN_URL);
let transferQueue=Promise.resolve();
const queueTransfer=operation=>{transferQueue=transferQueue.then(operation).catch(error=>{
  console.warn("Raven file transfer:",error.message);
  return chrome.storage.local.set({ravenChatGptError:"Automatic JSON import failed: "+error.message+" Select the downloaded JSON file in Raven’s Import window."});
});};
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(!trustedRaven(sender))return;
  if(message?.type==="raven-chatgpt-request"&&/^[0-9a-f-]{36}$/.test(message.requestId))queueTransfer(async()=>{
    const {ravenChatGptRequests:requests={}}=await chrome.storage.local.get("ravenChatGptRequests");
    for(const [id,time] of Object.entries(requests))if(Date.now()-time>86400000)delete requests[id];
    const {ravenChatGptResults:results={}}=await chrome.storage.local.get("ravenChatGptResults");
    for(const id of Object.keys(results))if(!requests[id])delete results[id];
    requests[message.requestId]=Date.now();await chrome.storage.local.set({ravenChatGptRequests:requests,ravenChatGptResults:results,ravenChatGptError:""});
  });
  if(message?.type==="raven-chatgpt-ack")queueTransfer(async()=>{
    const values=await chrome.storage.local.get(["ravenChatGptResults","ravenChatGptRequests"]);
    const results=values.ravenChatGptResults||{},requests=values.ravenChatGptRequests||{};
    delete results[message.requestId];delete requests[message.requestId];
    await chrome.storage.local.set({ravenChatGptResults:results,ravenChatGptRequests:requests});
  });
});
function chatGptFileUrl(value){
  try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="chatgpt.com"||url.hostname.endsWith(".oaiusercontent.com")||url.hostname==="oaiusercontent.com");}catch{return false;}
}
chrome.downloads.onChanged.addListener(change=>{
  if(change.state?.current!=="complete")return;
  queueTransfer(async()=>{
    const [download]=await chrome.downloads.search({id:change.id});
    const id=download?.filename?.match(/raven-([0-9a-f-]{36})\.json$/i)?.[1];
    if(!id||!chatGptFileUrl(download.finalUrl||download.url))return;
    const values=await chrome.storage.local.get(["ravenChatGptRequests","ravenChatGptResults"]);
    if(!values.ravenChatGptRequests?.[id]||Date.now()-values.ravenChatGptRequests[id]>86400000)return;
    if(download.fileSize>160000)throw new Error("JSON file exceeds Raven's size limit. Use manual Import.");
    const response=await fetch(download.finalUrl||download.url,{credentials:"include"});
    if(!response.ok)throw new Error("Cannot read ChatGPT attachment. Use the downloaded file in Raven Import.");
    const text=await response.text();if(text.length>160000)throw new Error("JSON file too large.");
    const payload=JSON.parse(text);
    if(payload.raven_format!=="raven-chatgpt-v1"||payload.request_id!==id)throw new Error("JSON request identity does not match.");
    await chrome.storage.local.set({ravenChatGptResults:{...(values.ravenChatGptResults||{}),[id]:text}});
  });
});

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
