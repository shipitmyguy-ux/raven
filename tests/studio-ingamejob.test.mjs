import test from 'node:test';
import assert from 'node:assert/strict';
import {ingamejobEndpoint,parseIngamejobPage,parseIngamejobDetail,collectIngamejob} from '../supabase/functions/_shared/studio-ingamejob.mjs';
import '../supabase/functions/_shared/track-filter.js';
const source={provider:'ingamejob',board_key:'ingamejob'},category='https://ingamejob.com/en/jobs/art-and-animation';
const card=(id=1,{title='3D Environment Artist',company='Example Studio',location='Remote'}={})=>`<div class="employer-job-listing-single shadow-sm"><h5><a href="https://ingamejob.com/en/job/environment-artist-${id}">${title}</a></h5><strong><i class="la la-building-o"></i> ${company}</strong><p><i class="la la-map-marker"></i> ${location}</p></div>`;
const page=(cards=card(),total=1,current=1)=>`<link rel="canonical" href="${category}">Found <strong>${total}</strong> jobs<div class="employer-job-listing my-4">${total>30?`<ul class="pagination"><li aria-current="page"><span class="page-link">${current}</span></li><a href="${category}?page=${current===1?2:1}" ${current===1?'rel="next"':''}>Next</a></ul>`:''}${cards}</div>`;
const job=()=>parseIngamejobPage(source,page()).jobs[0];
const text='For which tasks (responsibilities)? Create paid production environment assets and work with experienced artists on a remote studio team. What kind of professional are we looking for? Strong portfolio and experience with Unreal Engine.';
const detail=(j=job(),{description=text,archived=false,recruiting=false}={})=>`<link rel="canonical" href="${j.url}"><div class="job-view-lead-position-box col-sm-8"><h1>${j.title}</h1><a class="job-view-lead-position-box" href="https://ingamejob.com/en/company/example-studio">${j.company}</a><p><i class="la la-map-marker"></i> ${j.location}</p>${archived?'Vacancy archived':'<a href="https://ingamejob.com/en/login" class="btn btn-success">Apply</a>'}</div><div class="container job-view-body"><div class="job-view-container text-break"><div class="job-view-single-section mb-3"><p>${description}</p></div></div><div class="col-md-4">Company type: ${recruiting?'Recruiting':'Developer'}</div>`;
test('fixed English first-party art category and bounded page numbers',()=>{
 assert.equal(ingamejobEndpoint(source),category);assert.equal(ingamejobEndpoint(source,2),category+'?page=2');for(const s of [{...source,board_key:'other'},{provider:'unknown'}])assert.throws(()=>ingamejobEndpoint(s));for(const n of [0,11,1.5])assert.throws(()=>ingamejobEndpoint(source,n));
});
test('complete pagination, exact advertised totals and duplicate protection',()=>{
 const first=parseIngamejobPage(source,page(Array.from({length:30},(_,i)=>card(i)).join(''),37));assert.equal(first.jobs.length,30);assert.equal(first.next,2);
 const second=parseIngamejobPage(source,page(Array.from({length:7},(_,i)=>card(i+30)).join(''),37,2),2);assert.equal(second.next,null);assert.equal(second.total,37);
 for(const html of ['Challenge page',page('',1),page(card(),31),page(card()+card(),2),page().replace(category,'https://evil.test/category')])assert.throws(()=>parseIngamejobPage(source,html));
 assert.throws(()=>parseIngamejobPage(source,page(Array.from({length:30},(_,i)=>card(i)).join(''),37).replace(category+'?page=2','https://evil.test/page2')));
});
test('canonical title employer and location binding and full description',()=>{
 const j=job(),d=parseIngamejobDetail(source,j,detail());assert.equal(d.company,j.company);assert.equal(d.remote,true);assert.match(d.snippet,/professional/);
 for(const html of [detail().replace(j.url,'https://evil.test/en/job/environment-artist-1'),detail().replace('<h1>'+j.title,'<h1>Different role'),detail().replace('>Example Studio</a>','>Other Employer</a>'),detail().replace('> Remote</p>','> Onsite</p>'),detail().replace('Apply','Closed')])assert.throws(()=>parseIngamejobDetail(source,j,html));
});
test('fresh archived activity excluded and no application endpoint is fetched',()=>{
 assert.equal(parseIngamejobDetail(source,job(),detail(job(),{archived:true})).excluded,true);
 assert.throws(()=>parseIngamejobDetail(source,job(),detail().replace('<a href="https://ingamejob.com/en/login" class="btn btn-success">Apply</a>','')));
});
test('employer lookalike hosts and credentials are rejected',()=>{
 for(const url of ['https://ingamejobXcom/en/company/example-studio','https://user@ingamejob.com/en/company/example-studio','https://ingamejob.com/en/company/example-studio?other=1','https://ingamejob.com/en/company/example-studio#other'])assert.throws(()=>parseIngamejobDetail(source,job(),detail().replace('https://ingamejob.com/en/company/example-studio',url)));
});
test('balanced nested descriptions retain trailing qualifications and geography',()=>{
 const description=text+'<div><p>Nested production details.</p><div>Additional role responsibilities.</div></div><p>Must work from our office. English required.</p>';
 const d=parseIngamejobDetail(source,job(),detail(job(),{description}));assert.match(d.snippet,/Additional role responsibilities/);assert.match(d.snippet,/English required/);assert.equal(d.remote,false);
 assert.throws(()=>parseIngamejobDetail(source,job(),detail(job(),{description}).replace('</div></div><div class="col-md-4">','<div class="col-md-4">')));
});
test('undisclosed recruiting label and geography conditions preserved',()=>{
 const d=parseIngamejobDetail(source,job(),detail(job(),{description:text+' Fully remote B2B work or officially employed in Kazakhstan. Relocation optional.',recruiting:true}));assert.equal(d.company,'Example Studio (undisclosed client)');assert.match(d.location,/Kazakhstan/);assert.equal(d.remote,true);
 for(const condition of ['Hybrid office attendance.','Initially remote with relocation required.','You must work from our office.']){const result=parseIngamejobDetail(source,job(),detail(job(),{description:text+' '+condition}));assert.equal(result.remote,false);assert.match(result.location,/onsite/);}
});
test('unpaid pools closed titles and 2D-only rejected, unknown location not invented',()=>{
 assert.equal(parseIngamejobDetail(source,job(),detail(job(),{description:text+' This is unpaid.'})).excluded,true);
 for(const title of ['Talent Pool Artist','2D Artist','[CLOSED] Environment Artist']){const j={...job(),title};assert.equal(parseIngamejobDetail(source,j,detail(j)).excluded,true);}
 const noLocation=parseIngamejobPage(source,page(card(1,{location:''}))).jobs[0];assert.equal(noLocation.location,'');assert.equal(parseIngamejobDetail(source,noLocation,detail(noLocation)).remote,false);
});
test('hybrid game genre and explicit remote alternatives are not mandatory office conditions',()=>{
 for(const condition of ['The studio makes hybrid-casual games.','Fully remote, or on-site / hybrid for Kyiv-based specialists.']){const d=parseIngamejobDetail(source,job(),detail(job(),{description:text+' '+condition}));assert.equal(d.remote,true);assert.equal(globalThis.RavenTrackFilter.jobLocationAllowed({...job(),...d}),true);assert.match(d.snippet,new RegExp(condition.startsWith('Fully')?'Kyiv':'hybrid-casual'));}
 const j={...job(),location:''},d=parseIngamejobDetail(source,j,detail(j,{description:text+' Fully remote collaboration.'}));assert.equal(d.remote,true);assert.match(d.location,/explicit description/);
 assert.equal(parseIngamejobDetail(source,job(),detail(job(),{description:text+' Fully remote, or on-site / hybrid for Kyiv-based specialists. Later office attendance is mandatory.'})).remote,false);
 for(const condition of ['Fully remote, or hybrid; must work from our office weekly.','Fully remote, or hybrid but relocation to Kyiv is required.','Fully remote with optional onsite, mandatory weekly office attendance.']){const d=parseIngamejobDetail(source,job(),detail(job(),{description:text+' '+condition}));assert.equal(d.remote,false);assert.match(d.location,/Hybrid \/ onsite/);assert.match(d.snippet,/weekly|required|mandatory/);}
});
test('bounded serial fresh details, robots spacing and rotating cursor',async()=>{
 let active=0,peak=0,details=0;const waits=[];
 const rows=Array.from({length:15},(_,i)=>card(i)).join('');const result=await collectIngamejob(source,{wait:async ms=>waits.push(ms),fetchText:async url=>{
  if(url===category)return page(rows,15);assert.ok(/^https:\/\/ingamejob\.com\/en\/job\//.test(url));details++;active++;peak=Math.max(peak,active);await Promise.resolve();active--;return detail({...job(),url});
 }});
 assert.equal(details,12);assert.equal(peak,1);assert.equal(result.details.status,'partial');assert.equal(result.detail_cursor_next,12);assert.equal(result.jobs.length,12);assert.equal(waits.length,12);assert.ok(waits.every(ms=>ms>4900));
});
test('detail failures remain honest partial and unknown list never becomes healthy zero',async()=>{
 await assert.rejects(()=>collectIngamejob(source,{fetchText:async()=>page('',1)}));
 const result=await collectIngamejob(source,{wait:async()=>{},fetchText:async url=>url===category?page():'Forbidden'});assert.equal(result.jobs.length,0);assert.equal(result.details.status,'partial');assert.equal(result.details.attempted,1);
});
