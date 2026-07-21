import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class FakeQueue { jobs = new Map<string, unknown>(); async enqueue(x: { runId: string }) { this.jobs.set(x.runId, x); } async remove(id: string) { return this.jobs.delete(id); } }
test("control plane serves local UI and Phase 2 run detail/control APIs", async t => {
  const store = new SQLiteStateStore(":memory:"), queue = new FakeQueue(), controller = new RunController(store, queue), intake = new RunIntakeService(store, controller); let approvedPlan = "";
  const server = new ControlPlaneApi(store, intake, controller, { approvePlan(runId) { approvedPlan = runId; }, approveResult() {} }).server(); server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => { server.close(); store.close(); }); const address = server.address(); assert.ok(address && typeof address === "object"); const base = `http://127.0.0.1:${address.port}`;
  const html = await (await fetch(base)).text(); assert.match(html, /실행 워크스페이스/); assert.match(html, /Diff/); assert.match(html, /Phase 2 아티팩트/); assert.match(html, /감사 로그/);
  const created = await fetch(`${base}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "api-run", requestId: "api-req", goal: "change auth", requestedPaths: ["src/auth.ts"], requestedRisk: "low", budgetLimit: 3 }) }); assert.equal(created.status, 201); assert.equal((await created.json() as { decision: { risk: string } }).decision.risk, "high");
  const artifact = store.createArtifactVersion({ logicalId: "code:src/auth.ts", parentVersionId: null, runId: "api-run", kind: "code", path: "src/auth.ts", baseCommit: "base", contentHash: "a".repeat(64) }); store.saveContextBuild("api-run", "b".repeat(64), { provenance: [artifact.id] }); store.saveMergeAssessment({ runId: "api-run", currentHead: "head", baseMoved: true, overlappingFiles: ["src/auth.ts"], conflictedFiles: [], conflict: false, revalidationRequired: true });
  const detail = await (await fetch(`${base}/api/runs/api-run`)).json() as { run: { risk: string }; audit: unknown[]; phase2: { artifacts: unknown[]; contexts: unknown[]; mergeAssessments: unknown[] } }; assert.equal(detail.run.risk, "high"); assert.ok(detail.audit.length >= 2); assert.equal(detail.phase2.artifacts.length, 1); assert.equal(detail.phase2.contexts.length, 1); assert.equal(detail.phase2.mergeAssessments.length, 1);
  await fetch(`${base}/api/runs/api-run/actions/approve-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(approvedPlan, "api-run");
  await fetch(`${base}/api/runs/api-run/actions/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(store.getRun("api-run")?.status, "CANCELLED");
  await intake.create({ id: "control-run", requestId: "control-req", goal: "small edit", requestedPaths: ["src/a.ts"], requestedRisk: "low", budgetLimit: 1 }); controller.move("control-run", "PLANNING"); await fetch(`${base}/api/runs/control-run/actions/pause`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(store.getRun("control-run")?.status, "PAUSED"); await fetch(`${base}/api/runs/control-run/actions/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(store.getRun("control-run")?.status, "READY");
});
