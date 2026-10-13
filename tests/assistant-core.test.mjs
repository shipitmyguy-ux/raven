import fs from "node:fs";
import vm from "node:vm";

const sandbox={URL,globalThis:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../extension/src/assistant-core.js",import.meta.url),"utf8"),sandbox);
const core=sandbox.globalThis.RavenAssistantCore;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

assert(core.detectAdapter("job-boards.greenhouse.io").id==="greenhouse","Greenhouse detection failed");
assert(core.detectAdapter("jobs.lever.co").id==="lever","Lever detection failed");
assert(core.detectAdapter("jobs.ashbyhq.com").id==="ashby","Ashby detection failed");
assert(core.detectAdapter("acme.wd5.myworkdayjobs.com").id==="workday","Workday detection failed");
assert(core.detectAdapter("careers-acme.icims.com").id==="icims","iCIMS detection failed");
assert(core.detectAdapter("acme.taleo.net").id==="taleo","Taleo detection failed");
assert(core.detectAdapter("example.com").id==="generic","generic fallback failed");

assert(core.isSensitiveQuestion("Will you now or in the future require visa sponsorship?"),"sponsorship must be blocked");
assert(core.isSensitiveQuestion("Desired salary"),"salary must be blocked");
assert(!core.isSensitiveQuestion("Are you willing to travel occasionally?"),"safe reusable answer was blocked");

assert(core.acceptsFile(".pdf,.docx","resume.pdf","application/pdf"),"PDF accept check failed");
assert(!core.acceptsFile(".pdf,.docx","resume.html","text/html"),"incompatible file should be rejected");
assert(core.acceptsFile("text/html","resume.html","text/html"),"MIME accept check failed");

assert(core.completionLooksSuccessful({url:"https://jobs.lever.co/acme/thank-you",text:"Thank you for applying."}),"strong completion should pass");
assert(!core.completionLooksSuccessful({url:"https://jobs.lever.co/acme/job",text:"Thank you for applying."}),"generic job page must not be marked complete");
assert(!core.completionLooksSuccessful({url:"https://jobs.lever.co/acme/thank-you",text:"Complete your application below."}),"URL alone must not be enough");

const contentScript=fs.readFileSync(new URL("../extension/src/content.js",import.meta.url),"utf8");
assert(!/requestSubmit\s*\(|\.submit\s*\(|\.click\s*\(\s*\)/i.test(contentScript),"Application Assistant must never click or submit employer forms automatically");

console.log("assistant-core tests passed");
