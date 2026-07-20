import type { AgentEvent, HostCapabilities, ModelInfo, ModelRequest, ModelResult, UsageRecord, UserContext } from "../../contracts/src/index.js";

export type AdapterErrorCode = "CAPABILITY_UNAVAILABLE" | "AUTHENTICATION_FAILED" | "RATE_LIMITED" | "HOST_UNAVAILABLE" | "CONTRACT_MISMATCH" | "PERMANENT_FAILURE";

export class AdapterError extends Error {
  constructor(public readonly code: AdapterErrorCode, message: string, public readonly retryAfterMs?: number) { super(message); }
}

export interface HostAdapter {
  readonly hostId: string;
  capabilities(): Promise<HostCapabilities>;
  authenticate(request: unknown): Promise<UserContext>;
  listModels(): Promise<ModelInfo[]>;
  invokeModel(request: ModelRequest): Promise<ModelResult>;
  recordUsage(usage: UsageRecord): Promise<void>;
  publishEvent(event: AgentEvent): Promise<void>;
}

export function assertContractVersion(version: string): void {
  if (version.split(".")[0] !== "1") throw new AdapterError("CONTRACT_MISMATCH", `Unsupported contract ${version}`);
}

export function signalForDeadline(deadline: number, signal?: AbortSignal): AbortSignal {
  const remaining = deadline - Date.now();
  const deadlineSignal = remaining > 0
    ? AbortSignal.timeout(remaining)
    : AbortSignal.abort(new DOMException("Model request deadline exceeded", "TimeoutError"));
  return signal ? AbortSignal.any([signal, deadlineSignal]) : deadlineSignal;
}
