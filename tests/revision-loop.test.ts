import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import type {ModelRequest,ModelResult} from "../packages/contracts/src/index.js";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {RunController} from "../packages/runtime/src/index.js";
import {RolePipeline} from "../packages/role-pipeline/src/index.js";
import {StandaloneHostAdapter} from "../apps/standalone-host/src/index.js";
import {WorktreeManager} from "../packages/worktree/src/index.js";
import {ApprovalIntegrity} from "../packages/approval/src/index.js";
import {Phase1Execution} from "../packages/phase1-execution/src/index.js";

class Queue{async enqueue(){}async remove(){return false;}}
class RevisionHost extends StandaloneHostAdapter{private workers=0;async invokeModel(request:ModelRequest):Promise<ModelResult>{const result=await super.invokeModel(request);if(request.requestId.includes(":worker")&&++this.workers===1)return{...result,text:JSON.stringify({changes:[{path:"src/generated.js",content:"const = ???\n"}]})};return result;}}
const git=join(process.cwd(),".tools","mingit","cmd","git.exe");

test("failed validation creates a revision, regenerates worker output and revalidates",async t=>{const root=mkdtempSync(join(tmpdir(),"revision-loop-"));t.after(()=>rmSync(root,{recursive:true,force:true}));const repo=join(root,"repo"),worktrees=join(root,"worktrees");execFileSync(git,["init",repo]);execFileSync(git,["-C",repo,"config","user.email","test@example.com"]);execFileSync(git,["-C",repo,"config","user.name","Test"]);writeFileSync(join(repo,"README.md"),"base\n");execFileSync(git,["-C",repo,"add","."]);execFileSync(git,["-C",repo,"commit","-m","base"]);const store=new SQLiteStateStore(":memory:"),controller=new RunController(store,new Queue()),host=new RevisionHost(),pipeline=new RolePipeline(store,controller,host),manager=new WorktreeManager(git,repo,worktrees,store),execution=new Phase1Execution(store,controller,pipeline,manager,new ApprovalIntegrity(store,controller));await controller.create({id:"r",requestId:"q",goal:"generate",risk:"low",status:"CREATED",budgetLimit:20,spent:0,checkpoint:{requestedPaths:["src/generated.js"]}});await pipeline.process("r");pipeline.approvePlan("r","owner");const command={file:process.execPath,args:["--check","src/generated.js"]},result=await execution.execute("r",{allowedPaths:["src"],commands:{build:command,typecheck:command,test:command,lint:command,security:command},validatorChecks:["typecheck","test"]});assert.equal(store.getRun("r")?.status,"RESULT_APPROVAL_WAITING");assert.ok(result.validation.every(x=>x.passed));assert.deepEqual((store.db.prepare("SELECT request_id requestId FROM model_calls WHERE role='worker' ORDER BY created_at").all() as Array<{requestId:string}>).map(x=>x.requestId),["q:worker","q:worker:revision-1"]);assert.equal(store.db.prepare("SELECT COUNT(*) n FROM audit_events WHERE type='REVISION_CREATED'").get()?.n,1);assert.equal(store.db.prepare("SELECT COUNT(*) n FROM validation_results WHERE passed=0").get()?.n,2);const contexts=store.contextBuilds("r");assert.equal(contexts.length,2);const revision=contexts.at(-1)?.bundle as {untrustedEvidence:Array<{kind:string;source:string}>};assert.ok(revision.untrustedEvidence.some(item=>item.kind==="prior-failure"&&item.source==="validator"));await manager.remove("r",result.worktree);store.close();});
