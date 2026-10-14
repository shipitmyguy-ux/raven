export function probePreparationExtension({documentRef=globalThis.document,timeoutMs=1200}={}){
  return new Promise((resolve,reject)=>{
    const bridge=documentRef?.getElementById('ravenExtensionBridge');
    if(!bridge){reject(Error('The Raven Chrome extension is required to prepare an application. Install or enable it, then refresh Raven.'));return;}
    let settled=false;
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-prepare-capability',onCapability);error?reject(error):resolve(true);};
    const onCapability=()=>{if(bridge.dataset.prepareCapability==='1')finish();};
    const timer=setTimeout(()=>finish(Error('The Raven Chrome extension is missing or out of date. Install or update it in Chrome, then refresh Raven.')),timeoutMs);
    delete bridge.dataset.prepareCapability;
    bridge.addEventListener('raven-prepare-capability',onCapability);
    bridge.dispatchEvent(new Event('raven-prepare-probe',{bubbles:true}));
  });
}

export function dispatchPreparedApplication(packet,{documentRef=globalThis.document,timeoutMs=120000}={}){
  const bridge=documentRef?.getElementById('ravenExtensionBridge');
  if(!bridge)throw Error('The Raven Chrome extension is required to prepare an application.');
  const requestId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);bridge.removeEventListener('raven-prepare-response',onResponse);error?reject(error):resolve(result);};
    const onResponse=()=>{
      const response=bridge.dataset.prepareResponse;
      if(!response)return;
      let value;try{value=JSON.parse(response);}catch{return;}
      if(value.requestId!==requestId)return;
      if(value.ok!==true){finish(Error(value.error||'Chrome could not open the application for preparation.'));return;}
      finish(null,value);
    };
    const timer=setTimeout(()=>finish(Error('Chrome did not confirm opening the application. Check Chrome and try again.')),timeoutMs);
    bridge.addEventListener('raven-prepare-response',onResponse);
    bridge.dataset.prepareRequest=JSON.stringify({requestId,packet});
    bridge.dispatchEvent(new Event('raven-prepare-application',{bubbles:true}));
  });
}
