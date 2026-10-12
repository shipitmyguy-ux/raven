import assert from 'node:assert/strict';
import {canonicalStudioUrl, providerEndpoint, providerRecords, normalizeStudioJobs} from '../supabase/functions/_shared/studio-providers.mjs';
const source = provider => ({provider, board_key: 'example-studio', studio_name: 'Example Studio'});
const fixtures = [
 ['ashby', {jobs: [{title:'Environment Artist',location:'Remote - US',isRemote:true,jobUrl:'https://jobs.ashbyhq.com/example/a?utm_source=test',descriptionPlain:'Build worlds'}]}],
 ['greenhouse', {jobs: [{title:'Environment Artist',location:{name:'Austin, TX'},absolute_url:'https://boards.greenhouse.io/example/jobs/1',content:'<p>Build <b>worlds</b></p>'}]}],
 ['lever', [{text:'Environment Artist',categories:{location:'Remote - US'},hostedUrl:'https://jobs.lever.co/example/a',descriptionPlain:'Build worlds'}]],
 ['workable', {jobs: [{title:'Environment Artist',city:'Austin',state:'Texas',country:'United States',telecommuting:true,shortlink:'https://apply.workable.com/j/ABC/',description:'<p>Build worlds</p>'}]}],
 ['smartrecruiters', {content: [{id:'1234',name:'Environment Artist',location:{city:'Austin',region:'Texas',country:'US',remote:true},releasedDate:'2026-10-12',jobAd:{sections:{jobDescription:{text:'<p>Build worlds</p>'}}}}]}],
];
for(const [provider, payload] of fixtures){
 const [job] = normalizeStudioJobs(source(provider), payload);
 assert.equal(job.title,'Environment Artist',provider);
 assert.equal(job.company,'Example Studio',provider);
 assert.equal(job.snippet,'Build worlds',provider);
 assert.match(job.url,/^https:\/\//,provider);
 assert.ok(job.location,provider);
 assert.equal(job.remote,provider!=='greenhouse',provider);
}
assert.equal(normalizeStudioJobs(source('smartrecruiters'),fixtures[4][1])[0].url,'https://jobs.smartrecruiters.com/example-studio/1234');
assert.equal(normalizeStudioJobs(source('workable'),{jobs:[{title:'Artist',url:'https://apply.workable.com/j/A',locations:[{city:'London',country:'UK'},{city:'Austin',country:'US'}]}]})[0].location,'London, UK; Austin, US');
assert.deepEqual(normalizeStudioJobs(source('ashby'),{jobs:[null,{}, {title:'Unsafe',jobUrl:'javascript:alert(1)'}]}),[]);
assert.throws(()=>providerRecords('ashby',{}),/Unexpected/);
assert.throws(()=>providerEndpoint('ashby','../../localhost'),/Bad board/);
assert.throws(()=>providerEndpoint('pending','example'),/Unsupported/);
assert.throws(()=>providerEndpoint('smartrecruiters','example',-1),/Bad page/);
assert.match(providerEndpoint('workable','example'),/^https:\/\/apply.workable.com\/api\/v1\/widget\/accounts\/example\?details=true$/);
assert.match(providerEndpoint('smartrecruiters','example',100),/limit=100&offset=100$/);
assert.equal(canonicalStudioUrl('https://example.com/job?utm_source=a&token=b#top'),'https://example.com/job?token=b');
assert.equal(canonicalStudioUrl('https://user:pass@example.com/'),'');
assert.equal(canonicalStudioUrl('http://example.com/'),'');
const duplicates=normalizeStudioJobs(source('workable'),{jobs:[{title:'Environment Artist',url:'https://apply.workable.com/j/A',locations:[{city:'Oxford',region:'England',country:'United Kingdom'}]},{title:'Environment Artist',url:'https://apply.workable.com/j/A',locations:[{city:'Warwick',region:'England',country:'United Kingdom'}]}]});
assert.equal(duplicates.length,1);assert.equal(duplicates[0].location,'Oxford, England, United Kingdom; Warwick, England, United Kingdom');
assert.equal(normalizeStudioJobs(source('smartrecruiters'),{content:[{id:'123',name:'Artist',location:{city:'Bordeaux',country:'fr',fullLocation:'Bordeaux, France'}}]})[0].location,'Bordeaux, France');
console.log('studio provider normalization checks passed');
const {providerDetailEndpoint,providerDetailRecord,sourceJobAllowed}=await import('../supabase/functions/_shared/studio-providers.mjs');
assert.equal(providerEndpoint('bamboohr','studiowildcard'),'https://studiowildcard.bamboohr.com/careers/list');
for (const board of ['example_studio','EXAMPLE','bad.example','bad--host/','-bad','bad-']) assert.throws(()=>providerEndpoint('bamboohr',board),/Bad/);
assert.equal(providerDetailEndpoint('bamboohr','inxile','92'),'https://inxile.bamboohr.com/careers/92/detail');
assert.equal(providerDetailEndpoint('smartrecruiters','Ubisoft2','123-456'),'https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings/123-456');
for(const id of ['../1','1?x=y','0','-1','1/other']) assert.throws(()=>providerDetailEndpoint('bamboohr','inxile',id),/Bad/);
const bamboo={id:'73',jobOpeningName:'Technical Animator',atsLocation:{city:'Seattle',state:'Washington',country:'United States'},location:{city:null,state:null},departmentLabel:'Technical Animation'};
const bs={provider:'bamboohr',board_key:'studiowildcard',studio_name:'Studio Wildcard'};
const [bj]=normalizeStudioJobs(bs,{meta:{totalCount:1},result:[bamboo]});
assert.equal(bj.url,'https://studiowildcard.bamboohr.com/careers/73');
assert.equal(bj.location,'Seattle, Washington, United States');
assert.equal(bj.provider_job_id,'73');
assert.equal(bj.remote,false);
assert.throws(()=>providerRecords('bamboohr',{result:{}}),/Unexpected/);
const bd={...bamboo,jobOpeningStatus:'Open',jobOpeningShareUrl:bj.url,description:'<p>Build animations &amp; worlds</p>',datePosted:'2026-07-27'};
assert.equal(normalizeStudioJobs(bs,{result:[providerDetailRecord('bamboohr',{result:{jobOpening:bd}},'73')]})[0].snippet,'Build animations & worlds');
assert.throws(()=>providerDetailRecord('bamboohr',{result:{jobOpening:{...bd,jobOpeningStatus:'Closed'}}},'73'),/no longer open/);
assert.throws(()=>providerDetailRecord('bamboohr',{result:{jobOpening:bd}},'75'),/mismatch/);
assert.throws(()=>providerDetailRecord('bamboohr',{result:{}},'73'),/Unexpected/);
const scoped={...source('greenhouse'),job_scope:{field:'department',values:['Santa Monica Studio']}};
assert.equal(sourceJobAllowed(scoped,{departments:[{name:'Engineering'},{name:' santa monica studio '}]}),true);
assert.equal(sourceJobAllowed(scoped,{departments:[{name:'Engineering'},{name:'Insomniac Games'}]}),false);
assert.equal(sourceJobAllowed(scoped,{department:'Santa Monica Studio Engineering'}),false);
assert.equal(normalizeStudioJobs(scoped,{jobs:[{title:'Artist',absolute_url:'https://example.com/a',departments:[{name:'Insomniac Games'}]}]}).length,0);
assert.equal(sourceJobAllowed({...scoped,job_scope:{field:'title',values:['Artist']}},{title:'Senior Artist'}),false);
assert.equal(sourceJobAllowed({...scoped,job_scope:{field:'company',values:['Insomniac Games']}},{company:{name:'Insomniac Games'}}),true);
for(const job_scope of [{field:'description',values:['a']},{field:'title',values:[]},{field:'title',values:['']},{field:'title',values:[{}]},'invalid']) assert.throws(()=>sourceJobAllowed({...scoped,job_scope},{}),/Invalid/);
console.log('BambooHR details and exact studio scope checks passed');
assert.deepEqual(normalizeStudioJobs(bs,{result:[{...bamboo,id:'../73',jobOpeningShareUrl:'https://evil.example/careers/73'}]}),[]);
assert.throws(()=>normalizeStudioJobs({...bs,board_key:'evil.example'},{result:[]}),/Bad/);
assert.throws(()=>normalizeStudioJobs({...bs,job_scope:{field:'anything',values:[]}},{result:[]}),/Invalid/);
assert.throws(()=>sourceJobAllowed({...scoped,job_scope:{field:'department',values:Array(21).fill('Studio')}},{}),/Invalid/);
for(const jobOpeningName of ['Environment Artist (Remote)','Environment Artist - Remote','Environment Artist – Remote','Environment Artist Remote or On-Site']) assert.equal(normalizeStudioJobs(bs,{result:[{...bamboo,jobOpeningName}]} )[0].remote,true,jobOpeningName);
for(const jobOpeningName of ['Remote collaboration artist','Environment Artist - Remote Collaboration','Environment Artist (Not Remote)']) assert.equal(normalizeStudioJobs(bs,{result:[{...bamboo,jobOpeningName}]} )[0].remote,false,jobOpeningName);
const remoteLondon=normalizeStudioJobs(bs,{result:[{...bamboo,jobOpeningName:'Environment Artist - Remote',atsLocation:{city:'London',country:'United Kingdom'}}]})[0];
assert.equal(remoteLondon.remote,true);
assert.equal(normalizeStudioJobs(bs,{result:[{...bamboo,locationType:'2'}]})[0].remote,false);
const organizationSource={...source('smartrecruiters'),job_scope:{field:'organization',values:['Massive studio','Montréal studio']}};
assert.equal(sourceJobAllowed(organizationSource,{customField:[{fieldLabel:'Organizational Unit',valueLabel:'Montréal studio'}]}),true);
assert.equal(sourceJobAllowed(organizationSource,{customField:[{fieldLabel:'Organizational Unit',valueLabel:' MASSIVE STUDIO '}]}),true);
assert.equal(sourceJobAllowed(organizationSource,{customField:[{fieldLabel:'Organizational Unit',valueLabel:'Massive studio engineering'}]}),false);
assert.equal(sourceJobAllowed(organizationSource,{customField:[{fieldLabel:'Department',valueLabel:'Massive studio'}]}),false);
assert.equal(sourceJobAllowed(organizationSource,{customField:[{fieldLabel:'Organizational Unit',valueLabel:'Toronto studio'}]}),false);

const longPosting=normalizeStudioJobs(source('smartrecruiters'),{content:[{id:'123',name:'Environment Artist',location:{city:'Remote'},jobAd:{sections:{jobDescription:{text:'x'.repeat(25000)}}}}]})[0];
assert.equal(longPosting.snippet.length,20000);
