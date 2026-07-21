import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { OpenAICompatibleClient, localModelClient } from "../packages/model-adapters/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import { CONTRACT_VERSION } from "../packages/contracts/src/index.js";

async function startMockOpenAiServer() {
  const requests: Array<{ url: string; body: string }> = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      requests.push({ url: req.url ?? "", body });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "llama3" }, { id: "qwen2" }] }));
      if (req.url === "/v1/chat/completions" && req.method === "POST") return res.end(JSON.stringify({ choices: [{ message: { content: "mock completion" } }], usage: { total_tokens: 12 } }));
      res.statusCode = 404; res.end(JSON.stringify({ error: "not found" }));
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address === "object");
  return { server, requests, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

test("OpenAICompatibleClient maps chat completions and model list", async t => {
  const { server, requests, baseUrl } = await startMockOpenAiServer();
  t.after(() => server.close());
  const client = new OpenAICompatibleClient({ baseUrl, apiKey: "test-key", costPer1kTokens: 0.5 });
  assert.deepEqual(await client.listModels(), ["llama3", "qwen2"]);
  const result = await client.complete({ model: "llama3", prompt: "hello" });
  assert.equal(result.text, "mock completion");
  assert.equal(result.tokens, 12);
  assert.equal(result.cost, 0.006);
  assert.deepEqual(requests.map(r => r.url), ["/v1/models", "/v1/chat/completions"]);
  const sentBody = JSON.parse(requests[1]?.body ?? "{}") as { model: string; messages: Array<{ role: string; content: string }> };
  assert.equal(sentBody.model, "llama3");
  assert.deepEqual(sentBody.messages, [{ role: "user", content: "hello" }]);
});

test("OpenAICompatibleClient surfaces HTTP failures", async t => {
  const server = createServer((_req, res) => { res.statusCode = 500; res.end("boom"); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.close());
  const address = server.address(); assert.ok(address && typeof address === "object");
  const client = new OpenAICompatibleClient({ baseUrl: `http://127.0.0.1:${address.port}` });
  await assert.rejects(client.complete({ model: "x", prompt: "y" }), /chat completion failed: 500/);
});

test("localModelClient defaults to the standard local OpenAI-compatible port", () => {
  const client = localModelClient();
  assert.ok(client instanceof OpenAICompatibleClient);
});

test("StandaloneHostAdapter delegates to an injected ModelClient when provided", async () => {
  const { server, baseUrl } = await startMockOpenAiServer();
  try {
    const client = new OpenAICompatibleClient({ baseUrl });
    const host = new StandaloneHostAdapter(client);
    assert.deepEqual((await host.listModels()).map(m => m.id), ["llama3", "qwen2"]);
    const result = await host.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: "delegated-1", hostId: host.hostId, deadline: Date.now() + 1000, model: "llama3", prompt: "hello" });
    assert.equal(result.text, "mock completion");
    assert.equal(result.tokens, 12);
  } finally { server.close(); }
});

test("StandaloneHostAdapter keeps deterministic stub behavior without a ModelClient", async () => {
  const host = new StandaloneHostAdapter();
  assert.deepEqual((await host.listModels()).map(m => m.id), ["phase0-model"]);
  const result = await host.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: "stub-1", hostId: host.hostId, deadline: Date.now() + 1000, model: "phase0-model", prompt: "hello" });
  assert.equal(result.text, "[phase0-model] hello");
});

test("StandaloneHostAdapter enforces the model request deadline", async () => {
  let observedSignal: AbortSignal | undefined;
  const client = {
    async listModels() { return ["slow-model"]; },
    async complete(request: { model: string; prompt: string; signal?: AbortSignal }) {
      observedSignal = request.signal;
      await new Promise<void>((resolve, reject) => {
        request.signal?.addEventListener("abort", () => reject(request.signal?.reason), { once: true });
      });
      return { text: "unreachable", tokens: 0, cost: 0 };
    }
  };
  const host = new StandaloneHostAdapter(client);
  await assert.rejects(host.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: "deadline-1", hostId: host.hostId, deadline: Date.now() + 20, model: "slow-model", prompt: "hello" }), /timeout|timed out|deadline|model client unavailable/i);
  assert.equal(observedSignal?.aborted, true);
});
