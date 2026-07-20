import type { AgentEvent, HostCapabilities, ModelInfo, ModelRequest, ModelResult, UsageRecord, UserContext } from "../../../packages/contracts/src/index.js";
import { AdapterError, assertContractVersion, signalForDeadline, type HostAdapter } from "../../../packages/host-adapter-sdk/src/index.js";
import type { OperationalStore } from "../../../packages/operations/src/index.js";

export interface LegacyNvidiaClient {
  listModels(): Promise<string[]>;
  agent(input: { id: string; model: string; message: string; signal?: AbortSignal }): Promise<{ text: string; tokens: number; cost: number }>;
  usage(record: UsageRecord): Promise<void>;
}

export class LegacyNvidiaHostAdapter implements HostAdapter {
  readonly hostId = "legacy-nvidia";
  readonly events: AgentEvent[] = [];
  private readonly results = new Map<string, ModelResult>();
  constructor(private readonly client: LegacyNvidiaClient,private readonly durable?:OperationalStore) {}
  async capabilities(): Promise<HostCapabilities> { return { auth: true, models: true, usage: true, events: true, streamingAbort: true }; }
  async authenticate(request: unknown): Promise<UserContext> {
    if (!request || typeof request !== "object" || !("token" in request)) throw new AdapterError("AUTHENTICATION_FAILED", "token required");
    return { userId: "legacy-user", roles: ["owner"] };
  }
  async listModels(): Promise<ModelInfo[]> { return (await this.client.listModels()).map(id => ({ id, label: id })); }
  async invokeModel(request: ModelRequest): Promise<ModelResult> {
    assertContractVersion(request.contractVersion);
    const cached = this.results.get(request.requestId); if (cached) return cached;
    try {
      const raw = await this.client.agent({ id: request.requestId, model: request.model, message: request.prompt, signal: signalForDeadline(request.deadline, request.signal) });
      const result = { requestId: request.requestId, ...raw }; this.results.set(request.requestId, result); return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new AdapterError("HOST_UNAVAILABLE", error instanceof Error ? error.message : "legacy host unavailable");
    }
  }
  async recordUsage(usage: UsageRecord): Promise<void> { await this.client.usage(usage); }
  async publishEvent(event: AgentEvent): Promise<void> {if(this.durable){this.durable.enqueue("event",`nvidia-event:${event.id}`,event);return;}if (!this.events.some(x => x.id === event.id)) this.events.push(event); }
}
