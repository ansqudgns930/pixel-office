import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { PolicyEngine, RunIntakeService } from "../packages/policy/src/index.js";

class FakeQueue { async enqueue() {} async remove() { return false; } }
test("policy infers management depth and rejects requested risk downgrade", async () => {
  const engine = new PolicyEngine(); assert.equal(engine.decide({ goal: "small copy edit", requestedPaths: ["docs/a.md"] }).risk, "low"); assert.equal(engine.decide({ goal: "refactor shared API", requestedPaths: ["src/a.ts"] }).risk, "medium");
  const high = engine.decide({ goal: "change authentication", requestedPaths: ["src/auth.ts"], requestedRisk: "low" }); assert.equal(high.risk, "high"); assert.equal(high.managementDepth, "executive"); assert.deepEqual(high.requiredRoles, ["planner", "worker", "reviewer"]); assert.ok(high.reasons.includes("risk-downgrade-rejected"));
  const critical=engine.decide({goal:"deploy production payment secret",requestedPaths:[".env"],requestedRisk:"low"});assert.equal(critical.risk,"critical");assert.equal(critical.managementDepth,"executive");assert.deepEqual(critical.requiredRoles,["planner","worker","reviewer"]);assert.ok(critical.reasons.includes("risk-downgrade-rejected"));
  const store = new SQLiteStateStore(":memory:"); const intake = new RunIntakeService(store, new RunController(store, new FakeQueue()), engine); await intake.create({ id: "run", requestId: "req", goal: "modify database schema", requestedPaths: ["db/schema.sql"], requestedRisk: "low", budgetLimit: 2 });
  assert.equal(store.getRun("run")?.risk, "high"); assert.equal((store.getRun("run")?.checkpoint?.policy as { managementDepth: string }).managementDepth, "executive"); assert.equal(store.db.prepare("SELECT count(*) AS n FROM audit_events WHERE type='POLICY_DECIDED'").get()?.n, 1); store.close();
});
