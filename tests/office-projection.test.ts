import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";
import { OfficeProjectionStore } from "../packages/office-projection/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";
import { once } from "node:events";

class Queue { async enqueue() {} async remove() { return false; } }

test("office projection is ordered, idempotent and replayable",()=>{
  const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),ops=new OperationalStore(state.db);
  companies.bootstrapDemo("owner");
  ops.emit({tenantId:"demo-company",aggregateType:"run",aggregateId:"run-1",type:"RUN_CREATED",payload:{runId:"run-1",projectId:"demo-first-delivery",taskId:"demo-first-delivery-task"},eventId:"demo-run-created"});
  ops.emit({tenantId:"demo-company",aggregateType:"run",aggregateId:"run-1",type:"VALIDATION_COMPLETED",payload:{runId:"run-1",taskId:"demo-first-delivery-task"},eventId:"demo-validation"});
  const projection=new OfficeProjectionStore(state.db,ops),first=projection.catchUp("demo-company");
  assert.equal(first.phase,"validating");
  assert.equal(first.activeAgentId,"demo-qa");
  assert.equal(first.timeline.at(-1)?.type,"validation.completed");
  assert.deepEqual(projection.catchUp("demo-company"),first);
  const rebuilt=projection.rebuild("demo-company");
  assert.equal(rebuilt.stateHash,first.stateHash);
  assert.deepEqual(rebuilt.timeline,first.timeline);
  state.close();
});

test("office projection API catches up and rebuilds from durable events",async t=>{
  const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),ops=new OperationalStore(state.db),controller=new RunController(state,new Queue()),intake=new RunIntakeService(state,controller);
  companies.bootstrapDemo("owner");
  projects.transitionTask("demo-first-delivery-task","in-progress",{id:"demo-owner"});
  const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies,undefined,undefined,ops).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}/api/companies/demo-company`,url=`${base}/office-projection?actor=owner`,first=await(await fetch(url)).json() as {phase:string;stateHash:string},rebuilt=await(await fetch(url,{method:"POST"})).json() as {phase:string;stateHash:string},consistency=await(await fetch(`${base}/office-consistency?actor=owner`)).json() as {checked:number;ok:boolean;mismatches:unknown[]};assert.equal(first.phase,"working");assert.equal(rebuilt.stateHash,first.stateHash);assert.equal(consistency.checked,1);assert.equal(consistency.ok,true);assert.deepEqual(consistency.mismatches,[]);
});
