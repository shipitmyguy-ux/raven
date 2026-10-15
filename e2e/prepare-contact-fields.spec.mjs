import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const packet={version:2,mode:'prepare',createdAt:new Date().toISOString(),jobId:'JT-contact',jobUrl:'https://job-boards.greenhouse.io/studio/jobs/123',title:'Artist',company:'Studio',profile:{country:'USA',city:'Example City',region:'Sample State',phone:'+12025550123'},answers:{'are you authorized to work':'Yes','will you require sponsorship':'No','salary requirements':'120000'}};
for(const mode of ['accepted','reset-on-open','nex-controlled','ambiguous','missing','prefilled'])test(`Greenhouse contact selects committed location only: ${mode}`,async({page})=>{
 await page.addInitScript(packet=>{
  window.messages=[];let listener;
  window.deliver=()=>listener({type:'raven-prepare-deliver',packet,preflightId:'11111111-1111-4111-8111-111111111111',expectedUrl:location.href},{},()=>{});
  window.chrome={runtime:{onMessage:{addListener(fn){listener=fn;}},sendMessage(message,callback){window.messages.push(message);callback?.(message.type==='raven-preflight-context'?{title:packet.title,company:packet.company}:{});}}};
 },packet);
 await page.route('https://job-boards.greenhouse.io/**',route=>route.fulfill({contentType:'text/html',body:`<h1>Artist</h1><p>Studio</p><form onsubmit="window.submitted=true;event.preventDefault()">
 ${['country','candidate-location'].map((id,i)=>`<div class="select__control"><label for="${id}">${i?'Location (City)':'Country'}</label><span class="select__single-value"></span><input id="${id}" role="combobox" aria-expanded="false" required></div>`).join('')}
 <label for="phone">Phone</label><input id="phone" type="tel" required>
 <label for="authorized">Are you authorized to work?</label><input id="authorized" required>
 <label for="sponsor">Will you require sponsorship?</label><input id="sponsor" required>
 <label for="salary">Salary requirements</label><input id="salary" required><button type="submit">Submit</button></form>`}));
 await page.goto(packet.jobUrl);
 await page.evaluate(mode=>{
  window.selections=[];
  for(const input of document.querySelectorAll('[role="combobox"]')){
   if(mode==='prefilled'){input.parentElement.querySelector('span').textContent=input.id==='country'?'Canada +1':'Other City';continue;}
   const open=()=>{
    input.setAttribute('aria-expanded','true');
    setTimeout(()=>{
     if(!input.value)return;
     document.getElementById(input.id+'-list')?.remove();
     const list=document.createElement('div');list.id=input.id+'-list';list.setAttribute('role','listbox');input.setAttribute('aria-controls',list.id);
     const labels=input.id==='country'?['United States +1','United States Minor Outlying Islands +1']:mode==='missing'?['Different City, Sample State, United States']:['Example City, Sample State, United States',...(mode==='ambiguous'?['Example City, Sample State, USA']:[])];
     for(const label of labels){const option=document.createElement('div');option.setAttribute('role','option');option.textContent=label;option.addEventListener('click',()=>{window.selections.push(input.id);input.value='';input.setAttribute('aria-expanded','false');list.remove();const commit=()=>{input.parentElement.querySelector('span').innerHTML=input.id==='country'&&['reset-on-open','nex-controlled'].includes(mode)?'<i class="iti__us"></i>+1':label;};mode==='nex-controlled'&&input.id==='candidate-location'?setTimeout(commit,600):commit();});list.append(option);}
     input.parentElement.append(list);
    },150);
   };
   // Nex explicitly controls menuIsOpen via Control.onMouseUp. Input alone cannot open it.
   input.addEventListener('input',()=>{if(!['reset-on-open','nex-controlled'].includes(mode)||input.getAttribute('aria-expanded')==='true')open();});
   input.addEventListener('mousedown',()=>{if(mode==='nex-controlled')return;if(mode==='reset-on-open')input.value='';open();});
   input.addEventListener('mouseup',()=>{if(mode==='nex-controlled')open();});
   input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.setAttribute('aria-expanded','false');document.getElementById(input.id+'-list')?.remove();}});
  }
 },mode);
 await page.addScriptTag({content:fs.readFileSync(new URL('../extension/src/assistant-core.js',import.meta.url),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(new URL('../extension/src/prepare-content.js',import.meta.url),'utf8')});
 await page.evaluate(()=>window.deliver());
 await expect.poll(()=>page.evaluate(()=>window.messages.find(x=>x.type==='raven-prepare-result')?.result),{timeout:18000}).toBeTruthy();
 const result=await page.evaluate(()=>window.messages.find(x=>x.type==='raven-prepare-result').result);
 await expect(page.locator('#phone')).toHaveValue(packet.profile.phone);
 for(const id of ['authorized','sponsor','salary'])await expect(page.locator('#'+id)).toHaveValue('');
 expect(await page.evaluate(()=>Boolean(window.submitted))).toBe(false);
 if(['accepted','reset-on-open','nex-controlled'].includes(mode)){
  expect(result.filled).toEqual(expect.arrayContaining(['country','city','phone']));
  expect(result.requiredUnanswered).not.toContain('Country');expect(result.requiredUnanswered).not.toContain('Location (City)');
 }else if(mode==='prefilled'){
  expect(await page.evaluate(()=>window.selections)).toEqual([]);expect(result.filled).not.toContain('country');expect(result.filled).not.toContain('city');
 }else{
  expect(result.filled).not.toContain('city');expect(result.requiredUnanswered).toContain('Location (City)');await expect(page.locator('#candidate-location')).toHaveValue('');
 }
});
