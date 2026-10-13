import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeDocument,validateDraft} from '../supabase/functions/_shared/document-writer.mjs';
import {createDocumentHandler} from '../supabase/functions/_shared/document-handler.mjs';

const profile={name:'Synthetic Candidate',contact:'private-contact@example.com',skills:['Mentoring'],education:[],
 experience:[{id:'art',company:'Synthetic Studio',role:'Environment Artist',dates:'2000–2017',facts:[{id:'art-work',text:'Built environments and mentored artists.'}]}],
 transferable_facts:[{id:'art-tenure',text:'Has 17 years of environment-art experience.'},{id:'different-number',text:'Created 117 assets.'}],shipped_titles:[]};
const target={track:'Professional',title:'Implementation Analyst',company:'Synthetic Target',description:'Support implementations.'};
const c=(text,ids=['art-work'])=>({text,fact_ids:ids});
const draft={headline:c('Mentoring and production'),summary:c('Brings mentoring strengths. Has 17 years of environment-art experience.'),skills:['Mentoring'],
 experience:[{experience_id:'art',bullets:[c('Built environments and mentored artists.')]}],additional:[]};
async function run(summary,reviewIssues=[],trace=[]){
 return writeDocument({kind:'resume',profile,target,onEvidenceTrace:e=>trace.push(e),reviewComplete:async()=>({data:{issues:reviewIssues}}),
 complete:async args=>({data:args.name==='raven_passage_repair'?{repairs:[{path:'summary',claim:summary}]}:{...draft,summary}})});
}
test('missing citation remains blocked and privately identifies the available numeric fact',async()=>{
 const trace=[];await assert.rejects(run(draft.summary,[],trace),/unsupported number: 17/);
 assert.equal(trace.length,2);assert.deepEqual(trace.map(t=>t.attempt),[1,2]);
 assert.equal(trace[1].path,'summary');assert.equal(trace[1].passage,draft.summary.text);
 assert.deepEqual(trace[1].cited_fact_ids,['art-work']);
 assert.equal(trace[1].numbers[0].binding,'uncited_number_token');
 assert.deepEqual(trace[1].numbers[0].candidate_fact_ids,['art-tenure']);
 assert.equal(trace[1].number_facts[0].text,profile.transferable_facts[0].text);
 assert.equal(trace[1].semantic_support,'not_inferred_from_number_presence');
});
test('valid art tenure passes with its citation and private diagnostics do not enter the result',async()=>{
 const trace=[],result=await run(c(draft.summary.text,['art-work','art-tenure']),[],trace);
 assert.equal(result.final_review.status,'passed');assert.equal(trace[0].numbers[0].binding,'cited_number_token');
 for(const privateValue of ['art-tenure','number_facts','semantic_support'])assert.ok(!JSON.stringify(result).includes(privateValue));
});
test('a cited number cannot override a semantic rejection of transferred tenure',async()=>{
 const text='Brings 17 years of implementation analysis experience.';
 const issues=[{path:'summary',code:'unsupported_claim',quote:text,reason:'Environment-art tenure does not establish implementation-analysis tenure.'}];
 const trace=[];await assert.rejects(run(c(text,['art-tenure']),issues,trace));
 assert.equal(trace.at(-1).numbers[0].binding,'cited_number_token');
 assert.match(trace.at(-1).review_issues[0].reason,/does not establish/);
});
test('invented number, unknown citations, wrong employer, and invented target profession stay blocked',async()=>{
 const trace=[];await assert.rejects(run(c('Built 99 environments.'),[],trace),/unsupported number/);
 assert.equal(trace[0].numbers[0].binding,'no_number_token');
 assert.throws(()=>validateDraft('resume',{...draft,summary:c(draft.summary.text,['unknown'])},profile,{target}),/cite verified facts/);
 assert.throws(()=>validateDraft('resume',{...draft,summary:c('Built environments.'),experience:[{experience_id:'art',bullets:[c('Built environments for 17 years.',['art-tenure'])]}]},profile,{target}),/another employer or general background/);
 await assert.rejects(run(c('Implementation Analyst with 17 years of environment-art experience.',['art-tenure'])),/target role|profession/);
});
test('trace failure cannot change acceptance or rejection',async()=>{
 const args={kind:'resume',profile,target,onEvidenceTrace:()=>{throw Error('log sink down');},reviewComplete:async()=>({data:{issues:[]}})};
 const summary=c(draft.summary.text,['art-tenure']);
 assert.equal((await writeDocument({...args,complete:async()=>({data:{...draft,summary}})})).final_review.status,'passed');
 await assert.rejects(writeDocument({...args,complete:async()=>({data:draft})}),/unsupported number/);
});
test('framing repair carries prior numeric citations without binding them automatically',async()=>{
 const original={...draft,summary:c('Environment artist with 17 years of experience.',['art-tenure'])};
 const requests=[],trace=[];
 const result=await writeDocument({kind:'resume',profile,target,onEvidenceTrace:e=>trace.push(e),reviewComplete:async()=>({data:{issues:[]}}),complete:async args=>{
  requests.push(args);
  if(args.name!=='raven_passage_repair')return {data:original};
  const hints=args.input.factualCorrection.numeric_evidence;
  assert.deepEqual(hints.map(h=>({path:h.path,number:h.number,ids:h.prior_cited_facts.map(f=>f.id)})),[{path:'summary',number:'17',ids:['art-tenure']}]);
  assert.match(args.instructions,/original factual scope/);
  return {data:{repairs:[{path:'summary',claim:c(draft.summary.text,hints[0].prior_cited_facts.map(f=>f.id))}]}};
 }});
 assert.equal(requests.length,2);assert.equal(result.final_review.status,'passed');
 assert.deepEqual(result.document.experience.map(r=>r.bullets),[['Built environments and mentored artists.']]);
 assert.equal(trace[0].numbers[0].binding,'cited_number_token');assert.equal(trace[1].numbers[0].binding,'cited_number_token');
 // Even after a valid original citation, omitting it in the repair is blocked.
 await assert.rejects(writeDocument({kind:'resume',profile,target,reviewComplete:async()=>({data:{issues:[]}}),complete:async args=>({data:args.name==='raven_passage_repair'?{repairs:[{path:'summary',claim:draft.summary}]}:original})}),/unsupported number: 17/);
});
test('handler logs request-linked evidence internally, never in HTTP errors or request-event detail',async()=>{
 const logs=[],finishes=[];
 const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'test-service',OPENROUTER_API_KEY:'test'};
 const handler=createDocumentHandler('resume',{getEnv:n=>env[n],logEvidence:e=>logs.push(e),fetchImpl:async(url,init)=>{
  if(url.includes('raven_canonical_profiles'))return Response.json([{profile}]);
  if(url.endsWith('raven_request_guard'))return Response.json({allowed:true,event_id:777});
  const body=JSON.parse(init.body);
  if(url.endsWith('raven_request_finish')){finishes.push(body);return Response.json(null);}
  assert.match(url,/openrouter\.ai/);
  const review=body.messages.some(m=>String(m.content).includes('"reviewStage":true'));
  const data=review?{issues:[]}:draft;
  return Response.json({model:'free-test',choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});
 }});
 const response=await handler(new Request('https://test.example',{method:'POST',headers:{'x-raven-client':'raven-web-v1'},body:JSON.stringify({track:target.track,jobTitle:target.title,company:target.company,jobDescription:target.description,debug:true})}));
 assert.equal(response.status,503);assert.equal(logs.length,2);assert.equal(logs[1].request_event_id,777);
 const publicText=await response.text(),detail=JSON.stringify(finishes);
 for(const forbidden of [draft.summary.text,profile.transferable_facts[0].text,'art-tenure','number_facts','passage','private-contact']){
  // Existing generic diagnostic says "passage"; exclude the generic word.
  if(forbidden==='passage')continue;
  assert.ok(!publicText.includes(forbidden));assert.ok(!detail.includes(forbidden));
 }
 assert.equal(finishes[0].p_status,'rejected');
});
