import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { ProjectRunBudgetGuard } from "../packages/project-ops/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RolePipeline } from "../packages/role-pipeline/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";

test("Phase 3 project operations persist lineage and enforce dependencies, RBAC, budget, lease and notifications", async () => {
  const root=mkdtempSync(join(tmpdir(),"agent-company-project-")),db=join(root,"state.sqlite");
  try {
    let store=new SQLiteStateStore(db), ops=new ProjectOperations(store.db,store); const owner={id:"owner"}, reviewer={id:"reviewer"}, viewer={id:"viewer"};
    ops.createWorkspace("ws","Workspace"); ops.createProject({id:"p",workspaceId:"ws",name:"Project",repoPath:"D:/repo",defaultBranch:"main",runtimePath:"D:/runtime",organizationProfile:{management_depth:2},budgetLimit:10},owner.id);
    ops.addMember("p",owner,reviewer.id,"reviewer"); ops.addMember("p",owner,viewer.id,"viewer");
    assert.throws(()=>ops.addMember("p",viewer,"intruder","owner"),/Permission denied/);
    const milestone=ops.createMilestone({id:"m",projectId:"p",title:"M1",status:"active",completionCriteria:["all done"],budgetLimit:8,dueAt:null},owner);
    const first=ops.createTask({id:"t1",projectId:"p",milestoneId:milestone.id,title:"base",status:"backlog",priority:2,completionCriteria:["tested"],budgetLimit:5,dependsOn:[]},owner);
    const second=ops.createTask({id:"t2",projectId:"p",milestoneId:milestone.id,title:"dependent",status:"ready",priority:1,completionCriteria:["reviewed"],budgetLimit:5,dependsOn:[first.id]},owner);
    ops.assign(first.id,owner,"human-owner","human","owner"); ops.assign(first.id,owner,"worker-agent","agent","executor");
    assert.throws(()=>ops.transitionTask(second.id,"in-progress",owner),/dependency incomplete/);
    ops.transitionTask(first.id,"ready",owner); ops.transitionTask(first.id,"in-progress",owner); ops.transitionTask(first.id,"review",owner); ops.transitionTask(first.id,"done",reviewer);
    assert.equal(ops.transitionTask(second.id,"in-progress",owner).status,"in-progress"); ops.transitionTask(second.id,"blocked",owner);
    assert.equal(ops.spend(first.id,4),true); assert.equal(ops.spend(second.id,5),false); assert.equal(ops.project("p")?.spent,4); assert.equal(ops.milestone("m")?.spent,4); assert.equal(ops.task(second.id)?.spent,0);
    ops.transitionTask(second.id,"ready",owner); assert.equal(ops.claim(second.id,"agent-a",60_000,owner),true); assert.equal(ops.claim(second.id,"agent-b",60_000,owner),false); store.db.prepare("UPDATE board_tasks_v3 SET status='in-progress',lease_expires_at=? WHERE id='t2'").run("2000-01-01T00:00:00.000Z"); assert.deepEqual(ops.recoverExpired("p"),["t2"]); assert.equal(ops.task("t2")?.status,"ready");
    const notification=ops.notify("p","merge:t2","merge-conflict",{taskId:"t2"}); ops.notify("p","merge:t2","merge-conflict",{taskId:"t2"}); assert.equal(ops.notifications("p").filter(x=>x.dedupeKey==="merge:t2").length,1); ops.readNotification(notification.id,viewer); assert.ok(ops.notifications("p").find(x=>x.id===notification.id)?.readAt);
    store.createRun({id:"run",requestId:"req",goal:"work",risk:"medium",status:"READY",budgetLimit:5,spent:0,checkpoint:null}); ops.linkRun("t2","run",owner); store.createArtifactVersion({logicalId:"code:src/a.ts",parentVersionId:null,runId:"run",kind:"code",path:"src/a.ts",baseCommit:"base",contentHash:"a".repeat(64)});
    const before=ops.snapshot("p",viewer) as {tasks:Array<{id:string;run:unknown;artifacts:unknown[]}>;audit:unknown[]}; assert.equal(before.tasks.find(x=>x.id==="t2")?.artifacts.length,1); assert.ok(before.audit.length>=8);
    store.close(); store=new SQLiteStateStore(db); ops=new ProjectOperations(store.db,store); assert.equal(ops.claim("t2","agent-c",60_000,owner),true);store.db.prepare("UPDATE board_tasks_v3 SET status='in-progress',lease_expires_at=? WHERE id='t2'").run("2000-01-01T00:00:00.000Z");const queued:string[]=[];assert.deepEqual(await ops.recover("p",owner,async id=>void queued.push(id)),["run"]);assert.deepEqual(queued,["run"]);store.transition("run",["READY"],"BLOCKED",{reason:"test"});const after=ops.snapshot("p",viewer) as {project:{spent:number};milestones:unknown[];tasks:Array<{id:string;run:{id:string}|null;assignments:unknown[];artifacts:unknown[]}>;notifications:Array<{type:string}>}; assert.equal(after.project.spent,4); assert.equal(after.milestones.length,1); assert.equal(after.tasks.length,2); assert.equal(after.tasks.find(x=>x.id==="t2")?.run?.id,"run"); assert.equal(after.tasks.find(x=>x.id==="t2")?.artifacts.length,1); assert.equal(after.tasks.find(x=>x.id==="t1")?.assignments.length,2); assert.ok(after.notifications.length>=3);assert.ok(after.notifications.some(x=>x.type==="run-problem")); store.close();
  } finally {rmSync(root,{recursive:true,force:true});}
});

test("project budget reservation blocks before model invocation",async()=>{
  const store=new SQLiteStateStore(":memory:"),ops=new ProjectOperations(store.db,store),owner={id:"owner"};ops.createWorkspace("w","W");ops.createProject({id:"p",workspaceId:"w",name:"P",repoPath:"r",defaultBranch:"main",runtimePath:"x",organizationProfile:{},budgetLimit:.5},owner.id);ops.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:.5},owner);
  class Queue{async enqueue(){}async remove(){return false;}} const controller=new RunController(store,new Queue());await controller.create({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});ops.linkRun("t","r",owner);let calls=0;class Host extends StandaloneHostAdapter{override async invokeModel(input:Parameters<StandaloneHostAdapter["invokeModel"]>[0]){calls++;return super.invokeModel(input);}}
  const pipeline=new RolePipeline(store,controller,new Host(),new ProjectRunBudgetGuard(ops,1));await pipeline.process("r");pipeline.approvePlan("r","owner");await assert.rejects(pipeline.process("r"),/Project budget exceeded/);assert.equal(calls,0);assert.equal(store.getRun("r")?.status,"BLOCKED");assert.equal(ops.project("p")?.spent,0);store.close();
});

test("all project roles and concurrent hierarchical reservations are enforced",()=>{
  const store=new SQLiteStateStore(":memory:"),ops=new ProjectOperations(store.db,store),owner={id:"owner"};ops.createWorkspace("w","W");ops.createProject({id:"p",workspaceId:"w",name:"P",repoPath:"r",defaultBranch:"main",runtimePath:"x",organizationProfile:{},budgetLimit:2},owner.id);for(const [id,role] of [["manager","manager"],["reviewer","reviewer"],["worker","worker"],["viewer","viewer"]] as const)ops.addMember("p",owner,id,role);
  ops.require("p",{id:"manager"},"approval:plan");assert.throws(()=>ops.require("p",{id:"manager"},"approval:result"),/Permission denied/);ops.require("p",{id:"reviewer"},"approval:result");assert.throws(()=>ops.require("p",{id:"reviewer"},"task:execute"),/Permission denied/);ops.require("p",{id:"worker"},"task:execute");assert.throws(()=>ops.require("p",{id:"worker"},"approval:plan"),/Permission denied/);ops.require("p",{id:"viewer"},"view");assert.throws(()=>ops.require("p",{id:"viewer"},"run:control"),/Permission denied/);
  for(const n of [1,2]){ops.createTask({id:`t${n}`,projectId:"p",milestoneId:null,title:`T${n}`,status:"ready",priority:n,completionCriteria:["done"],budgetLimit:2},owner);store.createRun({id:`r${n}`,requestId:`q${n}`,goal:"g",risk:"low",status:"READY",budgetLimit:2,spent:0,checkpoint:null});ops.linkRun(`t${n}`,`r${n}`,owner);}const first=ops.reserveRunBudget("r1",1.5);assert.ok(first);assert.equal(ops.reserveRunBudget("r2",1.5),"");assert.equal(store.getRun("r2")?.status,"BLOCKED");assert.equal(ops.settleRunBudget(first!,1),true);assert.equal(ops.project("p")?.spent,1);assert.equal(ops.task("t1")?.spent,1);store.close();
});

test("approval and merge conflict notifications are durable and deduplicated",()=>{const store=new SQLiteStateStore(":memory:"),ops=new ProjectOperations(store.db,store),owner={id:"owner"};ops.createWorkspace("w","W");ops.createProject({id:"p",workspaceId:"w",name:"P",repoPath:"r",defaultBranch:"main",runtimePath:"x",organizationProfile:{},budgetLimit:2},owner.id);ops.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:2},owner);store.createRun({id:"r",requestId:"q",goal:"g",risk:"high",status:"PLAN_APPROVAL_WAITING",budgetLimit:2,spent:0,checkpoint:null});ops.linkRun("t","r",owner);store.saveMergeAssessment({runId:"r",currentHead:"head",baseMoved:true,overlappingFiles:["src/a.ts"],conflictedFiles:["src/a.ts"],conflict:true,revalidationRequired:true});ops.syncRunNotifications("r");ops.syncRunNotifications("r");const notifications=ops.notifications("p");assert.equal(notifications.filter(x=>x.type==="approval-waiting").length,1);assert.equal(notifications.filter(x=>x.type==="merge-conflict").length,1);store.close();});
