import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";

test("performance gate accepts ten simultaneous Run submissions without loss", async () => {
  const state = new SQLiteStateStore(":memory:");
  const queued: string[] = [];
  const controller = new RunController(state, {
    async enqueue(job) { queued.push(job.runId); },
    async remove() { return false; }
  });
  const started = performance.now();
  await Promise.all(Array.from({ length: 10 }, (_, index) => controller.create({
    id: `perf-run-${index}`,
    requestId: `perf-request-${index}`,
    goal: `parallel workload ${index}`,
    risk: "low",
    status: "CREATED",
    budgetLimit: 2,
    spent: 0,
    checkpoint: null
  })));
  const elapsedMs = performance.now() - started;
  assert.equal(new Set(queued).size, 10);
  assert.equal(Array.from({ length: 10 }, (_, index) => state.getRun(`perf-run-${index}`)).filter(Boolean).length, 10);
  assert.ok(elapsedMs < 1_000, `ten Run submissions took ${elapsedMs.toFixed(1)}ms`);
  state.close();
});

test("performance gate persists and reads at least 100 events within one minute", () => {
  const state = new SQLiteStateStore(":memory:");
  const operations = new OperationalStore(state.db);
  const started = performance.now();
  for (let index = 0; index < 100; index++) operations.emit({
    tenantId: "performance-company",
    aggregateType: "run",
    aggregateId: `run-${index % 10}`,
    type: "PERFORMANCE_EVENT",
    eventId: `performance-event-${index}`,
    payload: { index }
  });
  const events = operations.events("performance-company", 0, 100);
  const elapsedMs = performance.now() - started;
  assert.equal(events.length, 100);
  assert.deepEqual(events.map(event => event.cursor), [...events.map(event => event.cursor)].sort((a, b) => a - b));
  assert.ok(elapsedMs < 60_000, `100 event round trip took ${elapsedMs.toFixed(1)}ms`);
  state.close();
});
