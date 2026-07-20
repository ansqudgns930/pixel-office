import type { UsageRecord } from "../../../packages/contracts/src/index.js";
import type { LegacyNvidiaClient } from "./index.js";
import type { OperationalStore,OutboxRecord } from "../../../packages/operations/src/index.js";

interface NvidiaAgentResponse { text?: string; usage?: { total_tokens?: number }; cost?: number }

export class NvidiaHttpClient implements LegacyNvidiaClient {
  readonly usageOutbox: UsageRecord[] = [];
  constructor(private readonly baseUrl: string, private readonly maxTokens = 320,private readonly durable?:OperationalStore) {}

  async health(): Promise<boolean> {
    const response = await fetch(new URL("/health", this.baseUrl));
    if (!response.ok) throw new Error(`NVIDIA health ${response.status}`);
    return Boolean((await response.json() as { ok?: boolean }).ok);
  }

  async usageTotals(): Promise<{ requests: number; tokens: number }> {
    const response = await fetch(new URL("/usage", this.baseUrl));
    if (!response.ok) throw new Error(`NVIDIA usage ${response.status}`);
    const data = await response.json() as { totals?: { requestsTotal?: number; tokensTotal?: number } };
    return { requests: Number(data.totals?.requestsTotal ?? 0), tokens: Number(data.totals?.tokensTotal ?? 0) };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(new URL("/chat-models", this.baseUrl));
    if (!response.ok) throw new Error(`NVIDIA models ${response.status}`);
    const data = await response.json() as { models?: Array<string | { model?: string; id?: string }> };
    return (data.models ?? []).map(item => typeof item === "string" ? item : item.model ?? item.id ?? "").filter(Boolean);
  }

  async agent(input: { id: string; model: string; message: string; signal?: AbortSignal }): Promise<{ text: string; tokens: number; cost: number }> {
    const response = await fetch(new URL("/agent", this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": input.id },
      body: JSON.stringify({ conversationId: `agent-company:${input.id}`, model: input.model, message: input.message, planMode: true, maxSteps: 1, max_tokens: this.maxTokens, permissionMode: "basic" }),
      ...(input.signal ? { signal: input.signal } : {})
    });
    if (!response.ok) throw new Error(`NVIDIA agent ${response.status}: ${await response.text()}`);
    const data = await response.json() as NvidiaAgentResponse;
    const text = String(data.text ?? "");
    return { text, tokens: Number(data.usage?.total_tokens ?? Math.ceil((input.message.length + text.length) / 4)), cost: Number(data.cost ?? 0) };
  }

  async usage(record: UsageRecord): Promise<void> {
    if(this.durable){this.durable.enqueue("usage",`nvidia-usage:${record.requestId}`,record);return;}
    if (!this.usageOutbox.some(item => item.requestId === record.requestId)) this.usageOutbox.push(record);
  }
  async flushUsage():Promise<{sent:number;failed:number}>{if(!this.durable)return{sent:0,failed:0};return this.durable.flush(async(record:OutboxRecord)=>{if(record.kind!=="usage")return;const response=await fetch(new URL("/usage",this.baseUrl),{method:"POST",headers:{"content-type":"application/json","idempotency-key":record.idempotencyKey},body:JSON.stringify(record.payload)});if(!response.ok)throw new Error(`NVIDIA usage delivery ${response.status}`);});}
}
