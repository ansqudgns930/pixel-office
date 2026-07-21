import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore, type StoredRun } from "../packages/persistence/src/index.js";
import { InvalidTransition, RunController } from "../packages/runtime/src/index.js";

class FakeQueue {
  jobs = new Map<string, { runId: string; requestId: string }>();
  async enqueue(job: { runId: string; requestId: string }) { this.jobs.set(job.runId, job); }
  async remove(id: string) { return this.jobs.delete(id); }
}
const run = (id: string): StoredRun => ({ id, requestId: `req-${id}`, goal: "edit", risk: "low", status: "CREATED", budgetLimit: 1, spent: 0, checkpoint: null });

test("RunController enforces transitions, pause, retry and cancel", async () => {
  const store = new SQLiteStateStore(":memory:"); const queue = new FakeQueue(); const controller = new RunController(store, queue);
  await controller.create(run("one")); assert.equal(queue.jobs.size, 1);
  controller.move("one", "PLANNING", { role: "planner" });
  await controller.pause("one"); assert.equal(store.getRun("one")?.status, "PAUSED"); assert.equal(queue.jobs.size, 0);
  await controller.retry("one"); assert.equal(store.getRun("one")?.status, "READY"); assert.equal(store.getRun("one")?.checkpoint?.manualRetryCount,1); assert.equal(queue.jobs.size, 1);
  await controller.cancel("one"); assert.equal(store.getRun("one")?.status, "CANCELLED");
  assert.throws(() => controller.move("one", "RUNNING"), InvalidTransition); store.close();
});

test("recovery only requeues executable non-terminal runs and deduplicates by run id", async () => {
  const store = new SQLiteStateStore(":memory:"); const queue = new FakeQueue(); const controller = new RunController(store, queue);
  await controller.create(run("active")); controller.move("active", "PLANNING");
  await controller.create(run("waiting")); controller.move("waiting", "PLANNING"); controller.move("waiting", "PLAN_APPROVAL_WAITING");
  assert.equal(await controller.recover(), 1); assert.equal(await controller.recover(), 1); assert.deepEqual([...queue.jobs.keys()].sort(), ["active", "waiting"]); store.close();
});
