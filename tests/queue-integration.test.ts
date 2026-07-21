import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { RunQueue } from "../packages/queue/src/index.js";

test("BullMQ persists and deduplicates a run by run id", { skip: process.env.REDIS_INTEGRATION !== "1", timeout: 15_000 }, async t => {
  const connection = { host: "127.0.0.1", port: 6379 };
  const queue = new RunQueue(connection); const runId = `integration-${crypto.randomUUID()}`;
  const seen: string[] = [];
  const worker = queue.worker(connection, async job => { seen.push(job.data.runId); });
  t.after(async () => { await worker.close(); await queue.close(); });
  await queue.enqueue({ runId, requestId: "request-a" });
  await queue.enqueue({ runId, requestId: "request-a-duplicate" });
  const queued = await queue.queue.getJob(runId);
  if (!queued || !(await queued.isCompleted())) await once(worker, "completed");
  assert.deepEqual(seen, [runId]);
  assert.equal((await queue.queue.getJob(runId))?.data.requestId, "request-a");
});
