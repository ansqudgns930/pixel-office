import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunQueue } from "../packages/queue/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RolePipeline } from "../packages/role-pipeline/src/index.js";
import { RunWorker } from "../packages/run-worker/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!check()) { if (Date.now() > end) throw new Error("Timed out waiting for durable run state"); await new Promise(resolve => setTimeout(resolve, 25)); }
}

test("BullMQ worker drives durable pipeline and restart resumes without duplicate role", { skip: process.env.REDIS_INTEGRATION !== "1", timeout: 20_000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), "agent-company-restart-")), dbPath = join(dir, "state.sqlite");
  const connection = { host: "127.0.0.1", port: 6379 }; const queue = new RunQueue(connection); let store = new SQLiteStateStore(dbPath); let controller = new RunController(store, queue); let host = new StandaloneHostAdapter(); let pipeline = new RolePipeline(store, controller, host); let runner = new RunWorker(queue, store, pipeline, connection);
  t.after(async () => { await runner.close(); await queue.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });
  const id = `worker-${crypto.randomUUID()}`; runner.start();
  await controller.create({ id, requestId: `req-${id}`, goal: "high risk edit", risk: "high", status: "CREATED", budgetLimit: 10, spent: 0, checkpoint: null });
  await waitFor(() => store.getRun(id)?.status === "PLAN_APPROVAL_WAITING"); assert.equal(host.usage.length, 1);
  await runner.close(); store.close();
  store = new SQLiteStateStore(dbPath); controller = new RunController(store, queue); host = new StandaloneHostAdapter(); pipeline = new RolePipeline(store, controller, host); pipeline.approvePlan(id, "owner"); await queue.remove(id); await queue.enqueue({ runId: id, requestId: `req-${id}:resume` });
  runner = new RunWorker(queue, store, pipeline, connection); runner.start(); await waitFor(() => store.getRun(id)?.status === "VALIDATING");
  assert.equal(store.getRun(id)?.status, "VALIDATING"); assert.deepEqual(store.tasks(id).map(x => x.role), ["planner", "worker"]); assert.equal(host.usage.length, 1);
});
