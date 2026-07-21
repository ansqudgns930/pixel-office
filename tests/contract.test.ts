import test from "node:test";
import assert from "node:assert/strict";
import { CONTRACT_VERSION, type UsageRecord } from "../packages/contracts/src/index.js";
import type { HostAdapter } from "../packages/host-adapter-sdk/src/index.js";
import { AdapterError } from "../packages/host-adapter-sdk/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import { LegacyNvidiaHostAdapter, type LegacyNvidiaClient } from "../apps/legacy-nvidia-host/src/index.js";
import { CliAgentClient } from "../packages/cli-agent-adapter/src/index.js";
import type { ModelClient } from "../packages/model-adapters/src/index.js";
import { join } from "node:path";

class FakeLegacyClient implements LegacyNvidiaClient {
  usageRecords: UsageRecord[] = []; available = true;
  async listModels(): Promise<string[]> { return ["phase0-model"]; }
  async agent(input: { id: string; model: string; message: string; signal?: AbortSignal }) {
    if (!this.available) throw new Error("offline");
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { text: input.message, tokens: input.message.length, cost: input.message.length / 1000 };
  }
  async usage(record: UsageRecord): Promise<void> { if (!this.usageRecords.some(x => x.requestId === record.requestId)) this.usageRecords.push(record); }
}

function adapters(): Array<{ adapter: HostAdapter; offline: () => void; recover: () => void }> {
  const standalone = new StandaloneHostAdapter(); const client = new FakeLegacyClient();
  class ToggleCliClient implements ModelClient{available=true;constructor(readonly delegate:CliAgentClient){}listModels(){return this.delegate.listModels();}complete(request:Parameters<ModelClient["complete"]>[0]){if(!this.available)throw new Error("offline");return this.delegate.complete(request);}}
  const fixture=join(process.cwd(),"tests","fixtures","fake-cli.cjs"),claude=new ToggleCliClient(new CliAgentClient({provider:"claude",executable:process.execPath,executableArgsPrefix:[fixture]})),codex=new ToggleCliClient(new CliAgentClient({provider:"codex",executable:process.execPath,executableArgsPrefix:[fixture]}));
  return [
    { adapter: standalone, offline: () => { standalone.available = false; }, recover: () => { standalone.available = true; } },
    { adapter: new LegacyNvidiaHostAdapter(client), offline: () => { client.available = false; }, recover: () => { client.available = true; } },
    { adapter: new StandaloneHostAdapter(claude,"claude-cli"),offline:()=>{claude.available=false;},recover:()=>{claude.available=true;} },
    { adapter: new StandaloneHostAdapter(codex,"codex-cli"),offline:()=>{codex.available=false;},recover:()=>{codex.available=true;} }
  ];
}

for (const entry of adapters()) test(`contract: ${entry.adapter.hostId}`, async t => {
  await t.test("auth and models", async () => { assert.equal((await entry.adapter.authenticate({ token: "ok" })).roles[0], "owner"); assert.ok((await entry.adapter.listModels()).length); });
  await t.test("model idempotency and usage", async () => {
    const request = { contractVersion: CONTRACT_VERSION, requestId: "same", hostId: entry.adapter.hostId, deadline: Date.now() + 1000, model: "phase0-model", prompt: "hello" };
    assert.deepEqual(await entry.adapter.invokeModel(request), await entry.adapter.invokeModel(request));
    const result = await entry.adapter.invokeModel(request); await entry.adapter.recordUsage({ requestId: result.requestId, tokens: result.tokens, cost: result.cost });
  });
  await t.test("events are idempotent", async () => { const event = { id: "evt", type: "RUN", runId: "run", payload: {} }; await entry.adapter.publishEvent(event); await entry.adapter.publishEvent(event); });
  await t.test("stream abort", async () => { const c = new AbortController(); c.abort(); await assert.rejects(entry.adapter.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: "abort", hostId: entry.adapter.hostId, deadline: Date.now() + 1000, model: "phase0-model", prompt: "x", signal: c.signal }), { name: "AbortError" }); });
  await t.test("contract mismatch", async () => assert.rejects(entry.adapter.invokeModel({ contractVersion: "2.0", requestId: "bad", hostId: entry.adapter.hostId, deadline: 0, model: "x", prompt: "x" }), (e: unknown) => e instanceof AdapterError && e.code === "CONTRACT_MISMATCH"));
  await t.test("host failure and recovery", async () => {
    const request = { contractVersion: CONTRACT_VERSION, requestId: "offline", hostId: entry.adapter.hostId, deadline: Date.now() + 5_000, model: "x", prompt: "x" };
    entry.offline();
    await assert.rejects(entry.adapter.invokeModel(request), (e: unknown) => e instanceof AdapterError && e.code === "HOST_UNAVAILABLE");
    entry.recover();
    assert.equal((await entry.adapter.invokeModel(request)).requestId, "offline");
  });
});
