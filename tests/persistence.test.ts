import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";

test("SQLite is the durable source of truth across process-store restart", t => {
  const dir = mkdtempSync(join(tmpdir(), "agent-company-sqlite-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "state.sqlite");
  let store = new SQLiteStateStore(path);
  store.createRun({ id: "run-1", requestId: "req-1", goal: "change code", risk: "high", status: "CREATED", budgetLimit: 2, spent: 0, checkpoint: null });
  assert.equal(store.transition("run-1", ["CREATED"], "PLANNING", { role: "planner" }), true);
  assert.equal(store.spend("run-1", 0.5), true);
  assert.equal(store.spend("run-1", 2), false);
  store.addTask({ id: "task-1", runId: "run-1", role: "planner", status: "PENDING", input: { goal: "change code" }, output: null, ordinal: 1, completionCriteria: ["plan produced"], validationCommands: [], dependsOn: [] });
  store.completeTask("task-1", { plan: ["edit", "test"] });
  store.createApproval({ id: "approval-1", runId: "run-1", kind: "plan", status: "PENDING", expectedPatchHash: null });
  assert.equal(store.decideApproval("approval-1", true, "owner"), true);
  store.audit("run-1", "PLAN_APPROVED", { userId: "owner" });
  store.recordModelCall("run-1", "planner", "model-1", "COMPLETED", 10, 0.1, { text: "plan" }); store.recordToolCall("run-1", "test", "COMPLETED"); store.recordValidation("run-1", "test", true, "ok"); store.recordUsage("run-1", "model-1", 10, 0.1); store.addArtifact("run-1", "src/a.ts", "a".repeat(64), "code");
  store.close();

  store = new SQLiteStateStore(path);
  assert.equal(store.getRun("run-1")?.status, "PLANNING");
  assert.deepEqual(store.getRun("run-1")?.checkpoint, { role: "planner" });
  assert.equal(store.getRun("run-1")?.spent, 0.5);
  assert.deepEqual(store.tasks("run-1")[0]?.output, { plan: ["edit", "test"] });
  assert.deepEqual(store.tasks("run-1")[0]?.completionCriteria, ["plan produced"]); assert.equal(store.lineage("run-1").modelCalls.length, 1); assert.equal(store.lineage("run-1").toolCalls.length, 1); assert.equal(store.lineage("run-1").validations.length, 1); assert.equal(store.lineage("run-1").usage.length, 1); assert.equal(store.lineage("run-1").artifacts.length, 1);
  assert.equal(store.approval("approval-1")?.status, "APPROVED");
  assert.equal(store.db.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
  assert.equal(store.db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);
  assert.equal(store.db.prepare("SELECT count(*) AS count FROM audit_events").get()?.count, 1);
  store.close();
});
