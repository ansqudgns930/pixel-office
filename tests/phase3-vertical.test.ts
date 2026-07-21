import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations, ProjectRunBudgetGuard } from "../packages/project-ops/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { RolePipeline } from "../packages/role-pipeline/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import { WorktreeManager } from "../packages/worktree/src/index.js";
import { ApprovalIntegrity } from "../packages/approval/src/index.js";
import { Phase1Execution } from "../packages/phase1-execution/src/index.js";
import { MergeCandidateService } from "../packages/merge-candidate/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class Queue{async enqueue(){}async remove(){return false;}}
const git=join(process.cwd(),".tools","mingit","cmd","git.exe");
test("Phase 3 local API drives Project through real Run, Artifact, approval and completion",async t=>{
  const root=mkdtempSync(join(tmpdir(),"agent-company-phase3-"));t.after(()=>rmSync(root,{recursive:true,force:true}));const repo=join(root,"repo"),worktreesRoot=join(root,"worktrees");execFileSync(git,["init",repo]);execFileSync(git,["-C",repo,"config","user.email","test@example.com"]);execFileSync(git,["-C",repo,"config","user.name","Test"]);writeFileSync(join(repo,"README.md"),"base\n");execFileSync(git,["-C",repo,"add","."]);execFileSync(git,["-C",repo,"commit","-m","base"]);
  const store=new SQLiteStateStore(join(root,"state.sqlite")),queue=new Queue(),controller=new RunController(store,queue),intake=new RunIntakeService(store,controller),projects=new ProjectOperations(store.db,store),pipeline=new RolePipeline(store,controller,new StandaloneHostAdapter(),new ProjectRunBudgetGuard(projects)),worktrees=new WorktreeManager(git,repo,worktreesRoot,store),approvals=new ApprovalIntegrity(store,controller),execution=new Phase1Execution(store,controller,pipeline,worktrees,approvals),candidates=new MergeCandidateService(store,approvals,worktrees);
  const api=new ControlPlaneApi(store,intake,controller,{approvePlan(runId,userId){pipeline.approvePlan(runId,userId);},async approveResult(runId,userId,hash){const result=store.runResult(runId);if(!result)throw new Error("result missing");await candidates.approveAndCreate(runId,hash,userId,result.worktree);}},projects),server=api.server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>server.close());const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}`,post=(path:string,body:unknown)=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  await post("/api/workspaces",{id:"ws",name:"Workspace"});await post("/api/projects",{id:"p",workspaceId:"ws",name:"Project",repoPath:repo,defaultBranch:"master",runtimePath:root,organizationProfile:{management_depth:1},budgetLimit:10,ownerId:"owner"});await post("/api/projects/p/milestones",{actorId:"owner",id:"m",title:"Release",status:"active",completionCriteria:["candidate ready"],budgetLimit:8,dueAt:null});await post("/api/projects/p/tasks",{actorId:"owner",id:"task",milestoneId:"m",title:"Generate module",status:"ready",priority:1,completionCriteria:["validated"],budgetLimit:5});await post("/api/projects/p/tasks/task/actions/assign",{actorId:"owner",principalId:"worker-agent",kind:"agent",responsibility:"executor"});
  await post("/api/runs",{id:"run",requestId:"req",goal:"create generated module",requestedPaths:["src/generated.js"],requestedRisk:"low",budgetLimit:5});await post("/api/projects/p/tasks/task/actions/link-run",{actorId:"owner",runId:"run"});await post("/api/projects/p/tasks/task/actions/transition",{actorId:"owner",status:"in-progress"});await pipeline.process("run");assert.equal(store.getRun("run")?.status,"PLAN_APPROVAL_WAITING");assert.equal((await post("/api/runs/run/actions/approve-plan",{userId:"owner"})).status,200);
  const command={file:process.execPath,args:["--check","src/generated.js"]},result=await execution.execute("run",{allowedPaths:["src"],commands:{build:command,test:command,lint:command,security:command}});assert.equal((await post("/api/runs/run/actions/approve-result",{userId:"owner"})).status,200);assert.equal(store.getRun("run")?.status,"COMPLETED");assert.ok(store.mergeCandidate("run"));
  await post("/api/projects/p/tasks/task/actions/transition",{actorId:"owner",status:"review"});assert.equal((await post("/api/projects/p/milestones/m/transition",{actorId:"owner",status:"completed"})).status,400);await post("/api/projects/p/tasks/task/actions/transition",{actorId:"owner",status:"done"});await post("/api/projects/p/milestones/m/transition",{actorId:"owner",status:"completed"});const room=await (await fetch(base+"/api/projects/p?actor=owner")).json() as {progress:{done:number};milestones:Array<{status:string;spent:number}>;tasks:Array<{run:{status:string};artifacts:unknown[];spent:number}>;project:{spent:number}};assert.equal(room.progress.done,1);assert.equal(room.milestones[0]?.status,"completed");assert.equal(room.tasks[0]?.run.status,"COMPLETED");assert.ok(room.tasks[0]!.artifacts.length>=6);assert.ok(room.project.spent>0);assert.equal(room.project.spent,room.milestones[0]?.spent);assert.equal(room.project.spent,room.tasks[0]?.spent);await worktrees.remove("run",result.worktree);store.close();
});
