import { test, expect } from "@playwright/test";
import { classifyApplicationMessage } from "../supabase/functions/raven-backend-v3/signal-classifier.mjs";

const savedJob={id:"job-1",track:"Professional",title:"Implementation Project Manager",company:"Acme Health",location:"Remote",remote:true,salary_text:"$90,000",url:"https://example.com/job/1?utm_source=test",source:"Mock",status:"Saved",notes:"Lead implementation projects, coordinate internal teams, manage schedules and stakeholder communication.",added:new Date().toISOString(),resume:"",cover_letter:""};
const generatedResume={name:"Test Candidate",headline:"Project & Implementation Leader",contact:"candidate@example.com",summary:"Experienced delivery leader.",skills:["Project delivery","Team leadership"],experience:[{role:"Environment Artist",company:"Example Studio",dates:"2020–2025",bullets:["Led delivery across internal teams."]}],education:[{degree:"Bachelor's Degree",school:"Example University",location:"",dates:""}],additional:[]};
const generatedLetter={greeting:"Dear Hiring Manager,",paragraphs:["I am applying for the Implementation Project Manager role.","My background includes project delivery and internal team leadership."],closing:"Sincerely,",signature:"Test Candidate"};

async function mockRaven(page,{generatorFails=false,generatorDelayMs=0,initialJob=null,dataDelayMs=0,discoveredJob=null}={}){
  let job={...savedJob,...(initialJob||{})};
  let persisted=!discoveredJob;
  let generationCalls=0;
  const generationBodies=[];
  const searchTracks=[];
  const listTracks=[];
  const events=[];
  const snapshots=[];
  const lifecycleEventType=(status)=>({Applied:"applied",Interview:"interview",Offer:"offer",Rejected:"rejected",Ignored:"ignored",Interested:"bookmarked",Ready:"ready",Saved:"saved"})[status]||"status_changed";
  const transition=(status,body={})=>{
    const previous=job.status||"Saved";
    const occurredAt=body.occurredAt||new Date().toISOString();
    if(status==="Applied"){
      job.applied_date=job.applied_date||job.appliedDate||occurredAt;
      job.appliedDate=job.applied_date;
      const base=new Date(job.applied_date);
      base.setUTCDate(base.getUTCDate()+7);
      job.follow_up=Object.prototype.hasOwnProperty.call(body,"followUp")?(body.followUp||null):(job.follow_up||job.followUp||base.toISOString().slice(0,10));
      job.followUp=job.follow_up;
    }else if(["Interview","Offer","Rejected","Ignored"].includes(status)){
      job.follow_up=null;
      job.followUp=null;
    }else if(["Saved","Interested","Ready"].includes(status)&&previous==="Applied"){
      job.applied_date=null;
      job.appliedDate=null;
      job.follow_up=null;
      job.followUp=null;
    }
    job.status=status;
    job.viewed=true;
    if(previous!==status || Object.prototype.hasOwnProperty.call(body,"followUp")){
      events.unshift({
        id:"event-"+(events.length+1),job_id:job.id,event_type:previous===status&&Object.prototype.hasOwnProperty.call(body,"followUp")?"follow_up_changed":lifecycleEventType(status),
        occurred_at:occurredAt,source:body.source||"raven-ui",summary:body.summary||("Status changed from "+previous+" to "+status),metadata:{from_status:previous,to_status:status}
      });
    }
    if(status==="Applied"&&previous!=="Applied"){
      snapshots.unshift({id:"snapshot-"+(snapshots.length+1),job_id:job.id,snapshot_type:"application",captured_at:occurredAt,snapshot:{...job}});
    }
    return {ok:true,job:{...job},event:events[0]||null,snapshot:snapshots[0]||null};
  };
  await page.route("**/functions/v1/raven-data-v1**",route=>route.fulfill({status:410,json:{ok:false,error:"retired"}}));
  await page.route("**/functions/v1/raven-backend-v3**",async route=>{
    const req=route.request();
    const url=new URL(req.url());
    let action=url.searchParams.get("action")||"";
    let body={};
    if(req.method()==="POST"){
      body=JSON.parse(req.postData()||"{}");
      action=body.action||action;
    }
    const track=url.searchParams.get("track")||body.track||"";
    if(action==="jobs"){
      if(dataDelayMs) await new Promise(resolve=>setTimeout(resolve,dataDelayMs));
      return route.fulfill({json:{ok:true,jobs:persisted?[job]:[]}});
    }
    if(action==="updateJob"){
      job={...job,...body};delete job.action;
      return route.fulfill({json:{...job,ok:true}});
    }
    if(action==="addJob"){
      persisted=true;
      job={...job,...body,id:body.id||job.id||"job-added"};delete job.action;
      return route.fulfill({json:{...job,ok:true}});
    }
    if(action==="transitionJob"){
      return route.fulfill({json:transition(body.status,body)});
    }
    if(action==="jobEvents"){
      return route.fulfill({json:{ok:true,events}});
    }
    if(action==="jobSnapshots"){
      return route.fulfill({json:{ok:true,snapshots}});
    }
    if(action==="addJobEvent"){
      const event={id:"event-"+(events.length+1),job_id:body.jobId,event_type:body.eventType||"note",occurred_at:body.occurredAt||new Date().toISOString(),source:body.source||"manual",summary:body.summary||"",metadata:body.metadata||{}};
      events.unshift(event);
      return route.fulfill({json:{ok:true,event}});
    }
    if(action==="receiveApplicationSignal"){
      const map={submitted:"Applied",application_submitted:"Applied",interview:"Interview",interview_requested:"Interview",interview_scheduled:"Interview",offer:"Offer",offer_received:"Offer",rejection:"Rejected",rejected:"Rejected"};
      const next=map[body.type];
      if(next&&Number(body.confidence||0)>=0.85) return route.fulfill({json:{matched:true,auto_applied:true,...transition(next,body)}});
      const event={id:"event-"+(events.length+1),job_id:job.id,event_type:"signal_"+body.type,occurred_at:new Date().toISOString(),source:body.source||"signal",summary:body.summary||"",metadata:{suggested_status:next||null}};
      events.unshift(event);
      return route.fulfill({json:{ok:true,matched:true,auto_applied:false,suggested_status:next||null,event,job}});
    }
    if(action==="analytics"){
      const applied=Boolean(job.applied_date)||["Applied","Interview","Offer","Rejected"].includes(job.status);
      const interview=["Interview","Offer"].includes(job.status)||events.some(e=>/interview/.test(e.event_type));
      const offer=job.status==="Offer"||events.some(e=>e.event_type==="offer");
      return route.fulfill({json:{ok:true,analytics:{applications:applied?1:0,interviews:interview?1:0,offers:offer?1:0,rejections:job.status==="Rejected"?1:0,interview_rate:applied&&interview?1:0,offer_rate:applied&&offer?1:0,average_response_days:null,by_source:{Mock:{applications:applied?1:0,interviews:interview?1:0,offers:offer?1:0,rejections:job.status==="Rejected"?1:0,interview_rate:applied&&interview?1:0,offer_rate:applied&&offer?1:0}},by_track:{Professional:{applications:applied?1:0,interviews:interview?1:0,offers:offer?1:0,rejections:job.status==="Rejected"?1:0,interview_rate:applied&&interview?1:0,offer_rate:applied&&offer?1:0}},by_resume_variant:{"v-test":{applications:applied?1:0,interviews:interview?1:0,offers:offer?1:0,rejections:job.status==="Rejected"?1:0,interview_rate:applied&&interview?1:0,offer_rate:applied&&offer?1:0}}}}});
    }
    if(action==="coverage"){
      return route.fulfill({json:{ok:true,coverage:{total:3,supported:2,partial:0,missing:1,supported_ratio:2/3,requirements:[
        {requirement:"Project management experience",status:"supported",evidence:[{id:"xfer_3",text:"Has project-management experience and a track record of on-time delivery.",kind:"transferable"}]},
        {requirement:"Team leadership",status:"supported",evidence:[{id:"xfer_2",text:"Has led teams, mentored artists, and supported onboarding and training.",kind:"transferable"}]},
        {requirement:"Direct enterprise SaaS implementation experience",status:"missing",evidence:[]}
      ]}}});
    }
    if(action==="search") searchTracks.push(track);
    if(action==="listResults") {
      listTracks.push(track);
      if(discoveredJob && !persisted && track===discoveredJob.track) return route.fulfill({json:{ok:true,results:[discoveredJob]}});
    }
    return route.fulfill({json:{ok:true,track,count:0,jobs:[],results:[],phase:"quick",deep_search:"started"}});
  });
  await page.route("**/functions/v1/raven-enrich-v1**",route=>route.fulfill({json:{ok:true,description:savedJob.notes}}));
  await page.route("**/functions/v1/raven-commute-v1**",route=>route.fulfill({json:{ok:true,minutes:0}}));
  await page.route("**/functions/v1/raven-generate-v1**",async route=>{
    generationCalls++;
    if(generatorFails) return route.fulfill({status:503,json:{ok:false,error:"Mock generator unavailable"}});
    if(generatorDelayMs) await new Promise(resolve=>setTimeout(resolve,generatorDelayMs));
    const body=JSON.parse(route.request().postData()||"{}");
    generationBodies.push(body);
    if(body.documentType==="coverLetter"){
      const coverLetter=body.instructions
        ? {...generatedLetter,paragraphs:[...generatedLetter.paragraphs,"Updated to apply the requested revision."]}
        : generatedLetter;
      return route.fulfill({json:{ok:true,coverLetter}});
    }
    const resume=body.instructions
      ? {...generatedResume,summary:generatedResume.summary+" Updated to apply the requested revision."}
      : generatedResume;
    return route.fulfill({json:{ok:true,resume}});
  });
  return {
    getJob:()=>job,
    getGenerationCalls:()=>generationCalls,
    getGenerationBodies:()=>generationBodies.slice(),
    getSearchTracks:()=>searchTracks.slice(),
    getListTracks:()=>listTracks.slice(),
    getEvents:()=>events.slice(),
    getSnapshots:()=>snapshots.slice()
  };
}

test("loads mocked jobs and all tracks without page errors",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));await mockRaven(page);await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator(".job-title").filter({ hasText: "Implementation Project Manager" })).toBeVisible();
  for(const track of ["Games / 3D","Professional","Labor","Wildcard"]){const tab=page.locator('[data-track="'+track+'"]');await expect(tab).toBeVisible();await tab.click();}
  expect(errors).toEqual([]);
});

// Refresh is global; tabs only filter already-refreshed data.
test("refresh updates every job track and tabs are filter-only",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await expect.poll(()=>api.getListTracks().length).toBe(4);
  expect(new Set(api.getListTracks())).toEqual(new Set(["Games / 3D","Professional","Labor","Wildcard"]));
  expect(api.getSearchTracks()).toEqual([]);

  await page.locator("#searchJobsButton").click();
  await expect.poll(()=>api.getSearchTracks().length).toBe(4);
  expect(new Set(api.getSearchTracks())).toEqual(new Set(["Games / 3D","Professional","Labor","Wildcard"]));

  const before=api.getSearchTracks().length;
  for(const track of ["Professional","Labor","Wildcard","Games / 3D"]){
    await page.locator('[data-track="'+track+'"]').click();
  }
  await page.waitForTimeout(100);
  expect(api.getSearchTracks().length).toBe(before);
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

test("application message classifier recognizes rejection interview and offer language",async()=>{
  const cases=[
    {
      text:"We regret to inform you that your application has not been selected for further consideration.",
      type:"rejection"
    },
    {
      text:"After reviewing the applicant pool, we have chosen to continue the process with candidates whose backgrounds more closely align with our current needs.",
      type:"rejection"
    },
    {
      text:"We would like to invite you to an interview for the Operations Project Manager role. Please choose one of the available times.",
      type:"interview"
    },
    {
      text:"We enjoyed reviewing your background and would like to schedule an interview with our hiring manager next week.",
      type:"interview"
    },
    {
      text:"Wencor Group LLC is pleased to offer you the Technician I position. The official Offer Letter is available for review and signature.",
      type:"offer"
    },
    {
      text:"We are excited to offer you the Project Coordinator role. If you accept this offer, your proposed start date is October 12.",
      type:"offer"
    }
  ];
  for(const row of cases){
    expect(classifyApplicationMessage(row.text)?.type).toBe(row.type);
  }
});

test("application message classifier avoids conditional interview and receipt false positives",async()=>{
  const receipt="We received your application and look forward to reviewing it. We'll be in touch to schedule an interview if your background and experience match what we're looking for.";
  expect(classifyApplicationMessage(receipt)?.type).toBe("application_submitted");

  const plainReceipt="Thank you for applying. Our hiring team will review your application and contact qualified applicants.";
  expect(classifyApplicationMessage(plainReceipt)).toBeNull();
});

test("shared lifecycle transitions schedule follow-up and handle post-application states",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();

  const lifecycle=page.locator("[data-lifecycle-status]");
  await expect(lifecycle).toHaveValue("Saved");
  await lifecycle.selectOption("Applied");

  await expect.poll(()=>api.getJob().status).toBe("Applied");
  await expect.poll(()=>String(api.getJob().followUp||"")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator(".next-action")).toContainText(/Follow up/);
  await expect(page.locator("[data-follow-up-date]")).toHaveValue(String(api.getJob().followUp));

  const customFollowUp="2026-10-15";
  await page.locator("[data-follow-up-date]").fill(customFollowUp);
  await page.locator("[data-follow-up-date]").dispatchEvent("change");
  await expect.poll(()=>api.getJob().followUp).toBe(customFollowUp);

  await page.locator("[data-lifecycle-status]").selectOption("Interview");
  await expect.poll(()=>api.getJob().status).toBe("Interview");
  expect(api.getJob().followUp).toBeNull();
  await expect(page.locator(".next-action")).toHaveCount(0);
  await expect(page.locator("[data-approved-apply]")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Mark as applied"})).toHaveCount(0);

  await page.locator("[data-lifecycle-status]").selectOption("Rejected");
  await expect.poll(()=>api.getJob().status).toBe("Rejected");
  await expect(page.locator(".stage-header h2").filter({hasText:"Rejected"})).toBeVisible();
});

test("activity timeline reuses signals and snapshots for interview mode",async({page})=>{
  const api=await mockRaven(page,{initialJob:{resume:"data:text/html,resume",cover_letter:"data:text/html,letter"}});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();

  await page.locator("[data-lifecycle-status]").selectOption("Applied");
  await expect.poll(()=>api.getSnapshots().length).toBe(1);
  await page.locator("[data-lifecycle-status]").selectOption("Interview");
  await expect.poll(()=>api.getJob().status).toBe("Interview");

  await expect(page.locator(".interview-context")).toContainText("Interview prep");
  await expect(page.locator(".interview-context")).toContainText("Application snapshot");
  await expect(page.locator(".snapshot-links")).toContainText("Original posting");

  const form=page.locator("[data-add-activity]");
  await form.locator('select[name="type"]').selectOption("recruiter_contact");
  await form.locator('input[name="summary"]').fill("Recruiter confirmed next steps.");
  await form.locator('button[type="submit"]').click();
  await expect.poll(()=>api.getEvents().some(e=>e.event_type==="recruiter_contact")).toBeTruthy();
  await expect(page.locator(".job-activity")).toContainText("Recruiter confirmed next steps.");
});

test("manual outcome signals advance lifecycle through the shared signal path",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();

  const form=page.locator("[data-add-activity]");
  await form.locator('select[name="type"]').selectOption("interview_requested");
  await form.locator('input[name="summary"]').fill("Interview requested by recruiter.");
  await form.locator('button[type="submit"]').click();
  await expect.poll(()=>api.getJob().status).toBe("Interview");
  await expect(page.locator(".stage-header h2").filter({hasText:"Interview"})).toBeVisible();
});

test("expanded jobs show verified evidence coverage instead of an opaque fit score",async({page})=>{
  await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await expect(page.locator(".evidence-coverage")).toContainText("67% supported");
  await expect(page.locator(".evidence-coverage")).toContainText("Direct enterprise SaaS implementation experience");
  await expect(page.locator(".evidence-coverage")).toContainText("No evidence found");
});

test("outcome analytics panel renders shared lifecycle metrics",async({page})=>{
  await mockRaven(page,{initialJob:{status:"Interview",applied_date:new Date().toISOString()}});
  await page.goto("/");
  await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="analytics"]').click();
  await expect(page.locator("#analyticsApplications")).toHaveText("1");
  await expect(page.locator("#analyticsInterviews")).toHaveText("1");
  await expect(page.locator("#analyticsByTrack")).toContainText("Professional");
  await expect(page.locator("#analyticsBySource")).toContainText("Mock");
  await expect(page.locator("#analyticsByResume")).toContainText("v-test");
});

test("medium-confidence external signals stay reviewable until accepted",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  const summary=page.locator(".job-card-summary").first();
  await summary.click();

  await page.evaluate(async()=>{
    await window.RavenAPI.receiveApplicationSignal({
      jobId:"job-1",
      type:"interview_requested",
      confidence:.6,
      source:"email",
      summary:"Possible interview invitation."
    });
  });

  await summary.click();
  await summary.click();
  expect(api.getJob().status).toBe("Saved");

  const suggestion=page.locator('[data-apply-suggested-status="Interview"]');
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect.poll(()=>api.getJob().status).toBe("Interview");
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
  await expect(page.locator("#syncStatus")).toContainText("Master resume saved");

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

test("offline resume generation refuses to create a non-LLM document",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"offline-master",name:"Offline master",sourceType:"local",fileName:"offline.txt",version:"1",tracks:["Professional"]
    }]));
  });
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.context().setOffline(true);
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).not.toBeVisible();
  await expect(page.locator("#syncStatus")).toContainText("internet connection is required for AI resume generation");
  expect(api.getGenerationCalls()).toBe(0);
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenPendingDocumentSyncV1")||"{}"));
  expect(pending["job-1"]?.resume).toBeUndefined();
  await page.context().setOffline(false);
});

test("generation cache prevents a duplicate resume model call",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.getByRole("tab",{name:"Professional",exact:true}).click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(1);
  await page.getByRole("button",{name:"Close",exact:true}).click();
  // A fresh server read has no document; identical inputs should reuse the cache.
  api.getJob().resume="";
  await page.reload();
  await page.getByRole("tab",{name:"Professional",exact:true}).click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(1);
});

test("application requires approval of both exact documents",async({page})=>{
  const resume="data:text/html,resume";
  const letter="data:text/html,letter";
  await mockRaven(page,{initialJob:{resume,cover_letter:letter}});
  await page.goto("/");await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Approve docs");
  await page.evaluate(({resume,letter})=>{
    localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({"job-1|resume":{value:resume},"job-1|coverLetter":{value:letter}}));
  },{resume,letter});
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
  expect(api.getGenerationBodies()[0].currentDocument).toBe("resume-v1");
  expect(api.getGenerationBodies()[0].instructions).toBe("Make the summary shorter.");
  await expect(page.locator("#reviewApprove")).toHaveText("Approve document");

  const approvals=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenDocumentApprovalsV1")||"{}"));
  expect(approvals["job-1|resume"]).toBeUndefined();
  expect(approvals["job-1|coverLetter"]?.value).toBe(letterV1);

  await page.locator('[data-review-close]').first().click();
  await expect(page.locator("[data-approved-apply]")).toContainText("Approve docs");
});

test("failed revision keeps the saved document and its approval",async({page})=>{
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

  const api=await mockRaven(page,{generatorFails:true,initialJob:{resume:resumeV1,cover_letter:letterV1}});
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
  await expect(page.locator("#reviewFeedback")).toContainText("Mock generator unavailable");
  await expect(page.locator("#reviewFeedback")).toContainText("previous document is unchanged");
  await expect(page.locator("#reviewInstructions")).toHaveValue("Make the summary shorter.");
  expect(api.getJob().resume).toBe(resumeV1);
  const approvals=await page.evaluate(()=>JSON.parse(localStorage.getItem("ravenDocumentApprovalsV1")||"{}"));
  expect(approvals["job-1|resume"]?.value).toBe(resumeV1);
  await expect(page.locator("#reviewSubmit")).toBeEnabled();
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


test("representative responsive widths keep primary Raven surfaces bounded",async({page})=>{
  await mockRaven(page);
  for(const viewport of [
    {width:375,height:667},
    {width:768,height:900},
    {width:1024,height:768},
    {width:1440,height:900}
  ]){
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-track="Professional"]').click();
    await page.locator(".job-card-summary").first().click();
    const layout=await page.evaluate(()=>({
      innerWidth:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth+2);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.innerWidth+2);
    await expect(page.locator("[data-lifecycle-status]")).toBeVisible();
    await expect(page.locator(".evidence-coverage")).toBeVisible();
  }
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


test("device backup restores profile, answer memory, and local master resume",async({page})=>{
  await mockRaven(page);
  await page.goto("/");
  await page.evaluate(async()=>{
    localStorage.setItem("ravenApplicationProfileV1",JSON.stringify({firstName:"Raven",lastName:"Tester",email:"raven@example.com"}));
    localStorage.setItem("ravenAnswerMemoryV1",JSON.stringify({"are you willing to travel":"Yes"}));
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{id:"backup-master",name:"Backup master",sourceType:"local",fileName:"backup.txt",version:"1",tracks:["Professional"]}]));
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open("ravenMasterResumeFilesV1",1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");};
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction("files","readwrite");
        tx.objectStore("files").put(new File(["MASTER BACKUP CONTENT"],"backup.txt",{type:"text/plain"}),"backup-master");
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>reject(tx.error);
      };
    });
  });
  await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="device-backup"]').click();
  const downloadPromise=page.waitForEvent("download");
  await page.locator("#exportDeviceBackup").click();
  const download=await downloadPromise;
  const backupPath=await download.path();
  expect(backupPath).toBeTruthy();

  await page.evaluate(async()=>{
    for(const key of ["ravenApplicationProfileV1","ravenAnswerMemoryV1","ravenMasterResumesV1","ravenGeneratorPreferencesV1","ravenUserSettingsV1","ravenDocumentApprovalsV1","ravenViewedJobsV1"]) localStorage.removeItem(key);
    await new Promise((resolve)=>{const request=indexedDB.deleteDatabase("ravenMasterResumeFilesV1");request.onsuccess=request.onerror=request.onblocked=()=>resolve();});
  });
  await page.locator("#deviceBackupFile").setInputFiles(backupPath);
  await expect(page.locator("#syncStatus")).toContainText("Device backup restored");

  const restored=await page.evaluate(async()=>{
    const profile=JSON.parse(localStorage.getItem("ravenApplicationProfileV1")||"{}");
    const answers=JSON.parse(localStorage.getItem("ravenAnswerMemoryV1")||"{}");
    const masters=JSON.parse(localStorage.getItem("ravenMasterResumesV1")||"[]");
    const file=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("ravenMasterResumeFilesV1",1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction("files","readonly");
        const get=tx.objectStore("files").get("backup-master");
        get.onsuccess=()=>{resolve(get.result||null);db.close();};
        get.onerror=()=>reject(get.error);
      };
    });
    return {profile,answers,masters,fileName:file?.name||"",fileText:file?await file.text():""};
  });
  expect(restored.profile.email).toBe("raven@example.com");
  expect(restored.answers["are you willing to travel"]).toBe("Yes");
  expect(restored.masters[0].id).toBe("backup-master");
  expect(restored.fileName).toBe("backup.txt");
  expect(restored.fileText).toBe("MASTER BACKUP CONTENT");
});

for(const site of [
  {name:"Greenhouse",url:"https://job-boards.greenhouse.io/raven-test/jobs/1",resume:'<input id="resume" type="file" accept=".html">',cover:'<input id="cover_letter" type="file" accept=".html">'},
  {name:"Lever",url:"https://jobs.lever.co/raven-test/1",resume:'<input name="resume" type="file" accept=".html">',cover:'<input name="cover_letter" type="file" accept=".html">'},
  {name:"Ashby",url:"https://jobs.ashbyhq.com/raven-test/1",resume:'<input name="resume" type="file" accept=".html">',cover:'<input name="cover_letter" type="file" accept=".html">'}
]){
  test(site.name+" assistant attaches exact approved documents without submitting",async({page})=>{
    const resumeValue="data:text/html;charset=utf-8,"+encodeURIComponent("<html><body>APPROVED RESUME EXACT</body></html>");
    const coverValue="data:text/html;charset=utf-8,"+encodeURIComponent("<html><body>APPROVED COVER EXACT</body></html>");
    await page.addInitScript(({url,resumeValue,coverValue})=>{
      const store={
        ravenApplicationPacket:{
          version:1,createdAt:new Date().toISOString(),jobId:"job-1",jobUrl:url,title:"Test Role",company:"Test Company",
          profile:{firstName:"Raven",lastName:"Tester",email:"raven@example.com"},answers:{},
          resume:resumeValue,coverLetter:coverValue
        }
      };
      globalThis.chrome={
        storage:{local:{
          get(keys,cb){const list=Array.isArray(keys)?keys:[keys];cb(Object.fromEntries(list.map(k=>[k,store[k]]).filter(([,v])=>v!==undefined)));},
          set(values,cb){Object.assign(store,values);if(cb)cb();},
          remove(keys,cb){for(const k of (Array.isArray(keys)?keys:[keys])) delete store[k];if(cb)cb();}
        }},
        runtime:{lastError:null,sendMessage(_m,cb){if(cb)cb();}}
      };
    },{url:site.url,resumeValue,coverValue});
    await page.route(site.url,route=>route.fulfill({status:200,contentType:"text/html",body:'<!doctype html><html><body><form><input id="first_name" name="name" type="text"><input id="last_name" type="text"><input id="email" type="email">'+site.resume+site.cover+'<button type="submit">Submit application</button></form></body></html>'}));
    await page.goto(site.url);
    await page.addScriptTag({path:"extension/src/assistant-core.js"});
    await page.addScriptTag({path:"extension/src/content.js"});
    await expect(page.locator("#raven-assistant-banner")).toContainText("approved document");
    const attached=await page.evaluate(async()=>{
      const inputs=[...document.querySelectorAll('input[type="file"]')];
      return Promise.all(inputs.map(async(input)=>({name:input.files?.[0]?.name||"",text:input.files?.[0]?await input.files[0].text():""})));
    });
    expect(attached).toHaveLength(2);
    expect(attached[0].text).toContain("APPROVED RESUME EXACT");
    expect(attached[1].text).toContain("APPROVED COVER EXACT");
    expect(await page.locator("button[type=submit]").count()).toBe(1);
  });
}

test("listing and direct application remain available without approved documents",async({page})=>{
  await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  for(const name of ["View listing","Apply on site"]){
    const link=page.getByRole("link",{name,exact:true});
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href",savedJob.url);
    await expect(link).toHaveAttribute("target","_blank");
  }
  await page.locator("[data-approved-apply]").click();
  await expect(page.locator("#syncStatus")).toContainText("Approve the resume and cover letter");
});

test("remote watermark keeps one visual treatment across card states",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();

  const watermark=()=>page.locator(".job-card.is-remote .remote-watermark").first();
  await expect(watermark()).toBeVisible();
  const style=()=>watermark().evaluate(el=>{
    const computed=getComputedStyle(el);
    return {color:computed.color,opacity:computed.opacity};
  });
  const baseline=await style();

  await page.locator(".job-card.is-remote").first().hover();
  await expect.poll(style).toEqual(baseline);

  await page.locator(".job-card-summary").first().click();
  await expect.poll(style).toEqual(baseline);

  await page.getByRole("button",{name:"Bookmark job"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Interested");
  await expect(watermark()).toBeVisible();
  await expect.poll(style).toEqual(baseline);

  await page.locator(".job-card-summary").first().click();
  await page.getByRole("button",{name:"Mark as applied"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Applied");
  await expect(watermark()).toBeVisible();
  await expect.poll(style).toEqual(baseline);
});

test("resume generation stays visibly active and does not pop review after leaving the card",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"test-master",name:"Test master",sourceType:"drive",url:"https://drive.google.com/file/d/test/view",tracks:["Professional"]
    }]));
  });
  await mockRaven(page,{generatorDelayMs:500,initialJob:{resume:""}});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();

  await expect(page.locator(".job-card.is-generating-document")).toBeVisible();
  await expect(page.locator(".generation-card-status")).toContainText("AI is generating resume");
  await expect(page.locator(".document-primary.is-generating")).toBeVisible();

  await page.locator(".job-card-summary").first().click();
  await expect(page.locator(".job-card.is-generating-document")).toBeVisible();
  await expect(page.locator("#documentReviewDialog")).not.toBeVisible();

  await expect.poll(async()=>await page.locator(".job-card.is-generating-document").count(),{timeout:5000}).toBe(0);
  await expect(page.locator("#documentReviewDialog")).not.toBeVisible();

  await page.locator(".job-card-summary").first().click();
  await expect(page.locator('[data-generate="resume"]')).toHaveText("Review");
});

test("requested document changes show persistent AI processing feedback",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"test-master",name:"Test master",sourceType:"drive",url:"https://drive.google.com/file/d/test/view",tracks:["Professional"]
    }]));
  });
  await mockRaven(page,{generatorDelayMs:700});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  await page.locator("#reviewInstructions").fill("Make the summary shorter.");
  await page.locator("#reviewSubmit").click();

  await expect(page.locator("#reviewSubmit")).toBeDisabled();
  await expect(page.locator("#reviewSubmit")).toContainText("AI applying changes");
  await expect(page.locator("#reviewFeedback")).toHaveClass(/is-processing/);
  await expect(page.locator("#reviewFeedback")).toContainText("AI is rewriting and fact-checking");
  await expect(page.locator("#reviewSubmit")).toBeEnabled({timeout:5000});
  await expect(page.locator("#reviewFeedback")).toContainText("Updated draft saved");
  await expect(page.locator("#reviewFeedback")).not.toHaveClass(/is-processing/);
});

test("generation indicator survives job object refresh while generation is active",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"test-master",name:"Test master",sourceType:"drive",url:"https://drive.google.com/file/d/test/view",tracks:["Professional"]
    }]));
  });
  const api=await mockRaven(page,{generatorDelayMs:900,initialJob:{resume:""}});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator(".generation-card-status")).toContainText("AI is generating resume");

  await page.getByRole("button",{name:"Bookmark job"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Interested");
  await expect(page.locator(".generation-card-status")).toContainText("AI is generating resume");
  await expect(page.locator(".job-card.is-generating-document")).toBeVisible();
});

test("cover letter generation inherits resume progress and nonintrusive completion behavior",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"test-master",name:"Test master",sourceType:"drive",url:"https://drive.google.com/file/d/test/view",tracks:["Professional"]
    }]));
  });
  await mockRaven(page,{generatorDelayMs:500,initialJob:{cover_letter:""}});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="coverLetter"]').click();

  await expect(page.locator(".job-card.is-generating-document")).toBeVisible();
  await expect(page.locator(".generation-card-status")).toContainText("AI is generating cover letter");
  await expect(page.locator(".document-primary.is-generating")).toBeVisible();

  await page.locator(".job-card-summary").first().click();
  await expect(page.locator(".job-card.is-generating-document")).toBeVisible();
  await expect(page.locator("#documentReviewDialog")).not.toBeVisible();

  await expect.poll(async()=>await page.locator(".job-card.is-generating-document").count(),{timeout:5000}).toBe(0);
  await expect(page.locator("#documentReviewDialog")).not.toBeVisible();

  await page.locator(".job-card-summary").first().click();
  await expect(page.locator('[data-generate="coverLetter"]')).toHaveText("Review");
});

test("generators save discovery jobs and recover descriptions before generating both documents",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("ravenMasterResumesV1",JSON.stringify([{
      id:"test-master",name:"Test master",sourceType:"drive",url:"https://drive.google.com/file/d/test/view",tracks:["Professional"]
    }]));
  });
  const api=await mockRaven(page,{discoveredJob:{
    id:"discovery-1",track:"Professional",title:savedJob.title,company:savedJob.company,
    location:"Remote",remote:true,url:savedJob.url,source:"Mock",snippet:""
  }});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  await expect(page.frameLocator("#reviewFrame").getByText("Test Candidate",{exact:true})).toBeVisible();
  await expect(page.frameLocator("#reviewFrame").locator("body")).not.toContainText("Remote");
  await page.getByRole("button",{name:"Close",exact:true}).click();
  await page.locator('[data-generate="coverLetter"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  await expect(page.frameLocator("#reviewFrame").getByText("Dear Hiring Manager,")).toBeVisible();
  await page.getByRole("button",{name:"Close",exact:true}).click();
  expect(api.getGenerationCalls()).toBe(2);
  expect(api.getGenerationBodies().every(body=>body.jobId==="job-1" && body.jobDescription===savedJob.notes)).toBe(true);
  expect(api.getGenerationBodies().every(body=>!("location" in body) && !("jobLocation" in body))).toBe(true);
  expect(api.getJob().resume).toContain("data:text/html");
  expect(api.getJob().coverLetter).toContain("data:text/html");
  await page.reload();
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await expect(page.locator('[data-generate="resume"]')).toHaveText("Review");
  await expect(page.locator('[data-generate="coverLetter"]')).toHaveText("Review");
});

for (const track of ["Games / 3D", "Professional", "Labor", "Wildcard"]) {
  test(`canonical profile generates both documents without device masters: ${track}`, async ({page}) => {
    const errors=[]; page.on("pageerror",error=>errors.push(error.message));
    const api=await mockRaven(page,{generatorDelayMs:700,initialJob:{track}});
    await page.goto("/");
    await page.getByRole("tab",{name:track,exact:true}).click();
    await page.locator(".job-card-summary").first().click();
    for(const type of ["resume","coverLetter"]){
      await page.locator(`[data-generate="${type}"]`).click();
      await expect(page.locator(".generation-card-status")).toBeVisible();
      await expect(page.locator(".document-primary.is-generating")).toBeDisabled();
      await expect(page.locator("#documentReviewDialog")).toBeVisible();
      await expect(page.frameLocator("#reviewFrame").locator("body")).toContainText("Test Candidate");
      await page.getByRole("button",{name:"Close",exact:true}).click();
    }
    expect(api.getGenerationCalls()).toBe(2);
    expect(api.getGenerationBodies().every(body=>!("masterResume" in body))).toBe(true);
    await page.reload();
    await page.getByRole("tab",{name:track,exact:true}).click();
    await page.locator(".job-card-summary").first().click();
    await expect(page.locator('[data-generate="resume"]')).toHaveText("Review");
    await expect(page.locator('[data-generate="coverLetter"]')).toHaveText("Review");
    expect(errors).toEqual([]);
  });
}

test("missing legacy local file does not block the canonical profile generator",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("ravenMasterResumesV1",JSON.stringify([
    {id:"missing-file",sourceType:"local",fileName:"old.txt",tracks:["Professional"]}
  ])));
  const api=await mockRaven(page);
  await page.goto("/");
  await page.getByRole("tab",{name:"Professional",exact:true}).click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  expect(api.getGenerationCalls()).toBe(1);
});

test("generation errors stay beside the button and allow a successful retry",async({page})=>{
  await mockRaven(page,{generatorFails:true});
  await page.goto("/");
  await page.getByRole("tab",{name:"Professional",exact:true}).click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator(".document-generation-error")).toContainText("Mock generator unavailable");
  await expect(page.locator('[data-generate="resume"]')).toBeEnabled();
  await expect(page.locator(".generation-card-status")).toHaveCount(0);
  await page.route("**/functions/v1/raven-generate-v1**",route=>route.fulfill({json:{ok:true,resume:generatedResume}}));
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  await expect(page.locator(".document-generation-error")).toHaveCount(0);
});

for(const type of ["resume","coverLetter"]){
  test(`Regenerate bypasses cached ${type} with no device master`,async({page})=>{
    const api=await mockRaven(page);
    await page.goto("/");
    await page.getByRole("tab",{name:"Professional",exact:true}).click();
    await page.locator(".job-card-summary").first().click();
    await page.locator(`[data-generate="${type}"]`).click();
    await expect(page.locator("#documentReviewDialog")).toBeVisible();
    await page.getByRole("button",{name:"Close",exact:true}).click();
    const label=type==="resume"?"resume":"cover letter";
    await page.getByRole("button",{name:`More ${label} options`}).click();
    await page.getByRole("menuitem",{name:"Regenerate",exact:true}).click();
    await expect(page.locator("#documentReviewDialog")).toBeVisible();
    expect(api.getGenerationCalls()).toBe(2);
  });
}
