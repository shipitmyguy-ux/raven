import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../supabase/functions/_shared/track-filter.js';
import {candidateAllowedForTrack,rankCandidates} from '../supabase/functions/raven-backend-v3/utils.ts';
const allowed=globalThis.RavenTrackFilter.professionalRoleAllowed;
test('selling titles cannot qualify through operations or training keywords',()=>{
 for(const title of ['Sales Manager','Sales Operations Account Executive','Enterprise Account Executive','Customer Account Manager','Business Development Representative','BDR','SDR','Presales Consultant','Solutions Consultant','Salesperson'])
  assert.equal(allowed({title,snippet:'operations training implementation remote'}),false,title);
});
test('selling responsibilities are excluded despite customer success or generic titles',()=>{
 for(const notes of ['You will carry a sales quota.','Own a revenue quota and grow accounts.','You will close new deals.','Responsible for selling our services.','Responsibilities include cold calling.'])
  assert.equal(allowed({title:'Customer Success Manager',notes}),false,notes);
 assert.equal(allowed({title:'Operations Coordinator',description:'<p>You will sell our products.</p>'}),false);
});
test('support, enablement and implementation are not rejected for sales mentions',()=>{
 for(const title of ['Project Manager','Implementation Specialist','Customer Success Manager','Sales Operations Analyst','Sales Enablement Manager','Sales Training Specialist','Senior Manager, GTM Enablement'])
  assert.equal(allowed({title,notes:'Partner with sales teams. Train quota-carrying sellers. Prior experience as a quota-carrying seller is a plus. This is not a quota-carrying role.'}),true,title);
 assert.equal(allowed({title:'Implementation Coordinator',company:'Salesforce'}),true);
});
test('backend eligibility and ranking reject selling before score boosts',()=>{
 const sales={title:'Sales Manager',snippet:'project manager operations manager training manager',location:'Colorado',source:'Remotive',url:'https://example.com/sales'};
 const success={title:'Customer Success Manager',notes:'You will carry a sales quota.',source:'Remotive',url:'https://example.com/csm'};
 const implementation={title:'Implementation Specialist',source:'Remotive',url:'https://example.com/implementation'};
 assert.equal(candidateAllowedForTrack('Professional',sales),false);
 assert.equal(candidateAllowedForTrack('Professional',success),false);
 assert.deepEqual(rankCandidates('Professional',[sales,success,implementation]).map(r=>r.title),['Implementation Specialist']);
 assert.equal(candidateAllowedForTrack('Wildcard',success),true);
});
test('browser hides saved and discovered sales without modifying records',()=>{
 const code=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const start=code.indexOf('  function combinedJobs() {'),end=code.indexOf('  function filteredJobs()',start);
 assert.ok(start>=0&&end>start);
 const state={activeTrack:'Professional',jobs:[{id:'saved-sales',track:'Professional',title:'Account Executive',url:'https://example.com/saved',status:'Saved'},{id:'applied-sales',track:'Professional',title:'Sales Manager',url:'https://example.com/applied',status:'Applied'}],discovered:{Professional:[{title:'Business Development Manager',url:'https://example.com/discovered'},{title:'Implementation Manager',url:'https://example.com/allowed'}]}};
 const before=JSON.stringify(state);
 const context={state,window:{RavenTrackFilter:globalThis.RavenTrackFilter},normalizeComparableUrl:v=>v||'',parseBool:v=>Boolean(v),preferredDescription:(a,b)=>a||b};
 vm.createContext(context);
 vm.runInContext(code.slice(start,end)+';result=combinedJobs();',context);
 assert.deepEqual(Array.from(context.result,r=>r.title),['Implementation Manager']);
 assert.equal(JSON.stringify(state),before);
});
