import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const packet={version:2,mode:'prepare',createdAt:new Date().toISOString(),jobId:'JT-required',jobUrl:'https://example.test/apply',title:'Artist',company:'Acme',profile:{firstName:'Ari',email:'ari@example.test'},answers:{},resume:'data:application/pdf;base64,JVBERi0xLjQK',coverLetter:'data:application/pdf;base64,JVBERi0xLjQK'};

test('required choices are checked per control or form and absent upload fields are explained',async({page})=>{
 await page.addInitScript(value=>{
  const messages=[],listeners=[];window.__ravenMessages=messages;
  window.__ravenDeliver=message=>{let accepted=false;for(const listener of listeners)listener(message,{},response=>{accepted=Boolean(response?.accepted);});return accepted;};
  Object.defineProperty(window,'chrome',{configurable:true,value:{runtime:{lastError:null,onMessage:{addListener(listener){listeners.push(listener);}},sendMessage(message,callback){messages.push(message);callback?.(message.type==='raven-preflight-context'?{title:value.title,company:value.company}:{});}}}});
 },packet);
 await page.route('https://example.test/apply',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>
  <h1>Artist</h1><p>Acme</p>
  <form id="first"><label for="first-name">First name</label><input id="first-name" type="text"><label for="email">Email</label><input id="email" type="email">
    <label for="agree-a">Accept policy A</label><input id="agree-a" type="checkbox" name="policy" required checked>
    <label for="agree-b">Accept policy B</label><input id="agree-b" type="checkbox" name="policy" required>
    <fieldset><legend>Work mode</legend><label for="mode-a">Remote</label><input id="mode-a" type="radio" name="workmode" required></fieldset>
    <label for="unnamed-a">Choice A</label><input id="unnamed-a" type="radio" required checked>
    <label for="unnamed-b">Choice B</label><input id="unnamed-b" type="radio" required>
    <label for="hidden-text">Hidden answer</label><input id="hidden-text" type="text" required style="display:none">
    <label for="extra-file">Other document</label><input id="extra-file" type="file" required style="display:none">
  </form>
  <form id="second"><label for="mode-b">Office</label><input id="mode-b" type="radio" name="workmode" checked></form>
 </body></html>`}));
 await page.goto('https://example.test/apply');
 await page.addScriptTag({content:fs.readFileSync(new URL('../extension/src/assistant-core.js',import.meta.url),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(new URL('../extension/src/prepare-content.js',import.meta.url),'utf8')});
 await expect.poll(()=>page.evaluate(()=>window.__ravenMessages.find(message=>message.type==='raven-preflight-result')?.status)).toBe('ready');
 expect(await page.evaluate(value=>window.__ravenDeliver({type:'raven-prepare-deliver',packet:value,preflightId:'11111111-1111-4111-8111-111111111111',expectedUrl:location.href}),packet)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__ravenMessages.find(message=>message.type==='raven-prepare-result')?.result)).toBeTruthy();
 const result=await page.evaluate(()=>window.__ravenMessages.find(message=>message.type==='raven-prepare-result').result);
 expect(result.requiredUnanswered).toContain('Accept policy B');
 expect(result.requiredUnanswered).not.toContain('Accept policy A');
 expect(result.requiredUnanswered).toContain('Work mode');
 expect(result.requiredUnanswered).toContain('Choice B');
 expect(result.requiredUnanswered).not.toContain('Choice A');
 expect(result.requiredUnanswered).toContain('Other document');
 expect(result.requiredUnanswered).not.toContain('Hidden answer');
 await expect(page.locator('#raven-assistant-banner')).toContainText('No upload field for: resume, cover letter.');
 await expect(page.locator('#raven-assistant-banner')).not.toContainText('linkedin');
});
