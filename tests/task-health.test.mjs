import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const store = new Map();
const sandbox = {
  URL,
  globalThis,
  window: {},
  localStorage: {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  }
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../raven-core.js", import.meta.url), "utf8"), sandbox);

const { classifyTask, filterActiveSystemFailures, evaluateRavenHealth } = sandbox.window.RavenCore;

console.log("Running task-health classification tests...");

// 1. Disposable test task classification
const testTask1 = { id: "test-123", status: "FAILED", source: "e2e-playwright" };
const testTask2 = { id: "task-456", status: "FAILED", is_test: true };
const testTask3 = { id: "task-789", title: "Integration-test job", status: "FAILED" };

assert.equal(classifyTask(testTask1).category, "disposable_test");
assert.equal(classifyTask(testTask2).category, "disposable_test");
assert.equal(classifyTask(testTask3).category, "disposable_test");

// 2. Manual application blocked task classification
const blockedTask1 = { id: "task-1", status: "BLOCKED_USER_INPUT", notes: "Waiting for user confirmation" };
const blockedTask2 = { id: "task-2", status: "BLOCKED_USER_CONFIRMATION" };
const blockedTask3 = { id: "task-3", status: "PENDING", notes: "Never submit without user confirmation" };

assert.equal(classifyTask(blockedTask1).category, "manual_blocked");
assert.equal(classifyTask(blockedTask2).category, "manual_blocked");
assert.equal(classifyTask(blockedTask3).category, "manual_blocked");

// 3. Historical / legacy task classification
const legacyTask1 = { id: "legacy-1", status: "FAILED_FINAL" };
const legacyTask2 = { id: "legacy-2", status: "BLOCKED_TOOLING" };
const legacyTask3 = { id: "legacy-3", status: "FAILED", source: "drive_upload", notes: "Google Drive retired queue failure" };

assert.equal(classifyTask(legacyTask1).category, "historical_legacy");
assert.equal(classifyTask(legacyTask2).category, "historical_legacy");
assert.equal(classifyTask(legacyTask3).category, "historical_legacy");

// 4. Operational active tasks & failures
const activeSuccess = { id: "active-1", status: "COMPLETED" };
const activeFailure = { id: "active-2", status: "FAILED", notes: "Supabase DB timeout" };

assert.equal(classifyTask(activeSuccess).category, "operational_active");
assert.equal(classifyTask(activeSuccess).isSystemFailure, false);
assert.equal(classifyTask(activeFailure).category, "operational_active");
assert.equal(classifyTask(activeFailure).isSystemFailure, true);

// 5. System health evaluation with mixed tasks
const mixedTasks = [
  testTask1,
  testTask2,
  blockedTask1,
  blockedTask2,
  legacyTask1,
  legacyTask2,
  activeSuccess
];

const health = evaluateRavenHealth(mixedTasks);
assert.equal(health.healthy, true);
assert.equal(health.status, "healthy");
assert.equal(health.counts.total, 7);
assert.equal(health.counts.disposableTest, 2);
assert.equal(health.counts.manualBlocked, 2);
assert.equal(health.counts.historicalLegacy, 2);
assert.equal(health.counts.operationalActive, 1);
assert.equal(health.counts.activeFailures, 0);

// 6. System health evaluation with active failure
const degradedTasks = [...mixedTasks, activeFailure];
const degradedHealth = evaluateRavenHealth(degradedTasks);
assert.equal(degradedHealth.healthy, false);
assert.equal(degradedHealth.status, "degraded");
assert.equal(degradedHealth.counts.activeFailures, 1);

const activeFailures = filterActiveSystemFailures(degradedTasks);
assert.equal(activeFailures.length, 1);
assert.equal(activeFailures[0].id, "active-2");

console.log("All task-health classification tests passed successfully!");
