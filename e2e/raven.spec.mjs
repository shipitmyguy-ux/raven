import { test, expect } from "@playwright/test";

const savedJob={id:"job-1",track:"Professional",title:"Implementation Project Manager",company:"Acme Health",location:"Remote",remote:true,salary_text:"$90,000",url:"https://example.com/job/1?utm_source=test",source:"Mock",status:"Saved",notes:"Lead implementation projects, coordinate internal teams, manage schedules and stakeholder communication.",added:new Date().toISOString(),resume:"",cover_letter:""};
const generatedResume={name:"Test Candidate",headline:"Project & Implementation Leader",contact:"candidate@example.com",summary:"Experienced delivery leader.",skills:["Project delivery","Team leadership"],experience:[{role:"Environment Artist",company:"Example Studio",dates:"2020–2025",bullets:["Led delivery across internal teams."]}],education:[{degree:"Bachelor's Degree",school:"Example University",location:"",dates:""}],additional:[]};
const generatedLetter={greeting:"Dear Hiring Manager,",paragraphs:["I am applying for the Implementation Project Manager role.","My background includes project delivery and internal team leadership."],closing:"Sincerely,",signature:"Test Candidate"};

async function mockRaven(page,{generatorFails=false,initialJob=null,dataDelayMs=0}={}){
  let job={...savedJob,...(initialJob||{})};
  let generationCalls=0;
  await page.route("**/functions/v1/raven-data-v1**",async route=>{
    const req=route.request();
    if(req.method()==="GET"){ if(dataDelayMs) await new Promise(resolve=>setTimeout(resolve,dataDelayMs)); return route.fulfill({json:{ok:true,jobs:[job]}}); }
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


test("local master resume and track assignments persist through reload",async({page})=>{
  await mockRaven(page);
  await page.goto("/");
  await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="master-resumes"]').click();
  await page.locator("#masterResumeQuickFile").setInputFiles({
    name:"persistent-master.txt",
    mimeType:"text/plain",
    buffer:Buffer.from("Persistent master resume text for Raven browser QA.")
  });
  await expect(page.locator("#masterResumeEditor")).toBeVisible();
  await page.locator('.master-resume-tracks input[value="Professional"]').check();
  await page.locator('.master-resume-tracks input[value="Games / 3D"]').check();
  await page.locator("#saveMasterResumeButton").click();

  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenMasterResumesV1")||"[]"));
  expect(before).toHaveLength(1);
  expect(before[0].tracks).toEqual(expect.arrayContaining(["Professional","Games / 3D"]));
  const masterId=before[0].id;

  await page.reload();
  const persisted=await page.evaluate(async(id)=>{
    const metadata=JSON.parse(localStorage.getItem("ravenMasterResumesV1")||"[]");
    const file=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("ravenMasterResumeFilesV1",1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction("files","readonly");
        const get=tx.objectStore("files").get(id);
        get.onsuccess=()=>{resolve(get.result||null);db.close();};
        get.onerror=()=>reject(get.error);
      };
    });
    return {metadata,fileName:file?.name||"",text:file?await file.text():""};
  },masterId);
  expect(persisted.metadata[0].tracks).toEqual(expect.arrayContaining(["Professional","Games / 3D"]));
  expect(persisted.fileName).toBe("persistent-master.txt");
  expect(persisted.text).toContain("Persistent master resume text");
});

test("offline resume fallback creates a local draft without network generation",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"offline-master",name:"Offline master",sourceType:"local",fileName:"offline.txt",version:"1",tracks:["Professional"]
    }]));
  });
  const api=await mockRaven(page);
  await page.goto("/");
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("ravenMasterResumeFilesV1",1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").put(new File([
        "Project coordination and team leadership across complex production milestones.\n",
        "Mentored and onboarded team members while delivering work on schedule.\n",
        "Built automation modules, reports, and asset database workflows."
      ],"offline.txt",{type:"text/plain"}),"offline-master");
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.context().setOffline(true);
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(0);
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenPendingDocumentSyncV1")||"{}"));
  expect(String(pending["job-1"]?.resume?.value||"")).toContain("data:text/html");
  await page.context().setOffline(false);
});

test("generation cache prevents a duplicate resume model call",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"cache-master",name:"Cache master",sourceType:"local",fileName:"cache.txt",version:"cache-v1",tracks:["Professional"]
    }]));
  });
  const api=await mockRaven(page);
  await page.goto("/");
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("ravenMasterResumeFilesV1",1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").put(new File(["Cached master resume text"],"cache.txt",{type:"text/plain"}),"cache-master");
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.evaluate(async(resume)=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("ravenMasterResumeFilesV1",1);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const file=await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readonly");
      const get=tx.objectStore("files").get("cache-master");
      get.onsuccess=()=>resolve(get.result);
      get.onerror=()=>reject(get.error);
    });
    db.close();
    const dataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(file);
    });
    const job={id:"job-1",track:"Professional",title:"Implementation Project Manager",company:"Acme Health",url:"https://example.com/job/1?utm_source=test",source:"Mock",status:"Saved",notes:"Lead implementation projects, coordinate internal teams, manage schedules and stakeholder communication."};
    const master={id:"cache-master",name:"Cache master",sourceType:"local",fileName:"cache.txt",version:"cache-v1",url:"",dataUrl};
    const key=window.RavenCore.generationFingerprint(job,master,"resume","modern-v2");
    localStorage.setItem("ravenGenerationCacheV1",JSON.stringify({[key]:{resume,createdAt:new Date().toISOString()}}));
  },generatedResume);

  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(0);
});

test("application requires approval of both exact documents",async({page})=>{
  await mockRaven(page);await page.goto("/");await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Approve docs");
  await page.evaluate(()=>{
    const job={id:"job-1",resume:"data:text/html,resume",coverLetter:"data:text/html,letter"};
    localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({"job-1|resume":{value:job.resume},"job-1|coverLetter":{value:job.coverLetter}}));
  });
  await page.route("**/functions/v1/raven-data-v1**",async route=>{
    if(route.request().method()==="GET") return route.fulfill({json:{ok:true,jobs:[{...savedJob,resume:"data:text/html,resume",cover_letter:"data:text/html,letter"}]}});
    return route.fulfill({json:{ok:true}});
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


test("review preserves approved document and revision invalidates approval",async({page})=>{
  const resumeV1="data:text/html;charset=utf-8,resume-v1";
  const letterV1="data:text/html;charset=utf-8,letter-v1";
  await page.addInitScript(({resumeV1,letterV1})=>{
    localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({
      "job-1|resume":{value:resumeV1,approvedAt:new Date().toISOString()},
      "job-1|coverLetter":{value:letterV1,approvedAt:new Date().toISOString()}
    }));
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"master-test",name:"Test master",sourceType:"local",fileName:"master.txt",tracks:["Professional"]
    }]));
  },{resumeV1,letterV1});

  const api=await mockRaven(page,{initialJob:{resume:resumeV1,cover_letter:letterV1}});
  await page.goto("/");
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("ravenMasterResumeFilesV1",1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
    };
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").put(new File(["Verified master resume content"],"master.txt",{type:"text/plain"}),"master-test");
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));

  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Apply");

  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(0);

  await page.locator("#reviewInstructions").fill("Make the summary shorter.");
  await page.locator("#reviewSubmit").click();
  await expect.poll(()=>api.getGenerationCalls()).toBe(1);
  await expect(page.locator("#reviewApprove")).toHaveText("Approve document");

  const approvals=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenDocumentApprovalsV1")||"{}"));
  expect(approvals["job-1|resume"]).toBeUndefined();
  expect(approvals["job-1|coverLetter"]?.value).toBe(letterV1);

  await page.locator('[data-review-close]').first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Approve docs");
});

test("Answer Memory stores only reusable non-sensitive answers",async({page})=>{
  await mockRaven(page);
  await page.goto("/");
  await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="answer-memory"]').click();
  await page.locator("#answerMemoryQuestion").fill("Are you willing to travel occasionally?");
  await page.locator("#answerMemoryAnswer").fill("Yes, up to 20%.");
  await page.locator("#saveAnswerMemory").click();

  let memory=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenAnswerMemoryV1")||"{}"));
  expect(memory["are you willing to travel occasionally"]).toBe("Yes, up to 20%.");
  await expect(page.locator("#answerMemoryList")).toContainText("Willing To Travel");

  await page.locator("#answerMemoryQuestion").fill("What salary do you expect?");
  await page.locator("#answerMemoryAnswer").fill("$100,000");
  await page.locator("#saveAnswerMemory").click();
  memory=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenAnswerMemoryV1")||"{}"));
  expect(memory["what salary do you expect"]).toBeUndefined();
  await expect(page.locator("#syncStatus")).toContainText("not stored");
});

test("strong extension completion event marks only the matching job Applied",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.evaluate(()=>{
    const bridge=document.getElementById("ravenExtensionBridge");
    bridge.dataset.completion=JSON.stringify({
      version:1,
      jobId:"job-1",
      jobUrl:"https://example.com/job/1",
      host:"example.com",
      adapter:"generic",
      completedAt:new Date().toISOString()
    });
    document.dispatchEvent(new CustomEvent("raven-application-complete"));
  });
  await expect.poll(()=>api.getJob().status).toBe("Applied");
  await expect(page.locator("#syncStatus")).toContainText("marked Applied");
});

test("completion event with host mismatch is ignored",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.evaluate(()=>{
    const bridge=document.getElementById("ravenExtensionBridge");
    bridge.dataset.completion=JSON.stringify({
      version:1,
      jobId:"job-1",
      jobUrl:"https://evil.example/job/1",
      host:"evil.example",
      adapter:"generic",
      completedAt:new Date().toISOString()
    });
    document.dispatchEvent(new CustomEvent("raven-application-complete"));
  });
  await page.waitForTimeout(100);
  expect(api.getJob().status).toBe("Saved");
});


// iPhone SE 2nd gen CSS viewport in portrait.
test("iPhone SE viewport keeps Raven usable without page overflow",async({page})=>{
  await page.setViewportSize({width:375,height:667});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await mockRaven(page);
  await page.goto("/");
  await expect(page.locator("#optionsButton")).toBeVisible();
  await expect(page.locator("#searchJobsButton")).toBeVisible();

  let layout=await page.evaluate(()=>({
    innerWidth:window.innerWidth,
    documentWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth+1);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.innerWidth+1);

  await page.locator("#optionsButton").click();
  await expect(page.locator("#optionsDialog")).toBeVisible();
  const dialogBox=await page.locator("#optionsDialog").boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x+dialogBox.width).toBeLessThanOrEqual(376);
  await page.locator(".options-close").click();

  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await expect(page.locator('[data-generate="resume"]')).toBeVisible();
  await expect(page.locator("[data-approved-apply]")).toBeVisible();

  layout=await page.evaluate(()=>({
    innerWidth:window.innerWidth,
    documentWidth:document.documentElement.scrollWidth
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth+1);
  expect(errors).toEqual([]);
});

test("malformed ATS rows are pruned from cached startup data before refresh",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenJobsCacheV1",JSON.stringify([
      {id:"cached-good",track:"Professional",title:"Cached Project Manager",company:"Acme",url:"https://job-boards.greenhouse.io/acme/jobs/123",source:"ATS:greenhouse",status:"Saved",notes:"Valid cached job."},
      {id:"cached-bad",track:"Professional",title:"Coordinate internal teams and manage implementation",company:"greenhouse",url:"- Lead project delivery",source:"ATS:greenhouse",status:"Saved",notes:"Description overflow fragment."}
    ]));
    localStorage.setItem("ravenDiscoveredCacheV1",JSON.stringify({
      Professional:[
        {id:"DISC-cached-bad",track:"Professional",title:"Description overflow fragment",company:"greenhouse",url:"This is an implementation role",source:"ATS:greenhouse",status:"Discovered",notes:"More description text.",_discovered:true}
      ]
    }));
  });
  await mockRaven(page,{dataDelayMs:1200});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator(".job-title").filter({hasText:"Cached Project Manager"})).toBeVisible();
  await expect(page.getByText("Coordinate internal teams and manage implementation",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Description overflow fragment",{exact:true})).toHaveCount(0);
});
