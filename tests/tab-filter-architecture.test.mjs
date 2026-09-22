import fs from "node:fs";

const assert=(condition,message)=>{if(!condition) throw new Error(message);};
const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const config=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/config.ts",import.meta.url),"utf8");
const sources=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/sources.ts",import.meta.url),"utf8");
const utils=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/utils.ts",import.meta.url),"utf8");

assert(app.includes("async function loadAllDiscovered()"),"Raven must load discovered jobs for every tab.");
assert(app.includes('searchJobsButton.textContent="Refreshing all…"'),"Refresh control must be global.");
assert(!app.includes("loadDiscovered(state.activeTrack)"),"Tab switching must not trigger active-tab retrieval.");
assert(!app.includes("job.track||state.activeTrack"),"Generation and job actions must not depend on the open tab.");
assert(!app.includes("job.track || state.activeTrack"),"Generation and job actions must not depend on the open tab.");

assert(!config.includes("localOnly"),"Tracks must not select different local-only search logic.");
assert(!config.includes("remoteBoards"),"Tracks must not select different remote-board logic.");
assert(!config.includes("atsSources?"),"Tracks must not select different ATS source sets.");

assert(!sources.includes(".localOnly"),"Source adapters must not branch on track local-only policy.");
assert(!sources.includes(".remoteBoards"),"Source adapters must not branch on remote-board policy.");
assert(!sources.includes(".atsSources"),"ATS parser must use the same source set for every track.");
assert(!sources.includes('track==="Professional"'),"ATS parsing must not special-case Professional.");
assert(!utils.includes('track==="Wildcard"'),"Ranking must not special-case Wildcard.");

console.log("Tab/filter architecture regression tests passed");
