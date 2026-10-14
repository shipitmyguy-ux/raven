import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { classifyApplicationMessage } from "../supabase/functions/raven-backend-v3/signal-classifier.mjs";

const savedJob={id:"job-1",track:"Professional",title:"Implementation Project Manager",company:"Acme Health",location:"Remote",remote:true,salary_text:"$90,000",url:"https://example.com/job/1?utm_source=test",source:"Mock",status:"Saved",notes:"Lead implementation projects, coordinate internal teams, manage schedules and stakeholder communication.",added:new Date().toISOString(),resume:"",cover_letter:""};
const generatedResume={name:"Test Candidate",headline:"Project & Implementation Leader",contact:"candidate@example.com",summary:"Experienced delivery leader.",skills:["Project delivery","Team leadership"],experience:[{role:"Environment Artist",company:"Example Studio",dates:"2020–2025",bullets:["Led delivery across internal teams."]}],education:[{degree:"Bachelor's Degree",school:"Example University",location:"",dates:""}],additional:[]};
const generatedLetter={greeting:"Dear Hiring Manager,",paragraphs:["I am applying for the Implementation Project Manager role.","My background includes project delivery and internal team leadership."],closing:"Sincerely,",signature:"Test Candidate"};

const jobDetail=(page,selector)=>page.locator("#jobDetailPanel").locator(selector);
async function openDocumentMenu(page,type){
 const row=jobDetail(page,`[data-document-type="${type}"]`);
 if(await row.locator("[data-document-menu]").getAttribute("aria-expanded")!=="true")await row.locator("[data-document-menu]").click();
}
async function openDetailSection(page,name){
 const section=jobDetail(page,".job-detail-disclosure").filter({has:page.locator("summary",{hasText:new RegExp("^"+name+"$")})});
 if(!await section.evaluate(el=>el.open))await section.locator("summary").click();
}


async function mockRaven(page,{generatorFails=false,generatorDelayMs=0,initialJob=null,dataDelayMs=0,discoveredJob=null,availabilityResponse=null,savedDiscoveryId=null}={}){
  // These fixtures exercise the remote-provider workflow. One-click cases
  // explicitly override this route and install their own helper fixtures.
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=false;await route.fulfill({json:config});});
  let job={...savedJob,...(initialJob||{})};
  let persisted=!discoveredJob;
  let generationCalls=0;
  let addJobCalls=0;
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
      addJobCalls++;
      persisted=true;
      job={...job,...body,id:body.id||savedDiscoveryId||job.id||"job-added"};delete job.action;
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
  await page.route("**/functions/v1/raven-enrich-v1**",route=>{
    if(availabilityResponse?.availability?.state==="closed"){
      const a=availabilityResponse.availability;
      job={...job,listing_state:'closed',listing_reason:a.reason,listing_checked_at:a.checked_at,listing_source_url:a.source_url};
    }
    return route.fulfill({json:availabilityResponse||{ok:true,description:savedJob.notes}});
  });
  await page.route("**/functions/v1/raven-commute-v1**",route=>route.fulfill({json:{ok:true,minutes:0}}));
  await page.route("**/functions/v1/raven-generate-v1**",async route=>{
    generationCalls++;
    if(generatorFails) return route.fulfill({status:503,json:{ok:false,error:"Mock generator unavailable"}});
    if(generatorDelayMs) await new Promise(resolve=>setTimeout(resolve,generatorDelayMs));
    const body=JSON.parse(route.request().postData()||"{}");
    generationBodies.push(body);
    if(body.revisionSection==="summary")return route.fulfill({json:{ok:true,final_review:{status:"passed",factual_review:{status:"passed"}},document_patch:{section:"summary",text:"Experienced delivery leader. Updated to apply the requested revision."},resume:{...generatedResume,headline:"Unexpected unrelated rewrite"}}});
    if(body.documentType==="coverLetter"){
      const coverLetter=body.instructions
        ? {...generatedLetter,paragraphs:[...generatedLetter.paragraphs,"Updated to apply the requested revision."]}
        : generatedLetter;
      return route.fulfill({json:{ok:true,final_review:{status:"passed",factual_review:{status:"passed"}},coverLetter}});
    }
    const resume=body.instructions
      ? {...generatedResume,summary:generatedResume.summary+" Updated to apply the requested revision."}
      : generatedResume;
    return route.fulfill({json:{ok:true,final_review:{status:"passed",factual_review:{status:"passed"}},resume}});
  });
  return {
    getJob:()=>job,
    getAddJobCalls:()=>addJobCalls,
    getGenerationCalls:()=>generationCalls,
    getGenerationBodies:()=>generationBodies.slice(),
    getSearchTracks:()=>searchTracks.slice(),
    getListTracks:()=>listTracks.slice(),
    getEvents:()=>events.slice(),
    getSnapshots:()=>snapshots.slice()
  };
}

test("review downloads a Word file and opens the PDF print dialog",async({page})=>{
  await mockRaven(page);await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator('.job-title').filter({hasText:savedJob.title}).click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#reviewDownloadWord').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  await page.evaluate(()=>{window.__printed=false;Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){return {focus(){},print(){window.__printed=true;}};},configurable:true});});
  await page.locator('#reviewDownloadPdf').click();
  await expect.poll(()=>page.evaluate(()=>window.__printed)).toBe(true);
});

test("JSON attachment automatically validates and persists to its original job",async({page})=>{
  const api=await mockRaven(page);await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator('.job-title').filter({hasText:savedJob.title})).toBeVisible();
  await page.evaluate(()=>{
    localStorage.setItem('ravenChatGptRequestsV1',JSON.stringify({test:{jobId:'job-1',type:'resume',createdAt:Date.now(),before:{resume:'',coverLetter:''}}}));
    const bridge=document.getElementById('ravenExtensionBridge');
    bridge.dataset.chatgptResult=JSON.stringify({raven_format:'raven-chatgpt-v1',request_id:'test',resume:{headline:{text:'Supported headline',fact_ids:['fact']}}});
    document.dispatchEvent(new CustomEvent('raven-chatgpt-result'));
  });
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  expect(api.getGenerationBodies()[0].manualDraft).toBeTruthy();
  expect(api.getJob().resume).toContain('data:text/html');
  await page.reload();await page.locator('[data-track="Professional"]').click();
  await page.locator('.job-title').filter({hasText:savedJob.title}).click();
  await expect(page.locator('[data-generate="resume"]')).toHaveText('Review');
});

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
  await page.locator("[data-lifecycle-status]").selectOption("Applied");
  await expect.poll(()=>api.getJob().status).toBe("Applied");
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await expect(page.locator("[data-lifecycle-status]")).toHaveValue("Applied");
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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toHaveCount(0);
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

  await openDetailSection(page,"Activity");
  const form=page.locator("[data-add-activity]");
  await form.locator('select[name="type"]').selectOption("recruiter_contact");
  await form.locator('input[name="summary"]').fill("Recruiter confirmed next steps.");
  await form.locator('button[type="submit"]').click();
  await expect.poll(()=>api.getEvents().some(e=>e.event_type==="recruiter_contact")).toBeTruthy();
  await expect(jobDetail(page, ".job-activity")).toContainText("Recruiter confirmed next steps.");
});

test("manual outcome signals advance lifecycle through the shared signal path",async({page})=>{
  const api=await mockRaven(page);
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();

  await openDetailSection(page,"Activity");
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

  await page.locator("[data-close-job-detail]").click();
  await summary.click();
  await openDetailSection(page,"Activity");
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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toContainText("Approve documents");
  await page.evaluate(({resume,letter})=>{
    localStorage.setItem("ravenDocumentApprovalsV1",JSON.stringify({"job-1|resume":{value:resume},"job-1|coverLetter":{value:letter}}));
  },{resume,letter});
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator(".job-card-summary").first().click();
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toContainText("Open with approved documents");
});

test("application profile controls are available",async({page})=>{
  await mockRaven(page);await page.goto("/");await page.locator("#optionsButton").click();
  await page.locator('[data-options-target="application-profile"]').click();
  await expect(page.locator('[data-profile-key="firstName"]')).toBeVisible();
  await expect(page.locator("#saveApplicationProfile")).toBeVisible();
});


test("review preserves approved document and revision invalidates approval",async({page})=>{
  const resumeV1="data:text/html;charset=utf-8,"+encodeURIComponent('<p class="summary">resume-v1</p>');
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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toContainText("Open with approved documents");

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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toContainText("Approve documents");
});

test("failed revision keeps the saved document and its approval",async({page})=>{
  const resumeV1="data:text/html;charset=utf-8,"+encodeURIComponent('<p class="summary">resume-v1</p>');
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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toContainText("Open with approved documents");

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
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator('.job-card[data-job-id="job-1"]')).toBeVisible();
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
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator('.job-card[data-job-id="job-1"]')).toBeVisible();
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


test("document pills keep busy labels and adjacent controls contained",async({page})=>{
  await mockRaven(page);
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-direct-save']=false;config.settings['chatgpt-one-click']=false;await route.fulfill({json:config});});
  await page.addInitScript(()=>window.open=()=>null);
  await page.route("**/functions/v1/raven-generate-v1**",()=>{});
  for(const width of [320,375,715,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await page.locator('[data-track="Professional"]').click();
    await page.locator(".job-card-summary").first().click();
    await openDocumentMenu(page,'resume');await page.locator('[data-chatgpt-prompt="resume"]').click();
    await expect(page.locator('[data-chatgpt-prompt="resume"]')).toHaveAttribute("aria-busy","true");
    const issues=await page.evaluate(()=>{
      const failures=[];
      for(const el of document.querySelectorAll('.document-control > button,.workflow-action,.job-detail-progress')){
        const box=el.getBoundingClientRect(),parent=el.closest('.inline-job-detail,.card-main').getBoundingClientRect();
        if(box.left<parent.left-1||box.right>parent.right+1)failures.push(el.textContent+": outside container");
        const range=document.createRange();range.selectNodeContents(el);
        if([...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))failures.push(el.textContent+": outside button");
      }
      return failures;
    });
    expect(issues).toEqual([]);
    const importButton=page.locator('[data-chatgpt-import="resume"]');
    await expect(importButton).toBeVisible();
    expect((await importButton.boundingBox()).height).toBeLessThan(35);
    if(width===320||width===1440)await page.screenshot({path:`test-results/document-pills-${width}.png`,fullPage:true});
  }
});

test('ChatGPT button sends a direct job-bound save request without the JSON prompt service',async({page})=>{
  const api=await mockRaven(page);
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=false;await route.fulfill({json:config});});
  await page.addInitScript(()=>{
    window.open=()=>({closed:false,document:{title:'',body:{}},location:{replace:url=>{window.lastChatGptUrl=url;}},close(){}});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  });
  await page.goto('/');
  await page.locator('[data-track="Professional"]').click();
  await page.locator('.job-card-summary').first().click();
  await openDocumentMenu(page,'resume');await page.locator('[data-chatgpt-prompt="resume"]').click();
  await expect(page.locator('#syncStatus')).toContainText('saves directly');
  const prompt=await page.evaluate(()=>new URL(window.lastChatGptUrl).searchParams.get('q'));
  expect(prompt).toContain('job-1');expect(prompt).toContain('save_generated_document');
  expect(api.getGenerationCalls()).toBe(0);
});

test('one-click button creates a durable resume and Drive PDF without opening ChatGPT',async({page})=>{
  const api=await mockRaven(page);
  const resume='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html><body><h1>Test Candidate</h1><p>Verified resume.</p></body></html>');
  const runId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const doc={document_type:'resume',document_url:resume,document_sha256:createHash('sha256').update(resume).digest('hex'),file_id:'file1234567890',drive_url:'https://drive.google.com/file/d/file1234567890/view'};
  let starts=0,polls=0;
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
  await page.route('http://127.0.0.1:8766/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/session')return route.fulfill({json:{token:'fixture-token'}});
    expect(route.request().headers().authorization).toBe('Bearer fixture-token');
    if(path==='/runs'){
      starts++;expect(route.request().postDataJSON()).toEqual({job_id:'job-1',document_type:'resume'});
      return route.fulfill({json:{run_id:runId,stage:'writing'}});
    }
    polls++;api.getJob().resume=resume;
    await page.evaluate(async metadata=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata}),doc);
    return route.fulfill({json:{run_id:runId,job_id:'job-1',stage:'complete',documents:[doc]}});
  });
  await page.addInitScript(()=>{window.chatWindows=0;window.open=()=>{window.chatWindows++;return null;};});
  await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
  await openDocumentMenu(page,'resume');await page.locator('[data-chatgpt-prompt="resume"]').click();
  await expect(page.locator('#syncStatus')).toContainText('copied to Drive');
  expect(starts).toBe(1);expect(polls).toBe(1);expect(await page.evaluate(()=>window.chatWindows)).toBe(0);expect(api.getJob().status).toBe('Saved');
  await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
  await expect(page.getByRole('link',{name:'Current PDF'})).toBeVisible();expect(api.getJob().resume).toBe(resume);
});

async function mockOneClickQueue(page,api,{delayResume=false}={}){
 const requests=[],runs=new Map();let released=!delayResume,releaseCover=false;
 const resume='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><h1>Verified resume</h1></body></html>');
 const cover='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><p>Verified cover letter</p></body></html>');
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('http://127.0.0.1:8766/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/session')return route.fulfill({json:{token:'fixture-token'}});
  if(path==='/runs'){
   const body=route.request().postDataJSON();requests.push(body);const id=`aaaaaaaa-aaaa-aaaa-aaaa-${String(requests.length).padStart(12,'0')}`;runs.set(id,body);
   return route.fulfill({json:{run_id:id,job_id:body.job_id,stage:body.document_type==='coverLetter'&&delayResume?'queued':'writing'}});
  }
  const runId=path.split('/').pop(),input=runs.get(runId);
  if(!released||(input.document_type==='coverLetter'&&delayResume&&!releaseCover))return route.fulfill({json:{run_id:runId,job_id:input.job_id,stage:input.document_type==='coverLetter'?'queued':'writing'}});
  const kinds=input.document_type==='both'?['resume','coverLetter']:[input.document_type];const documents=[];
  for(const kind of kinds){
   const url=kind==='resume'?resume:cover;api.getJob()[kind==='resume'?'resume':'cover_letter']=url;
   const doc={document_type:kind,document_url:url,document_sha256:createHash('sha256').update(url).digest('hex'),file_id:kind==='resume'?'resume1234567890':'cover1234567890',drive_url:`https://drive.google.com/file/d/${kind==='resume'?'resume1234567890':'cover1234567890'}/view`};documents.push(doc);
   await page.evaluate(async data=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata:data}),doc);
  }
  await route.fulfill({json:{run_id:runId,job_id:input.job_id,stage:'complete',documents}});
 });
 await page.addInitScript(()=>{window.chatWindows=0;window.open=()=>{window.chatWindows++;return null;};});
 return {requests,ready:()=>expect(page.locator('#statusFilter option[value="Interested"]')).toHaveCount(1),release:()=>{released=true;},releaseCover:()=>{releaseCover=true;},resume,cover};
}

test('Generate both uses one-click helper for both saved PDFs and survives refresh',async({page})=>{
 const api=await mockRaven(page),helper=await mockOneClickQueue(page,api);
 await page.goto('/');await helper.ready();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await openDetailSection(page,"Job details");await jobDetail(page, "[data-generate-both]").click();await expect(page.locator('#syncStatus')).toContainText('copied to Drive');
 expect(helper.requests).toEqual([{job_id:'job-1',document_type:'both'}]);expect(api.getGenerationCalls()).toBe(0);expect(api.getJob().resume).toBe(helper.resume);expect(api.getJob().cover_letter).toBe(helper.cover);
 expect(await page.evaluate(()=>window.chatWindows)).toBe(0);await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(page.getByRole('link',{name:'Current PDF'})).toHaveCount(2);expect(api.getJob().status).toBe('Saved');
});

test('cover can queue while resume writes and reservations remain busy through rerender',async({page})=>{
 const api=await mockRaven(page),helper=await mockOneClickQueue(page,api,{delayResume:true});
 await page.goto('/');await helper.ready();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await page.locator('[data-generate="resume"]').click();await expect(page.locator('[data-generate="resume"]')).toHaveAttribute('aria-busy','true');
 await page.locator('[data-generate="coverLetter"]').click();await expect(page.locator('[data-generate="coverLetter"]')).toHaveAttribute('aria-busy','true');
 await expect(page.locator('[data-generate="coverLetter"]')).toHaveText('Generate');
 await expect(page.locator('[data-generate="resume"]')).toHaveAttribute('aria-busy','true');await expect(jobDetail(page, "[data-generate-both]")).toBeDisabled();
 await expect.poll(()=>helper.requests.map(x=>x.document_type)).toEqual(['resume','coverLetter']);expect(api.getGenerationCalls()).toBe(0);
 // Collapsing and re-opening re-renders the controls without losing reservations.
 await page.locator('[data-close-job-detail]').click();await page.locator('.job-card-summary').first().click();await expect(page.locator('[data-generate="coverLetter"]')).toHaveAttribute('aria-busy','true');
 helper.release();await expect.poll(()=>api.getJob().resume).toBe(helper.resume);helper.releaseCover();await expect.poll(()=>api.getJob().cover_letter).toBe(helper.cover);
 await expect(page.locator('#syncStatus')).toContainText('copied to Drive');expect(helper.requests).toHaveLength(2);
});

test('both reserves each document and overlapping duplicate requests show visible feedback',async({page})=>{
 const api=await mockRaven(page),helper=await mockOneClickQueue(page,api,{delayResume:true});
 await page.goto('/');await helper.ready();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await page.evaluate(()=>{window.staleResume=document.querySelector('[data-generate="resume"]');window.staleBoth=document.querySelector('[data-generate-both]');});
 await openDetailSection(page,"Job details");await jobDetail(page, "[data-generate-both]").click();await expect(page.locator('[data-generate="resume"]')).toBeDisabled();await expect(page.locator('[data-generate="coverLetter"]')).toBeDisabled();
 // A stale control event cannot bypass the reservation, even if delivered after re-render.
 await page.evaluate(()=>{window.staleResume.click();window.staleBoth.click();});
 await expect(page.locator('#syncStatus')).toContainText('already queued or being generated');
 await expect.poll(()=>helper.requests.length).toBe(1);helper.release();await expect(page.locator('#syncStatus')).toContainText('copied to Drive');expect(helper.requests).toHaveLength(1);
});

test('one-click completion does not open review after the user leaves the job',async({page})=>{
 const api=await mockRaven(page),helper=await mockOneClickQueue(page,api,{delayResume:true});
 await page.goto('/');await helper.ready();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();await page.locator('[data-generate="resume"]').click();
 await page.locator('[data-close-job-detail]').click();helper.release();await expect(page.locator('#syncStatus')).toContainText('copied to Drive');
 await expect(page.locator('dialog[open]')).toHaveCount(0);expect(api.getJob().resume).toBe(helper.resume);
});

test('one-click stopped helper reports recovery action without opening ChatGPT or claiming success',async({page})=>{
  await mockRaven(page);
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
  await page.route('http://127.0.0.1:8766/**',route=>route.abort());
  await page.addInitScript(()=>{window.chatWindows=0;window.open=()=>{window.chatWindows++;return null;};});
  await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();await openDocumentMenu(page,'resume');await page.locator('[data-chatgpt-prompt="resume"]').click();
  await expect(page.locator('#syncStatus')).toContainText('Start the Raven one-click helper');expect(await page.evaluate(()=>window.chatWindows)).toBe(0);
  await expect(page.locator('[data-chatgpt-prompt="resume"]')).not.toHaveAttribute('aria-busy','true');
});

test('Prepare application opens verified attachments for an Applied job without changing its status',async({page})=>{
 const api=await mockRaven(page,{initialJob:{...savedJob,status:'Applied',resume:'',cover_letter:''}});
 const htmlResume='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><h1>Verified resume</h1></body></html>');
 const htmlCover='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><p>Verified cover letter</p></body></html>');
 const resumeSha=createHash('sha256').update(htmlResume).digest('hex'),coverSha=createHash('sha256').update(htmlCover).digest('hex');
 const runId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF'),pdfHash=createHash('sha256').update(pdf).digest('hex');
 let runCalls=0,documentCalls=0;
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('http://127.0.0.1:8766/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/health')return route.fulfill({json:{application_prepare_supported:true,application_receipts_supported:true}});
  if(path==='/session')return route.fulfill({json:{token:'fixture-token'}});
  expect(route.request().headers().authorization).toBe('Bearer fixture-token');
  if(path==='/runs'){
   runCalls++;expect(route.request().postDataJSON()).toEqual({job_id:'job-1',document_type:'both'});
   const documents=[
    {document_type:'resume',document_url:htmlResume,document_sha256:resumeSha,file_id:'resume1234567890',drive_url:'https://drive.google.com/file/d/resume1234567890/view'},
    {document_type:'coverLetter',document_url:htmlCover,document_sha256:coverSha,file_id:'cover1234567890',drive_url:'https://drive.google.com/file/d/cover1234567890/view'}
   ];
   api.getJob().resume=htmlResume;api.getJob().cover_letter=htmlCover;
   for(const doc of documents)await page.evaluate(async data=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata:data}),doc);
   return route.fulfill({json:{run_id:runId,job_id:'job-1',stage:'complete',documents}});
  }
  if(path==='/application-receipts'){
   const request=route.request().postDataJSON();
   expect(request.job_id).toBe('job-1');
   expect(request.documents.map(doc=>doc.document_sha256)).toEqual([resumeSha,coverSha]);
   return route.fulfill({json:{job_id:'job-1',documents:request.documents}});
  }
  if(path==='/application-documents'){
   documentCalls++;expect(route.request().postDataJSON()).toEqual({job_id:'job-1',documents:[{document_type:'resume',document_sha256:resumeSha},{document_type:'coverLetter',document_sha256:coverSha}]});
   return route.fulfill({json:{job_id:'job-1',documents:['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:i?coverSha:resumeSha,pdf_sha256:pdfHash,file_name:document_type+'.pdf',data_url:'data:application/pdf;base64,'+pdf.toString('base64')}))}});
  }
  throw new Error('Unexpected local writer request '+path);
 });
 await page.addInitScript(()=>{
  window.preparedPacket=null;
  window.preflightRequest=null;
  window.extensionSawReadyDocuments=[];
  const documentsReady=()=>{
   const intent=JSON.parse(localStorage.getItem('raven.application-preparation.v1')||'null');
   return intent?.state==='documents-ready'&&!!intent.documents?.resume?.documentSha256&&!!intent.documents?.coverLetter?.documentSha256;
  };
  const attach=bridge=>{
   bridge.addEventListener('raven-prepare-probe',()=>{window.extensionSawReadyDocuments.push(documentsReady());bridge.dataset.prepareCapability='2';bridge.dispatchEvent(new Event('raven-prepare-capability'));});
   bridge.addEventListener('raven-preflight-application',()=>{
    window.preflightSawReadyDocuments=documentsReady();
    const req=JSON.parse(bridge.dataset.preparePreflightRequest);window.preflightRequest=req;
    bridge.dataset.preparePreflightResponse=JSON.stringify({requestId:req.requestId,ok:true,status:'ready',preflightId:'12345678-1234-4234-8234-123456789abc',tabId:19,observedUrl:req.jobUrl});
    bridge.dispatchEvent(new Event('raven-preflight-response'));
   });
   bridge.addEventListener('raven-prepare-application',()=>{
    const req=JSON.parse(bridge.dataset.prepareRequest);
    if(req.requestId!==window.preflightRequest?.requestId||req.preflightId!=='12345678-1234-4234-8234-123456789abc')throw Error('Packet binding differs from preflight.');
    window.preparedPacket=req.packet;bridge.dataset.prepareResponse=JSON.stringify({requestId:req.requestId,ok:true,tabId:19});bridge.dispatchEvent(new Event('raven-prepare-response'));
   });
  };
  const observer=new MutationObserver(()=>{const bridge=document.getElementById('ravenExtensionBridge');if(bridge){observer.disconnect();attach(bridge);}});observer.observe(document,{childList:true,subtree:true});
 });
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(page.getByRole('button',{name:'Prepare again for review'})).toBeVisible();
 await page.getByRole('button',{name:'Prepare again for review'}).click();
 await expect(page.locator('#syncStatus')).toHaveText('Application opened for preparation—review fields and attachments in Chrome');
 const packet=await page.evaluate(()=>window.preparedPacket);
 expect(await page.evaluate(()=>window.extensionSawReadyDocuments)).toEqual([true,true]);
 expect(await page.evaluate(()=>window.preflightSawReadyDocuments)).toBe(true);
 expect(packet.version).toBe(2);expect(packet.mode).toBe('prepare');expect(packet.jobId).toBe('job-1');expect(packet.resume).toMatch(/^data:application\/pdf;base64,/);expect(packet.coverLetter).toMatch(/^data:application\/pdf;base64,/);
 expect(runCalls).toBe(1);expect(documentCalls).toBe(1);expect(api.getJob().status).toBe('Applied');
});

test('access-gated Prepare saves verified PDFs and explicit Resume reuses them without early dispatch',async({page})=>{
 const api=await mockRaven(page,{initialJob:{...savedJob,resume:'',cover_letter:''}});
 const htmlResume='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><h1>Verified resume</h1></body></html>');
 const htmlCover='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><p>Verified cover letter</p></body></html>');
 const resumeSha=createHash('sha256').update(htmlResume).digest('hex'),coverSha=createHash('sha256').update(htmlCover).digest('hex');
 const runId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF'),pdfHash=createHash('sha256').update(pdf).digest('hex');
 let runCalls=0,receiptCalls=0,pdfCalls=0;
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('http://127.0.0.1:8766/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/health')return route.fulfill({json:{application_prepare_supported:true,application_receipts_supported:true}});
  if(path==='/session')return route.fulfill({json:{token:'fixture-token'}});
  expect(route.request().headers().authorization).toBe('Bearer fixture-token');
  if(path==='/runs'){
   runCalls++;expect(route.request().postDataJSON()).toEqual({job_id:'job-1',document_type:'both'});
   const documents=[
    {document_type:'resume',document_url:htmlResume,document_sha256:resumeSha,file_id:'resume1234567890',drive_url:'https://drive.google.com/file/d/resume1234567890/view'},
    {document_type:'coverLetter',document_url:htmlCover,document_sha256:coverSha,file_id:'cover1234567890',drive_url:'https://drive.google.com/file/d/cover1234567890/view'}
   ];
   api.getJob().resume=htmlResume;api.getJob().cover_letter=htmlCover;
   for(const doc of documents)await page.evaluate(async data=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata:data}),doc);
   return route.fulfill({json:{run_id:runId,job_id:'job-1',stage:'complete',documents}});
  }
  if(path==='/application-receipts'){
   receiptCalls++;const request=route.request().postDataJSON();
   expect(request.documents.map(doc=>doc.document_sha256)).toEqual([resumeSha,coverSha]);
   return route.fulfill({json:{job_id:'job-1',documents:request.documents}});
  }
  if(path==='/application-documents'){
   pdfCalls++;const request=route.request().postDataJSON();
   expect(request.documents.map(doc=>doc.document_sha256)).toEqual([resumeSha,coverSha]);
   return route.fulfill({json:{job_id:'job-1',documents:['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:i?coverSha:resumeSha,pdf_sha256:pdfHash,file_name:document_type+'.pdf',data_url:'data:application/pdf;base64,'+pdf.toString('base64')}))}});
  }
  throw new Error('Unexpected local writer request '+path);
 });
 await page.addInitScript(()=>{
  window.gateOpen=true;window.preparedPackets=[];window.preflightRequests=[];
  const attach=bridge=>{
   bridge.addEventListener('raven-prepare-probe',()=>{bridge.dataset.prepareCapability='2';bridge.dispatchEvent(new Event('raven-prepare-capability'));});
   bridge.addEventListener('raven-preflight-application',()=>{
    const req=JSON.parse(bridge.dataset.preparePreflightRequest);window.preflightRequests.push(req);
    bridge.dataset.preparePreflightResponse=JSON.stringify(window.gateOpen
      ? {requestId:req.requestId,ok:false,status:'manual',reason:'Application requires sign-in or an account.'}
      : {requestId:req.requestId,ok:true,status:'ready',preflightId:'12345678-1234-4234-8234-123456789abc',tabId:19,observedUrl:req.jobUrl});
    bridge.dispatchEvent(new Event('raven-preflight-response'));
   });
   bridge.addEventListener('raven-prepare-application',()=>{
    const req=JSON.parse(bridge.dataset.prepareRequest);window.preparedPackets.push(req.packet);
    bridge.dataset.prepareResponse=JSON.stringify({requestId:req.requestId,ok:true,tabId:19});bridge.dispatchEvent(new Event('raven-prepare-response'));
   });
  };
  const observer=new MutationObserver(()=>{const bridge=document.getElementById('ravenExtensionBridge');if(bridge){observer.disconnect();attach(bridge);}});observer.observe(document,{childList:true,subtree:true});
 });
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await jobDetail(page,'[data-prepare-application]').click();
 await expect(page.locator('#syncStatus')).toContainText('Documents ready; employer form needs manual access');
 await expect(jobDetail(page,'[data-prepare-application]')).toHaveText('Resume preparation');
 await expect(page.getByRole('link',{name:'Current PDF'})).toHaveCount(2);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven.application-preparation.v1')));
 expect(saved.state).toBe('documents-ready');expect(saved.documents.resume.documentSha256).toBe(resumeSha);expect(saved.documents.coverLetter.documentSha256).toBe(coverSha);
 expect(await page.evaluate(()=>window.preparedPackets.length)).toBe(0);
 expect(runCalls).toBe(1);expect(receiptCalls).toBe(1);expect(pdfCalls).toBe(1);
 await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(jobDetail(page,'[data-prepare-application]')).toHaveText('Resume preparation');
 expect(runCalls).toBe(1);expect(await page.evaluate(()=>window.preparedPackets.length)).toBe(0);
 await page.evaluate(()=>{window.gateOpen=false;});
 await jobDetail(page,'[data-prepare-application]').click();
 await expect(page.locator('#syncStatus')).toContainText('Application opened for preparation');
 expect(runCalls).toBe(1);expect(receiptCalls).toBe(2);expect(pdfCalls).toBe(2);
 expect(await page.evaluate(()=>window.preparedPackets.length)).toBe(1);
 expect(api.getJob().status).toBe('Saved');
});

for(const extensionMode of ['missing','outdated'])test(`Prepare finishes documents with ${extensionMode} extension, then explicit Resume delivers them`,async({page})=>{
 const api=await mockRaven(page,{initialJob:{...savedJob,resume:'',cover_letter:''}});
 const htmlResume='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><h1>Verified resume</h1></body></html>');
 const htmlCover='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><p>Verified cover letter</p></body></html>');
 const resumeSha=createHash('sha256').update(htmlResume).digest('hex'),coverSha=createHash('sha256').update(htmlCover).digest('hex');
 const pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF'),pdfHash=createHash('sha256').update(pdf).digest('hex');
 let runCalls=0,receiptCalls=0,pdfCalls=0;
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('http://127.0.0.1:8766/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/health')return route.fulfill({json:{application_prepare_supported:true,application_receipts_supported:true}});
  if(path==='/session')return route.fulfill({json:{token:'fixture-token'}});
  expect(route.request().headers().authorization).toBe('Bearer fixture-token');
  if(path==='/runs'){
   runCalls++;expect(route.request().postDataJSON()).toEqual({job_id:'job-1',document_type:'both'});
   const documents=[
    {document_type:'resume',document_url:htmlResume,document_sha256:resumeSha,file_id:'resume1234567890',drive_url:'https://drive.google.com/file/d/resume1234567890/view'},
    {document_type:'coverLetter',document_url:htmlCover,document_sha256:coverSha,file_id:'cover1234567890',drive_url:'https://drive.google.com/file/d/cover1234567890/view'}
   ];
   api.getJob().resume=htmlResume;api.getJob().cover_letter=htmlCover;
   for(const doc of documents)await page.evaluate(async data=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata:data}),doc);
   return route.fulfill({json:{run_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',job_id:'job-1',stage:'complete',documents}});
  }
  if(path==='/application-receipts'){
   receiptCalls++;const request=route.request().postDataJSON();
   expect(request.job_id).toBe('job-1');expect(request.documents.map(doc=>doc.document_sha256)).toEqual([resumeSha,coverSha]);
   return route.fulfill({json:{job_id:'job-1',documents:request.documents}});
  }
  if(path==='/application-documents'){
   pdfCalls++;const request=route.request().postDataJSON();
   expect(request.documents.map(doc=>doc.document_sha256)).toEqual([resumeSha,coverSha]);
   return route.fulfill({json:{job_id:'job-1',documents:['resume','coverLetter'].map((document_type,i)=>({document_type,document_sha256:i?coverSha:resumeSha,pdf_sha256:pdfHash,file_name:document_type+'.pdf',data_url:'data:application/pdf;base64,'+pdf.toString('base64')}))}});
  }
  throw new Error('Unexpected local writer request '+path);
 });
 await page.addInitScript(mode=>{
  window.extensionMode=mode;window.preflightRequests=[];window.preparedPackets=[];window.extensionProbeCount=0;
  const attach=bridge=>{
   bridge.addEventListener('raven-prepare-probe',()=>{
    window.extensionProbeCount++;
    if(window.extensionMode==='missing')return;
    bridge.dataset.prepareCapability=window.extensionMode==='outdated'?'1':'2';
    bridge.dispatchEvent(new Event('raven-prepare-capability'));
   });
   bridge.addEventListener('raven-preflight-application',()=>{
    const req=JSON.parse(bridge.dataset.preparePreflightRequest);window.preflightRequests.push(req);
    bridge.dataset.preparePreflightResponse=JSON.stringify({requestId:req.requestId,ok:true,status:'ready',preflightId:'12345678-1234-4234-8234-123456789abc',tabId:19,observedUrl:req.jobUrl});
    bridge.dispatchEvent(new Event('raven-preflight-response'));
   });
   bridge.addEventListener('raven-prepare-application',()=>{
    const req=JSON.parse(bridge.dataset.prepareRequest);window.preparedPackets.push(req.packet);
    bridge.dataset.prepareResponse=JSON.stringify({requestId:req.requestId,ok:true,tabId:19});
    bridge.dispatchEvent(new Event('raven-prepare-response'));
   });
  };
  const observer=new MutationObserver(()=>{const bridge=document.getElementById('ravenExtensionBridge');if(bridge){observer.disconnect();attach(bridge);}});observer.observe(document,{childList:true,subtree:true});
 },extensionMode);
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 // Wait for runtime settings so this click uses the configured local writer.
 await expect(jobDetail(page,'[data-prepare-application]')).toBeVisible();
 await jobDetail(page,'[data-prepare-application]').click();
 await expect(page.locator('#syncStatus')).toContainText('Documents ready; form filling is unavailable');
 await expect(jobDetail(page,'[data-prepare-application]')).toHaveText('Resume preparation');
 await expect(page.getByRole('link',{name:'Current PDF'})).toHaveCount(2);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven.application-preparation.v1')));
 expect(saved.state).toBe('documents-ready');expect(saved.documents.resume.documentSha256).toBe(resumeSha);expect(saved.documents.coverLetter.documentSha256).toBe(coverSha);
 expect(saved.reason).toMatch(extensionMode==='missing'?/install|enable/i:/update|reload/i);
 expect(runCalls).toBe(1);expect(receiptCalls).toBe(1);expect(pdfCalls).toBe(0);
 expect(await page.evaluate(()=>window.preflightRequests.length)).toBe(0);
 expect(await page.evaluate(()=>window.preparedPackets.length)).toBe(0);
 expect(api.getJob().status).toBe('Saved');

 await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(jobDetail(page,'[data-prepare-application]')).toHaveText('Resume preparation');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven.application-preparation.v1')));
 expect(restored.state).toBe('documents-ready');expect(restored.reason).toBe(saved.reason);
 expect(runCalls).toBe(1);expect(pdfCalls).toBe(0);
 expect(await page.evaluate(()=>window.preflightRequests.length)).toBe(0);
 await page.evaluate(()=>{window.extensionMode='ready';});
 await jobDetail(page,'[data-prepare-application]').click();
 await expect(page.locator('#syncStatus')).toContainText('Application opened for preparation');
 expect(runCalls).toBe(1);expect(receiptCalls).toBe(2);expect(pdfCalls).toBe(1);
 expect(await page.evaluate(()=>window.preflightRequests.length)).toBe(1);
 const packets=await page.evaluate(()=>window.preparedPackets);
 expect(packets).toHaveLength(1);expect(packets[0].jobId).toBe('job-1');
 expect(packets[0].resume).toMatch(/^data:application\/pdf;base64,/);expect(packets[0].coverLetter).toMatch(/^data:application\/pdf;base64,/);
 expect(api.getJob().status).toBe('Saved');
});

test('saved resume Drive action requests exact PDF export to configured folder and preserves resume',async({page})=>{
  await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=false;await route.fulfill({json:config});});
  const resume='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html><body><h1>Test Candidate</h1><p>Saved verified resume.</p></body></html>');
  const api=await mockRaven(page,{initialJob:{resume}});
  await page.addInitScript(()=>{
    window.open=()=>({closed:false,location:{replace:url=>{window.lastChatGptUrl=url;}},close(){}});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  });
  await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
  await page.locator('[data-generate="resume"]').click();
  await page.locator('#reviewSaveDrive').click();
  await expect(page.locator('#syncStatus')).toContainText('verified Drive link');
  const prompt=await page.evaluate(()=>new URL(window.lastChatGptUrl).searchParams.get('q'));
  expect(prompt).toContain('export_document_pdf');expect(prompt).toContain('1-1XjnS0MGWmRl1iAJYmOOxs2pNA6gTkl');
  expect(api.getJob().resume).toBe(resume);
  await page.reload();await page.locator('[data-track="Professional"]').click();await expect(page.locator('.job-card')).toHaveCount(1);expect(api.getJob().resume).toBe(resume);
});

for(const [status,appliedDate] of [
  ["Saved",null,false],["Interested",null,false],["Ready",null,false],
  ["Applied",null,true],["Interview",null,true],["Offer",null,true],["Rejected",null,true],
  ["Saved","2026-10-01",true],["Ignored","2026-10-01",true],["Ignored",null,false]
])test(`stage badge and application history survive for ${status} / ${appliedDate||"no date"}`,async({page})=>{
  const api=await mockRaven(page,{initialJob:{status,applied_date:appliedDate}});
  await page.setViewportSize({width:375,height:900});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator('.job-card')).toHaveCount(1);
  await expect(page.locator('.job-card .job-status')).toHaveText(status);
  const stage=status==="Interested"?"Bookmarked":status==="Ready"?"Tailoring":status==="Ignored"?"Archived / ignored":status==="Saved"?"Active jobs":status;
  await expect(page.locator('.stage-header h2')).toHaveText(stage);
  await page.reload();
  await page.locator('[data-track="Professional"]').click();
  await expect(page.locator('.job-card .job-status')).toHaveText(status);
  expect(api.getJob().applied_date||null).toBe(appliedDate);
  await page.locator('.job-card-summary').first().click();
  await expect(jobDetail(page,'[data-lifecycle-status]')).toHaveValue(status);
  await expect(jobDetail(page,'[data-apply-status]')).toHaveCount(0);
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
    await openDetailSection(page,"Evidence");
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
  await openDetailSection(page,"Job details");
  await expect(jobDetail(page, "[data-approved-apply]")).toBeVisible();

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
      {id:"cached-good",track:"Professional",title:"Cached Project Manager",company:"Acme",location:"Fort Collins, CO",remote:false,url:"https://job-boards.greenhouse.io/acme/jobs/123",source:"ATS:greenhouse",status:"Saved",notes:"Valid cached job."},
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
  for(const name of ["Open employer listing ↗"]){
    const link=page.getByRole("link",{name,exact:true});
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href",savedJob.url);
    await expect(link).toHaveAttribute("target","_blank");
  }
  await openDetailSection(page,"Job details");
  await jobDetail(page, "[data-approved-apply]").click();
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

  await jobDetail(page,"[data-close-job-detail]").click();
  await page.getByRole("button",{name:"Bookmark job"}).click();
  await expect.poll(()=>api.getJob().status).toBe("Interested");
  await expect(watermark()).toBeVisible();
  await expect.poll(style).toEqual(baseline);

  await page.locator(".job-card-summary").first().click();
  await page.locator("[data-lifecycle-status]").selectOption("Applied");
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
  await expect(jobDetail(page, ".job-detail-progress")).toContainText("Creating resume");
  await expect(jobDetail(page, '[data-generate="resume"]')).toHaveAttribute("aria-busy","true");

  await jobDetail(page,"[data-close-job-detail]").click();
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
  await expect(jobDetail(page, ".job-detail-progress")).toContainText("Creating resume");

  await jobDetail(page,"[data-close-job-detail]").click();
  await page.getByRole("button",{name:"Bookmark job"}).click();
  await page.locator(".job-card-summary").first().click();
  await expect.poll(()=>api.getJob().status).toBe("Interested");
  await expect(jobDetail(page, ".job-detail-progress")).toContainText("Creating resume");
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
  await expect(jobDetail(page, ".job-detail-progress")).toContainText("Creating cover letter");
  await expect(jobDetail(page, '[data-generate="coverLetter"]')).toHaveAttribute("aria-busy","true");

  await jobDetail(page,"[data-close-job-detail]").click();
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

test("application preparation reservation follows a discovered job when it receives its saved id",async({page})=>{
 let releaseDescription;
 const descriptionGate=new Promise(resolve=>{releaseDescription=resolve;});
 const discovery={id:"DISC-prepare-race",track:"Professional",title:savedJob.title,company:savedJob.company,location:"Remote",remote:true,url:savedJob.url,source:"Mock",snippet:""};
 const api=await mockRaven(page,{discoveredJob:discovery,savedDiscoveryId:"JT-prepare-race"});
 let descriptionCalls=0;
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('**/functions/v1/raven-enrich-v1**',async route=>{
  descriptionCalls++;
  await descriptionGate;
  await route.fulfill({status:503,json:{ok:false,error:"fixture stopped before generation"}});
 });
 await page.route('http://127.0.0.1:8766/**',route=>route.fulfill({json:{application_prepare_supported:true}}));
 await page.addInitScript(()=>{
  const attach=bridge=>{
   bridge.addEventListener('raven-prepare-probe',()=>{bridge.dataset.prepareCapability='2';bridge.dispatchEvent(new Event('raven-prepare-capability'));});
  };
  const observer=new MutationObserver(()=>{const bridge=document.getElementById('ravenExtensionBridge');if(bridge){observer.disconnect();attach(bridge);}});observer.observe(document,{childList:true,subtree:true});
 });
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await jobDetail(page, "[data-prepare-application]").click();
 await expect.poll(()=>api.getJob().id).toBe("JT-prepare-race");
 await expect.poll(()=>descriptionCalls).toBe(1);
 // Collapse/reopen forces a render from the saved ID. The live reservation must
 // still disable the control while the original preparation is waiting.
 await jobDetail(page,'[data-close-job-detail]').click();
 await page.locator('.job-card-summary').first().click();
 await expect(jobDetail(page, "[data-prepare-application]")).toBeDisabled();
 expect(api.getAddJobCalls()).toBe(1);expect(descriptionCalls).toBe(1);
 releaseDescription();
 await expect(page.locator('#syncStatus')).toContainText('fixture stopped before generation');
 await expect(jobDetail(page, "[data-prepare-application]")).toBeEnabled();
 expect(api.getAddJobCalls()).toBe(1);expect(descriptionCalls).toBe(1);
});

for (const track of ["Games / 3D", "Professional", "Labor", "Wildcard"]) {
  test(`canonical profile generates both documents without device masters: ${track}`, async ({page}) => {
    const errors=[]; page.on("pageerror",error=>errors.push(error.message));
    const api=await mockRaven(page,{generatorDelayMs:700,initialJob:{track,...(track==="Games / 3D"?{title:"Senior Environment Artist",company:"Example Studio"}:{})}});
    await page.goto("/");
    await page.getByRole("tab",{name:track,exact:true}).click();
    await page.locator(".job-card-summary").first().click();
    for(const type of ["resume","coverLetter"]){
      await jobDetail(page, `[data-generate="${type}"]`).click();
      await expect(jobDetail(page, ".job-detail-progress")).toBeVisible();
      await expect(jobDetail(page, '[data-generate="'+type+'"]')).toHaveAttribute("aria-busy","true");
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
  await expect(jobDetail(page, ".job-detail-progress")).toHaveCount(0);
  await page.route("**/functions/v1/raven-generate-v1**",route=>route.fulfill({json:{ok:true,final_review:{status:"passed",factual_review:{status:"passed"}},resume:generatedResume}}));
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#documentReviewDialog")).toBeVisible();
  await expect(page.locator(".document-generation-error")).toHaveCount(0);
});

test("failed pair errors survive reload and retry clears only the successful document",async({page})=>{
  await mockRaven(page,{generatorFails:true});
  const openJob=async()=>{
    await page.getByRole('tab',{name:'Professional',exact:true}).click();
    await page.locator('.job-card-summary').first().click();
  };
  const errors=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ravenGenerationErrorsV1')||'{}'));
  await page.goto('/');await openJob();
  await jobDetail(page,'[data-generate-both]').click();
  await expect(page.locator('.document-generation-error')).toHaveCount(2);
  await expect.poll(errors).toEqual({
    'job-1|resume':'resume generation failed: Mock generator unavailable',
    'job-1|coverLetter':'cover letter generation failed: Mock generator unavailable'
  });
  await page.reload();await openJob();
  await expect(page.locator('.document-generation-error')).toHaveCount(2);
  await page.route('**/functions/v1/raven-generate-v1**',route=>route.fulfill({json:{ok:true,final_review:{status:'passed',factual_review:{status:'passed'}},resume:generatedResume}}));
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  await expect.poll(errors).toEqual({'job-1|coverLetter':'cover letter generation failed: Mock generator unavailable'});
  await page.reload();await openJob();
  await expect(page.locator('[data-generate="resume"]')).toHaveText('Review');
  await expect(page.locator('.document-generation-error')).toHaveCount(1);
  await expect(page.locator('.document-generation-error')).toContainText('cover letter generation failed');
});

test("failed pair preserves its successful sibling across reload and retry",async({page})=>{
  const api=await mockRaven(page);
  const calls=[];let coverFails=true;
  await page.route('**/functions/v1/raven-generate-v1**',route=>{
    const body=JSON.parse(route.request().postData());calls.push(body.documentType);
    if(body.documentType==='coverLetter'&&coverFails)return route.fulfill({status:503,json:{ok:false,error:'Cover reviewer unavailable'}});
    return route.fulfill({json:{ok:true,final_review:{status:'passed',factual_review:{status:'passed'}},...(body.documentType==='resume'?{resume:generatedResume}:{coverLetter:generatedLetter})}});
  });
  const openJob=async()=>{
    await page.getByRole('tab',{name:'Professional',exact:true}).click();
    await page.locator('.job-card-summary').first().click();
  };
  await page.goto('/');await openJob();
  await jobDetail(page,'[data-generate-both]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  const prior=api.getJob().resume;expect(prior).toContain('data:text/html');
  await page.reload();await openJob();
  await expect(page.locator('[data-generate="resume"]')).toHaveText('Review');
  await expect(page.locator('.document-generation-error')).toContainText('Cover reviewer unavailable');
  expect(api.getJob().resume).toBe(prior);
  coverFails=false;
  await jobDetail(page,'[data-generate-both]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  expect(calls).toEqual(['resume','coverLetter','coverLetter']);
  expect(api.getJob().resume).toBe(prior);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ravenGenerationErrorsV1')||'{}'))).toEqual({});
  await page.reload();await openJob();
  await expect(page.locator('[data-generate="resume"]')).toHaveText('Review');
  await expect(page.locator('[data-generate="coverLetter"]')).toHaveText('Review');
  await expect(page.locator('.document-generation-error')).toHaveCount(0);
});

for(const type of ["resume","coverLetter"]){
  test(`Regenerate bypasses cached ${type} with no device master`,async({page})=>{
    const api=await mockRaven(page);
    await page.goto("/");
    await page.getByRole("tab",{name:"Professional",exact:true}).click();
    await page.locator(".job-card-summary").first().click();
    await jobDetail(page, `[data-generate="${type}"]`).click();
    await expect(page.locator("#documentReviewDialog")).toBeVisible();
    await page.getByRole("button",{name:"Close",exact:true}).click();
    const label=type==="resume"?"resume":"cover letter";
    await page.getByRole("button",{name:`More ${label} options`}).click();
    await page.getByRole("menuitem",{name:"Regenerate",exact:true}).click();
    await expect(page.locator("#documentReviewDialog")).toBeVisible();
    expect(api.getGenerationCalls()).toBe(2);
  });
}

test("Generate both creates and persists both documents from one button",async({page})=>{
  const api=await mockRaven(page);
  await page.goto('/');
  await page.getByRole('tab',{name:'Professional',exact:true}).click();
  await page.locator('.job-card-summary').first().click();
  await jobDetail(page,'[data-generate-both]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  expect(api.getGenerationBodies().map(body=>body.documentType)).toEqual(['resume','coverLetter']);
  expect(api.getJob().resume).toContain('data:text/html');
  expect(api.getJob().coverLetter||api.getJob().cover_letter).toContain('data:text/html');
  await page.reload();
  await page.getByRole('tab',{name:'Professional',exact:true}).click();
  await page.locator('.job-card-summary').first().click();
  await expect(page.locator('[data-generate="resume"]')).toHaveText('Review');
  await expect(page.locator('[data-generate="coverLetter"]')).toHaveText('Review');
});

test("Finish documents preserves an existing resume",async({page})=>{
  const prior='data:text/html;charset=utf-8,'+encodeURIComponent('<h1>Prior approved resume</h1>');
  const api=await mockRaven(page,{initialJob:{resume:prior}});
  await page.goto('/');
  await page.getByRole('tab',{name:'Professional',exact:true}).click();
  await page.locator('.job-card-summary').first().click();
  await jobDetail(page,'[data-generate-both]').click();
  await expect(page.locator('#documentReviewDialog')).toBeVisible();
  expect(api.getGenerationBodies().map(body=>body.documentType)).toEqual(['coverLetter']);
  expect(api.getJob().resume).toBe(prior);
});

test("summary-only revision preserves exact saved HTML through reload and rejects widening",async({page})=>{
  const original='<!doctype html><html><head><style>.summary{color:#123}</style></head><body><h1>Original Name</h1><p class="headline">Original headline</p><p class="summary">Original summary.</p><ul><li>Original bullet with exact punctuation!</li></ul></body></html>';
  const resume="data:text/html;charset=utf-8,"+encodeURIComponent(original);
  const api=await mockRaven(page,{initialJob:{resume}});
  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await page.locator("#reviewInstructions").fill("Rewrite only the summary in a punchy tone.");
  await page.locator("#reviewSubmit").click();
  await expect(page.locator("#reviewFeedback")).toContainText("Updated draft saved");
  const expected="data:text/html;charset=utf-8,"+encodeURIComponent(original.replace('Original summary.','Experienced delivery leader. Updated to apply the requested revision.'));
  expect(api.getJob().resume).toBe(expected);
  expect(api.getGenerationBodies()[0].revisionSection).toBe("summary");
  await page.evaluate(()=>localStorage.removeItem("ravenJobsCacheV1"));
  await page.reload();
  await page.locator('[data-track="Professional"]').click();
  await page.locator(".job-card-summary").first().click();
  await page.locator('[data-generate="resume"]').click();
  await expect(page.locator("#reviewFrame")).toHaveAttribute("src",expected);
  await page.route("**/functions/v1/raven-generate-v1**",route=>route.fulfill({json:{ok:true,final_review:{status:"passed",factual_review:{status:"passed"}},resume:generatedResume}}));
  await page.locator("#reviewInstructions").fill("Rewrite only the summary.");
  await page.locator("#reviewSubmit").click();
  await expect(page.locator("#reviewFeedback")).toContainText("previous document is unchanged");
  expect(api.getJob().resume).toBe(expected);
});


test("game tab hides unrelated saved roles and retains environment art after reload",async({page})=>{
 await mockRaven(page);
 await page.route("**/functions/v1/raven-backend-v3?action=jobs",route=>route.fulfill({json:{ok:true,jobs:[
  {...savedJob,id:"art",track:"Games / 3D",title:"Senior Environment Artist",company:"Example Studio",url:"https://example.com/art"},
  {...savedJob,id:"bad",track:"Games / 3D",title:"Community Participation Supports Supervisor",url:"https://example.com/community"}
 ]}}));
 for(let pass=0;pass<2;pass++){
  if(pass)await page.reload();else await page.goto("/");
  await page.getByRole("tab",{name:"Games / 3D",exact:true}).click();
  await expect(page.locator(".job-card-summary").filter({hasText:"Senior Environment Artist"})).toBeVisible();
  await expect(page.locator(".job-card-summary").filter({hasText:"Community Participation"})).toHaveCount(0);
 }
});

for(const failure of ['unreviewed','fallback','rendered-duplicate'])test(`final review preserves saved resume on ${failure}`,async({page})=>{
 const old='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><h1>Test Candidate</h1><p class="summary">Previously reviewed saved resume.</p></body></html>');
 const api=await mockRaven(page,{initialJob:{resume:old}});
 const repeated='Delivered complex projects with colleagues across several internal teams and departments.';
 const resume=failure==='rendered-duplicate'?{...generatedResume,summary:repeated,experience:[{...generatedResume.experience[0],bullets:[repeated]}]}:generatedResume;
 const payload={ok:true,resume,...(failure==='unreviewed'?{}:{final_review:{status:'passed',factual_review:{status:'passed'}}}),...(failure==='fallback'?{ai_used:false,fallback_used:true}:{})};
 await page.route('**/functions/v1/raven-generate-v1**',route=>route.fulfill({json:payload}));
 await page.goto('/');await page.getByRole('tab',{name:'Professional',exact:true}).click();
 await page.locator('.job-card-summary').first().click();await page.locator('[data-generate="resume"]').click();
 await page.locator('#reviewInstructions').fill('Rewrite this document with a more formal tone.');await page.locator('#reviewSubmit').click();
 await expect(page.locator('#reviewFeedback')).toContainText('previous document is unchanged',{ignoreCase:true});
 expect(api.getJob().resume).toBe(old);
 await page.reload();await page.getByRole('tab',{name:'Professional',exact:true}).click();await page.locator('.job-card-summary').first().click();await page.locator('[data-generate="resume"]').click();
 await expect(page.locator('#reviewFrame')).toHaveAttribute('src',old);
});

test('rendered review rejects omitted education and highlights',async({page})=>{
 await mockRaven(page);await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {reviewRenderedDocument}=await import('/supabase/functions/_shared/document-review.mjs');
  return reviewRenderedDocument('resume','<html><body><h1>Candidate</h1><p>Summary text.</p></body></html>',{name:'Candidate',summary:'Summary text.',education:[{degree:'BFA',school:'College',dates:'2008'}],additional:['Mentored newer artists.']});
 });
 expect(result.status).toBe('blocked');expect(result.issues).toContain('Rendered document is missing expected content.');
});

for (const width of [320,375,768,1440]) {
 test(`status pills fit at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await mockRaven(page,{initialJob:{status:'Ignored'}});
  await page.goto('/');await page.locator('[data-track="Professional"]').click();
  const status=page.locator('.job-status').filter({hasText:'Ignored'});
  await expect(status).toBeVisible();
  const boxes=await status.evaluate(el=>({pill:el.getBoundingClientRect().toJSON(),parent:el.parentElement.getBoundingClientRect().toJSON(),scroll:el.scrollWidth,client:el.clientWidth}));
  expect(boxes.pill.width).toBeGreaterThan(40);
  expect(boxes.pill.height).toBeLessThan(35);
  expect(boxes.scroll).toBeLessThanOrEqual(boxes.client+1);
  expect(boxes.pill.right).toBeLessThanOrEqual(boxes.parent.right+1);
 });
}

test('confirmed closure removes saved job from active stage but preserves documents through reload',async({page})=>{
 const resume='data:text/html,<h1>Existing resume</h1>',letter='data:text/html,<p>Existing cover letter</p>';
 const api=await mockRaven(page,{initialJob:{resume,cover_letter:letter},availabilityResponse:{ok:true,expired:true,availability:{state:'closed',reason:'Source states: This job is closed',checked_at:'2026-10-08T16:00:00Z',source_url:savedJob.url,http_status:200}}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.stage-header')).toContainText(['Active jobs']);
 await page.locator('#searchJobsButton').click();
 await expect(page.locator('.listing-availability')).toContainText('Listing closed');
 await expect(page.locator('.stage-header')).toContainText(['Archived / ignored']);
 expect(api.getJob().status).toBe('Saved');expect(api.getJob().resume).toBe(resume);expect(api.getJob().cover_letter).toBe(letter);
 await page.reload();await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.listing-availability')).toContainText('Listing closed');
 await page.locator('.job-title').click();
 await expect(jobDetail(page, 'button[data-generate="resume"]')).toBeVisible();
});

test('closed interview retains interview stage and application history',async({page})=>{
 const api=await mockRaven(page,{initialJob:{status:'Interview',applied_date:'2026-10-01T12:00:00Z',listing_state:'closed',listing_reason:'JobPosting expired',listing_checked_at:'2026-10-08T16:00:00Z'}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.stage-header')).toContainText(['Interview']);
 await expect(page.locator('.listing-availability')).toBeVisible();
 expect(api.getJob().status).toBe('Interview');expect(api.getJob().applied_date).toBe('2026-10-01T12:00:00Z');
});

test('unconfirmed source check retains active saved job',async({page})=>{
 const api=await mockRaven(page,{availabilityResponse:{ok:true,expired:false,availability:{state:'unconfirmed',reason:'Source check blocked or unavailable',checked_at:'2026-10-08T16:00:00Z',http_status:403}}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('#searchJobsButton').click();
 await expect(page.locator('.stage-header')).toContainText(['Active jobs']);await expect(page.locator('.listing-availability')).toHaveCount(0);
 expect(api.getJob().status).toBe('Saved');
});

test('legacy closed saved row remains accessible even without fresh discovery',async({page})=>{
 await mockRaven(page,{initialJob:{id:'DISC-legacy',status:'Saved',viewed:false,listing_state:'closed',listing_reason:'Source confirmed closed',listing_checked_at:'2026-10-08T16:00:00Z'}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.job-title')).toHaveText(savedJob.title);
 await expect(page.locator('.stage-header')).toContainText(['Archived / ignored']);
});

test('closed discovery is excluded while closed saved history survives active location eligibility',async({page})=>{
 await mockRaven(page,{initialJob:{status:'Saved',location:'New York, NY',remote:false,listing_state:'closed',listing_reason:'Source confirmed closed',listing_checked_at:'2026-10-08T16:00:00Z'}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.job-title')).toHaveText(savedJob.title);
 await expect(page.locator('.stage-header')).toContainText(['Archived / ignored']);
});

test('confirmed closed discovered row never enters active results',async({page})=>{
 await mockRaven(page,{discoveredJob:{id:'closed-discovery',track:'Professional',title:savedJob.title,company:savedJob.company,location:'Remote',remote:true,url:savedJob.url,listing_state:'closed',last_seen:new Date().toISOString(),snippet:savedJob.notes}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await expect(page.locator('.job-title')).toHaveCount(0);
});

test("employer listing link stays passive across repeat visits and reload",async({page})=>{
 const api=await mockRaven(page,{generatorDelayMs:250});
 await page.route('https://example.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Employer listing</h1>'}));
 await page.goto("/");await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 const link=jobDetail(page,'[data-employer-link]');
 await expect(link).toHaveAttribute('href',savedJob.url);
 await expect(link).toHaveAttribute('target','_blank');
 for(let i=0;i<2;i++){
  const popup=page.waitForEvent('popup');await link.click();const employer=await popup;
  await expect(employer).toHaveURL(savedJob.url);await employer.close();
 }
 expect(api.getGenerationCalls()).toBe(0);
 expect(api.getJob().resume).toBe('');
 expect(api.getJob().cover_letter).toBe('');
 await expect(page.locator('#documentReviewDialog')).not.toBeVisible();
 await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(jobDetail(page,'[data-employer-link]')).toHaveAttribute('href',savedJob.url);
});
test("passive employer listing preserves an existing resume",async({page})=>{
 const api=await mockRaven(page,{initialJob:{resume:'data:text/html,existing'}});
 await page.route('https://example.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Employer listing</h1>'}));
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 const popup=page.waitForEvent('popup');await jobDetail(page,'[data-employer-link]').click();await (await popup).close();
 expect(api.getGenerationCalls()).toBe(0);expect(api.getJob().resume).toBe('data:text/html,existing');
});
test("missing listing URL offers no employer navigation or automatic document write",async({page})=>{
 const api=await mockRaven(page,{initialJob:{url:''}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await expect(jobDetail(page,'[data-employer-link]')).toHaveCount(0);
 await expect(jobDetail(page,'.posting-unavailable')).toContainText('Listing link unavailable');
 expect(api.getGenerationCalls()).toBe(0);expect(api.getJob().resume).toBe('');
});

test('Drive exports remain visible when workflow progress fills the activity window',async({page})=>{
 const resume='data:text/html,resume',cover='data:text/html,cover';
 const hashes={resume:createHash('sha256').update(resume).digest('hex'),coverLetter:createHash('sha256').update(cover).digest('hex')};
 await mockRaven(page,{initialJob:{resume,cover_letter:cover}});
 await page.goto('/');await page.locator('[data-track="Professional"]').click();
 await page.evaluate(async hashes=>{
  for(const kind of ['resume','coverLetter'])await window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata:{document_type:kind,document_sha256:hashes[kind],drive_url:'https://drive.google.com/file/d/'+(kind==='resume'?'resume12345678':'cover123456789')+'/view'}});
  for(let i=0;i<12;i++)await window.RavenAPI.addJobEvent('job-1',{eventType:'resume_workflow',summary:'Queued workflow '+i});
 },hashes);
 await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();
 await openDetailSection(page,"Activity");
 await expect(jobDetail(page,'.job-activity').getByRole('link',{name:'Open current PDF in Drive'})).toHaveCount(2);
});

test('paired phone uses remote writer and verifies both PDFs after reload',async({page})=>{
 const api=await mockRaven(page);const token='a'.repeat(64),runId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let starts=0,localCalls=0;
 await page.addInitScript(t=>localStorage.setItem('raven.local-writer.device.v1',t),token);
 await page.route('**/runtime-config.json',async route=>{const response=await route.fetch();const config=await response.json();config.settings['chatgpt-one-click']=true;await route.fulfill({json:config});});
 await page.route('http://127.0.0.1:8766/**',route=>{localCalls++;return route.abort();});
 await page.route('**/functions/v1/raven-local-queue',async route=>{
  expect(route.request().headers()['x-raven-device']).toBe(token);const input=route.request().postDataJSON();
  if(input.action==='enqueue'){starts++;return route.fulfill({json:{run_id:runId,job_id:'job-1',stage:'queued',online:false}});}
  const documents=[];
  for(const kind of ['resume','coverLetter']){
   const url='data:text/html;charset=utf-8,'+encodeURIComponent('<html><body>Verified '+kind+'</body></html>');api.getJob()[kind==='resume'?'resume':'cover_letter']=url;
   const doc={document_type:kind,document_url:url,document_sha256:createHash('sha256').update(url).digest('hex'),file_id:kind+'1234567890',drive_url:'https://drive.google.com/file/d/'+kind+'1234567890/view'};documents.push(doc);
   await page.evaluate(async metadata=>window.RavenAPI.addJobEvent('job-1',{eventType:'document_drive_export',metadata}),doc);
  }
  return route.fulfill({json:{run_id:runId,job_id:'job-1',stage:'complete',online:true,documents}});
 });
 await page.goto('/');await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();await openDetailSection(page,"Job details");await jobDetail(page, "[data-generate-both]").click();
 await expect(jobDetail(page,'.job-detail-progress')).toContainText('waiting for your computer');await expect(page.locator('#syncStatus')).toContainText('copied to Drive');
 expect(starts).toBe(1);expect(localCalls).toBe(0);
 await page.reload();await page.locator('[data-track="Professional"]').click();await page.locator('.job-card-summary').first().click();await expect(page.getByRole('link',{name:'Current PDF'})).toHaveCount(2);
});

test('pairing consumes URL fragment and requires deliberate connect before storage',async({page})=>{
 await page.route('**/functions/v1/raven-local-queue',route=>route.fulfill({json:{online:false}}));
 await page.goto('/pair-writer.html#'+'a'.repeat(64));
 await expect(page).toHaveURL(/pair-writer.html$/);
 expect(await page.evaluate(()=>localStorage.getItem('raven.local-writer.device.v1'))).toBeNull();
 await page.getByRole('button',{name:'Connect this device',exact:true}).click();await expect(page.locator('#status')).toContainText('Connected');
 expect(await page.evaluate(()=>localStorage.getItem('raven.local-writer.device.v1'))).toBe('a'.repeat(64));
 await page.getByRole('button',{name:'Disconnect this device',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('raven.local-writer.device.v1'))).toBeNull();
});
