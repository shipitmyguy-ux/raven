import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../supabase/functions/_shared/track-filter.js';
const {gameArtRoleAllowed:allowed,hasWholePhrase:match}=globalThis.RavenTrackFilter;
test('substring collisions cannot qualify community or Burlingame jobs',()=>{
 assert.equal(match('community','unity'),false);assert.equal(match('Burlingame','game'),false);
 assert.equal(match('Unity artist','unity'),true);assert.equal(match('video game production','game'),true);
 for(const title of ['Assistant Manager - Burlingame Avenue','Join our Senior / Lead Biotechnologist Talent Community','Community Participation Supports Lead DSP','Math Tutor 4-8 - Bancroft Community School','Join Our Talent Community: Enterprise Account Executive','Manager, Social and Community Marketing','Game Designer (Systems)'])assert.equal(allowed({title,snippet:'Unity Unreal video game environment artist collaboration'}),false,title);
});
test('actual art roles remain eligible even when descriptions are missing',()=>{
 for(const title of ['Senior Environment Artist','Lead Level Artist','Environment Artist – StarCraft','3D Artist 2','Sr 3D Artist / Art Director','Real-Time 3D Visualization Artist | Unreal Engine','Unreal Generalist','World Builder','Game Artist (Mobile)'])assert.equal(allowed({title}),true,title);
});
test('excluded specialties stay excluded regardless of studio and description',()=>{
 for(const title of ['Technical Artist','Senior Technical Designer','Environment Art Engineer','Character Artist','Community Manager','VFX Artist','Gameplay Programmer'])assert.equal(allowed({title,company:'Epic Games',snippet:'3D art and environment art'}),false,title);
 assert.equal(allowed({title:'Art Director',snippet:'environment art and worldbuilding'}),true);
 assert.equal(allowed({title:'Art Director',snippet:'advertising and print design'}),false);
});

test('ranking applies role eligibility before incidental keyword and location boosts',async()=>{
 const {rankCandidates}=await import('../supabase/functions/raven-backend-v3/utils.ts');
 const rows=rankCandidates('Games / 3D',[
  {title:'Community Participation Supports Supervisor',snippet:'community game changer unity',remote:true,location:'Fort Collins',url:'https://example.com/community'},
  {title:'Assistant Manager - Burlingame Avenue',remote:true,location:'Colorado',url:'https://example.com/retail'},
  {title:'Senior Environment Artist',snippet:'Unity environment art',url:'https://example.com/artist'}
 ]);
 assert.deepEqual(rows.map(r=>r.title),['Senior Environment Artist']);
});
