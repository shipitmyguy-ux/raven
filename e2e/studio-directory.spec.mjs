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
