import test from "node:test";
import assert from "node:assert/strict";
import { AgentCompanyCore } from "../packages/agent-core/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import type { WorkRequest } from "../packages/contracts/src/index.js";
import type { ModelRequest, ModelResult } from "../packages/contracts/src/index.js";

const base: WorkRequest = { runId: "run", requestId: "req", strategy: "role_pipeline", risk: "high", goal: "secure auth", approved: true, allowedPaths: ["src/auth/**"], requestedPaths: ["src/auth/token.ts"], maxCost: 2 };

test("blocks approval bypass", async () => { const result = await new AgentCompanyCore(new StandaloneHostAdapter()).execute({ ...base, approved: false }); assert.equal(result.status, "blocked"); assert.equal(result.audit.at(-1)?.type, "APPROVAL_BLOCKED"); });
test("blocks path escape", async () => { const result = await new AgentCompanyCore(new StandaloneHostAdapter()).execute({ ...base, requestedPaths: ["deployment/prod.yml"] }); assert.equal(result.audit.at(-1)?.type, "SCOPE_BLOCKED"); });
test("blocks budget and checkpoints", async () => { const core = new AgentCompanyCore(new StandaloneHostAdapter()); const result = await core.execute({ ...base, maxCost: 0.001 }); assert.equal(result.audit.at(-1)?.type, "BUDGET_BLOCKED"); });
test("deduplicates execution and preserves checkpoint", async () => { const host = new StandaloneHostAdapter(); const core = new AgentCompanyCore(host); const one = await core.execute(base); const two = await core.execute(base); assert.equal(one, two); assert.ok(core.checkpoint(base.runId)); });

test("retries from preserved work after transient failure", async () => {
  class FlakyHost extends StandaloneHostAdapter {
    failed = false;
    override async invokeModel(request: ModelRequest): Promise<ModelResult> {
      if (request.requestId.endsWith(":reviewer") && !this.failed) { this.failed = true; throw new Error("transient"); }
      return super.invokeModel(request);
    }
  }
  const host = new FlakyHost(); const core = new AgentCompanyCore(host);
  await assert.rejects(core.execute(base), /transient/);
  assert.equal(core.checkpoint(base.runId), `${base.runId}:worker`);
  const result = await core.execute(base);
  assert.equal(result.status, "completed");
  assert.equal(host.usage.length, 3);
});
