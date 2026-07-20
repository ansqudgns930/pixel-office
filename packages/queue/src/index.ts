import { Queue, Worker, type Job } from "bullmq";

export interface RunJob { runId: string; requestId: string }
export class RunQueue {
  readonly queue: Queue<RunJob>;
  constructor(connection: { host: string; port: number }) { this.queue = new Queue<RunJob>("agent-company-runs", { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 500 }, removeOnComplete: 100, removeOnFail: 100 } }); }
  async enqueue(data: RunJob): Promise<void> { await this.queue.add("execute", data, { jobId: data.runId }); }
  async remove(runId: string): Promise<boolean> { const job = await this.queue.getJob(runId); if (!job) return false; await job.remove(); return true; }
  worker(connection: { host: string; port: number }, processor: (job: Job<RunJob>) => Promise<void>): Worker<RunJob> { return new Worker<RunJob>("agent-company-runs", processor, { connection, concurrency: 2 }); }
  async close(): Promise<void> { await this.queue.close(); }
}
