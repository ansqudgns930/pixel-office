import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class Queue {async enqueue(){} async remove(){return false;}}
const post=(base:string,path:string,body:unknown)=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
test("War Room API creates project, milestone, board task, assignment and linked run with RBAC",async t=>{
  const store=new SQLiteStateStore(":memory:"),controller=new RunController(store,new Queue()),intake=new RunIntakeService(store,controller),projects=new ProjectOperations(store.db,store);
  const server=new ControlPlaneApi(store,intake,controller,{approvePlan(){},approveResult(){}},projects).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();store.close();});const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}`;
  const html=await (await fetch(base)).text();assert.match(html,/Project War Room/);assert.match(html,/실행 담당 배정/);assert.match(html,/만료 작업 복구/);assert.match(html,/알림 읽음/);
  assert.equal((await post(base,"/api/workspaces",{id:"ws",name:"Workspace"})).status,201);assert.equal((await post(base,"/api/projects",{id:"p",workspaceId:"ws",name:"Project",repoPath:process.cwd(),defaultBranch:"main",runtimePath:"D:/runtime",organizationProfile:{management_depth:1},budgetLimit:10,ownerId:"owner"})).status,201);
  assert.equal((await post(base,"/api/projects/p/milestones",{actorId:"owner",id:"m",title:"M1",status:"active",completionCriteria:["done"],budgetLimit:8,dueAt:null})).status,201);
  assert.equal((await post(base,"/api/projects/p/tasks",{actorId:"owner",id:"t",milestoneId:"m",title:"Task",status:"ready",priority:1,completionCriteria:["reviewed"],budgetLimit:5})).status,201);
  assert.equal((await post(base,"/api/projects/p/tasks/t/actions/assign",{actorId:"owner",principalId:"agent",kind:"agent",responsibility:"executor"})).status,200);
  assert.equal((await post(base,"/api/projects/p/tasks/t/actions/transition",{actorId:"owner",status:"in-progress"})).status,200);assert.equal((await post(base,"/api/projects/p/tasks/t/actions/transition",{actorId:"owner",status:"review"})).status,200);assert.equal((await post(base,"/api/projects/p/tasks/t/actions/transition",{actorId:"owner",status:"done"})).status,200);assert.equal((await post(base,"/api/projects/p/milestones/m/transition",{actorId:"owner",status:"completed"})).status,200);assert.equal((await post(base,"/api/projects/p/budget",{actorId:"owner",limit:12})).status,200);assert.equal((await post(base,"/api/projects/p/validator-profile",{actorId:"owner",checks:["build","typecheck","test"]})).status,200);assert.deepEqual(projects.validatorProfile("p").checks,["build","typecheck","test"]);
  const repositoryRead=await post(base,"/api/projects/p/repository/read",{actorId:"owner",path:"package.json"});assert.equal(repositoryRead.status,200);assert.match(JSON.stringify(await repositoryRead.json()),/agent-company-os/);assert.equal((await post(base,"/api/projects/p/repository/read",{actorId:"owner",path:"../secret"})).status,400);
  assert.equal((await post(base,"/api/runs",{id:"run",requestId:"req",goal:"change",requestedPaths:["src/a.ts"],requestedRisk:"low",budgetLimit:3})).status,201);
  assert.equal((await post(base,"/api/projects/p/tasks/t/actions/link-run",{actorId:"owner",runId:"run"})).status,200);
  const denied=await post(base,"/api/runs/run/actions/cancel",{userId:"stranger"});assert.equal(denied.status,400);assert.match(JSON.stringify(await denied.json()),/Permission denied/);
  const room=await (await fetch(base+"/api/projects/p?actor=owner")).json() as {project:{id:string};tasks:Array<{run:{id:string};assignments:unknown[]}>;progress:{total:number}};assert.equal(room.project.id,"p");assert.equal(room.progress.total,1);assert.equal(room.tasks[0]?.run.id,"run");assert.equal(room.tasks[0]?.assignments.length,1);
});
