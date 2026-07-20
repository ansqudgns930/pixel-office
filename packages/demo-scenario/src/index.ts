import type { DatabaseSync } from "node:sqlite";
import type { OperationalStore } from "../../operations/src/index.js";

export type DemoScenarioStatus="running"|"completed";
export interface DemoScenario { id:string;requestId:string;companyId:string;goal:string;requestedBy:string;step:number;status:DemoScenarioStatus;createdAt:string;updatedAt:string }

const now=()=>new Date().toISOString();
const STEPS=[
  {type:"GOAL_CREATED",agentId:"demo-ceo",detail:"Goal accepted"},
  {type:"PLAN_CREATED",agentId:"demo-pm",detail:"Plan prepared"},
  {type:"PLAN_APPROVED",agentId:"demo-ceo",detail:"Plan approved"},
  {type:"TASK_CLAIMED",agentId:"demo-developer",detail:"Implementation started"},
  {type:"VALIDATION_FAILED",agentId:"demo-qa",detail:"Type check failed as designed"},
  {type:"REVISION_CREATED",agentId:"demo-developer",detail:"Revision task created"},
  {type:"TASK_CLAIMED",agentId:"demo-developer",detail:"Revision applied"},
  {type:"VALIDATION_COMPLETED",agentId:"demo-qa",detail:"Type check and tests passed"},
  {type:"RESULT_HASH_BOUND",agentId:"demo-ceo",detail:"Result patch bound for approval"},
  {type:"RESULT_APPROVED",agentId:"demo-ceo",detail:"Result approved"},
  {type:"MERGE_CANDIDATE_CREATED",agentId:"demo-developer",detail:"Merge candidate created"},
  {type:"WORKFLOW_COMPLETED",agentId:"demo-ceo",detail:"First delivery completed",contributorAgentId:"demo-developer"}
] as const;

export class DemoScenarioService{
  constructor(private readonly db:DatabaseSync,private readonly operations:OperationalStore){this.db.exec("CREATE TABLE IF NOT EXISTS demo_scenarios_v7(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,company_id TEXT NOT NULL,goal TEXT NOT NULL,requested_by TEXT NOT NULL,step INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)");}
  start(input:{requestId:string;goal:string;requestedBy:string;auto?:boolean}):DemoScenario{if(!input.requestId||!input.goal.trim()||!input.requestedBy)throw new Error("Demo requestId, goal and principal required");const existing=this.byRequest(input.requestId);if(existing)return input.auto===false?existing:this.run(existing.id);const id=crypto.randomUUID(),timestamp=now();this.db.prepare("INSERT INTO demo_scenarios_v7 VALUES(?,?,?,?,?,?,?,?,?)").run(id,input.requestId,"demo-company",input.goal.trim(),input.requestedBy,0,"running",timestamp,timestamp);return input.auto===false?this.get(id)!:this.run(id);}
  advance(id:string):DemoScenario{const scenario=this.get(id);if(!scenario)throw new Error("Demo scenario missing");if(scenario.status==="completed")return scenario;const index=scenario.step,next=STEPS[index];if(!next)return this.finish(id);this.operations.emit({tenantId:scenario.companyId,aggregateType:"demo-scenario",aggregateId:id,type:next.type,eventId:`demo:${id}:${index+1}`,payload:{scenarioId:id,goal:scenario.goal,projectId:"demo-first-delivery",taskId:"demo-first-delivery-task",runId:`demo-run:${id}`,agentId:next.agentId,step:index+1,detail:next.detail,...("contributorAgentId" in next?{contributorAgentId:next.contributorAgentId}:{}),...(next.type==="VALIDATION_FAILED"?{passed:false}:{})}});const step=index+1,status:DemoScenarioStatus=step===STEPS.length?"completed":"running";this.db.prepare("UPDATE demo_scenarios_v7 SET step=?,status=?,updated_at=? WHERE id=? AND step=?").run(step,status,now(),id,index);return this.get(id)!;}
  run(id:string):DemoScenario{let scenario=this.get(id);if(!scenario)throw new Error("Demo scenario missing");while(scenario.status!=="completed")scenario=this.advance(id);return scenario;}
  get(id:string):DemoScenario|null{const row=this.db.prepare("SELECT * FROM demo_scenarios_v7 WHERE id=?").get(id) as Record<string,unknown>|undefined;return row?this.row(row):null;}
  events(id:string){return this.db.prepare("SELECT cursor,event_id AS eventId,type,payload,created_at AS createdAt FROM events_v6 WHERE aggregate_type='demo-scenario' AND aggregate_id=? ORDER BY cursor").all(id);}
  private byRequest(requestId:string):DemoScenario|null{const row=this.db.prepare("SELECT * FROM demo_scenarios_v7 WHERE request_id=?").get(requestId) as Record<string,unknown>|undefined;return row?this.row(row):null;}
  private finish(id:string):DemoScenario{this.db.prepare("UPDATE demo_scenarios_v7 SET status='completed',updated_at=? WHERE id=?").run(now(),id);return this.get(id)!;}
  private row(x:Record<string,unknown>):DemoScenario{return{id:String(x.id),requestId:String(x.request_id),companyId:String(x.company_id),goal:String(x.goal),requestedBy:String(x.requested_by),step:Number(x.step),status:String(x.status) as DemoScenarioStatus,createdAt:String(x.created_at),updatedAt:String(x.updated_at)};}
}
