import fs from "node:fs";
import vm from "node:vm";
const store=new Map();
const sandbox={URL,window:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../raven-core.js",import.meta.url),"utf8"),sandbox);
const core=sandbox.window.RavenCore;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
assert(core.normalizeUrl("https://example.com/job/1?utm_source=x#top")==="https://example.com/job/1","URL normalization failed");
const job=core.normalizeJob({title:" Engineer ",company:" Acme ",url:"https://example.com/job/1?utm_medium=x"});
assert(job.title==="Engineer"&&job.company==="Acme","job normalization failed");
assert(core.jobFingerprint(job).includes("https://example.com/job/1"),"fingerprint failed");
const api=core.fromApiJob({id:"1",title:"PM",salary_min:85000,cover_letter:"doc"});
assert(api.salaryMin===85000&&api.coverLetter==="doc","API adapter failed");
const discovered=core.fromDiscoveredJob({id:"2",title:"Ops",url:"https://example.com/2",remote:true,score:9});
assert(discovered.id==="DISC-2"&&discovered.remote==="Remote"&&discovered._discovered===true,"discovered adapter failed");
const atsRows=core.normalizeJobs({jobs:[
  {id:"good",title:"Project Manager",source:"ATS:greenhouse",url:"https://job-boards.greenhouse.io/acme/jobs/1"},
  {id:"bad",title:"Coordinate internal teams",source:"ATS:greenhouse",url:"- Lead implementation work"}
]});
assert(atsRows.length===1&&atsRows[0].id==="good","malformed ATS rows must not render");
assert(core.isRenderableJob({id:"bad",title:"Description fragment",source:"ATS:greenhouse",url:"This is not a URL"})===false,"invalid ATS URL guard failed");
assert(core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf"})===core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf"}),"generation fingerprint unstable");
assert(core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf"})!==core.generationFingerprint(job,{id:"master-2",fileName:"resume.pdf"}),"master resume must invalidate generation cache");
assert(core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf",dataUrl:"data:a"})!==core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf",dataUrl:"data:b"}),"master resume content must invalidate generation cache");
assert(core.generationFingerprint(job,{id:"master-1",fileName:"resume.pdf"}).length<20,"generation fingerprint should stay compact");
const cache=core.createCache("test");
assert(cache.write("job",job)===true,"cache write failed");
assert(cache.read("job").title==="Engineer","cache read failed");
cache.remove("job");
assert(cache.read("job","missing")==="missing","cache remove failed");
console.log("raven-core tests passed");

// CI trigger: reusable-core optimization pass 2026-09-20
