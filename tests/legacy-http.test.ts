import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { NvidiaHttpClient } from "../apps/legacy-nvidia-host/src/http-client.js";
import { LegacyNvidiaHostAdapter } from "../apps/legacy-nvidia-host/src/index.js";
import { CONTRACT_VERSION } from "../packages/contracts/src/index.js";

test("legacy HTTP composition maps NVIDIA endpoints without importing NVIDIA code", async t => {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url ?? ""); res.setHeader("Content-Type", "application/json");
    if (req.url === "/health") return res.end(JSON.stringify({ ok: true }));
    if (req.url === "/chat-models") return res.end(JSON.stringify({ models: [{ model: "phase0-model" }] }));
    if (req.url === "/agent" && req.method === "POST") return res.end(JSON.stringify({ text: "mapped response", usage: { total_tokens: 7 }, cost: 0.01 }));
    res.statusCode = 404; res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.close());
  const address = server.address(); assert.ok(address && typeof address === "object");
  const client = new NvidiaHttpClient(`http://127.0.0.1:${address.port}`);
  assert.equal(await client.health(), true);
  const adapter = new LegacyNvidiaHostAdapter(client);
  assert.deepEqual((await adapter.listModels()).map(x => x.id), ["phase0-model"]);
  const result = await adapter.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: "http-1", hostId: adapter.hostId, deadline: Date.now() + 1000, model: "phase0-model", prompt: "hello" });
  assert.equal(result.text, "mapped response");
  await adapter.recordUsage({ requestId: result.requestId, tokens: result.tokens, cost: result.cost });
  await adapter.recordUsage({ requestId: result.requestId, tokens: result.tokens, cost: result.cost });
  assert.equal(client.usageOutbox.length, 1);
  assert.deepEqual(requests, ["/health", "/chat-models", "/agent"]);
});
