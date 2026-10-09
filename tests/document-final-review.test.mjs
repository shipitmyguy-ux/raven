import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewDocument,reviewFacts} from '../supabase/functions/_shared/document-review.mjs';
import {writeDocument} from '../supabase/functions/_shared/document-writer.mjs';
const c=(text,fact_ids)=>({text,fact_ids});
const profile={name:'Candidate',contact:'candidate@example.com',skills:['Mentoring'],education:[],experience:[
 {id:'one',company:'First Studio',role:'Artist',dates:'2020',facts:[{id:'a',text:'Created environment assets for Example Game.'}]},
 {id:'two',company:'Second Studio',role:'Artist',dates:'2021',facts:[{id:'b',text:'Mentored newer artists.'}]}
],shipped_titles:['Example Game','Six Days in Fallujah'],transferable_facts:[]};
const target={company:'Target Studio',title:'Artist',track:'Games / 3D',description:'Create environments.'};
const paragraph='I created environment assets for Example Game.';
const good={greeting:'Dear Hiring Manager,',paragraphs:[c(paragraph,['a']),c('I mentored newer artists.',['b'])],closing:'Sincerely,'};
test('live cover regression: internal collaboration does not establish external partners, healthcare passion, or historical Excel use',()=>{
 const p={...profile,skills:['Excel (intermediate)'],transferable_facts:[{id:'t',text:'Has led meetings with internal teams.'}]};
 for(const text of [
  'I have also developed strong relationships with internal teams and external partners, and I am comfortable working in a fast-paced environment with multiple stakeholders.',
  'As someone with a passion for healthcare and Tech for Good, I believe that I would be a valuable addition to the team.',
  'Additionally, I have intermediate Excel skills, which have been useful in my previous roles for tracking progress and managing assets.'
 ]){
  const result=reviewDocument('coverLetter',{paragraphs:[text]},{profile:p,target});
  assert.equal(result.status,'blocked',text);
  assert.equal(result.issues[0].path,'paragraphs.0');
 }
});
test('live cover guards permit prospective relevance and explicitly supported history',()=>{
 const texts=['I would welcome the opportunity to build relationships with external partners.',
  'I am excited about this healthcare role and would bring intermediate Excel skills.',
  'I have developed relationships with external partners.',
  'I have a passion for healthcare.',
  'I used Excel for tracking progress and managing assets.'];
 const p={...profile,transferable_facts:[{id:'partners',text:'Developed relationships with external partners.'},{id:'interest',text:'Has a passion for healthcare.'},{id:'excel',text:'Used Excel for tracking progress and managing assets.'}]};
 for(const text of texts)assert.equal(reviewDocument('coverLetter',{paragraphs:[text]},{profile:p,target}).status,'passed',text);
 for(const text of texts.slice(0,2))assert.equal(reviewDocument('coverLetter',{paragraphs:[text]},{profile,target}).status,'passed',text);
});
test('missed cover claim triggers a bounded passage repair even when the model reviewer approves',async()=>{
 const bad={...good,paragraphs:[c('I mentored newer artists and developed relationships with external partners.',['b']),good.paragraphs[0]]};
 const requests=[];
 const result=await writeDocument({kind:'coverLetter',profile,target,complete:async args=>{
  requests.push(args);
  return {data:args.name==='raven_passage_repair'?{repairs:[{path:'paragraphs.0',claim:good.paragraphs[1]}]}:bad};
 },reviewComplete:async()=>({data:{issues:[]}})});
 assert.equal(requests.length,2);
 assert.deepEqual(requests[1].input.factualCorrection.invalid_paths,['paragraphs.0']);
 assert.deepEqual(result.document.paragraphs,[good.paragraphs[1].text,good.paragraphs[0].text]);
 assert.equal(result.final_review.status,'passed');
});
test('live professional retest: database reporting is not database management',()=>{
 const p={...profile,skills:['Database querying'],transferable_facts:[{id:'db',text:'Has experience with game-production asset databases, metadata markup, report generation, and database queries.'}]};
 assert.equal(reviewDocument('resume',{name:p.name,contact:p.contact,summary:'Skilled in automation scripting and asset database management.'},{profile:p,target:{track:'Professional'}}).status,'blocked');
 assert.equal(reviewDocument('resume',{name:p.name,contact:p.contact,summary:'Experienced in asset database queries, metadata and report generation.'},{profile:p,target:{track:'Professional'}}).status,'passed');
 assert.equal(reviewDocument('coverLetter',{paragraphs:['I would welcome the opportunity to learn database management.']},{profile:p,target}).status,'passed');
 p.transferable_facts.push({id:'db_management',text:'Managed asset databases.'});
 assert.equal(reviewDocument('resume',{name:p.name,contact:p.contact,summary:'Experienced in asset database management.'},{profile:p,target:{track:'Professional'}}).status,'passed');
 assert.equal(reviewDocument('coverLetter',{paragraphs:['I believe my passion for tech makes me a strong fit.']},{profile:p,target}).status,'blocked');
});
test('whole-document check catches duplicates across sections and placeholders without style limits',()=>{
 const bad=reviewDocument('resume',{summary:paragraph,experience:[{bullets:[paragraph,'[Insert company name]']}],additional:[]});
 assert.deepEqual(bad.issues.map(i=>i.code).sort(),['duplicate','placeholder']);
 assert.equal(reviewDocument('coverLetter',{paragraphs:['Meow! I built environments with care.','I would love to discuss this role.']}).status,'passed');
});
test('live repaired summary cannot invent the target profession; transition language remains allowed',()=>{
 const t={title:'Implementation Analyst',track:'Professional'};
 const d={name:profile.name,contact:profile.contact,summary:'Implementation analyst with experience in onboarding, training, and project management.'};
 assert.equal(reviewDocument('resume',d,{profile,target:t}).status,'blocked');
 assert.equal(reviewDocument('resume',{...d,summary:'Seeking an Implementation Analyst role, bringing mentoring and workflow experience.'},{profile,target:t}).status,'passed');
 const p={...profile,experience:[...profile.experience,{role:'Implementation Analyst',facts:[]}]};
 assert.equal(reviewDocument('resume',d,{profile:p,target:t}).status,'passed');
});
test('live repaired cover cannot repeat a whole factual sentence inside otherwise different paragraphs',()=>{
 const sentence='My experience with automation scripting and module building, as well as my familiarity with asset database metadata and reporting, aligns with the company goals.';
 const result=reviewDocument('coverLetter',{paragraphs:['I am drawn to this role. '+sentence,sentence+' I would welcome a discussion.']});
 assert.equal(result.status,'blocked');assert.equal(result.issues[0].path,'paragraphs.1');assert.equal(result.issues[0].code,'duplicate');
 assert.equal(reviewDocument('coverLetter',{paragraphs:['I bring mentoring and workflow experience.','I would apply my mentoring skills to help new colleagues.']}).status,'passed');
});
test('whole-document canonical credit guard catches omitted Six Days in Fallujah',()=>{
 const result=reviewDocument('resume',{name:profile.name,contact:profile.contact,shipped_titles:['Example Game']},{profile,target});
 assert.equal(result.issues[0].code,'missing_credits');
});
test('separate factual reviewer repairs only the wrong project attribution and rechecks the entire letter',async()=>{
 const bad={...good,paragraphs:[c('For Example Game, I created environment assets and mentored newer artists.',['a','b']),good.paragraphs[1]]};
 const drafts=[],reviews=[];
 const result=await writeDocument({kind:'coverLetter',profile,target,complete:async args=>{
  drafts.push(args);
  return {provider:'test',data:args.name==='raven_passage_repair'?{repairs:[{path:'paragraphs.0',claim:good.paragraphs[0]}]}:bad};
 },reviewComplete:async args=>{
  reviews.push(args);
  return {provider:'reviewer',model:'test',data:{issues:reviews.length===1?[{path:'paragraphs.0',code:'wrong_attribution',quote:'mentored newer artists',reason:'Mentoring belongs to Second Studio; do not attribute it to Example Game.'}]:[]}};
 }});
 assert.equal(reviews.length,2);assert.equal(drafts.length,2);
 assert.deepEqual(drafts[1].input.factualCorrection.invalid_paths,['paragraphs.0']);
 assert.deepEqual(result.document.paragraphs,good.paragraphs.map(p=>p.text));
 assert.equal(result.final_review.factual_review.status,'passed');
 assert.equal(reviews[1].input.document.paragraphs[1],good.paragraphs[1].text);
});
test('failed or malformed final review cannot return an approved document',async()=>{
 for(const reviewComplete of [async()=>{throw Error('offline');},async()=>({data:{issues:[{path:'paragraphs.0',code:'wrong_attribution',quote:'not present',reason:'Unsubstantiated'}]}})]){
  await assert.rejects(writeDocument({kind:'coverLetter',profile,target,complete:async()=>({data:good}),reviewComplete}),e=>e.code==='FINAL_REVIEW_UNAVAILABLE');
 }
});
test('final review has two separate bounded calls and cannot consume or inflate draft repair budget',async()=>{
 const {createLLMCompletion}=await import('../supabase/functions/_shared/llm-router.mjs?review-budget');
 let calls=0;
 const complete=createLLMCompletion({getEnv:n=>n==='OPENROUTER_API_KEY'?'test':undefined,fetchImpl:async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:'{"issues":[]}'}}]});}});
 await complete({input:{},schema:{}});
 await complete({purpose:'final_review',input:{reviewStage:true},schema:{}});
 await complete({input:{factualCorrection:{}},schema:{}});
 await complete({purpose:'final_review',input:{reviewStage:true},schema:{}});
 await assert.rejects(complete({purpose:'final_review',input:{},schema:{}}),e=>e.code==='LLM_CALL_BUDGET_EXHAUSTED');
 assert.equal(calls,4);
});


test('Professional reviewer receives posting and severe mistailoring triggers only identified passage repair',async()=>{
 const t={track:'Professional',title:'Technical Program Manager',company:'Anduril',description:'Coordinate technical projects and teams.'};
 const requests=[],reviews=[];
 const result=await writeDocument({kind:'coverLetter',profile,target:t,complete:async args=>{
  requests.push(args);return {data:args.name==='raven_passage_repair'?{repairs:[{path:'paragraphs.0',claim:c('I would bring mentoring experience to technical team coordination.',['b'])}]}:good};
 },reviewComplete:async args=>{reviews.push(args);return {data:{issues:reviews.length===1?[{path:'paragraphs.0',code:'irrelevant_framing',quote:paragraph,reason:'Replace this art-only opening with verified mentoring relevant to team coordination.'}]:[]}};}});
 assert.equal(reviews[0].input.target.description,t.description);
 assert.deepEqual(requests[1].input.factualCorrection.invalid_paths,['paragraphs.0']);
 assert.equal(result.document.paragraphs[1],good.paragraphs[1].text);
 assert.equal(requests.length,2);assert.equal(reviews.length,2);
});

test('Professional cover art-first tenure is blocked and accurate source context after capability is permitted',async()=>{
 const p={...profile,transferable_facts:[{id:'years',text:'17 years of professional environment-art experience in video game development.'}]};
 const t={track:'Professional',title:'Technical Program Manager',description:'Coordinate technical projects.'};
 const bad={...good,paragraphs:[c('As a seasoned environment artist with 17 years of professional environment-art experience in video game development.',['years']),good.paragraphs[1]]};
 const calls=[];const result=await writeDocument({kind:'coverLetter',profile:p,target:t,complete:async args=>{calls.push(args);return {data:args.name==='raven_passage_repair'?{repairs:[{path:'paragraphs.0',claim:c('I mentored newer artists in environment-art production.',['b'])}]}:bad};}});
 assert.equal(calls.length,2);assert.deepEqual(calls[1].input.factualCorrection.invalid_paths,['paragraphs.0']);
 assert.match(result.document.paragraphs[0],/^I mentored/);
});
