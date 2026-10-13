import {test,expect} from '@playwright/test';
test('applied cross-board vacancy appears once after reload and keeps its documents',async({page})=>{
 const applied={id:'applied-smile',track:'Games / 3D',title:'Senior Environment Artist',company:'Smile-Break',location:'Remote',remote:true,url:'https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job',source:'Remote Game Jobs',status:'Applied',resume:'https://example.com/original-resume.pdf',cover_letter:'https://example.com/original-cover.pdf',applied_date:'2026-10-07T12:00:00Z',notes:'Verified saved summary'};
 const duplicate={...applied,id:'duplicate-smile',company:'Smile Break',source:'Studio:artstation',status:'Saved',resume:'',cover_letter:'',applied_date:null,url:'https://www.artstation.com/jobs/QKn9',location:'Asia; Europe; North America',notes:'Full current posting'};
 const discovered={...duplicate,id:'discovered',status:'Discovered',snippet:duplicate.notes,last_seen:new Date().toISOString()};
 await page.route('**/functions/v1/**',async route=>{
  const url=new URL(route.request().url());const body=route.request().postData();const action=url.searchParams.get('action')||(body?JSON.parse(body).action:'');
  if(action==='jobs')return route.fulfill({json:{ok:true,jobs:[duplicate,applied]}});
  if(action==='listResults'||action==='search')return route.fulfill({json:{ok:true,results:url.searchParams.get('track')==='Games / 3D'?[discovered]:[]}});
  return route.fulfill({json:{ok:true,events:[],snapshots:[],results:[],tasks:[],runs:[],counts:{},analytics:{}}});
 });
 for(let i=0;i<2;i++){
  if(i)await page.reload();else await page.goto('/');
  await page.getByRole('tab',{name:'Games / 3D',exact:true}).click();
  const roles=page.getByRole('button',{name:/Applied Senior Environment Artist Smile-Break/});
  await expect(roles).toHaveCount(1);
  await expect(page.getByRole('button',{name:/^Senior Environment Artist Smile Break/})).toHaveCount(0);
  await roles.click();
  await expect(page.getByRole('checkbox',{name:'Unmark as applied'})).toBeChecked();
  await expect(page.getByRole('button',{name:'Review',exact:true})).toHaveCount(2);
 }
});
