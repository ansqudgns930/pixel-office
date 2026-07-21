import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations} from "../packages/company-ops/src/index.js";
import {AgentBindingStore} from "../packages/agent-bindings/src/index.js";
import {MeetingAgentRunner,type MeetingRunnerLimits} from "../packages/meeting-runner/src/index.js";
import {OperationalStore} from "../packages/operations/src/index.js";
import type {HostAdapter} from "../packages/host-adapter-sdk/src/index.js";

const limits=():MeetingRunnerLimits=>({maxTokens:100,maxCost:1,maxRounds:1,deadline:new Date(Date.now()+60_000).toISOString(),maxTokensPerTurn:50,maxCostPerTurn:.5,maxRetries:1,leaseMs:100,maxOutputBytes:1000});

test("Milestone C backup restore preserves completed meeting turns, frozen snapshots and provenance without re-invocation",async()=>{
 const root=mkdtempSync(join(tmpdir(),"agent-company-c-")),source=join(root,"source.sqlite"),backup=join(root,"backup.sqlite"),restored=join(root,"restored.sqlite");
 try{
  let calls=0,state=new SQLiteStateStore(source),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects);
  projects.createWorkspace("w","W");companies.createCompany({id:"c",name:"C",workspaceId:"w",budgetLimit:10,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},"owner");companies.createDepartment({id:"d",companyId:"c",parentId:null,name:"D",budgetLimit:10},"owner");companies.addMember("c","owner","agent","member","d");companies.createMeeting({id:"m",companyId:"c",goalId:null,projectId:null,runId:null,title:"Recovery",purpose:"Verify durable turns",hostId:"owner",participantIds:["agent","owner"],agenda:["durability"],scheduledAt:null},"owner");companies.transitionMeeting("c","m","live","owner");
  let bindings=new AgentBindingStore(state.db,companies,{host:"standalone",model:"model",baseUrl:null});
  const host:HostAdapter={hostId:"fake",async capabilities(){return{auth:false,models:true,usage:true,events:false,streamingAbort:false}},async authenticate(){return{userId:"x",roles:[]}},async listModels(){return[]},async invokeModel(request){calls++;return{requestId:request.requestId,text:JSON.stringify({kind:"opinion",content:"The persisted evidence is sufficient.",evidenceIds:["m"],uncertainty:null,escalation:false}),tokens:10,cost:.1}},async recordUsage(){},async publishEvent(){}};
  let runner=new MeetingAgentRunner(state.db,companies,bindings,{resolve(){return host},providerIdempotent(){return true}}),operations=new OperationalStore(state.db,source);
  runner.initialize("m",limits());assert.equal((await runner.runNext("m","worker"))?.status,"completed");assert.equal(calls,1);assert.equal(operations.schemaVersion(),2400);await operations.createBackup(backup);state.close();
  OperationalStore.restore(backup,restored);state=new SQLiteStateStore(restored);projects=new ProjectOperations(state.db,state);companies=new CompanyOperations(state.db,state,projects);bindings=new AgentBindingStore(state.db,companies,{host:"standalone",model:"changed",baseUrl:null});runner=new MeetingAgentRunner(state.db,companies,bindings,{resolve(){return host},providerIdempotent(){return true}});operations=new OperationalStore(state.db,restored);
  assert.equal(await runner.runNext("m","restarted"),null);assert.equal(calls,1);assert.equal(runner.turns("m")[0]?.status,"completed");assert.equal(state.db.prepare("SELECT COUNT(*) n FROM meeting_agent_binding_snapshots_v18").get()?.n,1);assert.equal(state.db.prepare("SELECT COUNT(*) n FROM meeting_agent_profile_snapshots_v18").get()?.n,1);assert.equal(state.db.prepare("SELECT COUNT(*) n FROM meeting_agent_message_provenance_v18").get()?.n,1);assert.equal((state.db.prepare("SELECT settled_tokens n FROM meeting_agent_budgets_v18 WHERE meeting_id='m'").get() as {n:number}).n,10);assert.equal(operations.schemaVersion(),2400);state.close();
 }finally{try{rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}catch(error){if(!error||typeof error!=="object"||!("code" in error)||!["EPERM","EBUSY"].includes(String(error.code)))throw error;}}
});
