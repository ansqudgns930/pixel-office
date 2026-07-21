import test from "node:test";
import assert from "node:assert/strict";
import { runComparison, summarize } from "../apps/phase0-runner/index.js";

test("phase0 runner executes the controlled 3 x 3 x 5 matrix", async () => {
  const rows = await runComparison(5);
  assert.equal(rows.length, 45);
  assert.deepEqual(new Set(rows.map(row => row.risk)), new Set(["low", "medium", "high"]));
  assert.deepEqual(new Set(rows.map(row => row.strategy)), new Set(["single_agent", "manager_subagents", "role_pipeline"]));
  assert.ok(rows.every(row => row.result.audit.some(entry => entry.type === "RUN_STARTED")));
  assert.ok(rows.every(row => row.result.audit.some(entry => entry.type === "VALIDATION_COMPLETED")));
  assert.ok(rows.every(row => row.result.artifacts.length > 0));
  assert.ok(rows.flatMap(row => row.result.artifacts).every(artifact => /^[a-f0-9]{64}$/.test(artifact.sha256) && artifact.validation === "passed"));
  const summary = summarize(rows);
  assert.deepEqual(summary.map(item => item.runs), [15, 15, 15]);
  assert.deepEqual(summary.map(item => item.modelCalls), [15, 30, 45]);
});
