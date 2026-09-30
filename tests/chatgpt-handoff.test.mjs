import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('  async function launchChatGptPrompt('),source.indexOf('  function parseChatGptPayload('));
async function run({blocked=false,copied=true,fail=false}={}){
 const prompt='Resume & cover\nARK: Survival Evolved + DLCs\n'+ 'Verified source text — '.repeat(1500);
 const result={};
 const tab={closed:false,document:{title:'',body:{}},location:{replace:url=>{result.url=url;}},close:()=>{result.closed=true;}};
 const context={window:{open:()=>blocked?null:tab,prompt:(_,value)=>{result.fallback=value;}},requestChatGptPrompt:async()=>{if(fail)throw new Error('service failed');return prompt;},copyTextToClipboard:async value=>{result.clipboard=value;return copied;},setGenerationButton:(_,active)=>{result.busy=active;},setStatus:value=>{result.status=value;},encodeURIComponent};
 vm.createContext(context);
 await vm.runInContext(handler+'\nlaunchChatGptPrompt({},"resume")',context);
 return {...result,prompt};
}
test('handoff carries the entire encoded prompt and retains clipboard backup',async()=>{
 const result=await run();
 assert.equal(new URL(result.url).searchParams.get('q'),result.prompt);
 assert.equal(result.clipboard,result.prompt);
 assert.equal(result.busy,false);
});
test('clipboard denial still opens ChatGPT with prompt and offers fallback',async()=>{
 const result=await run({copied:false});
 assert.equal(new URL(result.url).searchParams.get('q'),result.prompt);
 assert.equal(result.fallback,result.prompt);
});
test('blocked popup reports the block and keeps copied prompt',async()=>{
 const result=await run({blocked:true});
 assert.equal(result.url,undefined);
 assert.match(result.status,/pop-up blocked/);
 assert.equal(result.clipboard,result.prompt);
});
test('prompt request failure closes the placeholder and clears busy state',async()=>{
 const result=await run({fail:true});
 assert.equal(result.closed,true);
 assert.equal(result.busy,false);
 assert.match(result.status,/service failed/);
});
