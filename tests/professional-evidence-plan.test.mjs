import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRoleEvidencePlan,professionalSummaryIssue,isArtDominatedDocument} from '../supabase/functions/_shared/professional-evidence.mjs';
import {reviewFacts,reviewDocument} from '../supabase/functions/_shared/document-review.mjs';
import {validateDraft} from '../supabase/functions/_shared/document-writer.mjs';

const profile={name:'Synthetic Candidate',contact:'candidate@example.com',skills:['Project management','Team leadership','Cross-functional collaboration','Mentoring','Workflow development'],education:[],shipped_titles:[],experience:[
 {id:'studio',role:'Senior Environment Artist',company:'Synthetic Studio',dates:'2021–2025',facts:[{id:'mentor',text:'Provided mentorship to newer artists.'},{id:'collab',text:'Collaborated with programmers and designers to diagnose issues and improve tools and workflows.'},{id:'art',text:'Used a PBR workflow to create realistic game assets.'}]},
 {id:'workflow',role:'Senior Environment Artist',company:'Other Studio',dates:'2011–2017',facts:[{id:'process',text:'Helped define workflows for new art processes.'}]}],transferable_facts:[{id:'delivery',text:'Has project-management experience and a track record of on-time delivery.'},{id:'meetings',text:'Has led meetings with internal teams.'},{id:'training',text:'Has led teams, mentored artists, and supported onboarding and training.'}]};
const mercury={track:'Professional',company:'Synthetic Bank',title:'Customer Support Governance Program Manager',description:'Lead bank charter remediation. Translate regulatory requirements into operational controls. Coordinate cross-functional teams. Establish evidence collection and audit readiness. Mentor and train teams.'};
const claim=(text,fact_ids)=>({text,fact_ids});
const resume={headline:claim('Project management and cross-functional collaboration',['skill:0','skill:2']),summary:claim('Brings project-management experience and a track record of on-time delivery. Mentoring and internal-team meetings provide transferable strengths for coordination.',['delivery','mentor','meetings']),skills:['Project management','Mentoring'],experience:[{experience_id:'studio',bullets:[claim('Provided mentorship to newer artists.',['mentor']),claim('Collaborated with programmers and designers to diagnose issues and improve tools and workflows.',['collab'])]}],additional:[claim('Has led meetings with internal teams.',['meetings'])]};
const assembled=(headline='Project Management, Team Leadership and Cross-Functional Collaboration')=>({name:profile.name,contact:profile.contact,headline,summary:'Brings project-management experience and on-time delivery.',experience:[{role:'Senior Environment Artist',bullets:['Provided mentorship to newer artists in game production.']}],additional:[]});

test('Mercury evidence plan separates grounded transferability from missing banking and audit domains',()=>{
 const plan=buildRoleEvidencePlan(profile,mercury);
 assert.ok(plan.requirements.some(r=>r.status==='gap'&&/bank|regulat|audit/i.test(r.text)));
 assert.ok(plan.requirements.some(r=>r.status==='transferable'||r.status==='supported'));
 assert.ok(plan.general_evidence.some(f=>f.id==='delivery'));
 assert.ok(plan.employer_evidence.find(e=>e.experience_id==='studio').priority_facts.some(f=>f.id==='mentor'||f.id==='collab'));
 for(const e of plan.employer_evidence)assert.ok(!e.priority_facts.some(f=>f.id==='delivery'||f.id==='meetings'));
 assert.ok(!plan.requirements.filter(r=>/bank|regulat|audit/i.test(r.text)).some(r=>r.status==='supported'));
});

test('Mercury false nonexistent project-management and source-industry rejections cannot erase canonical capabilities',async()=>{
 const document=assembled();let request;
 const result=await reviewFacts({kind:'resume',document,profile,target:mercury,complete:async args=>{request=args;return {data:{issues:[
  {path:'headline',code:'unsupported_claim',quote:document.headline,reason:'Project management experience is not explicitly mentioned in the profile.'},
  {path:'experience.0.bullets.0',code:'irrelevant_framing',quote:document.experience[0].bullets[0],reason:'Mentoring is from game development, not banking governance.'}
 ]}};}});
 assert.deepEqual(result.issues,[]);
 assert.equal(request.input.target.description,mercury.description);
 assert.ok(request.input.roleEvidencePlan);
 assert.ok(request.input.supportedCapabilities);
 assert.ok(JSON.stringify(request.input.verifiedBackground).includes('project-management experience'));
});

test('banking domain, unsupported tools and transferred tenure are never neutralized as bare capabilities',async()=>{
 for(const text of ['Project Management and Banking Governance','Project Management with SQL Expertise','Project Management with 17 years of governance experience']){
  const document=assembled(text);
  const result=await reviewFacts({kind:'resume',document,profile,target:mercury,complete:async()=>({data:{issues:[{path:'headline',code:'unsupported_claim',quote:text,reason:'Verified project-management capability does not establish this added domain, tool or tenure.'}]}})});
  assert.equal(result.issues.length,1,text);
 }
 const misleading=assembled(mercury.title+' with banking governance experience');
 assert.equal(reviewDocument('resume',misleading,{profile,target:mercury}).status,'blocked');
});

test('truthful cross-industry transition keeps original roles and general delivery separate from employer claims',()=>{
 const doc=validateDraft('resume',resume,profile,{target:mercury});
 assert.equal(doc.experience[0].role,'Senior Environment Artist');
 assert.equal(doc.additional[0],'Has led meetings with internal teams.');
 assert.ok(!JSON.stringify(doc).includes('bank charter remediation experience'));
 const moved={...resume,experience:[{experience_id:'studio',bullets:[claim('Delivered projects on time.',['delivery'])]}]};
 assert.throws(()=>validateDraft('resume',moved,profile,{target:mercury}),/another employer or general background/);
});

test('Ashby-like generic capabilities require concrete available evidence without invented SaaS tenure',()=>{
 const ashby={track:'Professional',company:'Synthetic SaaS',title:'Customer Success Manager',description:'Coordinate projects, train customers, troubleshoot software and build relationships.'};
 const plan=buildRoleEvidencePlan(profile,ashby);
 assert.ok(plan.general_evidence.some(f=>f.id==='delivery'||f.id==='meetings'));
 assert.ok(plan.employer_evidence.some(e=>e.priority_facts.some(f=>f.id==='collab')));
 const supported=new Set([...profile.experience.flatMap(e=>e.facts),...profile.transferable_facts].map(f=>f.id));
 for(const r of plan.requirements)for(const id of r.matched_fact_ids)assert.ok(supported.has(id));
 assert.ok(!plan.requirements.some(r=>/customer|saas/i.test(r.text)&&r.status==='supported'));
});


test('Ashby generic summary triggers concrete-evidence repair while concise supported transition is allowed',()=>{
 const ashby={track:'Professional',title:'Customer Success Manager',description:'Coordinate projects and troubleshoot technical issues.'};
 const generic={...resume,summary:claim('Highly motivated professional with a strong background in project management.',['delivery']),additional:[]};
 assert.match(professionalSummaryIssue(generic,profile,ashby),/concrete verified project delivery|internal-team/);
 assert.equal(professionalSummaryIssue(resume,profile,ashby),null);
 const withHighlights={...generic,additional:[claim('Has a track record of on-time delivery and has led meetings with internal teams.',['delivery','meetings'])]};
 assert.equal(professionalSummaryIssue(withHighlights,profile,ashby),null);
 const sparse={...profile,transferable_facts:[]};
 assert.equal(professionalSummaryIssue(generic,sparse,ashby),null); // no padding requirement when source lacks alternatives
});

test('art-dominant irrelevant production remains repairable while source-industry mentoring never becomes irrelevance',async()=>{
 const doc={...assembled(),experience:[{bullets:['Created realistic assets using PBR and texture painting.','Performed worldbuilding and terrain sculpting.','Provided mentorship to newer artists in game production.']}]};
 assert.equal(isArtDominatedDocument('resume',doc,mercury),true);
 const result=await reviewFacts({kind:'resume',document:doc,profile,target:mercury,complete:async()=>({data:{issues:[
 {path:'experience.0.bullets.0',code:'irrelevant_framing',quote:doc.experience[0].bullets[0],reason:'Unrelated art-production detail dominates this governance application.'},
 {path:'experience.0.bullets.2',code:'irrelevant_framing',quote:doc.experience[0].bullets[2],reason:'Mentoring from games does not count.'}
 ]}})});
 assert.deepEqual(result.issues.map(i=>i.path),['experience.0.bullets.0']);
 const artTarget={...mercury,description:'Coordinate PBR and environment-art production.'};
 assert.equal(isArtDominatedDocument('resume',doc,artTarget),false);
});


test('generic leadership furniture without any verified capability cannot bypass factual review',async()=>{
 const artOnly={...profile,skills:[],transferable_facts:[],experience:[{id:'art-only',role:'Environment Artist',company:'Art Studio',dates:'2020',facts:[{id:'only-art',text:'Created environment assets.'}]}]};
 const document=assembled('Highly experienced leader');
 const result=await reviewFacts({kind:'resume',document,profile:artOnly,target:mercury,complete:async()=>({data:{issues:[{path:'headline',code:'unsupported_claim',quote:document.headline,reason:'There is no verified leadership capability in this profile.'}]}})});
 assert.equal(result.issues.length,1);
});
