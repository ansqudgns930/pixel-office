import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class Queue { async enqueue() {} async remove() { return false; } }

test("demo bootstrap creates a playable company skeleton and is idempotent", async t => {
  const store = new SQLiteStateStore(":memory:");
  const projects = new ProjectOperations(store.db, store);
  const companies = new CompanyOperations(store.db, store, projects);
  const controller = new RunController(store, new Queue());
  const intake = new RunIntakeService(store, controller);
  const server = new ControlPlaneApi(store, intake, controller, { approvePlan() {}, approveResult() {} }, projects, companies).server();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.close(); store.close(); });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const bootstrap = () => fetch(`http://127.0.0.1:${address.port}/api/demo/bootstrap`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const first = await bootstrap();
  const second = await bootstrap();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const body = await second.json() as { company: { mode: string }; pixel: { agents: unknown[] }; task: { status: string } };
  assert.equal(body.company.mode, "demo");
  assert.equal(body.pixel.agents.length, 5);
  assert.equal(body.task.status, "ready");
  assert.equal((store.db.prepare("SELECT COUNT(*) AS n FROM companies_v4 WHERE mode='demo'").get() as { n: number }).n, 1);
  assert.equal((store.db.prepare("SELECT COUNT(*) AS n FROM board_tasks_v3 WHERE project_id='demo-first-delivery'").get() as { n: number }).n, 1);
  assert.equal((store.db.prepare("SELECT COUNT(*) AS n FROM assignments_v3 WHERE task_id='demo-first-delivery-task'").get() as { n: number }).n, 2);
  const profiles=companies.roleTemplates("demo-company");assert.equal(profiles.length,2);assert.equal(profiles.find(x=>x.logicalId==="default-developer")?.jobFamily,"engineering");assert.equal(profiles.find(x=>x.logicalId==="default-qa")?.prohibitedActions.find(x=>x.action==="modify production code")?.enforcement,"deterministic-check");assert.equal((store.db.prepare("SELECT COUNT(*) AS n FROM role_template_bindings_v15 WHERE company_id='demo-company'").get() as {n:number}).n,2);
  companies.bootstrapDemo("admin");
  assert.equal((store.db.prepare("SELECT role FROM project_members_v3 WHERE project_id='demo-first-delivery' AND principal_id='admin'").get() as {role:string}).role,"owner");
});
