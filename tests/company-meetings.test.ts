import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";

function fixture(){
  const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects);
  projects.createWorkspace("w","Workspace");projects.createProject({id:"p",workspaceId:"w",name:"Project",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:20},"owner");
  companies.createCompany({id:"c",name:"Company",workspaceId:"w",budgetLimit:30,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");companies.createDepartment({id:"d",companyId:"c",parentId:null,name:"Product",budgetLimit:20},"owner");companies.addMember("c","owner","manager","department-manager","d","human");companies.addMember("c","owner","member","member","d","human");companies.linkProject("c","d","p",1,"owner");
  companies.createGoal({id:"g",companyId:"c",title:"Goal",description:"",ownerId:"owner",completionCriteria:["done"],budgetLimit:20,dueAt:null,status:"active"},"owner");companies.linkGoalProject("c","g","p","owner");
  const operations=new OperationalStore(state.db);
  return{state,projects,companies,operations};
}

test("meeting lifecycle stores audited interventions, drafts a summary and confirms follow-up tasks",()=>{
  const {state,projects,companies,operations}=fixture();
  const meeting=companies.createMeeting({id:"meeting",companyId:"c",goalId:"g",projectId:"p",runId:null,title:"Launch review",purpose:"Decide readiness",hostId:"manager",participantIds:["member"],agenda:["release"],scheduledAt:null},"manager");
  assert.equal(meeting.status,"scheduled");assert.equal(companies.transitionMeeting("c","meeting","live","manager").status,"live");
  companies.addMeetingMessage("c","meeting",{id:"q",kind:"question",targetType:"all",targetId:null,content:"검증은 통과했나요?",evidence:["project:p"]},"member");
  assert.throws(()=>companies.addMeetingMessage("c","meeting",{id:"denied",kind:"decision",targetType:"agenda",targetId:"release",content:"출시 승인",evidence:[]},"member"),/permission denied/);
  companies.addMeetingMessage("c","meeting",{id:"decision",kind:"decision",targetType:"agenda",targetId:"release",content:"검증 후 출시 승인",evidence:["goal:g"],followUp:{title:"출시 체크리스트 완료",assigneeId:"member",dueAt:null,completionCriteria:["체크리스트 승인"],budgetLimit:2}},"manager");
  assert.equal(companies.setMeetingPaused("c","meeting",true,"manager").paused,true);assert.throws(()=>companies.addMeetingMessage("c","meeting",{id:"paused",kind:"opinion",targetType:"all",targetId:null,content:"대기",evidence:[]},"member"),/not accepting/);companies.setMeetingPaused("c","meeting",false,"manager");
  companies.transitionMeeting("c","meeting","ended","manager");const draft=companies.meetingSummary("meeting") as any;assert.equal(draft.status,"draft");assert.deepEqual(draft.decisions,["검증 후 출시 승인"]);assert.equal(draft.followUps.length,1);
  const confirmed=companies.confirmMeetingSummary("c","meeting","owner") as any;assert.equal(confirmed.status,"confirmed");assert.equal(confirmed.createdTaskIds.length,1);assert.equal(projects.task(confirmed.createdTaskIds[0])?.title,"출시 체크리스트 완료");
  assert.ok(operations.events("c").some(x=>x.type==="MEETING_MESSAGE_ADDED"));state.close();
});

test("meeting tenant, participant and linked resource boundaries are enforced",()=>{
  const {state,projects,companies}=fixture();projects.createWorkspace("other-w","Other");projects.createProject({id:"outside",workspaceId:"other-w",name:"Outside",repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:1},"owner");
  assert.throws(()=>companies.createMeeting({id:"bad",companyId:"c",goalId:"g",projectId:"outside",runId:null,title:"Bad",purpose:"Bad",hostId:"manager",participantIds:[],agenda:["x"],scheduledAt:null},"manager"),/belong to company/);
  assert.throws(()=>companies.createMeeting({id:"bad2",companyId:"c",goalId:"g",projectId:"p",runId:null,title:"Bad",purpose:"Bad",hostId:"manager",participantIds:["outsider"],agenda:["x"],scheduledAt:null},"manager"),/participant must belong/);state.close();
});
