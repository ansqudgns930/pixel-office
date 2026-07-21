import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";
import { DemoScenarioService } from "../packages/demo-scenario/src/index.js";
import { OfficeProjectionStore } from "../packages/office-projection/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";
import { once } from "node:events";

class Queue { async enqueue() {} async remove() { return false; } }

test("first delivery demo runs through failure, revision, approvals and completion exactly once",()=>{
  const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db),service=new DemoScenarioService(state.db,operations);companies.bootstrapDemo("owner");
  const first=service.start({requestId:"demo-request",goal:"Add connection status",requestedBy:"owner"}),again=service.start({requestId:"demo-request",goal:"Ignored duplicate",requestedBy:"owner"});
  assert.equal(first.status,"completed");assert.equal(first.step,12);assert.equal(again.id,first.id);assert.equal(service.events(first.id).length,12);
  const mapped=operations.events("demo-company").map(x=>x.type);assert.ok(mapped.includes("VALIDATION_FAILED"));assert.ok(mapped.includes("REVISION_CREATED"));assert.ok(mapped.includes("RESULT_APPROVED"));assert.ok(mapped.includes("WORKFLOW_COMPLETED"));
  const projection=new OfficeProjectionStore(state.db,operations).catchUp("demo-company");assert.equal(projection.phase,"completed");assert.equal(projection.activeAgentId,"demo-ceo");
  const rebuilt=new OfficeProjectionStore(state.db,operations).rebuild("demo-company");assert.equal(rebuilt.stateHash,projection.stateHash);state.close();
});

test("demo scenario API accepts a goal and returns the complete event sequence",async t=>{
  const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db),controller=new RunController(state,new Queue()),intake=new RunIntakeService(state,controller),server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies,undefined,undefined,operations).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const response=await fetch(`http://127.0.0.1:${address.port}/api/demo/scenarios`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:"api-demo",goal:"Show connection status",auto:true})}),body=await response.json() as {scenario:{status:string;step:number};events:unknown[]};assert.equal(response.status,201);assert.equal(body.scenario.status,"completed");assert.equal(body.scenario.step,12);assert.equal(body.events.length,12);
});
