import {test,expect} from '@playwright/test';
import fs from 'node:fs';
// Reuse the immutable public posting snapshot from the Node integration test.
// This extracts data only; it does not execute its tests.
const fixtureSource=fs.readFileSync(new URL('../tests/studio-to-resume.test.mjs',import.meta.url),'utf8');
const fixture=JSON.parse(fixtureSource.match(/const posting=(.+);\nconst source=/)[1]);
import {normalizeStudioJobs} from '../supabase/functions/_shared/studio-providers.mjs';
const [publicRow]=normalizeStudioJobs({studio_name:'People Can Fly',provider:'smartrecruiters',board_key:'PeopleCanFly'},{content:[fixture]});
const discovered={...publicRow,id:'pcf-fixture',track:'Games / 3D',source:'Studio:smartrecruiters',last_seen:new Date().toISOString()};

test('studio discovery displays complete public description and sends it to prompt-only endpoint',async({page})=>{
 let adopted=null;const requests=[];
 await page.addInitScript(()=>{
  localStorage.clear();
  localStorage.setItem('ravenMasterResumesV1',JSON.stringify([{id:'fixture-master',name:'Fixture master',sourceType:'drive',url:'https://drive.google.com/file/d/fixture/view',tracks:['Games / 3D']}]));
 });
 await page.route('**/functions/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const body=req.method()==='POST'?JSON.parse(req.postData()||'{}'):{};
  const action=body.action||url.searchParams.get('action');
  if(url.pathname.endsWith('/raven-backend-v3')){
   if(action==='jobs')return route.fulfill({json:{ok:true,jobs:adopted?[adopted]:[]}});
   if(action==='listResults')return route.fulfill({json:{ok:true,results:url.searchParams.get('track')==='Games / 3D'&&!adopted?[discovered]:[]}});
   if(action==='addJob'){adopted={...body,id:'fixture-saved-pcf'};return route.fulfill({json:{ok:true,...adopted}});}
   return route.fulfill({json:{ok:true,jobs:[],results:[],events:[],snapshots:[]}});
  }
  if(url.pathname.endsWith('/raven-generate-v1')){
   requests.push(body);expect(body.promptOnly).toBe(true);
   return route.fulfill({json:{prompt:'Fixture prompt\n'+body.jobDescription}});
  }
  if(url.pathname.endsWith('/raven-enrich-v1'))throw Error('Unexpected refetch of full studio description');
  return route.fulfill({json:{ok:true}});
 });
 await page.goto('/');await page.locator('[data-track="Games / 3D"]').click();
 await expect(page.locator('.job-card-summary').filter({hasText:fixture.name})).toBeVisible();
 await page.locator('.job-card-summary').filter({hasText:fixture.name}).click();
 await page.locator('[data-description-toggle]').click();
 await expect(page.locator('[data-description-full]')).toContainText(discovered.snippet);
 await page.locator('[data-chatgpt-prompt="both"]').click();
 await expect.poll(()=>requests.length).toBe(1);
 expect(adopted.notes).toBe(discovered.snippet);
 expect(requests[0].jobDescription).toBe(discovered.snippet);
 expect(requests[0].jobId).toBe('fixture-saved-pcf');
 expect(requests[0].sourceUrl).toBe(discovered.url);
 expect(adopted.resume||'').toBe('');expect(adopted.cover_letter||'').toBe('');
 await page.reload();await page.locator('[data-track="Games / 3D"]').click();
 await page.locator('.job-card-summary').filter({hasText:fixture.name}).click();
 await page.locator('[data-description-toggle]').click();
 await expect(page.locator('[data-description-full]')).toContainText(discovered.snippet);
});
