import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const id='12345678-1234-4234-8234-123456789abc';
async function background({sender='https://shipitmyguy-ux.github.io/raven/',url='https://files.oaiusercontent.com/file',payloadId=id}={}){
 const messages=[],storage={},downloads=[];let changed,fetches=0;
 const context={URL,console,fetch:async()=>{fetches++;return {ok:true,text:async()=>JSON.stringify({raven_format:'raven-chatgpt-v1',request_id:payloadId,resume:{}})};},chrome:{
  runtime:{onInstalled:{addListener(){}},onMessage:{addListener:fn=>messages.push(fn)}},
  contextMenus:{onClicked:{addListener(){}}},tabs:{query(){}},
  storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,storage[key]])),set:async value=>Object.assign(storage,value)}},
  downloads:{onChanged:{addListener:fn=>changed=fn},search:async()=>downloads}
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../extension/src/background.js',import.meta.url),'utf8'),context);
 messages.forEach(fn=>fn({type:'raven-chatgpt-request',requestId:id},{tab:{url:sender}}));await vm.runInContext('transferQueue',context);
 downloads.push({filename:'C:/Downloads/raven-'+id+'.json',finalUrl:url,fileSize:100});
 changed({id:1,state:{current:'complete'}});await vm.runInContext('transferQueue',context);
 return {storage,fetches};
}
test('extension queues matching ChatGPT download until acknowledged',async()=>{
 const result=await background();assert.equal(result.fetches,1);assert.equal(JSON.parse(result.storage.ravenChatGptResults[id]).request_id,id);
});
test('untrusted pages cannot register import requests',async()=>{
 const result=await background({sender:'https://evil.example/raven/'});assert.equal(result.fetches,0);assert.equal(result.storage.ravenChatGptResults,undefined);
});
test('extension never fetches a downloaded arbitrary origin',async()=>{
 const result=await background({url:'https://evil.example/file'});assert.equal(result.fetches,0);
});
test('attachment with wrong payload identity is not queued',async()=>{
 const result=await background({payloadId:'other'});assert.equal(result.storage.ravenChatGptResults[id],undefined);assert.match(result.storage.ravenChatGptError,/identity/);
});
