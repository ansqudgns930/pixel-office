import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { OperationalStore } from "../packages/operations/src/index.js";
import { DemoScenarioService } from "../packages/demo-scenario/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class Queue { async enqueue(){} async remove(){return false;} }

test("game progression API exposes evidence metrics, skills, unlocks, incidents and run briefings",async t=>{const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),operations=new OperationalStore(state.db),scenarios=new DemoScenarioService(state.db,operations),controller=new RunController(state,new Queue()),intake=new RunIntakeService(state,controller);companies.bootstrapDemo("owner");scenarios.start({requestId:"p2-api",goal:"Deliver with evidence",requestedBy:"owner"});const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies,undefined,undefined,operations).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}/api/companies/demo-company/game-progression?actor=owner`,first=await(await fetch(base)).json() as {companyXp:number;level:number;unlocks:string[];agents:Array<{skills:Record<string,number>}>;metrics:{completedRuns:number;validationFailures:number};incidents:Array<{severity:string}>;briefings:Array<{provenance:string[]}>;stateHash:string},rebuilt=await(await fetch(base,{method:"POST"})).json() as {stateHash:string};assert.equal(first.companyXp,23);assert.equal(first.level,1);assert.ok(first.unlocks.includes("starter-office"));assert.equal(first.agents[0]?.skills.delivery,20);assert.equal(first.metrics.completedRuns,1);assert.equal(first.metrics.validationFailures,1);assert.ok(first.incidents.some(x=>x.severity==="warning"));assert.ok(first.briefings[0]?.provenance.length);assert.equal(rebuilt.stateHash,first.stateHash);});
