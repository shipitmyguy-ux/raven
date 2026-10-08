import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../supabase/functions/_shared/track-filter.js';
import {candidateAllowedForTrack,rankCandidates} from '../supabase/functions/raven-backend-v3/utils.ts';
const allowed=globalThis.RavenTrackFilter.localLocationAllowed;
test('explicit nearby Colorado work locations qualify',()=>{
 for(const city of ['Fort Collins','Loveland','Windsor','Timnath','Wellington','Laporte','La Porte','Bellvue','Severance','Greeley','Johnstown','Berthoud','Eaton','Ault']){
  assert.equal(allowed({location:city+', CO'}),true,city);
  assert.equal(allowed({location:city+', Colorado, United States'}),true,city);
 }
 assert.equal(allowed({location:'Fort Collins CO 80524'}),true);
 assert.equal(allowed({location:'Loveland, CO (On-site)'}),true);
});
test('distant, ambiguous and nationwide locations fail closed',()=>{
 for(const location of ['', 'Colorado', 'Northern Colorado','United States','Remote','Denver, CO','Boulder, CO','Longmont, CO','Cheyenne, WY','Windsor, ON','Loveland, OH','Fort Collins','Not Fort Collins, CO','Fort Collinsville, CO','Remote - Fort Collins, CO','Fort Collins, CO - statewide travel','Multiple locations; Fort Collins, CO'])
  assert.equal(allowed({location}),false,location);
 assert.equal(allowed({location:'Denver, CO',company:'Fort Collins Repairs',notes:'Headquarters in Fort Collins, CO'}),false);
 for(const remote of [true,'true','Yes','Remote'])assert.equal(allowed({location:'Fort Collins, CO',remote}),false);
});
test('backend filters before ranking across tracks',()=>{
 const make=location=>({title:'Maintenance Technician',location,url:'https://example.com/'+encodeURIComponent(location),source:'LinkedIn'});
 assert.deepEqual(rankCandidates('Labor',[make('Denver, CO'),make('Loveland, CO'),make('Colorado')]).map(x=>x.location),['Loveland, CO']);
 assert.equal(candidateAllowedForTrack('Wildcard',make('Denver, CO')),false);
 const db=fs.readFileSync(new URL('../supabase/functions/raven-backend-v3/db.ts',import.meta.url),'utf8');
 assert.match(db,/candidateAllowedForTrack/);
});
test('browser filters saved and cached Labor without mutating history',()=>{
 const code=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const start=code.indexOf('  function combinedJobs() {'),end=code.indexOf('  function filteredJobs()',start);
 const state={activeTrack:'Labor',jobs:[{id:'distant',track:'Labor',title:'Painter',location:'Denver, CO',url:'https://example.com/distant',status:'Applied'},{id:'local',track:'Labor',title:'Painter',location:'Fort Collins, CO',url:'https://example.com/local',status:'Saved'}],discovered:{Labor:[{title:'Maintenance Technician',location:'Loveland, CO',url:'https://example.com/loveland'},{title:'Custodian',location:'Colorado',url:'https://example.com/unknown'}]}};
 const before=JSON.stringify(state);
 const context={state,window:{RavenTrackFilter:globalThis.RavenTrackFilter},normalizeComparableUrl:v=>v||'',parseBool:v=>Boolean(v),preferredDescription:(a,b)=>a||b};
 vm.createContext(context);vm.runInContext(code.slice(start,end)+';result=combinedJobs();',context);
 assert.deepEqual(Array.from(context.result,r=>r.location),['Fort Collins, CO','Loveland, CO']);
 assert.equal(JSON.stringify(state),before);
});

test('global policy permits remote work and gates all four tracks',()=>{
 const globalAllowed=globalThis.RavenTrackFilter.jobLocationAllowed;
 assert.equal(globalAllowed({remote:true,location:'Seattle, WA'}),true);
 assert.equal(globalAllowed({remote:'Yes',location:'United States'}),true);
 assert.equal(globalAllowed({location:'Remote - United States'}),true);
 assert.equal(globalAllowed({remote:true,location:'Denver, CO (Hybrid)'}),false);
 assert.equal(globalAllowed({location:'Fort Collins, CO (Hybrid)'}),true);
 assert.equal(globalAllowed({location:'Denver, CO',notes:'remote possibility'}),false);
 for(const track of ['Professional','Labor','Wildcard','Games / 3D']){
  const title=track==='Games / 3D'?'Environment Artist':'Operations Coordinator';
  assert.equal(candidateAllowedForTrack(track,{title,location:'Denver, CO'}),false,track);
  assert.equal(candidateAllowedForTrack(track,{title,location:'Fort Collins, CO'}),true,track);
  assert.equal(candidateAllowedForTrack(track,{title,remote:true,location:'United States'}),true,track);
 }
});
