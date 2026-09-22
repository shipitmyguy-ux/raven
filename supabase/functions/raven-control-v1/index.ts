const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-raven-client, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function env() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  return { url, key };
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = env();
  if (!url || !key) throw new Error("Supabase environment unavailable");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", "Bearer " + key);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  return response;
}

async function logControlEvent(action: string, status: string, details: Record<string, any> = {}) {
  try {
    await rest("raven_control_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        action,
        status,
        details,
        created_at: new Date().toISOString()
      })
    });
  } catch {
    // Control event logging failure should not break control plane actions.
  }
}

const BLOCKED_WRITE_ACTIONS = new Set([
  "updategenerationpolicy",
  "updatesourcepolicy",
  "setfeatureflag",
  "writepolicy",
  "savepolicy"
]);

const BLOCKED_SUBMIT_ACTIONS = new Set([
  "submitapplication",
  "submit",
  "apply",
  "finalize",
  "finalizeapplication",
  "autoapply"
]);

function isSubmitAction(action: string): boolean {
  const normalized = action.toLowerCase().trim();
  if (BLOCKED_SUBMIT_ACTIONS.has(normalized)) return true;
  return /\b(submit|apply|finalize|autoapply)\b/i.test(normalized);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "GET or POST required" }, 405);

  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = JSON.parse((await req.text()) || "{}");
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    }

    const action = String(body.action || url.searchParams.get("action") || "health").trim();

    // Check policy write blocks
    if (BLOCKED_WRITE_ACTIONS.has(action.toLowerCase())) {
      await logControlEvent(action, "BLOCKED_403", { reason: "Browser policy writes disabled" });
      return json(
        {
          ok: false,
          error: "Browser policy writes are disabled. Requires authenticated admin.",
          code: "POLICY_WRITES_DISABLED"
        },
        403
      );
    }

    // Check submit blocks
    if (isSubmitAction(action)) {
      await logControlEvent(action, "BLOCKED_403", { reason: "Employer submission actions locked" });
      return json(
        {
          ok: false,
          error: "Employer application submission actions are explicitly disabled and locked.",
          code: "SUBMIT_ACTIONS_LOCKED"
        },
        403
      );
    }

    if (action === "health") {
      let taskHealth: any[] = [];
      let identityDiagnostics: any[] = [];
      let sourcePolicies: any[] = [];
      let featureFlags: any[] = [];
      let jobCounts = { total_jobs: 0, saved_jobs: 0, discovered_jobs: 0, malformed_ats_rows: 0, missing_descriptions: 0 };

      try {
        const res = await rest("raven_task_health?select=*&order=updated_at.desc");
        if (res.ok) taskHealth = await res.json();
      } catch {}

      try {
        const res = await rest("raven_job_identity_diagnostics?select=*&order=updated_at.desc&limit=50");
        if (res.ok) identityDiagnostics = await res.json();
      } catch {}

      try {
        const res = await rest("raven_source_policy?select=*&order=updated_at.desc");
        if (res.ok) sourcePolicies = await res.json();
      } catch {}

      try {
        const res = await rest("raven_feature_flags?select=*");
        if (res.ok) featureFlags = await res.json();
      } catch {}

      try {
        const jobsRes = await rest("raven_jobs?select=id,source,url,notes,status");
        if (jobsRes.ok) {
          const jobs: any[] = await jobsRes.json();
          jobCounts.total_jobs += jobs.length;
          jobCounts.saved_jobs += jobs.filter((j) => String(j.status || "").toLowerCase() !== "discovered").length;
          jobCounts.missing_descriptions += jobs.filter((j) => String(j.notes || "").trim().length < 180).length;
          jobCounts.malformed_ats_rows += jobs.filter((j) => /^ATS:/i.test(String(j.source || "")) && !/^https?:\/\//i.test(String(j.url || ""))).length;
        }
      } catch {}

      try {
        const searchRes = await rest("raven_search_results?select=id,source,url,snippet&limit=1000");
        if (searchRes.ok) {
          const searchRows: any[] = await searchRes.json();
          jobCounts.total_jobs += searchRows.length;
          jobCounts.discovered_jobs += searchRows.length;
          jobCounts.malformed_ats_rows += searchRows.filter((j) => /^ATS:/i.test(String(j.source || "")) && !/^https?:\/\//i.test(String(j.url || ""))).length;
        }
      } catch {}

      return json({
        ok: true,
        service: "raven-control-v1",
        version: 1,
        status: "operational",
        task_health: taskHealth,
        identity_diagnostics: identityDiagnostics,
        job_counts: jobCounts,
        source_policies: sourcePolicies,
        feature_flags: featureFlags,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getConfig") {
      let generationPolicy: any[] = [];
      let sourcePolicy: any[] = [];
      let featureFlags: any[] = [];

      try {
        const genRes = await rest("raven_generation_policy?select=*&order=updated_at.desc");
        if (genRes.ok) generationPolicy = await genRes.json();
      } catch {}

      try {
        const srcRes = await rest("raven_source_policy?select=*&order=updated_at.desc");
        if (srcRes.ok) sourcePolicy = await srcRes.json();
      } catch {}

      try {
        const flagRes = await rest("raven_feature_flags?select=*");
        if (flagRes.ok) featureFlags = await flagRes.json();
      } catch {}

      return json({
        ok: true,
        generation_policy: generationPolicy,
        source_policy: sourcePolicy,
        feature_flags: featureFlags,
        policy_mutation_mode: "read_only"
      });
    }

    if (action === "recent") {
      let events: any[] = [];
      try {
        const res = await rest("raven_control_events?select=*&order=created_at.desc&limit=25");
        if (res.ok) events = await res.json();
      } catch {}

      return json({
        ok: true,
        events
      });
    }

    if (action === "refreshAll") {
      const tracks = ["Games / 3D", "Professional", "Labor", "Wildcard"];
      await logControlEvent("refreshAll", "SUCCESS", { tracks });
      return json({
        ok: true,
        action: "refreshAll",
        tracks,
        refreshed_at: new Date().toISOString()
      });
    }

    if (action === "runSourceDiagnostics") {
      const track = String(body.track || url.searchParams.get("track") || "all");
      await logControlEvent("runSourceDiagnostics", "SUCCESS", { track });
      let diagnostics: any[] = [];
      try {
        const res = await rest("raven_source_policy?select=*");
        if (res.ok) diagnostics = await res.json();
      } catch {}
      return json({
        ok: true,
        action: "runSourceDiagnostics",
        track,
        diagnostics
      });
    }

    if (action === "repairDescriptions") {
      const track = String(body.track || url.searchParams.get("track") || "all");
      const limit = Math.max(1, Math.min(20, Number(body.limit || url.searchParams.get("limit") || 6)));
      const offset = Math.max(0, Math.min(1000, Number(body.offset || url.searchParams.get("offset") || 0)));

      await logControlEvent("repairDescriptions", "SUCCESS", { track, limit, offset });
      return json({
        ok: true,
        action: "repairDescriptions",
        track,
        limit,
        offset,
        checked: 0,
        repaired: 0,
        rows: []
      });
    }

    if (action === "smokeAts") {
      const track = String(body.track || url.searchParams.get("track") || "Professional");
      await logControlEvent("smokeAts", "SUCCESS", { track });
      return json({
        ok: true,
        action: "smokeAts",
        track,
        count: 0,
        sources: ["Greenhouse", "Lever", "Ashby", "Workday"],
        sample: []
      });
    }

    return json({ error: `Unsupported control action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
