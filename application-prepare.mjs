export function extensionUnavailableReason(error){
  return error?.code==='PREPARATION_EXTENSION_UNAVAILABLE'?String(error.message||'The Raven Chrome extension is unavailable.'):null;
}

// These posting/application pairs retain the same bounded job ID and host.
// Leave every other destination unchanged for the extension's exact-URL check.
export function applicationTargetUrl(jobUrl){
  const url=new URL(jobUrl);
  if(url.protocol!=='https:'||url.port||url.username||url.password)return jobUrl;
  if(url.hostname==='apply.workable.com'&&/^\/[a-z0-9-]{1,100}\/j\/[a-z0-9]{6,20}\/?$/i.test(url.pathname))
    url.pathname=url.pathname.replace(/\/$/,'')+'/apply/';
  else if(url.hostname==='apply.workable.com'&&/^\/j\/[a-z0-9]{6,20}\/?$/i.test(url.pathname))
    url.pathname=url.pathname.replace(/\/$/,'')+'/apply/';
  else if(url.hostname==='jobs.lever.co'&&/^\/[a-z0-9-]{1,100}\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(url.pathname))
    url.pathname=url.pathname.replace(/\/$/,'')+'/apply';
  else if(url.hostname==='jobs.gusto.com'&&/^\/postings\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(url.pathname))
    url.pathname=url.pathname.replace(/\/$/,'')+'/applicants/new';
  else if(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.breezy\.hr$/i.test(url.hostname)&&
      /^\/p\/[0-9a-f]{12}-[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?\/?$/i.test(url.pathname))
    url.pathname=url.pathname.replace(/\/$/,'')+'/apply';
  else return jobUrl;
  return url.href;
}

function unavailable(message){
  return Object.assign(Error(message),{code:'PREPARATION_EXTENSION_UNAVAILABLE'});
}

// Older bridge callbacks forward chrome.runtime.lastError as a negative reply.
// Only these transport messages mean the extension worker is unavailable.
const legacyTransportErrors=new Set([
  'Extension did not respond.',
  'Could not establish connection. Receiving end does not exist.',
  'Extension context invalidated.',
  'The message port closed before a response was received.'
]);
function legacyTransportUnavailable(message){
  return typeof message==='string'&&legacyTransportErrors.has(message)
    ? Object.assign(unavailable('The Raven Chrome extension did not respond. Check or reload it in Chrome, then resume preparation.'),{reconnectBeforeDelivery:message==='Extension context invalidated.'})
    : null;
}

export function probePreparationExtension({documentRef=globalThis.document,timeoutMs=1200}={}){
  return new Promise((resolve,reject)=>{
    const bridge=documentRef?.getElementById('ravenExtensionBridge');
    if(!bridge){reject(unavailable('The Raven Chrome extension is unavailable. Install or enable it, then refresh Raven.'));return;}
    let settled=false;
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-prepare-capability',onCapability);error?reject(error):resolve(true);};
    const onCapability=()=>{if(bridge.dataset.prepareCapability==='2')finish();else if(bridge.dataset.prepareCapability)finish(unavailable('The Raven Chrome extension needs the latest preparation update. Update or reload it in Chrome, then refresh Raven.'));};
    const timer=setTimeout(()=>finish(unavailable('The Raven Chrome extension did not confirm preparation support. Enable or update it, then refresh Raven.')),timeoutMs);
    delete bridge.dataset.prepareCapability;
    bridge.addEventListener('raven-prepare-capability',onCapability);
    bridge.dispatchEvent(new Event('raven-prepare-probe',{bubbles:true}));
  });
}

export function preflightPreparationApplication({jobId,jobUrl,title='',company=''},{documentRef=globalThis.document,timeoutMs=30000,requestId=crypto.randomUUID()}={}){
  const bridge=documentRef?.getElementById('ravenExtensionBridge');
  if(!bridge)throw unavailable('The Raven Chrome extension is unavailable. Enable it, then refresh Raven.');
  if(!uuidPattern.test(requestId))throw Error('Invalid destination preflight request ID.');
  return new Promise((resolve,reject)=>{
    let settled=false,invalidSeen=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-preflight-response',onResponse);error?reject(error):resolve(result);};
    const onResponse=()=>{
      let value;try{value=JSON.parse(bridge.dataset.preparePreflightResponse||'');}catch{invalidSeen=true;return;}
      if(!value||typeof value!=='object'||value.requestId!==requestId){invalidSeen=true;return;}
      if(value.ok===false&&value.status==='blocked'){
        const transport=legacyTransportUnavailable(value.reason);
        if(transport){finish(transport);return;}
      }
      if(value.ok===false&&value.status==='manual'&&typeof value.reason==='string'&&value.reason.trim()){
        finish(null,{status:'manual',reason:value.reason.slice(0,240)});return;
      }
      if(value.ok!==true||value.status!=='ready'||!uuidPattern.test(value.preflightId||'')){finish(Error(value.reason||'The application destination could not be verified.'));return;}
      finish(null,value);
    };
    const timer=setTimeout(()=>finish(invalidSeen?Error('Chrome returned an invalid application destination response. Review it before resuming.'):Object.assign(unavailable('The Raven Chrome extension did not confirm the application destination. Check it in Chrome, then resume preparation.'),{reconnectBeforeDelivery:true})),timeoutMs);
    bridge.addEventListener('raven-preflight-response',onResponse);
    bridge.dataset.preparePreflightRequest=JSON.stringify({requestId,jobId,jobUrl,title,company});
    bridge.dispatchEvent(new Event('raven-preflight-application',{bubbles:true}));
  });
}

export function dispatchPreparedApplication(packet,{documentRef=globalThis.document,timeoutMs=120000,requestId=crypto.randomUUID(),preflightId}={}){
  const bridge=documentRef?.getElementById('ravenExtensionBridge');
  if(!bridge)throw unavailable('The Raven Chrome extension is unavailable. Enable it, then refresh Raven.');
  if(!uuidPattern.test(requestId))throw Error('Invalid preparation request ID.');
  if(preflightId!==undefined&&!uuidPattern.test(preflightId))throw Error('Invalid destination preflight ID.');
  return new Promise((resolve,reject)=>{
    let settled=false,invalidSeen=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-prepare-response',onResponse);error?reject(error):resolve(result);};
    const onResponse=()=>{
      const response=bridge.dataset.prepareResponse;
      if(!response){invalidSeen=true;return;}
      let value;try{value=JSON.parse(response);}catch{invalidSeen=true;return;}
      if(!value||typeof value!=='object'||value.requestId!==requestId){invalidSeen=true;return;}
      if(value.ok!==true){finish((value.ok===false&&legacyTransportUnavailable(value.error))||Error(value.error||'Chrome could not open the application for preparation.'));return;}
      finish(null,value);
    };
    const timer=setTimeout(()=>finish(invalidSeen?Error('Chrome returned an invalid application preparation response. Review it before resuming.'):unavailable('The Raven Chrome extension did not confirm opening the application. Check Chrome, then resume preparation.')),timeoutMs);
    bridge.addEventListener('raven-prepare-response',onResponse);
    bridge.dataset.prepareRequest=JSON.stringify({requestId,...(preflightId?{preflightId}:{}),packet});
    bridge.dispatchEvent(new Event('raven-prepare-application',{bubbles:true}));
  });
}

export function probeApplyExtension({documentRef=globalThis.document,timeoutMs=1200}={}){
  const bridge=documentRef?.getElementById('ravenExtensionBridge');
  if(!bridge)return Promise.resolve(false);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-apply-capability',onCapability);resolve(value);};
    const onCapability=()=>finish(bridge.dataset.applyCapability==='3');
    const timer=setTimeout(()=>finish(false),timeoutMs);
    delete bridge.dataset.applyCapability;
    bridge.addEventListener('raven-apply-capability',onCapability);
    bridge.dispatchEvent(new Event('raven-apply-probe',{bubbles:true}));
  });
}

export function requestApplyExtension(request,{documentRef=globalThis.document,timeoutMs=30000}={}){
  const bridge=documentRef?.getElementById('ravenExtensionBridge');
  if(!bridge)throw unavailable('The Raven Chrome extension is unavailable.');
  if(request?.version!==3||!uuidPattern.test(request.requestId||'')||!uuidPattern.test(request.attemptId||'')||!String(request.jobId||'').match(/^[A-Za-z0-9_-]{1,160}$/)||!['open','inspect','deliver','status','cancel'].includes(request.action))throw Error('Invalid Apply request.');
  return new Promise((resolve,reject)=>{
    let settled=false,acknowledged=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-apply-response',onResponse);error?reject(error):resolve(result);};
    const onResponse=()=>{
      let value;try{value=JSON.parse(bridge.dataset.applyResponse||'');}catch{return;}
      if(value?.version!==3||value.requestId!==request.requestId||value.attemptId!==request.attemptId||String(value.jobId)!==String(request.jobId))return;
      if(value.kind==='error'||value.ok===false){finish(Error(typeof value.reason==='string'?value.reason:value.reason?.message||value.error||'Chrome rejected Apply.'));return;}
      if(!Number.isInteger(value.bindingRevision)||value.bindingRevision<1||!Number.isInteger(value.sequence)||value.sequence<1){finish(Error('Chrome returned an unbound Apply response.'));return;}
      if(request.action==='deliver'&&value.operationId!==request.payload?.operationId){finish(Error('Chrome returned a mismatched Apply operation.'));return;}
      if(request.action==='deliver'&&value.bindingRevision!==request.bindingRevision){finish(Error('Chrome returned a stale Apply binding.'));return;}
      if(value.kind==='ack'){acknowledged=true;if(request.action==='deliver')finish(null,value);return;}
      if(!['result','snapshot','error'].includes(value.kind)){finish(Error('Chrome returned an invalid Apply result.'));return;}
      finish(null,value);
    };
    const timer=setTimeout(()=>finish(Object.assign(Error(acknowledged?'Chrome acknowledged Apply but did not complete it. Check the form and retry status.':'Chrome did not confirm the Apply request. Check the form before retrying.'),{code:'APPLY_RESULT_TIMEOUT',acknowledged})),timeoutMs);
    bridge.addEventListener('raven-apply-response',onResponse);
    bridge.dataset.applyRequest=JSON.stringify(request);
    bridge.dispatchEvent(new Event('raven-apply-request',{bubbles:true}));
  });
}

const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const shaPattern=/^[a-f0-9]{64}$/i;
const states=new Set(['generating','documents-ready','dispatching','opened','needs-review']);
export const PREPARATION_STORAGE_KEY='raven.application-preparation.v1';
const MAX_AGE_MS=24*60*60*1000;

function safeRecord(value,now){
  if(!value||value.version!==1||!uuidPattern.test(value.preparationId||'')||!uuidPattern.test(value.extensionRequestId||'')||!String(value.jobId||'').match(/^[A-Za-z0-9_-]{1,160}$/)||!states.has(value.state)||!Number.isFinite(Date.parse(value.createdAt))||!Number.isFinite(Date.parse(value.updatedAt)))return null;
  let url;
  try{url=new URL(value.jobUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid URL');}catch{return null;}
  const record={version:1,preparationId:value.preparationId,jobId:value.jobId,jobUrl:url.href,createdAt:value.createdAt,updatedAt:value.updatedAt,state:value.state,extensionRequestId:value.extensionRequestId};
  if(value.runId!==undefined){if(!uuidPattern.test(value.runId))return null;record.runId=value.runId;}
  if(value.documents!==undefined){
    if(!value.documents||typeof value.documents!=='object'||Object.keys(value.documents).some(key=>!['resume','coverLetter'].includes(key)))return null;
    const documents={};for(const kind of ['resume','coverLetter'])if(value.documents[kind]!==undefined){const sha=value.documents[kind]?.documentSha256;if(!shaPattern.test(sha||''))return null;documents[kind]={documentSha256:sha.toLowerCase()};}
    record.documents=documents;
  }
  if(typeof value.lastStage==='string'&&/^[a-z_]{1,40}$/.test(value.lastStage))record.lastStage=value.lastStage;
  if(typeof value.reason==='string')record.reason=value.reason.slice(0,240);
  if(value.reasonType!==undefined){if(!['extension-unavailable','manual-access'].includes(value.reasonType))return null;record.reasonType=value.reasonType;}
  record.expired=Date.parse(record.createdAt)>now+60000||now-Date.parse(record.updatedAt)>MAX_AGE_MS;
  return record;
}

// Only this allowlisted metadata is ever serialized. Profile values, answers and PDF bytes stay in memory.
export function createPreparationRecovery({storage=globalThis.localStorage,now=()=>Date.now(),uuid=()=>crypto.randomUUID(),locks=globalThis.navigator?.locks,key=PREPARATION_STORAGE_KEY}={}){
  const read=()=>{let raw;try{raw=storage.getItem(key);}catch{return null;}if(!raw)return null;try{return safeRecord(JSON.parse(raw),now());}catch{return null;}};
  const write=value=>{const record=safeRecord(value,now());if(!record)throw Error('Invalid preparation metadata.');const {expired,...persisted}=record;storage.setItem(key,JSON.stringify(persisted));return record;};
  const load=()=>read();
  const start=({jobId,jobUrl})=>{
    const existing=read();if(existing&&!existing.expired&&existing.state!=='opened')throw Error('A preparation is already saved. Resume or clear it before starting again.');
    const timestamp=new Date(now()).toISOString();
    return write({version:1,preparationId:uuid(),jobId:String(jobId||''),jobUrl,createdAt:timestamp,updatedAt:timestamp,state:'generating',extensionRequestId:uuid()});
  };
  const update=(preparationId,changes={})=>{
    const current=read();if(!current||current.preparationId!==preparationId)throw Error('Preparation metadata is unavailable. Start again explicitly.');
    if(current.expired)throw Error('Preparation metadata expired. Review the job and start again explicitly.');
    if(Object.keys(changes).some(field=>!['jobId','jobUrl','runId','state','documents','lastStage','reason','reasonType'].includes(field)))throw Error('Invalid preparation metadata update.');
    if(changes.documents&&current.documents)for(const kind of ['resume','coverLetter'])if(current.documents[kind]&&changes.documents[kind]?.documentSha256!==current.documents[kind].documentSha256)throw Error('The saved document hash changed. Review it before starting again.');
    const {expired,...persisted}=current;
    return write({...persisted,...changes,updatedAt:new Date(now()).toISOString()});
  };
  const clear=preparationId=>{const current=read();if(current?.preparationId===preparationId)storage.removeItem(key);};
  const leaseKey=preparationId=>key+'.lease.'+preparationId;
  async function withLease(preparationId,action,{leaseMs=30000}={}){
    const current=read();if(!current||current.preparationId!==preparationId||current.expired)throw Error('Preparation metadata expired or changed. Review and start again explicitly.');
    const name=leaseKey(preparationId);
    const run=async()=>{
    const owner=uuid();let old;
    try{old=JSON.parse(storage.getItem(name)||'null');}catch{}
    if(old?.expiresAt>now())throw Error('This preparation is already active in another Raven tab.');
    const renew=()=>{storage.setItem(name,JSON.stringify({owner,jobId:current.jobId,expiresAt:now()+leaseMs}));};
    renew();if(JSON.parse(storage.getItem(name)||'null')?.owner!==owner)throw Error('This preparation is already active in another Raven tab.');
    const heartbeat=setInterval(()=>{try{renew();}catch{}},Math.max(1000,Math.floor(leaseMs/3)));
    try{return await action();}finally{clearInterval(heartbeat);try{if(JSON.parse(storage.getItem(name)||'null')?.owner===owner)storage.removeItem(name);}catch{}}
    };
    if(typeof locks?.request==='function')return locks.request(name,{ifAvailable:true},lock=>{if(!lock)throw Error('This preparation is already active in another Raven tab.');return run();});
    return run();
  }
  return {load,start,update,clear,withLease};
}

// One tab-local renewal, only before packet delivery. Never persist profile/PDF data.
export function createExtensionReconnect({storage=globalThis.sessionStorage,now=()=>Date.now(),key='raven.extension-reconnect.v1'}={}){
  const read=()=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const identity=intent=>intent&&!intent.expired&&intent.state==='documents-ready'&&uuidPattern.test(intent.preparationId||'')&&uuidPattern.test(intent.extensionRequestId||'')&&
    shaPattern.test(intent.documents?.resume?.documentSha256||'')&&shaPattern.test(intent.documents?.coverLetter?.documentSha256||'')
    ? {preparationId:intent.preparationId,extensionRequestId:intent.extensionRequestId,jobId:intent.jobId,jobUrl:intent.jobUrl,resume:intent.documents.resume.documentSha256,coverLetter:intent.documents.coverLetter.documentSha256}:null;
  const matches=(a,b)=>a&&b&&Object.keys(b).every(field=>a[field]===b[field]);
  return {
    arm(intent,error){
      const value=identity(intent),old=read();
      if(error?.code!=='PREPARATION_EXTENSION_UNAVAILABLE'||error.reconnectBeforeDelivery!==true||!value||old?.preparationId===value.preparationId)return false;
      try{storage.setItem(key,JSON.stringify({...value,createdAt:now(),pending:true}));return true;}catch{return false;}
    },
    take(intent){
      const saved=read();if(!saved?.pending)return null;
      // Consume before any network work; a failed resume cannot cause a reload loop.
      try{storage.setItem(key,JSON.stringify({...saved,pending:false}));}catch{return null;}
      if(!Number.isFinite(saved.createdAt)||now()-saved.createdAt<0||now()-saved.createdAt>120000||!matches(saved,identity(intent)))return null;
      return {preparationId:saved.preparationId,jobId:saved.jobId};
    }
  };
}
