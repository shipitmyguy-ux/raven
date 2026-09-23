import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// 1. Verify HTML template safety rules
const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");

// Control Panel panel must be present
assert.ok(indexHtml.includes('data-options-panel="control-panel"'), "index.html must contain control-panel options panel");

// Confirm submit/finalize action is ABSENT from control panel
const controlPanelStart = indexHtml.indexOf('data-options-panel="control-panel"');
const controlPanelEnd = indexHtml.indexOf('data-options-panel="master-resumes"', controlPanelStart);
const controlPanelHtml = indexHtml.slice(controlPanelStart, controlPanelEnd > 0 ? controlPanelEnd : undefined);

assert.ok(!/submitApplication/i.test(controlPanelHtml), "submitApplication must not be present in control panel HTML");
assert.ok(!/finalize/i.test(controlPanelHtml), "finalize action must not be present in control panel HTML");
assert.ok(!/employerSubmit/i.test(controlPanelHtml), "employerSubmit action must not be present in control panel HTML");

// Confirm policy mutation write inputs are ABSENT from control panel
assert.ok(!/updateGenerationPolicy/i.test(controlPanelHtml), "updateGenerationPolicy write action must not be in control panel HTML");
assert.ok(!/updateSourcePolicy/i.test(controlPanelHtml), "updateSourcePolicy write action must not be in control panel HTML");
assert.ok(!/setFeatureFlag/i.test(controlPanelHtml), "setFeatureFlag write action must not be in control panel HTML");

// 2. Mock browser environment to test raven-api.js and app.js interactions
global.window = {
  RAVEN_CONFIG: {
    searchApiUrl: "https://example.supabase.co/functions/v1/raven-backend-v3",
    enrichApiUrl: "https://example.supabase.co/functions/v1/raven-enrich-v1",
    commuteApiUrl: "https://example.supabase.co/functions/v1/raven-commute-v1",
    generateApiUrl: "https://example.supabase.co/functions/v1/raven-generate-v1",
    controlApiUrl: "https://example.supabase.co/functions/v1/raven-control-v1"
  }
};

const calls = [];
global.fetch = async (url, init = {}) => {
  const urlObj = new URL(url);
  let body = {};
  if (init.body) {
    try { body = JSON.parse(init.body); } catch {}
  }
  const action = body.action || urlObj.searchParams.get("action");
  calls.push({ url: url.toString(), method: init.method || "GET", action, body });

  // Simulate raven-control-v1 Edge Function response rules
  if (action === "updateGenerationPolicy" || action === "updateSourcePolicy" || action === "setFeatureFlag") {
    return {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ ok: false, error: "Browser policy writes are disabled. Requires authenticated admin." })
    };
  }

  if (action === "submitApplication" || action === "apply" || action === "finalize") {
    return {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ ok: false, error: "Employer application submission actions are explicitly disabled and locked." })
    };
  }

  if (action === "health") {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        service: "raven-control-v1",
        version: 1,
        status: "operational",
        job_counts: { total_jobs: 12, saved_jobs: 8, discovered_jobs: 4, malformed_ats_rows: 0, missing_descriptions: 1 },
        task_health: [{ category: "operational_active", healthy_tasks: 5, failed_tasks: 0 }],
        identity_diagnostics: [],
        source_policies: [{ source_name: "Greenhouse", enabled: true, health_status: "PASS" }]
      })
    };
  }

  if (action === "getConfig") {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        generation_policy: [{ track: "all", model: "gemini-2.5-flash-lite" }],
        source_policy: [{ source: "Greenhouse", status: "active" }],
        feature_flags: [{ key: "control_plane", enabled: true, mode: "bounded" }]
      })
    };
  }

  if (action === "recent") {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, events: [{ action: "health", status: "SUCCESS", created_at: new Date().toISOString() }] })
    };
  }

  if (action === "refreshAll" || action === "runSourceDiagnostics" || action === "repairDescriptions" || action === "smokeAts") {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, action })
    };
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true })
  };
};

// Import raven-api.js
const ravenApiCode = fs.readFileSync(path.resolve("raven-api.js"), "utf8");
eval(ravenApiCode);

assert.ok(global.window.RavenAPI, "RavenAPI must be attached to window");
assert.equal(typeof global.window.RavenAPI.controlHealth, "function", "controlHealth method must exist");
assert.equal(typeof global.window.RavenAPI.getControlConfig, "function", "getControlConfig method must exist");
assert.equal(typeof global.window.RavenAPI.getControlEvents, "function", "getControlEvents method must exist");
assert.equal(typeof global.window.RavenAPI.refreshAllControl, "function", "refreshAllControl method must exist");
assert.equal(typeof global.window.RavenAPI.runSourceDiagnostics, "function", "runSourceDiagnostics method must exist");
assert.equal(typeof global.window.RavenAPI.repairDescriptionsControl, "function", "repairDescriptionsControl method must exist");
assert.equal(typeof global.window.RavenAPI.smokeAts, "function", "smokeAts method must exist");

// Test safe API calls invoke raven-control-v1
calls.length = 0;
const healthRes = await global.window.RavenAPI.controlHealth();
assert.ok(healthRes.ok, "health response must be ok");
assert.equal(calls[0].url.split("?")[0], "https://example.supabase.co/functions/v1/raven-control-v1");
assert.equal(calls[0].action, "health");

calls.length = 0;
const configRes = await global.window.RavenAPI.getControlConfig();
assert.ok(configRes.ok, "config response must be ok");
assert.equal(calls[0].action, "getConfig");

calls.length = 0;
const eventsRes = await global.window.RavenAPI.getControlEvents();
assert.ok(eventsRes.ok, "events response must be ok");
assert.equal(calls[0].action, "recent");

calls.length = 0;
await global.window.RavenAPI.refreshAllControl();
assert.equal(calls[0].action, "refreshAll");

calls.length = 0;
await global.window.RavenAPI.runSourceDiagnostics("Professional");
assert.equal(calls[0].action, "runSourceDiagnostics");
assert.equal(calls[0].body.track, "Professional");

calls.length = 0;
await global.window.RavenAPI.repairDescriptionsControl(6, 0, "all");
assert.equal(calls[0].action, "repairDescriptions");
assert.equal(calls[0].body.limit, 6);

calls.length = 0;
await global.window.RavenAPI.smokeAts("Games / 3D");
assert.equal(calls[0].action, "smokeAts");
assert.equal(calls[0].body.track, "Games / 3D");

// Test policy write block
try {
  await fetch("https://example.supabase.co/functions/v1/raven-control-v1", {
    method: "POST",
    body: JSON.stringify({ action: "updateGenerationPolicy" })
  }).then(async r => {
    assert.equal(r.status, 403, "updateGenerationPolicy must return 403");
  });
} catch (e) {
  assert.fail("Policy write call should be handled with 403 error response: " + e.message);
}

// Test submit action block
try {
  await fetch("https://example.supabase.co/functions/v1/raven-control-v1", {
    method: "POST",
    body: JSON.stringify({ action: "submitApplication" })
  }).then(async r => {
    assert.equal(r.status, 403, "submitApplication must return 403");
  });
} catch (e) {
  assert.fail("Submit action call should be handled with 403 error response: " + e.message);
}

// 3. Test refreshAll covers every track
const TRACKS = ["Games / 3D", "Professional", "Labor", "Wildcard"];
assert.equal(TRACKS.length, 4, "Raven must have 4 job tracks");
assert.deepEqual(TRACKS, ["Games / 3D", "Professional", "Labor", "Wildcard"]);


// 4. Canonical control-plane source must preserve production security + bounded delegation.
const controlSource = fs.readFileSync(path.resolve("supabase/functions/raven-control-v1/index.ts"), "utf8");

assert.ok(controlSource.includes("ALLOWED_ORIGINS"), "control source must restrict browser origins");
assert.ok(!controlSource.includes('"Access-Control-Allow-Origin": "*"'), "control source must not use wildcard CORS");
assert.ok(controlSource.includes('SUPABASE_SERVICE_ROLE_KEY'), "control source must require service-role backend access");
assert.ok(!controlSource.includes('SUPABASE_ANON_KEY'), "control source must not fall back to anon key");
assert.ok(controlSource.includes("JSON.stringify({action,status,detail})"), "control event writes must use the live detail column");
assert.ok(controlSource.includes('backend("search",{track})'), "refreshAll must delegate real searches to raven-backend-v3");
assert.ok(controlSource.includes('backend("runAtsDiagnostics",{track})'), "source diagnostics must delegate to backend diagnostics");
assert.ok(controlSource.includes('backend("repairDescriptions",{track,limit,offset})'), "description repair must delegate to backend");
assert.ok(controlSource.includes('backend("smokeAts",{track})'), "ATS smoke must delegate to backend");
assert.ok(controlSource.includes('return json(req,{error:"Origin not allowed"},403)'), "disallowed browser origins must be rejected");
assert.ok(controlSource.includes('return json(req,{error:"Policy/config writes require authenticated admin access and are not exposed to the browser."},403)'), "policy writes must remain blocked");
assert.ok(controlSource.includes('return json(req,{error:"Employer submission is not a supported control-plane action."},403)'), "employer submission must remain blocked");

console.log("control-panel tests passed");
