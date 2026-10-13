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
  if(await roles.getAttribute('aria-expanded')!=='true')await roles.click();
  await expect(page.getByRole('button',{name:'Unmark as applied'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Review',exact:true})).toHaveCount(2);
 }
});
async function auditFixture(page,jobs,discoveries){
 await page.route('**/functions/v1/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().postData();
  const action=url.searchParams.get('action')||(body?JSON.parse(body).action:'');
  if(action==='jobs')return route.fulfill({json:{ok:true,jobs}});
  if(action==='listResults'||action==='search')return route.fulfill({json:{ok:true,results:discoveries.filter(j=>j.track===url.searchParams.get('track'))}});
  return route.fulfill({json:{ok:true,events:[],snapshots:[],results:[],tasks:[],runs:[],counts:{},analytics:{}}});
 });
 await page.goto('/');await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
}
test('Eleventh Hour applied copies retain the original employer record and both document links',async({page})=>{
 const original={id:'ehg-primary',track:'Games / 3D',title:'Senior Environment Artist',company:'Eleventh Hour Games',location:'Remote',remote:true,status:'Applied',applied_date:'2026-10-07T12:00:00Z',resume:'https://example.com/resume.pdf',cover_letter:'https://example.com/cover.pdf',source:'Greenhouse',url:'https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002',notes:'Verified employer summary'};
 const mirror={...original,id:'ehg-linkedin',remote:false,location:'',source:'LinkedIn',url:'https://www.linkedin.com/jobs/view/senior-environment-artist-at-eleventh-hour-games-4399058671',notes:'Longer verified role text '.repeat(100)};
 await auditFixture(page,[mirror,original],[]);
 await page.getByRole('tab',{name:'Games / 3D',exact:true}).click();
 const card=page.getByRole('button',{name:/Applied Senior Environment Artist Eleventh Hour Games/});
 await expect(card).toHaveCount(1);await card.click();
 await expect(page.getByRole('link',{name:'View listing',exact:true})).toHaveAttribute('href',original.url);
 await expect(page.getByRole('button',{name:'Review',exact:true})).toHaveCount(2);
});
test('saved vacancy assigned to Wildcard is not rediscovered as a new Professional job',async({page})=>{
 const saved={id:'canonical-training',track:'Wildcard',title:'Training Manager',company:'Audit Studio',remote:true,location:'Remote',status:'Saved',url:'https://example.com/jobs/training-manager',source:'Jobicy',notes:'Verified training and onboarding role',resume:'https://example.com/training-resume.pdf'};
 const discovery={...saved,id:'discovery-training',track:'Professional',status:'Discovered',resume:'',snippet:saved.notes};
 await auditFixture(page,[saved],[discovery]);
 await page.getByRole('tab',{name:'Professional',exact:true}).click();
 await expect(page.getByRole('button',{name:/Training Manager Audit Studio/})).toHaveCount(0);
 await page.getByRole('tab',{name:'Wildcard',exact:true}).click();
 await expect(page.getByRole('button',{name:/Training Manager Audit Studio/})).toHaveCount(1);
});
