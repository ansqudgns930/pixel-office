import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {SQLiteStateStore} from "../packages/persistence/src/index.js";
import {ProjectOperations} from "../packages/project-ops/src/index.js";
import {CompanyOperations} from "../packages/company-ops/src/index.js";
import {RunController} from "../packages/runtime/src/index.js";
import {RunIntakeService} from "../packages/policy/src/index.js";
import {ControlPlaneApi} from "../apps/control-plane/src/index.js";

test("company switcher API returns only memberships with tenant summaries",async t=>{const state=new SQLiteStateStore(":memory:"),projects=new ProjectOperations(state.db,state),companies=new CompanyOperations(state.db,state,projects),controller=new RunController(state,{async enqueue(){},async remove(){return false;}}),intake=new RunIntakeService(state,controller);projects.createWorkspace("w","W");for(const [id,owner] of [["a","alice"],["b","bob"],["c","alice"]] as const)companies.createCompany({id,name:id.toUpperCase(),workspaceId:"w",budgetLimit:5,mandatoryReviews:["review"],mandatoryApprovals:["result"],allowedTools:["test"]},owner);const server=new ControlPlaneApi(state,intake,controller,{approvePlan(){},approveResult(){}},projects,companies).server();server.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.close();state.close();});const address=server.address();assert.ok(address&&typeof address==="object");const rows=await(await fetch(`http://127.0.0.1:${address.port}/api/companies?actor=alice`)).json() as Array<{id:string;role:string;projectCount:number}>;assert.deepEqual(rows.map(row=>row.id),["a","c"]);assert.ok(rows.every(row=>row.role==="owner"&&row.projectCount===0));});
