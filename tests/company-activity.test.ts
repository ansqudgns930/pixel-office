import test from "node:test";
import assert from "node:assert/strict";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations} from "../packages/company-ops/src/index.js";

function fixture(id="c"){
 const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),workspace=`w-${id}`,project=`p-${id}`;
 projects.createWorkspace(workspace,"Workspace");projects.createProject({id:project,workspaceId:workspace,name:`Searchable ${id}`,repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:10},"owner");
 companies.createCompany({id,name:`Company ${id}`,workspaceId:workspace,budgetLimit:10,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");companies.createDepartment({id:`d-${id}`,companyId:id,parentId:null,name:"Product",budgetLimit:10},"owner");companies.addMember(id,"owner",`member-${id}`,"member",`d-${id}`,"human");companies.linkProject(id,`d-${id}`,project,1,"owner");
 return{state,projects,companies,project};
}

test("company search spans business entities while preserving tenant boundaries",()=>{
 const a=fixture("a"),b=fixture("b");
 a.companies.createGoal({id:"goal-a",companyId:"a",title:"Launch Searchable",description:"customer release",ownerId:"owner",completionCriteria:["done"],budgetLimit:5,dueAt:null},"owner");a.projects.createTask({id:"task-a",projectId:a.project,milestoneId:null,title:"Searchable checklist",status:"ready",priority:1,completionCriteria:["done"],budgetLimit:1},{id:"owner"});
 const results=a.companies.searchCompany("a","owner","Searchable");assert.ok(results.some(x=>x.kind==="goal"&&x.id==="goal-a"));assert.ok(results.some(x=>x.kind==="project"&&x.id===a.project));assert.ok(results.some(x=>x.kind==="task"&&x.id==="task-a"));assert.ok(!results.some(x=>x.id===b.project));assert.throws(()=>a.companies.searchCompany("a","outsider","Searchable"),/permission denied/i);a.state.close();b.state.close();
});

test("company alerts aggregate risks, persist per-user reads and link to evidence",()=>{
 const {state,projects,companies,project}=fixture();projects.createTask({id:"blocked",projectId:project,milestoneId:null,title:"Blocked delivery",status:"blocked",priority:1,completionCriteria:["done"],budgetLimit:1},{id:"owner"});companies.createMeeting({id:"live",companyId:"c",goalId:null,projectId:project,runId:null,title:"Incident meeting",purpose:"Resolve",hostId:"owner",participantIds:["member-c"],agenda:["risk"],scheduledAt:null},"owner");companies.transitionMeeting("c","live","live","owner");
 const alerts=companies.companyAlerts("c","owner");assert.ok(alerts.some(x=>x.kind==="blocked"&&x.severity==="critical"));assert.ok(alerts.some(x=>x.kind==="meeting"&&x.url.includes("meetingId=live")));const key=alerts[0]!.key;companies.readCompanyAlert("c",key,"owner");assert.ok(companies.companyAlerts("c","owner").find(x=>x.key===key)?.readAt);assert.equal(companies.companyAlerts("c","member-c").find(x=>x.key===key)?.readAt,null);state.close();
});

test("archive and deletion request enforce operational blockers and typed confirmation",()=>{
 const {state,companies,project}=fixture();companies.createMeeting({id:"scheduled",companyId:"c",goalId:null,projectId:project,runId:null,title:"Pending",purpose:"Pending",hostId:"owner",participantIds:[],agenda:["x"],scheduledAt:null},"owner");assert.throws(()=>companies.setCompanyStatus("c","owner","archived"),/active meeting/);companies.transitionMeeting("c","scheduled","cancelled","owner");assert.equal(companies.setCompanyStatus("c","owner","archived").status,"archived");assert.throws(()=>companies.requestCompanyDeletion("c","owner","wrong"),/confirmation mismatch/);const request=companies.requestCompanyDeletion("c","owner","Company c") as any;assert.equal(request.status,"pending");assert.equal(request.impact.projects,1);assert.equal((companies.cancelCompanyDeletion("c","owner") as any).status,"cancelled");state.close();
});
