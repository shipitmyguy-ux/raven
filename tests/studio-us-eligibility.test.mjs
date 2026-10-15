import test from 'node:test';
import assert from 'node:assert/strict';
import {usStudioScopeAllowed} from '../supabase/functions/_shared/studio-us-eligibility.mjs';
test('US-based and worldwide remote scopes pass',()=>{
 for(const location of ['United States','USA','Remote - US','USA / Canada','UK / Worldwide','North America','Worldwide (preferred UTC +6 to UTC +10)','Within 4 hours of Pacific Time','Remote; geographic scope not specified']){
  assert.equal(usStudioScopeAllowed({location,remote:true}),true,location);
 }
});
test('Canada, UK, Europe and nearby GMT only are excluded',()=>{
 for(const location of ['Canada','Canada (Ontario)','Remote Canada','London, UK (Fully Remote)','Europe only','Remote EMEA','Hong Kong, Remote','Worldwide (-/+ 2h from GMT+1)','Australia remote']){
  assert.equal(usStudioScopeAllowed({location,remote:true}),false,location);
 }
});
test('mandatory non-US residence overrides unknown geography',()=>{
 assert.equal(usStudioScopeAllowed({location:'Remote',snippet:'Applicants must be located in Canada to be eligible.'}),false);
 assert.equal(usStudioScopeAllowed({location:'Remote',snippet:'Based in the UK is a requirement.'}),false);
});
test('uncertain location is not guessed foreign',()=>{
 assert.equal(usStudioScopeAllowed({location:'Remote',snippet:'Open to global teams and collaborators'}),true);
 assert.equal(usStudioScopeAllowed({location:'Hong Kong or Remote',snippet:'Worldwide contractors welcome'}),false,'specific country-only locations require verification');
});
