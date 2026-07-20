import type { Worker } from "bullmq";
import type { RunQueue, RunJob } from "../../queue/src/index.js";
import type { StateStore } from "../../persistence/src/index.js";
import type { RolePipeline } from "../../role-pipeline/src/index.js";

export class RunWorker {
  private worker: Worker<RunJob> | null = null;
  constructor(private readonly queue: RunQueue, private readonly store: StateStore, private readonly pipeline: RolePipeline, private readonly connection: { host: string; port: number }) {}
  start(): Worker<RunJob> {
    if (this.worker) return this.worker;
    this.worker = this.queue.worker(this.connection, async job => {
      const run = this.store.getRun(job.data.runId);
      if (!run || ["COMPLETED", "CANCELLED", "FAILED"].includes(run.status)) return;
      try { await this.pipeline.process(run.id); }
      catch (error) {
        const current = this.store.getRun(run.id);
        if (current && !["BLOCKED", "FAILED", "CANCELLED"].includes(current.status)) this.store.transition(run.id, [current.status], "FAILED", { error: error instanceof Error ? error.message : String(error) });
        this.store.audit(run.id, "WORKER_FAILED", { error: error instanceof Error ? error.message : String(error), attempt: job.attemptsMade + 1 });
        throw error;
      }
    });
    return this.worker;
  }
  async close(): Promise<void> { if (this.worker) await this.worker.close(); this.worker = null; }
}
