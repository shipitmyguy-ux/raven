import fs from "node:fs";

const assert=(condition,message)=>{if(!condition) throw new Error(message);};
const backend=fs.readFileSync(new URL("../supabase/functions/raven-backend-v3/index.ts",import.meta.url),"utf8");
const generator=fs.readFileSync(new URL("../supabase/functions/raven-generate-v1/index.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../supabase/migrations/20260922_request_budget_circuit_breaker.sql",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");

assert(backend.includes('requestGuard("search",track'),"Search endpoint must use the server request guard.");
assert(backend.includes("shortLimit:8,shortSeconds:60"),"Search short budget must allow two four-tab refreshes per minute.");
assert(backend.includes("longLimit:40,longSeconds:600"),"Search long budget must bound repeated refreshes.");
assert(backend.includes('phase:"cached"'),"Rate-limited search must return cached jobs.");
assert(backend.includes('budget_limited:true'),"Cached budget fallback must be explicit.");

assert(generator.includes('requestGuard("generation","gemini"'),"Generation must use the server request guard.");
assert(generator.includes("shortLimit:12,shortSeconds:60"),"Generation short budget must allow 8+ sequential requests per minute.");
assert(generator.includes("longLimit:30,longSeconds:3600"),"Generation hourly budget must be bounded.");
assert(generator.includes('"AI_CIRCUIT_OPEN"'),"Generation must expose the automatic provider circuit.");
assert(generator.includes('requestFinish(budgetEventId,"success",200)'),"Successful generation must reset provider failure history.");

assert(migration.includes("pg_advisory_xact_lock"),"Request budgets must be atomic across Edge Function instances.");
assert(migration.includes("interval '14 days'"),"Request-event retention must be bounded.");
assert(migration.includes("revoke all on function public.raven_request_guard"),"Request guard must not be publicly executable.");
assert(migration.includes("revoke all privileges on table public.raven_request_events from anon, authenticated"),"Request ledger must not be public.");

assert(app.includes("Refresh cooldown · showing cached jobs"),"Raven must tell the user when refresh uses cached results.");

console.log("Request budget and circuit-breaker regression tests passed");
