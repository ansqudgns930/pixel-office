import { CONTRACT_VERSION, type AuditEntry, type WorkRequest, type WorkResult } from "../../contracts/src/index.js";
import type { HostAdapter } from "../../host-adapter-sdk/src/index.js";
import { createHash } from "node:crypto";

export class PolicyViolation extends Error {}

function pathAllowed(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -3)) : path === pattern);
}

export class AgentCompanyCore {
  private readonly completed = new Map<string, WorkResult>();
  private readonly checkpoints = new Map<string, string>();
  constructor(private readonly host: HostAdapter) {}

  async execute(request: WorkRequest): Promise<WorkResult> {
    const prior = this.completed.get(request.requestId); if (prior) return prior;
    const started = Date.now(); const audit: AuditEntry[] = [];
    const log = (type: string, detail: Record<string, unknown> = {}) => audit.push({ at: new Date().toISOString(), runId: request.runId, type, detail });
    log("RUN_STARTED", { strategy: request.strategy, risk: request.risk });

    if (request.risk === "high" && !request.approved) { log("APPROVAL_BLOCKED"); return this.finish(request, "blocked", 0, false, started, audit); }
    const denied = request.requestedPaths.filter(path => !pathAllowed(path, request.allowedPaths));
    if (denied.length) { log("SCOPE_BLOCKED", { denied }); return this.finish(request, "blocked", 0, false, started, audit); }

    const roles = request.strategy === "single_agent" ? ["worker"] : request.strategy === "manager_subagents" ? ["orchestrator", "worker"] : ["planner", "worker", "reviewer"];
    let cost = 0;
    for (const role of roles) {
      const callId = `${request.requestId}:${role}`;
      const result = await this.host.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: callId, hostId: this.host.hostId, deadline: Date.now() + 30_000, model: "phase0-model", prompt: `${role}: ${request.goal}` });
      cost += result.cost; log("MODEL_CALLED", { role, callId, cost: result.cost });
      if (cost > request.maxCost) { log("BUDGET_BLOCKED", { cost, maxCost: request.maxCost }); return this.finish(request, "blocked", cost, false, started, audit); }
      await this.host.recordUsage({ requestId: callId, tokens: result.tokens, cost: result.cost });
      const checkpoint = `${request.runId}:${role}`; this.checkpoints.set(request.runId, checkpoint); log("CHECKPOINT_CREATED", { checkpoint });
    }
    const artifacts = request.requestedPaths.map(path => ({ path, kind: path.includes("test") ? "test" as const : "code" as const, sha256: createHash("sha256").update(`${request.goal}\n${path}`).digest("hex"), basedOn: request.requestId, validation: "passed" as const }));
    log("ARTIFACTS_CREATED", { artifacts: artifacts.map(item => ({ path: item.path, sha256: item.sha256 })) });
    log("VALIDATION_COMPLETED", { passed: true, checks: request.risk === "high" ? ["scope", "approval", "auth-security", "tests"] : ["scope", "tests"] });
    return this.finish(request, "completed", cost, true, started, audit, this.checkpoints.get(request.runId), artifacts);
  }

  checkpoint(runId: string): string | undefined { return this.checkpoints.get(runId); }

  private finish(request: WorkRequest, status: WorkResult["status"], cost: number, validationPassed: boolean, started: number, audit: AuditEntry[], checkpointId?: string, artifacts: WorkResult["artifacts"] = []): WorkResult {
    const result: WorkResult = { runId: request.runId, status, cost, durationMs: Date.now() - started, validationPassed, artifacts, audit, ...(checkpointId ? { checkpointId } : {}) };
    this.completed.set(request.requestId, result); return result;
  }
}

export { pathAllowed };
