import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dispatchPreparedApplication,probePreparationExtension} from '../application-prepare.mjs';

class Bridge extends EventTarget{
  dataset={};
  dispatchEvent(event){const sent=super.dispatchEvent(event);if(event.type==='raven-prepare-probe'){this.dataset.prepareCapability='1';super.dispatchEvent(new Event('raven-prepare-capability'));}if(event.type==='raven-prepare-application'){const {requestId}=JSON.parse(this.dataset.prepareRequest);this.dataset.prepareResponse=JSON.stringify({requestId,ok:true,tabId:42});super.dispatchEvent(new Event('raven-prepare-response'));}return sent;}
  removeEventListener(...args){return super.removeEventListener(...args);}
}
const documentFor=bridge=>({getElementById:id=>id==='ravenExtensionBridge'?bridge:null});

test('extension capability is probed before any preparation request',async()=>{
 const bridge=new Bridge();assert.equal(await probePreparationExtension({documentRef:documentFor(bridge)}),true);
});
test('missing extension capability fails clearly',async()=>{
 const bridge=new Bridge();bridge.dispatchEvent=EventTarget.prototype.dispatchEvent.bind(bridge);
 await assert.rejects(probePreparationExtension({documentRef:documentFor(bridge),timeoutMs:1}),/missing or out of date/);
});
test('prepared application dispatch waits for its matching extension response',async()=>{
 const bridge=new Bridge(),packet={version:2,mode:'prepare',jobId:'JT-test'};
 const response=await dispatchPreparedApplication(packet,{documentRef:documentFor(bridge)});
 assert.equal(response.ok,true);assert.equal(response.tabId,42);
 assert.deepEqual(JSON.parse(bridge.dataset.prepareRequest).packet,packet);
});
