import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations,CompanyRunGovernance} from "../packages/company-ops/src/index.js";
import {AgentBindingStore} from "../packages/agent-bindings/src/index.js";
import {RunController} from "../packages/runtime/src/index.js";
import {RolePipeline} from "../packages/role-pipeline/src/index.js";
import {StandaloneHostAdapter} from "../apps/standalone-host/src/index.js";

class Queue{async enqueue(){}async remove(){return false;}}

function fixture(path=":memory:"){
 const state=new SQLiteStateStore(path),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects);
 projects.createWorkspace("w","W");
 projects.createProject({id:"p",workspaceId:"w",name:"P",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:20},"owner");
 projects.createTask({id:"t",projectId:"p",milestoneId:null,title:"T",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:10},{id:"owner"});
 companies.createCompany({id:"c",name:"C",workspaceId:"w",budgetLimit:30,mandatoryReviews:["security"],mandatoryApprovals:["result"],allowedTools:["build","test","security"]},"owner");
 companies.createDepartment({id:"engineering",companyId:"c",parentId:null,name:"Engineering",budgetLimit:20},"owner");
 companies.createDepartment({id:"qa",companyId:"c",parentId:null,name:"QA",budgetLimit:20},"owner");
 companies.addMember("c","owner","worker-a","member","engineering");
 companies.addMember("c","owner","worker-b","member","engineering");
 companies.addMember("c","owner","reviewer-a","member","qa");
 companies.linkProject("c","engineering","p",1,"owner");
 const template=(logicalId:string,departmentId:string,name:string,responsibility:string,tools:string[]=["build","test"])=>
  companies.createRoleTemplate({logicalId,companyId:"c",departmentId,name,responsibility,allowedTools:tools,requiredReviews:["security"],requiredApprovals:["result"],completionCriteria:[`${name} complete`]},"owner");
 return{state,projects,companies,template,bindings:new AgentBindingStore(state.db,companies,{host:"standalone",model:"runtime-model",baseUrl:null})};
}

test("role template versions are tenant-local and common binding uniqueness does not depend on NULL",()=>{
 const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects);projects.createWorkspace("w","W");
 for(const [companyId,owner] of [["a","a-owner"],["b","b-owner"]] as const)companies.createCompany({id:companyId,name:companyId,workspaceId:"w",budgetLimit:2,mandatoryReviews:["r"],mandatoryApprovals:["result"],allowedTools:["test"]},owner);
 const a=companies.createRoleTemplate({logicalId:"developer",companyId:"a",departmentId:null,name:"A Dev",responsibility:"build",allowedTools:["test"],requiredReviews:["r"],requiredApprovals:["result"],completionCriteria:["done"]},"a-owner"),b=companies.createRoleTemplate({logicalId:"developer",companyId:"b",departmentId:null,name:"B Dev",responsibility:"build",allowedTools:["test"],requiredReviews:["r"],requiredApprovals:["result"],completionCriteria:["done"]},"b-owner");
 assert.equal(a.version,1);assert.equal(b.version,1);assert.equal(a.parentVersionId,null);assert.equal(b.parentVersionId,null);
 companies.bindRoleTemplate("a",a.id,"company","a","a-owner");companies.bindRoleTemplate("a",a.id,"company","a","a-owner");
 assert.equal(state.db.prepare("SELECT COUNT(*) n FROM role_template_bindings_v15 WHERE company_id='a' AND target_type='company' AND target_id='a' AND pipeline_role=''").get()?.n,1);state.close();
});

test("legacy common binding is transactionally backfilled, compared, and retained for rollback",()=>{
 const{state,projects,companies}=fixture(),createdAt=new Date().toISOString();
 state.db.prepare("INSERT INTO role_templates_v4 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("legacy-template","legacy-worker",1,null,"c",null,"Legacy Worker","legacy responsibility",'["build","test"]','["security"]','["result"]','["legacy done"]',createdAt);
 state.db.prepare("INSERT INTO role_template_bindings_v4 VALUES(?,?,?,?,?)").run("legacy-template","project","p","c",createdAt);
 state.db.prepare("DELETE FROM role_binding_migration_checks_v15 WHERE company_id='c'").run();state.db.prepare("DELETE FROM role_template_bindings_v15 WHERE company_id='c'").run();state.db.prepare("DELETE FROM role_templates_v15 WHERE id='legacy-template'").run();
 const migrated=new CompanyOperations(state.db,state,projects),check=state.db.prepare("SELECT legacy_template_id,new_template_id,matched FROM role_binding_migration_checks_v15 WHERE company_id='c' AND target_type='project' AND target_id='p'").get() as {legacy_template_id:string;new_template_id:string;matched:number};
 assert.equal(check.legacy_template_id,"legacy-template");assert.equal(check.new_template_id,"legacy-template");assert.equal(check.matched,1);const bindings=migrated.roleBindings("c") as Array<{targetId:string;pipelineRole:string|null}>;assert.equal(bindings.find(x=>x.targetId==="p")?.pipelineRole,null);assert.equal(state.db.prepare("SELECT template_id FROM role_template_bindings_v4 WHERE target_type='project' AND target_id='p'").get()?.template_id,"legacy-template");state.close();
});

test("worker and reviewer freeze distinct department templates with one atomic execution snapshot",()=>{
 const{state,projects,companies,template,bindings}=fixture();projects.assign("t",{id:"owner"},"worker-a","agent","executor");projects.assign("t",{id:"owner"},"reviewer-a","agent","reviewer");const engineering=template("engineering","engineering","Engineer","implementation"),qa=template("quality","qa","QA","verification",["test"]);companies.bindRoleTemplate("c",engineering.id,"task","t","owner","worker");companies.bindRoleTemplate("c",qa.id,"task","t","owner","reviewer");state.createRun({id:"r",requestId:"q",goal:"g",risk:"high",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});
 const executionSnapshotId=bindings.freezeRun("r"),worker=companies.roleProfileForRun("r","worker")!,reviewer=companies.roleProfileForRun("r","reviewer")!;assert.ok(executionSnapshotId);assert.equal(state.getRun("r")?.status,"PLANNING");assert.equal(state.getRun("r")?.checkpoint?.executionSnapshotId,executionSnapshotId);assert.equal(worker.executionSnapshotId,executionSnapshotId);assert.equal(reviewer.executionSnapshotId,executionSnapshotId);assert.equal(worker.templateId,engineering.id);assert.equal(worker.memberId,"worker-a");assert.equal(reviewer.templateId,qa.id);assert.equal(reviewer.memberId,"reviewer-a");assert.notEqual(worker.profileHash,reviewer.profileHash);assert.ok(bindings.snapshots("r").every(x=>x.executionSnapshotId===executionSnapshotId));assert.equal(state.db.prepare("SELECT COUNT(*) n FROM run_role_profile_snapshots_v15 WHERE run_id='r'").get()?.n,3);assert.equal(state.db.prepare("SELECT COUNT(*) n FROM run_role_profile_snapshots_v15 WHERE run_id='r' AND template_id IS NOT NULL").get()?.n,2);
 const changed=template("engineering","engineering","Engineer v2","new implementation");companies.bindRoleTemplate("c",changed.id,"task","t","owner","worker");assert.equal(companies.roleProfileForRun("r","worker")?.templateId,engineering.id);state.close();
});

test("ambiguous assignments fail closed and rollback every partial snapshot until a primary is selected",()=>{
 const{state,projects,companies,template,bindings}=fixture();projects.assign("t",{id:"owner"},"worker-a","agent","executor");projects.assign("t",{id:"owner"},"worker-b","agent","executor");const engineering=template("engineering","engineering","Engineer","implementation");companies.bindRoleTemplate("c",engineering.id,"task","t","owner","worker");state.createRun({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});assert.throws(()=>bindings.freezeRun("r"),/Ambiguous worker assignment/);assert.equal(state.getRun("r")?.status,"CREATED");assert.equal(state.db.prepare("SELECT COUNT(*) n FROM run_execution_snapshots_v15 WHERE run_id='r'").get()?.n,0);assert.equal(state.db.prepare("SELECT COUNT(*) n FROM run_agent_binding_snapshots_v7 WHERE run_id='r'").get()?.n,0);
 companies.setPrimaryAssignment("c","t","executor","worker-b","owner");const id=bindings.freezeRun("r");assert.ok(id);assert.equal(companies.roleProfileForRun("r","worker")?.memberId,"worker-b");state.close();
});

test("department mismatch blocks the whole snapshot and current policy can only narrow frozen tools",()=>{
 const{state,projects,companies,template,bindings}=fixture();projects.assign("t",{id:"owner"},"worker-a","agent","executor");const wrong=template("qa-worker","qa","QA Worker","verification",["test"]);companies.bindRoleTemplate("c",wrong.id,"task","t","owner","worker");state.createRun({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});assert.throws(()=>bindings.freezeRun("r"),/department mismatch/);assert.equal(state.getRun("r")?.status,"CREATED");assert.equal(state.db.prepare("SELECT COUNT(*) n FROM run_execution_snapshots_v15 WHERE run_id='r'").get()?.n,0);
 const correct=template("engineering","engineering","Engineer","implementation",["build","test"]);companies.bindRoleTemplate("c",correct.id,"task","t","owner","worker");bindings.freezeRun("r");companies.updatePolicy("c","owner",{mandatoryReviews:["security"],mandatoryApprovals:["result"],allowedTools:["test","security"]});assert.deepEqual(companies.governanceForRun("r","worker")?.allowedTools,["test"]);companies.updatePolicy("c","owner",{mandatoryReviews:["security"],mandatoryApprovals:["result"],allowedTools:["build","test","security"]});assert.deepEqual(companies.governanceForRun("r","worker")?.allowedTools,["build","test"]);state.close();
});

test("complete role and backend snapshots are deterministic after process restart",()=>{
 const root=mkdtempSync(join(tmpdir(),"role-snapshot-restart-")),db=join(root,"state.sqlite");try{let{state,projects,companies,template,bindings}=fixture(db);projects.assign("t",{id:"owner"},"worker-a","agent","executor");projects.assign("t",{id:"owner"},"reviewer-a","agent","reviewer");const engineering=template("engineering","engineering","Engineer","implementation"),qa=template("quality","qa","QA","verification",["test"]);companies.bindRoleTemplate("c",engineering.id,"task","t","owner","worker");companies.bindRoleTemplate("c",qa.id,"task","t","owner","reviewer");state.createRun({id:"r",requestId:"q",goal:"g",risk:"high",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});bindings.freezeRun("r");const before=JSON.stringify({profiles:["planner","worker","reviewer"].map(role=>companies.roleProfileForRun("r",role as "planner"|"worker"|"reviewer")),bindings:bindings.snapshots("r")});state.close();state=new SQLiteStateStore(db);projects=new ProjectOperations(state.db,state);companies=new CompanyOperations(state.db,state,projects);bindings=new AgentBindingStore(state.db,companies,{host:"standalone",model:"runtime-model",baseUrl:null});const after=JSON.stringify({profiles:["planner","worker","reviewer"].map(role=>companies.roleProfileForRun("r",role as "planner"|"worker"|"reviewer")),bindings:bindings.snapshots("r")});assert.equal(after,before);state.close();}finally{rmSync(root,{recursive:true,force:true});}
});

test("RolePipeline freezes company role profiles before leaving CREATED and records profile provenance",async()=>{
 const{state,projects,companies,template}=fixture();projects.assign("t",{id:"owner"},"worker-a","agent","executor");const engineering=template("engineering","engineering","Engineer","implementation");companies.bindRoleTemplate("c",engineering.id,"task","t","owner","worker");state.createRun({id:"r",requestId:"q",goal:"g",risk:"low",status:"CREATED",budgetLimit:5,spent:0,checkpoint:null});projects.linkRun("t","r",{id:"owner"});const pipeline=new RolePipeline(state,new RunController(state,new Queue()),new StandaloneHostAdapter(),undefined,new CompanyRunGovernance(companies));await pipeline.process("r");assert.equal(state.getRun("r")?.status,"PLAN_APPROVAL_WAITING");assert.ok(companies.executionSnapshotId("r"));const profile=companies.roleProfileForRun("r","worker")!;assert.equal(profile.templateId,engineering.id);pipeline.approvePlan("r","owner");await pipeline.process("r");const call=state.lineage("r").modelCalls[0] as {output:string},output=JSON.parse(call.output) as {profileHash:string;profileVersion:number;promptVersion:string;promptHash:string};assert.equal(output.profileHash,profile.profileHash);assert.equal(output.profileVersion,profile.templateVersion);assert.match(output.promptVersion,/role-prompts-v3/);assert.match(output.promptHash,/^[a-f0-9]{64}$/);assert.match(JSON.stringify(state.auditEvents("r")),new RegExp(profile.profileHash));state.close();
});
