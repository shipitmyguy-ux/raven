import test from 'node:test';
import assert from 'node:assert/strict';
import {generationProfile} from '../supabase/functions/_shared/document-profile.mjs';
import {buildExternalChatPrompt} from '../supabase/functions/_shared/document-handler.mjs';
const profile={skills:['Unity'],experience:[{id:'art',company:'Studio',role:'Artist',dates:'2020',facts:[{id:'art1',text:'Built worlds.'}]},{id:'exp_soundair',company:'SoundAir',role:'Technician',dates:'2026',facts:[{id:'soundair_1',text:'Repaired aircraft coffee makers.'}]}],resume_required_experience_ids:['art'],transferable_facts:[],shipped_titles:[],education:[]};
test('game generation excludes maintenance evidence without changing canonical profile',()=>{
 const result=generationProfile(profile,{track:'Games / 3D'});
 assert.deepEqual(result.experience.map(e=>e.id),['art']);
 assert.equal(profile.experience.length,2);
 for(const track of ['Professional','Labor','Wildcard'])assert.equal(generationProfile(profile,{track}),profile);
 assert.equal(generationProfile(profile,{track:'Games / 3D'},'Include SoundAir.'),profile);
});
test('manual game prompts exclude SoundAir facts for both document types',()=>{
 for(const kind of ['resume','coverLetter','both']){
  const prompt=buildExternalChatPrompt(kind,profile,{track:'Games / 3D',title:'Artist',description:'World building'});
  assert.ok(!prompt.includes('soundair_1'));
  assert.ok(!prompt.includes('Repaired aircraft coffee makers'));
  assert.ok(prompt.includes('art1'));
 }
});
