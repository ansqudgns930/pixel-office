import test from "node:test";
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations} from "../packages/company-ops/src/index.js";
import {OperationalStore} from "../packages/operations/src/index.js";
import {OfficeManagement} from "../packages/office-management/src/index.js";
import {GameProgressionStore} from "../packages/game-progression/src/index.js";

const policy={mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]};
test("P5 office supports five floors, hiring, placement, decoration, two projects and 30 staff",()=>{
 const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db),office=new OfficeManagement(state.db,companies,operations);
 projects.createWorkspace("w","W");companies.createCompany({id:"c",name:"Scale Co",workspaceId:"w",budgetLimit:100,...policy},"owner");companies.createDepartment({id:"d",companyId:"c",parentId:null,name:"Delivery",budgetLimit:100},"owner");
 for(const id of ["p1","p2"]){projects.createProject({id,workspaceId:"w",name:id,repoPath:".",defaultBranch:"main",runtimePath:".",organizationProfile:{},budgetLimit:20},"owner");companies.linkProject("c","d",id,1,"owner");}
 for(let i=1;i<29;i++)companies.addMember("c","owner",`agent-${String(i).padStart(2,"0")}`,"member","d");
 office.hire("c","owner",{principalId:"security-reviewer",departmentId:"d",role:"member",specialty:"security",appearance:{palette:"violet",badge:"shield"}});office.place("c","owner",{principalId:"security-reviewer",floor:3,zone:"security-review",desk:1});office.decorate("c","owner",{floor:2,zone:"meeting",kind:"plant",x:12,y:20});
 const started=performance.now(),snapshot=office.snapshot("c","owner") as any,elapsed=performance.now()-started;assert.equal(snapshot.floors.length,5);assert.equal(snapshot.staff.length,30);assert.equal(snapshot.projects.length,2);assert.equal(snapshot.decorations.length,1);assert.equal(snapshot.staff.find((x:any)=>x.principalId==="security-reviewer").characterStyle,"specialist");assert.equal(snapshot.staff.find((x:any)=>x.principalId==="security-reviewer").placement.floor,3);assert.deepEqual(snapshot.accessibility,{keyboardNavigation:true,reducedMotion:true,highContrast:true,screenReaderSummary:true});assert.ok(elapsed<1000);state.close();
});
test("P5 replay pages a 10,000 event history without truncating authoritative events",()=>{
 const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db),office=new OfficeManagement(state.db,companies,operations);projects.createWorkspace("w","W");companies.createCompany({id:"history",name:"History",workspaceId:"w",budgetLimit:1,...policy},"owner");
 for(let i=0;i<10_000;i++)operations.emit({tenantId:"history",aggregateType:"office",aggregateId:"history",type:"REPLAY_EVENT",eventId:`e-${i}`,payload:{i}});let after=0,total=0;for(;;){const page=office.replay("history","owner",after,500) as any;total+=page.events.length;after=page.nextAfter;if(!page.hasMore)break;}assert.equal(total,10_000);assert.equal(after,10_000);state.close();
});
test("P5 progression reaches level 10 with advanced unlocks",()=>{const state=new SQLiteStateStore(":memory:"),operations=new OperationalStore(state.db);for(let i=0;i<120;i++)operations.emit({tenantId:"max",aggregateType:"run",aggregateId:`r${i}`,type:"WORKFLOW_COMPLETED",eventId:`done-${i}`,payload:{runId:`r${i}`,contributorAgentId:"builder"}});const game=new GameProgressionStore(state.db,operations).catchUp("max","live");assert.equal(game.companyXp,3000);assert.equal(game.level,10);assert.ok(game.unlocks.includes("multi-company-entry"));assert.ok(game.unlocks.includes("office-themes"));state.close();});
