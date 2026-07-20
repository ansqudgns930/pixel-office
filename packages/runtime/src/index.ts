import type { RunQueue } from "../../queue/src/index.js";
import type { RunStatus, StateStore, StoredRun } from "../../persistence/src/index.js";

const TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  CREATED: ["PLANNING", "CANCELLED"], PLANNING: ["PLAN_APPROVAL_WAITING", "FAILED", "BLOCKED", "PAUSED", "CANCELLING"],
  PLAN_APPROVAL_WAITING: ["READY", "BLOCKED", "CANCELLED"], READY: ["RUNNING", "PAUSED", "CANCELLING"],
  RUNNING: ["VALIDATING", "BLOCKED", "PAUSED", "CANCELLING", "FAILED"], VALIDATING: ["REVISION_REQUIRED","RESULT_APPROVAL_WAITING", "BLOCKED", "FAILED", "PAUSED", "CANCELLING"],REVISION_REQUIRED:["READY","FAILED","CANCELLED"],
  RESULT_APPROVAL_WAITING: ["REVISION_REQUIRED","COMPLETED", "BLOCKED", "CANCELLED"], COMPLETED: [], PAUSED: ["READY", "CANCELLED"],
  CANCELLING: ["CANCELLED"], CANCELLED: [], FAILED: ["READY", "CANCELLED"], BLOCKED: ["READY", "CANCELLED"]
};

export class InvalidTransition extends Error {}

export class RunController {
  constructor(private readonly store: StateStore, private readonly queue: Pick<RunQueue, "enqueue" | "remove">) {}

  async create(run: StoredRun, options: { deferEnqueue?: boolean } = {}): Promise<void> { this.store.createRun(run); this.store.audit(run.id, "RUN_CREATED", { requestId: run.requestId }); if (!options.deferEnqueue) await this.queue.enqueue({ runId: run.id, requestId: run.requestId }); }
  async enqueue(runId: string): Promise<void> { const run=this.required(runId); await this.queue.enqueue({runId,requestId:run.requestId}); }
  move(runId: string, to: RunStatus, checkpoint?: Record<string, unknown>): void {
    const run = this.required(runId);
    const merged = checkpoint ? { ...(run.checkpoint ?? {}), ...checkpoint } : undefined;
    if (!TRANSITIONS[run.status].includes(to) || !this.store.transition(runId, [run.status], to, merged)) throw new InvalidTransition(`${run.status} -> ${to}`);
    this.store.audit(runId, "RUN_TRANSITIONED", { from: run.status, to, checkpoint: merged ?? null });
  }
  async pause(runId: string): Promise<void> { const run = this.required(runId); this.move(runId, "PAUSED", { ...(run.checkpoint ?? {}), pausedAt: new Date().toISOString() }); await this.queue.remove(runId).catch(() => false); }
  async cancel(runId: string): Promise<void> { const run = this.required(runId); if (["CREATED", "PLAN_APPROVAL_WAITING", "PAUSED", "RESULT_APPROVAL_WAITING", "FAILED", "BLOCKED"].includes(run.status)) this.move(runId, "CANCELLED"); else { this.move(runId, "CANCELLING"); this.move(runId, "CANCELLED"); } await this.queue.remove(runId).catch(() => false); }
  async retry(runId: string): Promise<void> { const run = this.required(runId); if (!["FAILED", "BLOCKED", "PAUSED"].includes(run.status)) throw new InvalidTransition(`${run.status} cannot retry`); const manualRetryCount=Number(run.checkpoint?.manualRetryCount??0)+1;this.move(runId, "READY", { ...(run.checkpoint ?? {}), manualRetryCount, lastManualRetryAt:new Date().toISOString() }); await this.queue.remove(runId).catch(() => false);await this.queue.enqueue({ runId, requestId: `${run.requestId}:manual-retry-${manualRetryCount}` }); }
  async recover(): Promise<number> { let count = 0; for (const run of this.store.recoverableRuns()) { if (run.status !== "PAUSED" && run.status !== "PLAN_APPROVAL_WAITING" && run.status !== "RESULT_APPROVAL_WAITING") { await this.queue.remove(run.id).catch(() => false);await this.queue.enqueue({ runId: run.id, requestId: run.requestId }); count++; } } return count; }
  private required(id: string): StoredRun { const run = this.store.getRun(id); if (!run) throw new Error(`Run not found: ${id}`); return run; }
}
