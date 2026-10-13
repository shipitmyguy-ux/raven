import assert from 'node:assert/strict';
import {deduplicateStudioResults} from '../supabase/functions/_shared/studio-result-dedup.mjs';
const row=(source,extra={})=>({source:'Studio:'+source,company:'Half Mermaid',title:'Senior Environment Artist',location:'Remote US',remote:true,snippet:'full description',url:'https://example.com/'+source,...extra});
const board=row('workwithindies'),official=row('ashby',{company:'Half Mermaid Productions',snippet:'official description'});
assert.deepEqual(deduplicateStudioResults([board,official]),[official]);
assert.deepEqual(deduplicateStudioResults([official,board]),[official]);
assert.deepEqual(deduplicateStudioResults([row('workwithindies',{company:'Smile-Break'}),row('artstation',{company:'Smile Break',snippet:'longer full verified description'})]).map(r=>r.source),['Studio:artstation']);
assert.equal(deduplicateStudioResults([board,row('artstation',{company:'  HALF   MERMAID  ',title:' senior environment artist ',snippet:'x'.repeat(50)})]).length,1);
for(const extra of [{title:'Lead Environment Artist'},{title:'Environment Artist'},{title:'Senior Environment Artist (Contract)'},{location:'Remote Canada'},{location:'Remote US; Europe'},{location:''},{remote:false},{remote:undefined},{company:'Half Mermaid Games'},{company:'Unknown employer'},{source:'Indeed'},{source:'Studio:unverified'}])assert.equal(deduplicateStudioResults([board,row('artstation',extra)]).length,2,JSON.stringify(extra));
assert.equal(deduplicateStudioResults([row('artstation',{company:'Unknown employer'}),row('workwithindies',{company:'Unknown employer'})]).length,2);
assert.equal(deduplicateStudioResults([board,{...board,url:'https://example.com/another'}]).length,2);
const ambiguous=[board,{...official,url:'https://example.com/official-one'},{...official,url:'https://example.com/official-two'}];
for(const rows of [ambiguous,[...ambiguous].reverse()])assert.equal(deduplicateStudioResults(rows).length,3,'ambiguous multiple vacancies remain');
const frozen=[Object.freeze(board),Object.freeze(official)];assert.deepEqual(deduplicateStudioResults(frozen),[official]);assert.equal(frozen.length,2);
assert.equal(deduplicateStudioResults([row('artstation',{company:'Undisclosed employer (forum)'}),row('workwithindies',{company:'Undisclosed employer (forum)'})]).length,2);
// Exact externally verified employer posting identities permit different board
// location wording; the winning whole row retains its original restrictions.
const verifiedPairs=[
 [row('workwithindies',{title:'Environment Artist',company:'Half Mermaid',url:'https://www.workwithindies.com/careers/half-mermaid-environment-artist',location:'US only; Pacific time',snippet:'x'.repeat(200)}),row('remotegamejobs',{title:'Environment Artist',company:'Half Mermaid Productions',url:'https://remotegamejobs.com/jobs/half-mermaid-productions-environment-artist-remote-job',location:'United States',snippet:'x'.repeat(100)})],
 [row('workwithindies',{url:'https://www.workwithindies.com/careers/half-mermaid-senior-environment-artist',location:'US only; Pacific time',snippet:'x'.repeat(200)}),row('remotegamejobs',{company:'Half Mermaid Productions',url:'https://remotegamejobs.com/jobs/half-mermaid-productions-senior-environment-artist-remote-job-f3701dac-2485-4691-bb10-3933a0b0337b',location:'United States',snippet:'x'.repeat(100)})],
 [row('artstation',{company:'Smile Break',url:'https://www.artstation.com/jobs/QKn9',location:'Asia; Europe; North America',snippet:'x'.repeat(300)}),row('remotegamejobs',{company:'Smile-Break',url:'https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job',location:'Worldwide',snippet:'x'.repeat(100)})],
];
for(const pair of verifiedPairs){
 for(const order of [pair,[...pair].reverse()])assert.deepEqual(deduplicateStudioResults(order),[pair[0]],'richest whole row preserves original geographic constraints');
 for(const changed of [{company:'Other employer'},{title:'Lead Environment Artist'},{remote:false},{source:'Studio:hitmarker'},{url:pair[1].url+'-unverified'}])assert.equal(deduplicateStudioResults([pair[0],{...pair[1],...changed}]).length,2,'alias requires exact verified identity');
}
assert.equal(deduplicateStudioResults(verifiedPairs.flat()).length,3,'senior and nonsenior exact posting identities stay distinct');
assert.equal(deduplicateStudioResults([verifiedPairs[0][0],{...verifiedPairs[0][0],url:verifiedPairs[0][1].url,source:'Studio:workwithindies'}]).length,2,'source/URL bindings cannot be spoofed');
console.log('studio presentation dedup exact posting aliases, geographic constraints and distinct vacancy guards passed');

const hyperHit={source:'Studio:hitmarker',company:'HyperHug',title:'3D Artist (weapon skins)',location:'Remote; geographic scope not specified',remote:true,url:'https://hitmarker.net/jobs/hyperhug-3d-artist-weapon-skins-4737280',snippet:'Russian C1 required'};
const hyperAts={...hyperHit,source:'Studio:ashby',location:'Remote',url:'https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8',snippet:'Official full description; Russian C1 required'};
for(const rows of [[hyperHit,hyperAts],[hyperAts,hyperHit]])assert.deepEqual(deduplicateStudioResults(rows),[hyperAts]);
assert.equal(deduplicateStudioResults([hyperHit,{...hyperAts,url:'https://jobs.ashbyhq.com/hyperhug/different-role'}]).length,2);
assert.equal(deduplicateStudioResults([row('eightbit',{company:'8Bit (undisclosed client)'}),row('skillsearch',{company:'8Bit (undisclosed client)'})]).length,2,'recruiter unknown-client labels cannot identify employer vacancies');
assert.equal(deduplicateStudioResults([row('eightbit',{company:'Actual Named Studio'}),row('skillsearch',{company:'Actual Named Studio'})]).length,1,'explicit named employers use strict existing title/geography dedup');
