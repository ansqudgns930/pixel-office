import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";
class Queue { async enqueue() {} async remove() { return false; } }
test("P4 API exposes state-aware intervention UI and returns 409 for stale commands", async t => {
  const state=new SQLiteStateStore(":memory:"),controller=new RunController(state,new Queue()),intake=new RunIntakeService(state,controller),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db);
  projects.createWorkspace("w","W"); projects.createProject({id:"p",workspaceId:"w",name:"P",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:10},"owner");
  await controller.create({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:5,spent:0,checkpoint:{seed:true}}); projects.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:5},{id:"owner"}); projects.linkRun("t","r",{id:"owner"}); state.transition("r",["CREATED"],"RUNNING",{seed:true});
  const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies,undefined,undefined,operations).server(); server.listen(0,"127.0.0.1"); await once(server,"listening"); t.after(()=>{server.close();state.close()}); const address=server.address(); assert.ok(address&&typeof address==="object"); const base=`http://127.0.0.1:${address.port}`;
  const html=await(await fetch(base)).text(); assert.match(html,/캐릭터 상세 · 운영 개입/); assert.match(html,/allowedInterventions/);
  const call=(requestId:string,expectedStatus:string)=>fetch(`${base}/api/runs/r/interventions/pause`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestId,actorId:"owner",reason:"operator",expectedStatus})});
  const stale=await call("stale","READY"),staleText=await stale.text(); assert.equal(stale.status,409,staleText);
  const ok=await call("ok","RUNNING"); assert.equal(ok.status,200,await ok.text());
  const detail=await(await fetch(`${base}/api/runs/r`)).json() as {run:{status:string};interventions:unknown[]}; assert.equal(detail.run.status,"PAUSED"); assert.equal(detail.interventions.length,1);
});
