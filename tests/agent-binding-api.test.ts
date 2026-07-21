import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { PlatformOperations } from "../packages/platform-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";
import { AgentBindingStore } from "../packages/agent-bindings/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

test("Agent binding API probes changes, persists a company default, and exposes Run snapshots",async t=>{
  const state=new SQLiteStateStore(":memory:"),controller=new RunController(state,{async enqueue(){},async remove(){return false;}}),intake=new RunIntakeService(state,controller),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),platform=new PlatformOperations(state.db,state,projects,companies),operations=new OperationalStore(state.db),bindings=new AgentBindingStore(state.db,companies,{host:"standalone",model:"default",baseUrl:null});
  projects.createWorkspace("w","W");projects.createProject({id:"p",workspaceId:"w",name:"P",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:5},"owner");projects.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:3},{id:"owner"});companies.createCompany({id:"c",name:"C",workspaceId:"w",budgetLimit:10,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");companies.createDepartment({id:"d",companyId:"c",parentId:null,name:"D",budgetLimit:10},"owner");companies.linkProject("c","d","p",1,"owner");state.createRun({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:3,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});
  assert.equal(bindings.resolveRun("r","worker").resolution,"company");
  let probes=0;const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){},async probeAgentBinding(){probes++;}},projects,companies,platform,undefined,operations,bindings).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}`;
  const post=await fetch(`${base}/api/companies/c/agent-bindings`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actorId:"owner",targetKind:"role",targetId:"worker",backend:"codex-cli",modelId:"gpt-5"})});assert.equal(post.status,200);assert.equal(probes,1);
  const list=await (await fetch(`${base}/api/companies/c/agent-bindings?actor=owner`)).json() as unknown[];assert.equal(list.length,2);
  const detail=await (await fetch(`${base}/api/runs/r`)).json() as {agentBindings:unknown[]};assert.equal(detail.agentBindings.length,3);
  const snapshots=await (await fetch(`${base}/api/runs/r/agent-bindings?actor=owner`)).json() as unknown[];assert.equal(snapshots.length,3);assert.equal((await fetch(`${base}/api/runs/r/agent-bindings?actor=outsider`)).status,400);
  const profiles=await (await fetch(`${base}/api/runs/r/role-profiles?actor=owner`)).json() as Array<{executionSnapshotId:string;pipelineRole:string}>;assert.deepEqual(profiles.map(x=>x.pipelineRole),["planner","worker","reviewer"]);assert.ok(profiles.every(x=>x.executionSnapshotId===profiles[0]?.executionSnapshotId));assert.equal((await fetch(`${base}/api/runs/r/role-profiles?actor=outsider`)).status,400);
});

test("Agent binding API rejects a backend before persistence when its health probe fails",async t=>{
  const state=new SQLiteStateStore(":memory:"),controller=new RunController(state,{async enqueue(){},async remove(){return false;}}),intake=new RunIntakeService(state,controller),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),bindings=new AgentBindingStore(state.db,companies,{host:"standalone",model:"default",baseUrl:null});projects.createWorkspace("w","W");companies.createCompany({id:"c",name:"C",workspaceId:"w",budgetLimit:1,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){},async probeAgentBinding(){throw new Error("backend unavailable");}},projects,companies,undefined,undefined,undefined,bindings).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const response=await fetch(`http://127.0.0.1:${address.port}/api/companies/c/agent-bindings`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actorId:"owner",targetKind:"company",backend:"codex-cli",modelId:"gpt-5"})});assert.equal(response.status,400);assert.equal(bindings.list("c","owner").length,0);
});
