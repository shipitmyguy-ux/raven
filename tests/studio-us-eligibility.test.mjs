import test from 'node:test';
import assert from 'node:assert/strict';
import {requiresVisaOrWorkPermit,usStudioScopeAllowed} from '../supabase/functions/_shared/studio-us-eligibility.mjs';

test('GMT offsets and country-only labels are metadata, not visa requirements',()=>{
 for(const location of [
  'United States','USA','Remote - US','USA / Canada','UK / Worldwide',
  'North America','Canada','Canada (Ontario)','Remote Canada','London, UK (Fully Remote)',
  'Europe only','Remote EMEA','Hong Kong, Remote','Australia remote',
  'Worldwide (-/+ 2h from GMT+1)','Worldwide (+/- 2h from GMT+1)',
  'Worldwide (preferred UTC +6 to UTC +10)','Within 4 hours of Pacific Time',
  'Remote; geographic scope not specified',''
 ]){
  assert.equal(usStudioScopeAllowed({location,remote:true}),true,location);
  assert.equal(requiresVisaOrWorkPermit({location,remote:true}),false,location);
 }
});

test('foreign residence and authorized-to-work statements alone do not establish visa requirements',()=>{
 for(const snippet of [
  'Applicants must be located in Canada to be eligible.',
  'Based in the UK is a requirement.',
  'You must already be eligible to work in Canada.',
  'Must have legal authorization to work in the United States.',
  'Currently eligible to work throughout Europe.',
  'No relocation support is offered. Remote across Europe.',
  'We cannot sponsor work visas for this position.',
  'Visa sponsorship is unavailable; local hires only.',
  'Please disclose whether you require visa sponsorship.',
  'Do you need a work visa? Please indicate on application.',
  'No visa is required for remote contractors.',
  'A work permit is not necessary for this remote role.'
 ]){
  assert.equal(usStudioScopeAllowed({location:'Canada',snippet}),true,snippet);
 }
});

test('clearly mandatory visa or work-permit statements exclude a listing',()=>{
 for(const snippet of [
  'A work visa is required for this role.',
  'A visa is mandatory to take this position.',
  'All applicants must hold a valid work visa before starting.',
  'You must obtain a work permit to perform this role.',
  'This position requires a valid employment visa.',
  'A valid work permit is required for this vacancy.'
 ]){
  assert.equal(requiresVisaOrWorkPermit({location:'Worldwide (-/+ 2h from GMT+1)',snippet}),true,snippet);
  assert.equal(usStudioScopeAllowed({location:'Worldwide (-/+ 2h from GMT+1)',snippet}),false,snippet);
 }
});

test('explicit visa requirement in location label is still honored',()=>{
 assert.equal(usStudioScopeAllowed({location:'Canada, work visa required',remote:true}),false);
 assert.equal(usStudioScopeAllowed({location:'Canada, no work visa required',remote:true}),true);
});

test('a mere mention of visa sponsorship must not be considered mandatory',()=>{
 assert.equal(requiresVisaOrWorkPermit({snippet:'Visa sponsorship may be available. Relocation considered.'}),false);
 assert.equal(requiresVisaOrWorkPermit({snippet:'No work visa is needed; remote from any country.'}),false);
 assert.equal(requiresVisaOrWorkPermit({snippet:'Will you require visa sponsorship?'}),false);
});
