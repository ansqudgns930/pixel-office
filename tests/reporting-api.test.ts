import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {RunController} from "../packages/runtime/src/index.js";
import {RunIntakeService} from "../packages/policy/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations} from "../packages/company-ops/src/index.js";
import {OperationalStore} from "../packages/operations/src/index.js";
import {ControlPlaneApi} from "../apps/control-plane/src/index.js";

test("report API lists, updates, authorizes, and rebuilds deterministic reports",async t=>{
 const state=new SQLiteStateStore(":memory:"),controller=new RunController(state,{async enqueue(){},async remove(){return false;}}),intake=new RunIntakeService(state,controller),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db);
 projects.createWorkspace("w","W");projects.createProject({id:"p",workspaceId:"w",name:"P",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:10},"owner");projects.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:5},{id:"owner"});companies.createCompany({id:"c",name:"C",workspaceId:"w",budgetLimit:20,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");companies.createDepartment({id:"d",companyId:"c",parentId:null,name:"D",budgetLimit:20},"owner");companies.addMember("c","owner","worker","member","d");companies.addMember("c","owner","manager","department-manager","d");companies.linkProject("c","d","p",1,"owner");projects.assign("t",{id:"owner"},"worker","agent","executor");state.createRun({id:"r",requestId:"q",goal:"g",risk:"high",status:"RUNNING",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});operations.emit({tenantId:"c",aggregateType:"run",aggregateId:"r",type:"PATCH_HASH_BLOCKED",eventId:"decision",payload:{runId:"r",taskId:"t",agentId:"worker"}});
 const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies,undefined,undefined,operations).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}`;
 const listed=await (await fetch(`${base}/api/companies/c/reports?actor=manager`)).json() as Array<{id:string;status:string;decisionRequired:boolean}>;assert.equal(listed.length,1);assert.equal(listed[0]?.decisionRequired,true);
 const read=await fetch(`${base}/api/companies/c/reports/${listed[0]!.id}/read`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actorId:"manager"})});assert.equal(read.status,200);assert.equal((await read.json() as {status:string}).status,"read");
 const denied=await fetch(`${base}/api/companies/c/reports/${listed[0]!.id}/acknowledge`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actorId:"worker"})});assert.equal(denied.status,400);
 const rebuilt=await fetch(`${base}/api/companies/c/reports/rebuild`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actorId:"owner"})});assert.equal(rebuilt.status,200);assert.equal((await rebuilt.json() as {created:number}).created,1);
});
