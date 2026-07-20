import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OperationalStore } from "../../operations/src/index.js";
import { mapLegacyEvent } from "../../event-mapper/src/index.js";

export type OfficePhase = "idle"|"planning"|"working"|"validating"|"reviewing"|"approval"|"blocked"|"completed";
export type OfficeAlertPriority="critical"|"high"|"warning";
export interface OfficeAlert { eventId:string;sequence:number;type:string;priority:OfficeAlertPriority;runId:string|null;taskId:string|null;message:string }
export interface OfficeAgentLink { companyId:string;projectId:string;taskId:string;runId:string|null;agentId:string;responsibility:string }
export interface OfficeWorkItem { key:string;projectId:string|null;runId:string|null;taskId:string|null;phase:OfficePhase;agentId:string|null;lastSequence:number }
export interface OfficeProjection { companyId:string; lastSequence:number; phase:OfficePhase; activeAgentId:string|null; projectId:string|null; runId:string|null; taskId:string|null; timeline:Array<{eventId:string;sequence:number;type:string;phase:OfficePhase;agentId:string|null}>; alerts:OfficeAlert[]; workItems:OfficeWorkItem[]; stateHash:string }

const stable=(value:unknown):string=>JSON.stringify(value,(_,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=(value:unknown):string=>createHash("sha256").update(stable(value)).digest("hex");
const phaseFor=(type:string,current:OfficePhase,payload:Record<string,unknown>):OfficePhase=>{
  if(type==="run.transitioned"){
    const status=String(payload.to??"");
    if(["CREATED","PLANNING","PLAN_APPROVAL_WAITING"].includes(status))return "planning";
    if(["READY","RUNNING"].includes(status))return "working";
    if(status==="VALIDATING")return "validating";
    if(status==="RESULT_APPROVAL_WAITING")return "approval";
    if(status==="COMPLETED")return "completed";
    if(["FAILED","BLOCKED","REVISION_REQUIRED"].includes(status))return "blocked";
    if(["PAUSED","CANCELLING","CANCELLED"].includes(status))return "idle";
  }
  if(type==="task.transitioned"){
    const status=String(payload.to??"");
    if(status==="in-progress")return "working";
    if(status==="review")return "reviewing";
    if(status==="blocked")return "blocked";
    if(status==="done")return "completed";
  }
  if(type.includes("blocked")||type.includes("failed")||type.includes("denied")||type.includes("conflict"))return "blocked";
  if(type.startsWith("validation."))return "validating";
  if(type==="workflow.completed"||type==="run.completed"||type.includes("merged"))return "completed";
  if(type.startsWith("approval.")||type.includes("approval_waiting"))return "approval";
  if(type.includes("review"))return "reviewing";
  if(type.includes("plan")||type.includes("created"))return "planning";
  if(type.startsWith("task.")||type.startsWith("tool.")||type.startsWith("model."))return "working";
  return current;
};
const defaultAgent=(phase:OfficePhase):string|null=>phase==="planning"?"demo-pm":phase==="working"?"demo-developer":phase==="validating"||phase==="reviewing"?"demo-qa":phase==="approval"?"demo-ceo":null;
const phaseFromRunStatus=(status:string):OfficePhase=>["CREATED","PLANNING","PLAN_APPROVAL_WAITING"].includes(status)?"planning":["READY","RUNNING"].includes(status)?"working":status==="VALIDATING"?"validating":status==="RESULT_APPROVAL_WAITING"?"approval":status==="COMPLETED"?"completed":["FAILED","BLOCKED","REVISION_REQUIRED"].includes(status)?"blocked":"idle";
const phaseFromTaskStatus=(status:string):OfficePhase=>status==="in-progress"?"working":status==="review"?"reviewing":status==="blocked"?"blocked":status==="done"?"completed":["backlog","ready"].includes(status)?"planning":"idle";
const alertFor=(event:ReturnType<typeof mapLegacyEvent>):OfficeAlert|null=>{const type=event.type;if(type.includes("failed")||type.includes("blocked")||type.includes("denied")||type.includes("conflict"))return{eventId:event.eventId,sequence:event.sequence,type,priority:"critical",runId:event.runId??null,taskId:event.taskId??null,message:`${type} requires attention`};if(type.startsWith("approval.")||type==="result.approved"||type==="plan.approved"||(type==="run.transitioned"&&String((event.payload as Record<string,unknown>).to??"").includes("APPROVAL_WAITING")))return{eventId:event.eventId,sequence:event.sequence,type,priority:"high",runId:event.runId??null,taskId:event.taskId??null,message:`${type} approval event`};if(type==="validation.completed"&&!(event.payload as Record<string,unknown>).passed)return{eventId:event.eventId,sequence:event.sequence,type,priority:"warning",runId:event.runId??null,taskId:event.taskId??null,message:"Validation did not pass"};return null;};

export class OfficeProjectionStore{
  constructor(private readonly db:DatabaseSync,private readonly operations:OperationalStore){this.db.exec(`CREATE TABLE IF NOT EXISTS office_projection_v7(company_id TEXT PRIMARY KEY,last_sequence INTEGER NOT NULL,state TEXT NOT NULL,state_hash TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS office_projection_events_v7(company_id TEXT NOT NULL,event_id TEXT NOT NULL,sequence INTEGER NOT NULL,PRIMARY KEY(company_id,event_id),UNIQUE(company_id,sequence));`);}
  get(companyId:string):OfficeProjection{return this.read(companyId)??this.empty(companyId);}
  links(companyId:string):OfficeAgentLink[]{return this.db.prepare(`SELECT cp.company_id AS companyId,t.project_id AS projectId,a.task_id AS taskId,t.run_id AS runId,a.principal_id AS agentId,a.responsibility FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id JOIN assignments_v3 a ON a.task_id=t.id WHERE cp.company_id=? ORDER BY t.project_id,a.task_id,a.responsibility,a.principal_id`).all(companyId) as unknown as OfficeAgentLink[];}
  consistency(companyId:string):{companyId:string;checked:number;mismatches:Array<{key:string;expected:OfficePhase;actual:OfficePhase|null}>;ok:boolean}{const projection=this.catchUp(companyId),rows=this.db.prepare(`SELECT t.id task_id,t.project_id,t.status task_status,t.run_id,r.status run_status FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id LEFT JOIN runs r ON r.id=t.run_id WHERE cp.company_id=? ORDER BY t.id`).all(companyId) as Array<{task_id:string;project_id:string;task_status:string;run_id:string|null;run_status:string|null}>,mismatches=[] as Array<{key:string;expected:OfficePhase;actual:OfficePhase|null}>;for(const row of rows){const key=row.run_id??row.task_id,expected=row.run_status?phaseFromRunStatus(row.run_status):phaseFromTaskStatus(row.task_status),actual=projection.workItems.find(x=>x.key===key)?.phase??null;if(actual!==expected)mismatches.push({key,expected,actual});}return{companyId,checked:rows.length,mismatches,ok:mismatches.length===0};}
  catchUp(companyId:string):OfficeProjection{let state=this.get(companyId);const mode=((this.db.prepare("SELECT mode FROM companies_v4 WHERE id=?").get(companyId) as {mode:string}|undefined)?.mode==="demo"?"demo":"live") as "demo"|"live";for(;;){const batch=this.operations.events(companyId,state.lastSequence,1000);if(!batch.length)break;for(const row of batch)state=this.apply(mapLegacyEvent(row,mode));if(batch.length<1000)break;}return state;}
  apply(event:ReturnType<typeof mapLegacyEvent>):OfficeProjection{const prior=this.get(event.companyId);if(event.sequence<=prior.lastSequence){const applied=this.db.prepare("SELECT 1 FROM office_projection_events_v7 WHERE company_id=? AND event_id=?").get(event.companyId,event.eventId);if(applied)return prior;throw new Error("Office projection event sequence is stale or out of order");}const payload=event.payload as Record<string,unknown>,key=event.runId??event.taskId??null,priorItem=key?prior.workItems.find(x=>x.key===key):undefined,phase=phaseFor(event.type,priorItem?.phase??prior.phase,payload),agentId=this.resolveAgent(event,phase),alert=alertFor(event),workItems=key?[...prior.workItems.filter(x=>x.key!==key&&!(event.runId&&event.taskId&&x.key===event.taskId)),{key,projectId:event.projectId??prior.projectId,runId:event.runId??null,taskId:event.taskId??null,phase,agentId,lastSequence:event.sequence}].sort((a,b)=>a.key.localeCompare(b.key)):prior.workItems,body={companyId:event.companyId,lastSequence:event.sequence,phase,activeAgentId:agentId,projectId:event.projectId??prior.projectId,runId:event.runId??prior.runId,taskId:event.taskId??prior.taskId,timeline:[...prior.timeline,{eventId:event.eventId,sequence:event.sequence,type:event.type,phase,agentId}].slice(-200),alerts:alert?[...prior.alerts,alert].slice(-50):prior.alerts,workItems},next={...body,stateHash:hash(body)};this.db.exec("BEGIN IMMEDIATE");try{this.db.prepare("INSERT INTO office_projection_events_v7 VALUES(?,?,?)").run(event.companyId,event.eventId,event.sequence);this.db.prepare("INSERT OR REPLACE INTO office_projection_v7 VALUES(?,?,?,?,?)").run(event.companyId,event.sequence,JSON.stringify(next),next.stateHash,new Date().toISOString());this.db.exec("COMMIT");return next;}catch(error){try{this.db.exec("ROLLBACK");}catch{}throw error;}}
  rebuild(companyId:string):OfficeProjection{this.db.exec("BEGIN IMMEDIATE");try{this.db.prepare("DELETE FROM office_projection_events_v7 WHERE company_id=?").run(companyId);this.db.prepare("DELETE FROM office_projection_v7 WHERE company_id=?").run(companyId);this.db.exec("COMMIT");}catch(error){try{this.db.exec("ROLLBACK");}catch{}throw error;}return this.catchUp(companyId);}
  private empty(companyId:string):OfficeProjection{const body={companyId,lastSequence:0,phase:"idle" as const,activeAgentId:null,projectId:null,runId:null,taskId:null,timeline:[],alerts:[],workItems:[]};return{...body,stateHash:hash(body)};}
  private read(companyId:string):OfficeProjection|null{const row=this.db.prepare("SELECT state FROM office_projection_v7 WHERE company_id=?").get(companyId) as {state:string}|undefined;if(!row)return null;const state=JSON.parse(row.state) as OfficeProjection;return{...state,alerts:state.alerts??[],workItems:state.workItems??[]};}
  private resolveAgent(event:ReturnType<typeof mapLegacyEvent>,phase:OfficePhase):string|null{if(event.agentId)return event.agentId;const responsibility=phase==="working"?"executor":phase==="validating"||phase==="reviewing"?"reviewer":phase==="planning"||phase==="approval"?"owner":null,task=event.taskId?{id:event.taskId}:event.runId?this.db.prepare("SELECT id FROM board_tasks_v3 WHERE run_id=?").get(event.runId) as {id:string}|undefined:undefined;if(task&&responsibility){const assignment=this.db.prepare("SELECT principal_id FROM assignments_v3 WHERE task_id=? AND responsibility=? ORDER BY principal_id LIMIT 1").get(task.id,responsibility) as {principal_id:string}|undefined;if(assignment)return assignment.principal_id;}const projectId=event.projectId??(task?(this.db.prepare("SELECT project_id FROM board_tasks_v3 WHERE id=?").get(task.id) as {project_id:string}|undefined)?.project_id:undefined);if(projectId&&(phase==="planning"||phase==="approval")){const owner=this.db.prepare("SELECT principal_id FROM project_members_v3 WHERE project_id=? AND role='owner' ORDER BY principal_id LIMIT 1").get(projectId) as {principal_id:string}|undefined;if(owner)return owner.principal_id;}return event.mode==="demo"?defaultAgent(phase):null;}
}
