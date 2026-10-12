import { test, expect } from '@playwright/test';
const endpoint='**/functions/v1/raven-studio-scan';
const studios=[
 {studio_name:'Example Studio',provider:'workable',careers_url:'https://apply.workable.com/example',last_status:'pending',enabled:true,next_check_at:'2026-10-12T18:00:00Z',last_job_count:0},
 {studio_name:'Checked Studio',provider:'smartrecruiters',careers_url:'https://careers.smartrecruiters.com/checked',last_status:'ok',last_success_at:'2026-10-12T12:00:00Z',last_job_count:0},
 {studio_name:'Failed Studio',provider:'greenhouse',enabled:false,last_status:'failed',last_checked_at:'2026-10-12T12:00:00Z',last_success_at:'2026-10-11T12:00:00Z',last_job_count:0},
 {studio_name:'Unverified Studio',provider:'pending',last_status:'pending',careers_url:'javascript:alert(1)'},
];
async function fixture(page){await page.route(endpoint,r=>r.fulfill({json:{studios}}));await page.goto('/studio-directory.html');await expect(page.locator('.card')).toHaveCount(4);}
test('search and provider/status filters distinguish pending, failed and successful zero roles',async({page})=>{
 await fixture(page);
 await expect(page.locator('#connected')).toHaveText('3');
 await expect(page.locator('#checked')).toHaveText('1');
 const pending=page.locator('.card').filter({hasText:'Example Studio'});
 await expect(pending).toContainText('Configured — awaiting first successful check');
 await expect(pending).not.toContainText('Eligible art roles');
 await expect(pending).toContainText('Next scheduled check');
 await expect(page.locator('.card').filter({hasText:'Failed Studio'})).toContainText('Scheduled checks paused');
 await expect(page.locator('.card').filter({hasText:'Checked Studio'})).toContainText('Eligible art roles in last check: 0');
 await expect(page.locator('.card').filter({hasText:'Failed Studio'})).toContainText('Previous successful check');
 await expect(page.locator('.card').filter({hasText:'Unverified Studio'}).locator('a')).toHaveCount(0);
 await page.locator('#search').fill('apply.workable.com');await expect(page.locator('.card')).toHaveCount(1);
 await page.getByRole('button',{name:'Clear filters'}).click();
 await page.locator('#provider').selectOption('smartrecruiters');await expect(page.locator('.card')).toHaveCount(1);
 await expect(page.locator('.card')).toContainText('SmartRecruiters');
 await page.getByRole('button',{name:'Clear filters'}).click();await page.locator('#filter').selectOption('pending');await expect(page.locator('.card')).toHaveCount(2);
 await page.locator('#search').fill('missing studio');await expect(page.locator('.empty')).toContainText('No studios match');
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('.card')).toHaveCount(4);
});
test('failed endpoint remains unavailable and retry recovers without duplicate provider options',async({page})=>{
 let requests=0;
 await page.route(endpoint,r=>++requests===1?r.fulfill({status:503,body:'unavailable'}):r.fulfill({json:{studios}}));
 await page.goto('/studio-directory.html');await expect(page.getByRole('status')).toContainText('Directory temporarily unavailable');
 await expect(page.locator('#total')).toHaveText('—');
 await page.getByRole('button',{name:'Retry loading directory'}).click();await expect(page.locator('.card')).toHaveCount(4);
 await expect(page.locator('#retry')).toBeHidden();await expect(page.locator('#provider option')).toHaveCount(5);
});
test('malformed response offers retry and does not report an empty successful directory',async({page})=>{
 await page.route(endpoint,r=>r.fulfill({json:{error:'unexpected'}}));await page.goto('/studio-directory.html');
 await expect(page.getByRole('status')).toContainText('Unexpected response');await expect(page.locator('#total')).toHaveText('—');await expect(page.locator('#retry')).toBeVisible();
});
test('mobile cards and filters stay within viewport with long studio names',async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.route(endpoint,r=>r.fulfill({json:{studios:[{...studios[0],studio_name:'VeryLongStudioNameWithoutAnySpaces'.repeat(4)}]}}));await page.goto('/studio-directory.html');await expect(page.locator('.card')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('health warnings distinguish first and repeated source failures and incomplete descriptions',async({page})=>{
 const sources=[
  {...studios[0],studio_name:'Pending clean',health_status:'pending',consecutive_failures:0,detail_health_status:'not_checked'},
  {...studios[2],studio_name:'First failure',health_status:'degraded',consecutive_failures:1},
  {...studios[2],studio_name:'Broken source',health_status:'broken',consecutive_failures:3},
  {...studios[1],studio_name:'Partial descriptions',detail_health_status:'partial',detail_error:'Two posting requests timed out.',last_job_count:2},
  {...studios[1],studio_name:'Scoped board',provider:'bamboohr',health_status:'healthy',detail_health_status:'complete',job_scope:{field:'department',values:['Studio Wildcard']}},
 ];
 await page.route(endpoint,r=>r.fulfill({json:{studios:sources}}));await page.goto('/studio-directory.html');
 await expect(page.locator('#health-summary')).toContainText('3 sources need attention');
 await expect(page.locator('#health-summary')).toContainText('2 sources have failed checks; 1 source has incomplete job descriptions');
 await expect(page.locator('.card').filter({hasText:'First failure'})).toContainText('First failed check');
 await expect(page.locator('.card').filter({hasText:'Broken source'})).toContainText('Repeated source failures: 3');
 await expect(page.locator('.card').filter({hasText:'Broken source'})).not.toContainText('Eligible art roles');
 await expect(page.locator('.card').filter({hasText:'Pending clean'})).not.toContainText('failed');
 await expect(page.locator('.card').filter({hasText:'Partial descriptions'})).toContainText('2 (job list checked; descriptions incomplete)');
 await expect(page.locator('.card').filter({hasText:'Partial descriptions'})).toContainText('Two posting requests timed out.');
 await expect(page.locator('.card').filter({hasText:'Scoped board'})).toContainText('Provider: BambooHR');
 await expect(page.locator('.card').filter({hasText:'Scoped board'})).toContainText('Shared hiring board — studio scope (department): Studio Wildcard');
 await page.locator('#filter').selectOption('attention');await expect(page.locator('.card')).toHaveCount(3);
 await page.locator('#filter').selectOption('failed');await expect(page.locator('.card')).toHaveCount(2);
});
test('successful retry state clears source and description warnings',async({page})=>{
 let healthy=false;
 await page.route(endpoint,r=>r.fulfill({json:{studios:[healthy?{...studios[1],health_status:'healthy',consecutive_failures:0,detail_health_status:'complete',detail_error:null}:{...studios[2],health_status:'failing',consecutive_failures:2,detail_health_status:'failed',detail_error:'Description fetch failed'}]}}));
 await page.goto('/studio-directory.html');await expect(page.locator('#health-summary')).toBeVisible();
 await expect(page.locator('.card')).toContainText('Repeated source failures: 2');
 healthy=true;await page.reload();await expect(page.locator('#checked')).toHaveText('1');
 await expect(page.locator('#health-summary')).toBeHidden();await expect(page.locator('.card')).not.toContainText('incomplete');
 await page.locator('#filter').selectOption('attention');await expect(page.locator('.card')).toHaveCount(0);
});
test('pending and healthy zero-match sources do not show automatic warnings',async({page})=>{
 await page.route(endpoint,r=>r.fulfill({json:{studios:[{...studios[0],health_status:'pending',consecutive_failures:0,detail_health_status:'not_checked'},{...studios[1],health_status:'healthy',consecutive_failures:0,detail_health_status:'not_needed'}]}}));
 await page.goto('/studio-directory.html');await expect(page.locator('.card')).toHaveCount(2);
 await expect(page.locator('#health-summary')).toBeHidden();
 await expect(page.locator('.card').filter({hasText:'Example Studio'})).not.toContainText('Eligible art roles');
 await expect(page.locator('.card').filter({hasText:'Checked Studio'})).toContainText('Eligible art roles in last check: 0');
 await page.locator('#filter').selectOption('attention');await expect(page.locator('.card')).toHaveCount(0);
});

test('unsupported and blocked verification notes do not imply broken source checks',async({page})=>{
 await page.route(endpoint,r=>r.fulfill({json:{studios:[
  {...studios[3],studio_name:'Unsupported source',verification_status:'unsupported',verification_note:'Official careers site uses a hiring system awaiting an adapter.',health_status:'pending',consecutive_failures:0},
  {...studios[3],studio_name:'Blocked verification',verification_status:'blocked',verification_note:'Official careers page was unavailable during verification.',health_status:'pending',consecutive_failures:0},
 ]}}));await page.goto('/studio-directory.html');
 await expect(page.locator('.card')).toHaveCount(2);
 await expect(page.locator('.card').filter({hasText:'Unsupported source'})).toContainText('Hiring system not yet supported — Official careers site uses a hiring system awaiting an adapter.');
 await expect(page.locator('.card').filter({hasText:'Blocked verification'})).toContainText('Official source verification blocked — Official careers page was unavailable during verification.');
 await expect(page.locator('#health-summary')).toBeHidden();
 await page.locator('#filter').selectOption('attention');await expect(page.locator('.card')).toHaveCount(0);
 await page.locator('#filter').selectOption('pending');await expect(page.locator('.card')).toHaveCount(2);
});
