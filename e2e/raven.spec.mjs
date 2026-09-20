import { test, expect } from "@playwright/test";

const savedJob={id:"job-1",track:"Professional",title:"Implementation Project Manager",company:"Acme Health",location:"Remote",remote:true,salary_text:"$90,000",url:"https://example.com/job/1?utm_source=test",source:"Mock",status:"Saved",notes:"Lead implementation projects, coordinate internal teams, manage schedules and stakeholder communication.",added:new Date().toISOString(),resume:"",cover_letter:""};
const generatedResume={name:"Test Candidate",headline:"Project & Implementation Leader",contact:"candidate@example.com",summary:"Experienced delivery leader.",skills:["Project delivery","Team leadership"],experience:[{role:"Environment Artist",company:"Example Studio",dates:"2020–2025",bullets:["Led delivery across internal teams."]}],education:[{degree:"Bachelor's Degree",school:"Example University",location:"",dates:""}],additional:[]};
const generatedLetter={greeting:"Dear Hiring Manager,",paragraphs:["I am applying for the Implementation Project Manager role.","My background includes project delivery and internal team leadership."],closing:"Sincerely,",signature:"Test Candidate"};

async function mockRaven(page,{generatorFails=false}={}){
  let job={...savedJob};
  let generationCalls=0;
  await page.route("**/functions/v1/raven-data-v1**",async route=>{
    const req=route.request();
    if(req.method()==="GET") return route.fulfill({json:{ok:true,jobs:[job]}});
    const body=JSON.parse(req.postData()||"{}");
    if(body.action==="updateJob"){job={...job,...body};delete job.action;return route.fulfill({json:{ok:true,job}});}
    if(body.action==="addJob") return route.fulfill({json:{ok:true,job:{...body,id:"job-added"}}});
    return route.fulfill({json:{ok:true}});
  });
  await page.route("**/functions/v1/raven-backend-v3**",route=>route.fulfill({json:{ok:true,jobs:[],results:[]}}));
  await page.route("**/functions/v1/raven-enrich-v1**",route=>route.fulfill({json:{ok:true,description:savedJob.notes}}));
  await page.route("**/functions/v1/raven-commute-v1**",route=>route.fulfill({json:{ok:true,minutes:0}}));
  await page.route("**/functions/v1/raven-generate-v1**",async route=>{
    generationCalls++;
    if(generatorFails) return route.fulfill({status:503,json:{ok:false,error:"Mock generator unavailable"}});
    const body=JSON.parse(route.request().postData()||"{}");
    if(body.documentType==="coverLetter") return route.fulfill({json:{ok:true,coverLetter:generatedLetter}});
    return route.fulfill({json:{ok:true,resume:generatedResume}});
  });
  return {getJob:()=>job,getGenerationCalls:()=>generationCalls};
}

test("loads mocked jobs and all tracks without page errors",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));await mockRaven(page);await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator(".job-title").filter({ hasText: "Implementation Project Manager" })).toBeVisible();
  for(const track of ["Games / 3D","Professional","Labor","Wildcard"]){const tab=page.locator('[data-track="'+track+'"]');await expect(tab).toBeVisible();await tab.click();}
  expect(errors).toEqual([]);
});

test("bookmark and applied status persist through reload",async({page})=>{
  const api=await mockRaven(page);await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.getByRole("button",{name:"Bookmark job"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Interested");
  await page.reload();await page.locator('[data-track="Professional"]').click();await expect(page.getByRole("button",{name:"Remove bookmark"})).toBeVisible();
  await page.locator(".job-card-summary").first().click();
  await page.getByRole("button",{name:"Mark as applied"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Applied");
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.getByRole("button",{name:"Unmark as applied"})).toBeVisible();
});

test("generator API can be fully mocked without spending model tokens",async({page})=>{
  const api=await mockRaven(page);await page.goto("/");
  const response=await page.evaluate(async()=>{const r=await fetch(window.RAVEN_CONFIG.generateApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentType:"resume"})});return r.json();});
  expect(response.resume.name).toBe("Test Candidate");expect(api.getGenerationCalls()).toBe(1);
});

test("generator failure is deterministic and does not hit production",async({page})=>{
  await mockRaven(page,{generatorFails:true});await page.goto("/");
  const result=await page.evaluate(async()=>{const r=await fetch(window.RAVEN_CONFIG.generateApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});return {status:r.status,body:await r.json()};});
  expect(result.status).toBe(503);expect(result.body.error).toContain("Mock generator unavailable");
});

test("document review and master resume controls remain present",async({page})=>{
  await mockRaven(page);await page.goto("/");
  await expect(page.locator("#documentReviewDialog")).toBeAttached();
  await page.locator("#optionsButton").click();await expect(page.locator("#optionsDialog")).toBeVisible();
  await expect(page.locator("#addMasterResumeButton")).toBeAttached();await expect(page.locator("#masterResumeList")).toBeAttached();
});


test("application requires approval of both exact documents",async({page})=>{
  await mockRaven(page);await page.goto("/");
  await page.evaluate(()=>{
    const profile={firstName:"Test",lastName:"Candidate",email:"candidate@example.com"};
    localStorage.setItem("ravenApplicationProfileV1",JSON.stringify(profile));
    localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({}));
  });
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Approve docs");
  await page.evaluate(()=>{
    const jobs=JSON.parse(localStorage.getItem("ravenJobsCacheV1")||"[]"); const job=jobs.find(x=>x.id==="job-1");
    if(job){job.resume="data:text/html,resume";job.coverLetter="data:text/html,letter";localStorage.setItem("ravenJobsCacheV1",JSON.stringify(jobs));
      localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({"job-1|resume":{value:job.resume},"job-1|coverLetter":{value:job.coverLetter}}));}
  });
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Apply");
});

test("application profile controls are available",async({page})=>{
  await mockRaven(page);await page.goto("/");await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="application-profile"]').click();
  await expect(page.locator('[data-profile-key="firstName"]')).toBeVisible();
  await expect(page.locator("#saveApplicationProfile")).toBeVisible();
});
