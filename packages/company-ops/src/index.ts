import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { StateStore } from "../../persistence/src/index.js";
import type { ProjectOperations } from "../../project-ops/src/index.js";
import type { BuildReviewEvidenceManifest } from "../../review-evidence/src/index.js";

export type CompanyRole =
  | "owner"
  | "executive"
  | "department-manager"
  | "member"
  | "viewer";
export type CompanyMode = "demo" | "live";
export type CompanyPipelineRole = "planner" | "worker" | "reviewer";
export type JobFamily =
  | "planning"
  | "engineering"
  | "design"
  | "qa"
  | "security"
  | "operations";
export interface ProhibitedAction {
  action: string;
  enforcement: "deterministic-check" | "prompt-only";
}
export interface CompanyRecord {
  id: string;
  name: string;
  workspaceId: string;
  budgetLimit: number;
  mandatoryReviews: string[];
  mandatoryApprovals: string[];
  allowedTools: string[];
  mode: CompanyMode;
  status: "active" | "archived";
}
export interface DepartmentRecord {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  budgetLimit: number;
}
export interface CompanyMemberRecord {
  companyId: string;
  principalId: string;
  role: CompanyRole;
  departmentId: string | null;
  kind: "human" | "agent";
}
export interface RoleTemplateRecord {
  id: string;
  logicalId: string;
  version: number;
  parentVersionId: string | null;
  companyId: string;
  departmentId: string | null;
  name: string;
  jobFamily: JobFamily;
  responsibility: string;
  completionCriteria: string[];
  requiredOutputs: string[];
  prohibitedActions: ProhibitedAction[];
  qualityChecklist: string[];
  escalationConditions: string[];
  allowedTools: string[];
  requiredReviews: string[];
  requiredApprovals: string[];
  createdAt: string;
}
export interface ResolvedRoleProfile {
  executionSnapshotId: string | null;
  companyId: string;
  projectId: string;
  taskId: string;
  pipelineRole: CompanyPipelineRole;
  memberId: string | null;
  assignmentResponsibility: "owner" | "executor" | "reviewer";
  departmentId: string | null;
  templateId: string | null;
  templateLogicalId: string | null;
  templateVersion: number | null;
  templateName: string | null;
  jobFamily: JobFamily;
  bindingSource: {
    targetType: "company" | "project" | "task";
    targetId: string;
    pipelineRole: CompanyPipelineRole | null;
  } | null;
  responsibility: string | null;
  completionCriteria: string[];
  requiredOutputs: string[];
  prohibitedActions: ProhibitedAction[];
  qualityChecklist: string[];
  escalationConditions: string[];
  allowedTools: string[];
  requiredReviews: string[];
  requiredApprovals: string[];
  profileHash: string;
}
export interface ReviewInput {
  id: string;
  companyId: string;
  projectId: string;
  runId: string;
  reviewerId: string;
  verdict: "approve" | "reject" | "needs-work";
  risks: string[];
  evidenceIds: string[];
  summary: string;
  contentHash: string;
  createdAt: string;
}
export interface ReviewMeeting {
  id: string;
  companyId: string;
  projectId: string;
  inputIds: string[];
  duplicates: string[];
  conflicts: string[];
  unresolvedRisks: string[];
  recommendation: "approve" | "reject" | "needs-work";
  provenance: string[];
  snapshotHash: string;
  createdAt: string;
}
export interface Briefing {
  id: string;
  companyId: string;
  portfolioHash: string;
  meetingIds: string[];
  facts: unknown;
  decisions: string[];
  nextActions: string[];
  provenance: string[];
  briefingHash: string;
  createdAt: string;
}
export type CompanyGoalStatus =
  | "draft"
  | "active"
  | "blocked"
  | "completed"
  | "cancelled";
export interface CompanyGoalRecord {
  id: string;
  companyId: string;
  title: string;
  description: string;
  status: CompanyGoalStatus;
  ownerId: string;
  completionCriteria: string[];
  budgetLimit: number;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export const GOAL_DELIVERY_STAGES = [
  "discovery",
  "delivery-planning",
  "build",
  "release",
  "operate",
] as const;
export type GoalDeliveryStage = (typeof GOAL_DELIVERY_STAGES)[number];
export type GoalDeliveryProcessStatus =
  | "active"
  | "blocked"
  | "completed"
  | "cancelled";
export type GoalDeliveryStageStatus =
  | "pending"
  | "in-progress"
  | "validation-waiting"
  | "review-waiting"
  | "owner-approval-waiting"
  | "revision-requested"
  | "approved"
  | "blocked"
  | "cancelled";
export interface GoalDeliveryProcessRecord {
  id: string;
  companyId: string;
  goalId: string;
  processVersion: number;
  version: number;
  currentStage: GoalDeliveryStage;
  status: GoalDeliveryProcessStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface GoalDeliveryStageInstanceRecord {
  id: string;
  processId: string;
  stage: GoalDeliveryStage;
  attempt: number;
  status: GoalDeliveryStageStatus;
  runId: string | null;
  meetingId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface GoalDeliveryArtifactSnapshotRecord {
  id: string;
  stageInstanceId: string;
  version: number;
  artifactIds: string[];
  snapshotHash: string;
  stale: boolean;
  staleReason: string | null;
  createdAt: string;
}
export interface OwnerReviewEvidenceItem {
  id: string;
  kind: "run" | "run-result" | "validation" | "artifact" | "meeting" | "other";
  label: string;
  status: "available" | "stale";
  url: string | null;
}
export interface OwnerReviewPacket {
  version: 2;
  stage: GoalDeliveryStage;
  stageLabel: string;
  goal: {
    id: string;
    title: string;
    description: string;
    completionCriteria: string[];
  };
  summary: string;
  sections: Array<{ id: string; title: string; items: string[] }>;
  deterministicFacts: Array<{ label: string; value: string; source: string }>;
  teamInterpretation: {
    decisions: string[];
    risks: string[];
    openItems: string[];
  };
  evidence: OwnerReviewEvidenceItem[];
  buildEvidence: BuildReviewEvidenceManifest | null;
  completeness: {
    required: string[];
    present: string[];
    missing: string[];
    staleEvidenceIds: string[];
    ready: boolean;
  };
  snapshotHash: string;
  createdAt: string;
}
export interface GoalDeliveryOwnerReviewRecord {
  id: string;
  processId: string;
  stageInstanceId: string;
  companyId: string;
  goalId: string;
  meetingId: string;
  runId: string | null;
  status: "pending" | "approved" | "revision-requested" | "on-hold";
  koreanSummary: string;
  decisions: string[];
  risks: string[];
  openItems: string[];
  evidenceIds: string[];
  snapshotHash: string;
  packet: OwnerReviewPacket;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}
export interface OwnerReviewQueueItem {
  review: GoalDeliveryOwnerReviewRecord;
  goalTitle: string;
  stage: GoalDeliveryStage;
  stageLabel: string;
  urgency: "high" | "normal";
  requestedAt: string;
}
export interface GoalDeploymentRecord {
  id: string;
  processId: string;
  stageInstanceId: string;
  companyId: string;
  goalId: string;
  provider: "firebase";
  environment: "preview" | "production";
  action: "deploy" | "skip";
  targetProjectId: string | null;
  targetChannel: string | null;
  artifactSnapshotHash: string;
  status:
    | "approved"
    | "deploying"
    | "succeeded"
    | "failed"
    | "skipped"
    | "rolled-back";
  approvedBy: string;
  approvedAt: string;
  receipt: {
    providerReceiptId: string;
    url: string | null;
    version: string | null;
    verifiedAt: string;
    rollbackRef: string | null;
  } | null;
  failure: string | null;
  rolledBackAt: string | null;
  updatedAt: string;
}
export interface GoalChangeRequestRecord {
  id: string;
  companyId: string;
  goalId: string;
  sourceProcessId: string;
  newProcessId: string;
  message: string;
  impactStage: Exclude<GoalDeliveryStage, "operate">;
  rationale: string[];
  sourceCompletionHash: string;
  status: "accepted";
  createdBy: string;
  createdAt: string;
}
export interface GoalDeliverySnapshot {
  process: GoalDeliveryProcessRecord;
  currentStageInstance: GoalDeliveryStageInstanceRecord;
  stages: GoalDeliveryStageInstanceRecord[];
  artifactSnapshots: GoalDeliveryArtifactSnapshotRecord[];
  ownerReview: GoalDeliveryOwnerReviewRecord | null;
  deployment: GoalDeploymentRecord | null;
  changeRequests?: GoalChangeRequestRecord[];
}
export interface GoalDeliveryStageWorkItem {
  companyId: string;
  goalId: string;
  processId: string;
  stageInstanceId: string;
  stage: GoalDeliveryStage;
  attempt: number;
  status: GoalDeliveryStageStatus;
  runId: string | null;
  ownerId: string;
}
export type CompanyMeetingStatus =
  | "scheduled"
  | "live"
  | "decision-pending"
  | "ended"
  | "cancelled";
export type MeetingMessageKind =
  | "agent"
  | "system"
  | "question"
  | "opinion"
  | "instruction"
  | "decision";
export interface CompanyMeetingRecord {
  id: string;
  companyId: string;
  goalId: string | null;
  projectId: string | null;
  runId: string | null;
  title: string;
  purpose: string;
  hostId: string;
  participantIds: string[];
  agenda: string[];
  status: CompanyMeetingStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface MeetingMessageRecord {
  id: string;
  meetingId: string;
  companyId: string;
  speakerId: string;
  kind: MeetingMessageKind;
  targetType: "all" | "member" | "agenda" | "goal-task";
  targetId: string | null;
  content: string;
  evidence: string[];
  followUp: {
    title: string;
    assigneeId: string | null;
    dueAt: string | null;
    completionCriteria: string[];
    budgetLimit: number;
  } | null;
  createdAt: string;
}
export interface CompanySearchResult {
  kind:
    | "goal"
    | "project"
    | "task"
    | "run"
    | "member"
    | "meeting"
    | "decision"
    | "audit";
  id: string;
  title: string;
  description: string;
  status: string | null;
  url: string;
  createdAt: string | null;
}
export interface CompanyAlert {
  key: string;
  kind:
    | "blocked"
    | "approval"
    | "validation"
    | "meeting"
    | "budget"
    | "notification";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  url: string;
  createdAt: string;
  readAt: string | null;
}
const RUN_STATUS_LABEL: Record<string, string> = {
  CREATED: "접수",
  PLANNING: "계획 작성",
  PLAN_APPROVAL_WAITING: "계획 승인 대기",
  READY: "실행 준비",
  RUNNING: "실행 중",
  VALIDATING: "검증 중",
  RESULT_APPROVAL_WAITING: "결과 승인 대기",
  COMPLETED: "완료",
  PAUSED: "일시정지",
  BLOCKED: "차단",
  FAILED: "실패",
  REVISION_REQUIRED: "재작업 필요",
  RETRY_WAITING: "재시도 대기",
};
/** notifications_v3.type/payload를 사람이 읽는 제목·설명으로 변환한다. 미등록 타입은 원문 대신 최소 안내문으로 대체한다. */
function describeNotification(
  type: string,
  payload: unknown,
): { title: string; description: string } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<
      string,
      unknown
    >,
    runId = typeof p.runId === "string" ? p.runId : null,
    taskId = typeof p.taskId === "string" ? p.taskId : null,
    statusLabel = (v: unknown) =>
      typeof v === "string" ? (RUN_STATUS_LABEL[v] ?? v) : "";
  if (type === "approval-waiting")
    return {
      title: "승인 대기",
      description: `Run ${runId ?? ""} ${statusLabel(p.status)}`.trim(),
    };
  if (type === "run-problem")
    return {
      title: "Run 문제 발생",
      description: `Run ${runId ?? ""} ${statusLabel(p.status)}`.trim(),
    };
  if (type === "task-blocked")
    return {
      title: "Task 차단",
      description: `Task ${taskId ?? ""}가 ${statusLabel(p.from)} 단계에서 차단되었습니다`,
    };
  if (type === "budget-blocked")
    return {
      title: "예산 부족",
      description: runId
        ? `Run ${runId} 예산 요청이 거부되었습니다`
        : `Task ${taskId ?? ""} 예산 요청이 거부되었습니다`,
    };
  if (type === "merge-conflict")
    return {
      title: "병합 충돌",
      description: `Run ${runId ?? ""} 병합 후보에 충돌이 있습니다`.trim(),
    };
  return {
    title: "업데이트",
    description: "자세한 내용은 프로젝트에서 확인하세요",
  };
}
const json = (x: unknown) => JSON.stringify(x ?? null),
  parse = <T>(x: unknown) => JSON.parse(String(x)) as T,
  now = () => new Date().toISOString(),
  sha = (x: string) => createHash("sha256").update(x).digest("hex"),
  stable = (x: unknown): string =>
    Array.isArray(x)
      ? `[${x.map(stable).join(",")}]`
      : x && typeof x === "object"
        ? `{${Object.entries(x as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
            .join(",")}}`
        : JSON.stringify(x);

export class CompanyOperations {
  constructor(
    private readonly db: DatabaseSync,
    private readonly state: StateStore,
    private readonly projects: ProjectOperations,
  ) {
    this.migrate();
    const migrated = now();
    this.db
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2200,?)",
      )
      .run(migrated);
    this.db
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2300,?)",
      )
      .run(migrated);
    this.db
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2400,?)",
      )
      .run(migrated);
  }
  private migrate(): void {
    this.db.exec(`
CREATE TABLE IF NOT EXISTS companies_v4(id TEXT PRIMARY KEY,name TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES workspaces_v3(id),budget_limit REAL NOT NULL,mandatory_reviews TEXT NOT NULL,mandatory_approvals TEXT NOT NULL,allowed_tools TEXT NOT NULL,created_at TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'live');
CREATE TABLE IF NOT EXISTS departments_v4(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,parent_id TEXT REFERENCES departments_v4(id),name TEXT NOT NULL,budget_limit REAL NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_members_v4(company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,principal_id TEXT NOT NULL,role TEXT NOT NULL,department_id TEXT REFERENCES departments_v4(id),kind TEXT NOT NULL DEFAULT 'agent',PRIMARY KEY(company_id,principal_id));
CREATE TABLE IF NOT EXISTS company_projects_v4(company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,department_id TEXT NOT NULL REFERENCES departments_v4(id),project_id TEXT NOT NULL REFERENCES projects_v3(id),priority INTEGER NOT NULL,PRIMARY KEY(company_id,project_id),UNIQUE(project_id));
CREATE TABLE IF NOT EXISTS role_templates_v4(id TEXT PRIMARY KEY,logical_id TEXT NOT NULL,version INTEGER NOT NULL,parent_version_id TEXT REFERENCES role_templates_v4(id),company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,department_id TEXT REFERENCES departments_v4(id),name TEXT NOT NULL,responsibility TEXT NOT NULL,allowed_tools TEXT NOT NULL,required_reviews TEXT NOT NULL,required_approvals TEXT NOT NULL,completion_criteria TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(logical_id,version));
CREATE TABLE IF NOT EXISTS role_template_bindings_v4(template_id TEXT NOT NULL REFERENCES role_templates_v4(id),target_type TEXT NOT NULL,target_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies_v4(id),created_at TEXT NOT NULL,PRIMARY KEY(target_type,target_id));
CREATE TABLE IF NOT EXISTS company_policy_versions_v4(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,version INTEGER NOT NULL,mandatory_reviews TEXT NOT NULL,mandatory_approvals TEXT NOT NULL,allowed_tools TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(company_id,version));
CREATE TABLE IF NOT EXISTS review_inputs_v4(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id),project_id TEXT NOT NULL REFERENCES projects_v3(id),run_id TEXT NOT NULL REFERENCES runs(id),reviewer_id TEXT NOT NULL,verdict TEXT NOT NULL,risks TEXT NOT NULL,evidence_ids TEXT NOT NULL,summary TEXT NOT NULL,content_hash TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(company_id,content_hash));
CREATE TABLE IF NOT EXISTS review_meetings_v4(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id),project_id TEXT NOT NULL REFERENCES projects_v3(id),input_ids TEXT NOT NULL,duplicates TEXT NOT NULL,conflicts TEXT NOT NULL,unresolved_risks TEXT NOT NULL,recommendation TEXT NOT NULL,provenance TEXT NOT NULL,snapshot_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ceo_briefings_v4(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id),portfolio_hash TEXT NOT NULL,meeting_ids TEXT NOT NULL,facts TEXT NOT NULL,decisions TEXT NOT NULL,next_actions TEXT NOT NULL,provenance TEXT NOT NULL,briefing_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_audit_v4(seq INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL REFERENCES companies_v4(id),type TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_goals_v12(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL,owner_id TEXT NOT NULL,completion_criteria TEXT NOT NULL,budget_limit REAL NOT NULL,due_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_goal_projects_v12(goal_id TEXT NOT NULL REFERENCES company_goals_v12(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES projects_v3(id),linked_at TEXT NOT NULL,PRIMARY KEY(goal_id,project_id),UNIQUE(company_id,project_id));
CREATE TABLE IF NOT EXISTS company_meetings_v13(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,goal_id TEXT REFERENCES company_goals_v12(id),project_id TEXT REFERENCES projects_v3(id),run_id TEXT REFERENCES runs(id),title TEXT NOT NULL,purpose TEXT NOT NULL,host_id TEXT NOT NULL,participant_ids TEXT NOT NULL,agenda TEXT NOT NULL,status TEXT NOT NULL,scheduled_at TEXT,started_at TEXT,ended_at TEXT,paused INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meeting_messages_v13(id TEXT PRIMARY KEY,meeting_id TEXT NOT NULL REFERENCES company_meetings_v13(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,speaker_id TEXT NOT NULL,kind TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT,content TEXT NOT NULL,evidence TEXT NOT NULL,follow_up TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meeting_summaries_v13(meeting_id TEXT PRIMARY KEY REFERENCES company_meetings_v13(id) ON DELETE CASCADE,status TEXT NOT NULL,paragraph TEXT NOT NULL,agenda_summaries TEXT NOT NULL,decisions TEXT NOT NULL,open_items TEXT NOT NULL,risks TEXT NOT NULL,intervention_message_ids TEXT NOT NULL,follow_ups TEXT NOT NULL,created_task_ids TEXT NOT NULL,confirmed_by TEXT,confirmed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_alert_reads_v14(company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,principal_id TEXT NOT NULL,alert_key TEXT NOT NULL,read_at TEXT NOT NULL,PRIMARY KEY(company_id,principal_id,alert_key));
CREATE TABLE IF NOT EXISTS company_deletion_requests_v14(company_id TEXT PRIMARY KEY REFERENCES companies_v4(id) ON DELETE CASCADE,requested_by TEXT NOT NULL,company_name TEXT NOT NULL,impact TEXT NOT NULL,status TEXT NOT NULL,requested_at TEXT NOT NULL,cancelled_at TEXT);
CREATE TABLE IF NOT EXISTS role_templates_v15(id TEXT PRIMARY KEY,logical_id TEXT NOT NULL,version INTEGER NOT NULL,parent_version_id TEXT REFERENCES role_templates_v15(id),company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,department_id TEXT REFERENCES departments_v4(id),name TEXT NOT NULL,job_family TEXT NOT NULL DEFAULT 'operations' CHECK(job_family IN ('planning','engineering','design','qa','security','operations')),responsibility TEXT NOT NULL,completion_criteria TEXT NOT NULL,required_outputs TEXT NOT NULL DEFAULT '[]',prohibited_actions TEXT NOT NULL DEFAULT '[]',quality_checklist TEXT NOT NULL DEFAULT '[]',escalation_conditions TEXT NOT NULL DEFAULT '[]',allowed_tools TEXT NOT NULL,required_reviews TEXT NOT NULL,required_approvals TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(company_id,logical_id,version));
CREATE TABLE IF NOT EXISTS role_template_bindings_v15(template_id TEXT NOT NULL REFERENCES role_templates_v15(id),target_type TEXT NOT NULL CHECK(target_type IN ('company','project','task')),target_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,pipeline_role TEXT NOT NULL DEFAULT '' CHECK(pipeline_role IN ('','planner','worker','reviewer')),created_at TEXT NOT NULL,PRIMARY KEY(company_id,target_type,target_id,pipeline_role));
CREATE TABLE IF NOT EXISTS role_binding_migration_checks_v15(company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,target_type TEXT NOT NULL,target_id TEXT NOT NULL,legacy_template_id TEXT NOT NULL,new_template_id TEXT,matched INTEGER NOT NULL CHECK(matched IN (0,1)),checked_at TEXT NOT NULL,PRIMARY KEY(company_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS task_role_primaries_v15(task_id TEXT NOT NULL,principal_id TEXT NOT NULL,responsibility TEXT NOT NULL CHECK(responsibility IN ('owner','executor','reviewer')),selected_by TEXT NOT NULL,selected_at TEXT NOT NULL,PRIMARY KEY(task_id,responsibility),FOREIGN KEY(task_id,principal_id,responsibility) REFERENCES assignments_v3(task_id,principal_id,responsibility) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS run_execution_snapshots_v15(id TEXT PRIMARY KEY,run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies_v4(id),status TEXT NOT NULL CHECK(status IN ('preparing','complete')),created_at TEXT NOT NULL,completed_at TEXT);
CREATE TABLE IF NOT EXISTS run_role_profile_snapshots_v15(execution_snapshot_id TEXT NOT NULL REFERENCES run_execution_snapshots_v15(id) ON DELETE CASCADE,run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,pipeline_role TEXT NOT NULL CHECK(pipeline_role IN ('planner','worker','reviewer')),template_id TEXT REFERENCES role_templates_v15(id),profile TEXT NOT NULL,profile_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(run_id,pipeline_role));
CREATE TABLE IF NOT EXISTS meeting_agent_message_provenance_v18(message_id TEXT PRIMARY KEY REFERENCES meeting_messages_v13(id) ON DELETE CASCADE,turn_id TEXT NOT NULL UNIQUE,round INTEGER NOT NULL,generated_by TEXT NOT NULL,profile_snapshot_id TEXT NOT NULL,backend_snapshot_id TEXT NOT NULL,prompt_hash TEXT NOT NULL,evidence_ids TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goal_delivery_processes_v19(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,goal_id TEXT NOT NULL REFERENCES company_goals_v12(id) ON DELETE CASCADE,process_version INTEGER NOT NULL,version INTEGER NOT NULL,current_stage TEXT NOT NULL CHECK(current_stage IN ('discovery','delivery-planning','build','release','operate')),status TEXT NOT NULL CHECK(status IN ('active','blocked','completed','cancelled')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,completed_at TEXT,UNIQUE(goal_id,process_version));
CREATE TABLE IF NOT EXISTS goal_delivery_stage_instances_v19(id TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id) ON DELETE CASCADE,stage TEXT NOT NULL CHECK(stage IN ('discovery','delivery-planning','build','release','operate')),attempt INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','in-progress','validation-waiting','review-waiting','owner-approval-waiting','revision-requested','approved','blocked','cancelled')),run_id TEXT REFERENCES runs(id),meeting_id TEXT REFERENCES company_meetings_v13(id),started_at TEXT,completed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(process_id,stage,attempt));
CREATE TABLE IF NOT EXISTS goal_delivery_artifact_snapshots_v19(id TEXT PRIMARY KEY,stage_instance_id TEXT NOT NULL REFERENCES goal_delivery_stage_instances_v19(id) ON DELETE CASCADE,version INTEGER NOT NULL,artifact_ids TEXT NOT NULL,snapshot_hash TEXT NOT NULL,stale INTEGER NOT NULL DEFAULT 0,stale_reason TEXT,created_at TEXT NOT NULL,UNIQUE(stage_instance_id,version));
CREATE TABLE IF NOT EXISTS goal_delivery_commands_v19(company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id) ON DELETE CASCADE,idempotency_key TEXT NOT NULL,command_type TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(company_id,idempotency_key));
CREATE TABLE IF NOT EXISTS goal_delivery_owner_reviews_v20(id TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id) ON DELETE CASCADE,stage_instance_id TEXT NOT NULL REFERENCES goal_delivery_stage_instances_v19(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,goal_id TEXT NOT NULL REFERENCES company_goals_v12(id) ON DELETE CASCADE,meeting_id TEXT NOT NULL REFERENCES company_meetings_v13(id),run_id TEXT REFERENCES runs(id),status TEXT NOT NULL CHECK(status IN ('pending','approved','revision-requested','on-hold')),korean_summary TEXT NOT NULL,decisions TEXT NOT NULL,risks TEXT NOT NULL,open_items TEXT NOT NULL,evidence_ids TEXT NOT NULL,snapshot_hash TEXT NOT NULL,created_at TEXT NOT NULL,resolved_at TEXT,resolved_by TEXT,UNIQUE(stage_instance_id));
CREATE TABLE IF NOT EXISTS goal_deployments_v21(id TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id) ON DELETE CASCADE,stage_instance_id TEXT NOT NULL REFERENCES goal_delivery_stage_instances_v19(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,goal_id TEXT NOT NULL REFERENCES company_goals_v12(id) ON DELETE CASCADE,provider TEXT NOT NULL CHECK(provider='firebase'),environment TEXT NOT NULL CHECK(environment IN ('preview','production')),action TEXT NOT NULL CHECK(action IN ('deploy','skip')),target_project_id TEXT,target_channel TEXT,artifact_snapshot_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('approved','deploying','succeeded','failed','skipped','rolled-back')),approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,receipt TEXT,failure TEXT,rolled_back_at TEXT,updated_at TEXT NOT NULL,UNIQUE(stage_instance_id));
CREATE TABLE IF NOT EXISTS goal_change_requests_v22(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies_v4(id) ON DELETE CASCADE,goal_id TEXT NOT NULL REFERENCES company_goals_v12(id) ON DELETE CASCADE,source_process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id),new_process_id TEXT NOT NULL REFERENCES goal_delivery_processes_v19(id),message TEXT NOT NULL,impact_stage TEXT NOT NULL CHECK(impact_stage IN ('discovery','delivery-planning','build','release')),rationale TEXT NOT NULL,source_completion_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status='accepted'),created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(new_process_id));
CREATE TABLE IF NOT EXISTS goal_delivery_review_packets_v23(owner_review_id TEXT PRIMARY KEY REFERENCES goal_delivery_owner_reviews_v20(id) ON DELETE CASCADE,packet_version INTEGER NOT NULL CHECK(packet_version=2),packet TEXT NOT NULL,packet_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goal_delivery_review_decisions_v23(id TEXT PRIMARY KEY,owner_review_id TEXT NOT NULL REFERENCES goal_delivery_owner_reviews_v20(id),company_id TEXT NOT NULL REFERENCES companies_v4(id),goal_id TEXT NOT NULL REFERENCES company_goals_v12(id),decision TEXT NOT NULL CHECK(decision IN ('approved','revision-requested','on-hold')),reason TEXT NOT NULL,packet_hash TEXT NOT NULL,packet TEXT NOT NULL,decided_by TEXT NOT NULL,decided_at TEXT NOT NULL,decision_hash TEXT NOT NULL UNIQUE,UNIQUE(owner_review_id,decision));
CREATE TABLE IF NOT EXISTS goal_delivery_build_evidence_v24(stage_instance_id TEXT PRIMARY KEY REFERENCES goal_delivery_stage_instances_v19(id) ON DELETE CASCADE,run_id TEXT NOT NULL REFERENCES runs(id),manifest_version INTEGER NOT NULL CHECK(manifest_version=1),manifest TEXT NOT NULL,snapshot_hash TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN (0,1)),created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_goal_delivery_process_goal_v19 ON goal_delivery_processes_v19(company_id,goal_id,process_version DESC);
CREATE INDEX IF NOT EXISTS idx_goal_delivery_stage_process_v19 ON goal_delivery_stage_instances_v19(process_id,stage,attempt);
CREATE INDEX IF NOT EXISTS idx_role_bindings_v15_lookup ON role_template_bindings_v15(company_id,target_type,target_id,pipeline_role);
`);
    const companyColumns = this.db
      .prepare("PRAGMA table_info(companies_v4)")
      .all() as Array<{ name: string }>;
    if (!companyColumns.some((c) => c.name === "mode"))
      this.db.exec(
        "ALTER TABLE companies_v4 ADD COLUMN mode TEXT NOT NULL DEFAULT 'live'",
      );
    if (!companyColumns.some((c) => c.name === "status"))
      this.db.exec(
        "ALTER TABLE companies_v4 ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
      );
    const memberColumns = this.db
      .prepare("PRAGMA table_info(company_members_v4)")
      .all() as Array<{ name: string }>;
    if (!memberColumns.some((c) => c.name === "kind")) {
      this.db.exec(
        "ALTER TABLE company_members_v4 ADD COLUMN kind TEXT NOT NULL DEFAULT 'agent'",
      );
      this.db.exec(
        "UPDATE company_members_v4 SET kind='human' WHERE role='owner'",
      );
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const templateColumns = this.db
        .prepare("PRAGMA table_info(role_templates_v15)")
        .all() as Array<{ name: string }>;
      for (const [name, ddl] of [
        ["job_family", "TEXT NOT NULL DEFAULT 'operations'"],
        ["required_outputs", "TEXT NOT NULL DEFAULT '[]'"],
        ["prohibited_actions", "TEXT NOT NULL DEFAULT '[]'"],
        ["quality_checklist", "TEXT NOT NULL DEFAULT '[]'"],
        ["escalation_conditions", "TEXT NOT NULL DEFAULT '[]'"],
      ] as const)
        if (!templateColumns.some((c) => c.name === name))
          this.db.exec(
            `ALTER TABLE role_templates_v15 ADD COLUMN ${name} ${ddl}`,
          );
      const roleSnapshotColumns = this.db
        .prepare("PRAGMA table_info(run_role_profile_snapshots_v15)")
        .all() as Array<{ name: string }>;
      if (
        roleSnapshotColumns.length &&
        !roleSnapshotColumns.some((c) => c.name === "template_id")
      )
        this.db.exec(
          "ALTER TABLE run_role_profile_snapshots_v15 ADD COLUMN template_id TEXT REFERENCES role_templates_v15(id)",
        );
      this.db.exec(
        "INSERT OR IGNORE INTO role_templates_v15(id,logical_id,version,parent_version_id,company_id,department_id,name,responsibility,allowed_tools,required_reviews,required_approvals,completion_criteria,created_at) SELECT id,logical_id,version,parent_version_id,company_id,department_id,name,responsibility,allowed_tools,required_reviews,required_approvals,completion_criteria,created_at FROM role_templates_v4;INSERT OR IGNORE INTO role_template_bindings_v15(template_id,target_type,target_id,company_id,pipeline_role,created_at) SELECT template_id,target_type,target_id,company_id,'',created_at FROM role_template_bindings_v4;",
      );
      this.db
        .prepare(
          "INSERT OR REPLACE INTO role_binding_migration_checks_v15(company_id,target_type,target_id,legacy_template_id,new_template_id,matched,checked_at) SELECT old.company_id,old.target_type,old.target_id,old.template_id,new.template_id,CASE WHEN new.template_id=old.template_id THEN 1 ELSE 0 END,? FROM role_template_bindings_v4 old LEFT JOIN role_template_bindings_v15 new ON new.company_id=old.company_id AND new.target_type=old.target_type AND new.target_id=old.target_id AND new.pipeline_role='' ",
        )
        .run(now());
      const bindingSnapshotColumns = this.db
        .prepare("PRAGMA table_info(run_agent_binding_snapshots_v7)")
        .all() as Array<{ name: string }>;
      if (
        bindingSnapshotColumns.length &&
        !bindingSnapshotColumns.some((c) => c.name === "execution_snapshot_id")
      )
        this.db.exec(
          "ALTER TABLE run_agent_binding_snapshots_v7 ADD COLUMN execution_snapshot_id TEXT",
        );
      const migrationTime = now(),
        migration = this.db.prepare(
          "INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)",
        );
      migration.run(1500, migrationTime);
      migration.run(1900, migrationTime);
      migration.run(2000, migrationTime);
      migration.run(2100, migrationTime);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  createCompany(
    input: Omit<CompanyRecord, "mode" | "status"> & { mode?: CompanyMode },
    ownerId: string,
  ): CompanyRecord {
    if (
      !input.mandatoryReviews.length ||
      !input.mandatoryApprovals.length ||
      !input.allowedTools.length
    )
      throw new Error("Company policy minimums required");
    const mode: CompanyMode = input.mode ?? "live";
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO companies_v4(id,name,workspace_id,budget_limit,mandatory_reviews,mandatory_approvals,allowed_tools,created_at,mode,status) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          input.id,
          input.name,
          input.workspaceId,
          input.budgetLimit,
          json([...new Set(input.mandatoryReviews)].sort()),
          json([...new Set(input.mandatoryApprovals)].sort()),
          json([...new Set(input.allowedTools)].sort()),
          now(),
          mode,
          "active",
        );
      this.db
        .prepare(
          "INSERT INTO company_members_v4(company_id,principal_id,role,department_id,kind) VALUES(?,?,?,NULL,'human')",
        )
        .run(input.id, ownerId, "owner");
      this.db
        .prepare("INSERT INTO company_policy_versions_v4 VALUES(?,?,?,?,?,?,?)")
        .run(
          crypto.randomUUID(),
          input.id,
          1,
          json(input.mandatoryReviews),
          json(input.mandatoryApprovals),
          json(input.allowedTools),
          now(),
        );
      this.db.exec("COMMIT");
      return this.company(input.id)!;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  company(id: string): CompanyRecord | null {
    const x = this.db
      .prepare("SELECT * FROM companies_v4 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          name: String(x.name),
          workspaceId: String(x.workspace_id),
          budgetLimit: Number(x.budget_limit),
          mandatoryReviews: parse(x.mandatory_reviews),
          mandatoryApprovals: parse(x.mandatory_approvals),
          allowedTools: parse(x.allowed_tools),
          mode: (x.mode === null || x.mode === undefined
            ? "live"
            : String(x.mode)) as CompanyMode,
          status: (x.status === null || x.status === undefined
            ? "active"
            : String(x.status)) as "active" | "archived",
        }
      : null;
  }
  companiesForActor(
    actorId: string,
  ): Array<CompanyRecord & { role: CompanyRole; projectCount: number }> {
    return (
      this.db
        .prepare(
          "SELECT c.id,m.role,(SELECT COUNT(*) FROM company_projects_v4 cp WHERE cp.company_id=c.id) project_count FROM companies_v4 c JOIN company_members_v4 m ON m.company_id=c.id WHERE m.principal_id=? ORDER BY c.name,c.id",
        )
        .all(actorId) as Array<{
        id: string;
        role: CompanyRole;
        project_count: number;
      }>
    ).map((row) => ({
      ...this.company(row.id)!,
      role: row.role,
      projectCount: Number(row.project_count),
    }));
  }
  updateCompany(
    companyId: string,
    actorId: string,
    input: { name: string; budgetLimit: number; mode: CompanyMode },
  ): CompanyRecord {
    this.require(companyId, actorId, "manage-policy");
    const current = this.company(companyId);
    if (!current) throw new Error("Company missing");
    const maxDepartment = Number(
      (
        this.db
          .prepare(
            "SELECT COALESCE(MAX(budget_limit),0) n FROM departments_v4 WHERE company_id=?",
          )
          .get(companyId) as { n: number }
      ).n,
    );
    if (!input.name.trim()) throw new Error("Company name required");
    if (
      !Number.isFinite(input.budgetLimit) ||
      input.budgetLimit < maxDepartment
    )
      throw new Error("Company budget is below a department budget");
    this.db
      .prepare(
        "UPDATE companies_v4 SET name=?,budget_limit=?,mode=? WHERE id=?",
      )
      .run(input.name.trim(), input.budgetLimit, input.mode, companyId);
    this.audit(companyId, "COMPANY_UPDATED", {
      actorId,
      from: {
        name: current.name,
        budgetLimit: current.budgetLimit,
        mode: current.mode,
      },
      to: input,
    });
    return this.company(companyId)!;
  }
  setCompanyStatus(
    companyId: string,
    actorId: string,
    status: "active" | "archived",
  ): CompanyRecord {
    this.require(companyId, actorId, "manage-policy");
    const current = this.company(companyId);
    if (!current) throw new Error("Company missing");
    if (status === "archived") {
      const impact = this.companyDeletionImpact(companyId);
      if (impact.blockers.length)
        throw new Error(
          `Company archive blocked: ${impact.blockers.join(", ")}`,
        );
    }
    this.db
      .prepare("UPDATE companies_v4 SET status=? WHERE id=?")
      .run(status, companyId);
    this.audit(
      companyId,
      status === "archived" ? "COMPANY_ARCHIVED" : "COMPANY_RESTORED",
      { actorId },
    );
    return this.company(companyId)!;
  }
  role(companyId: string, principalId: string): CompanyRole | null {
    const x = this.db
      .prepare(
        "SELECT role FROM company_members_v4 WHERE company_id=? AND principal_id=?",
      )
      .get(companyId, principalId) as { role: string } | undefined;
    return x ? (x.role as CompanyRole) : null;
  }
  require(
    companyId: string,
    actorId: string,
    permission: "view" | "manage-org" | "manage-policy" | "brief",
  ): void {
    const role = this.role(companyId, actorId),
      ok =
        permission === "view"
          ? !!role
          : permission === "brief"
            ? ["owner", "executive"].includes(role ?? "")
            : permission === "manage-org"
              ? ["owner", "department-manager"].includes(role ?? "")
              : role === "owner";
    if (!ok) {
      this.audit(companyId, "COMPANY_AUTHORIZATION_DENIED", {
        actorId,
        permission,
        role,
      });
      throw new Error(`Company permission denied: ${permission}`);
    }
  }
  addMember(
    companyId: string,
    actorId: string,
    principalId: string,
    role: CompanyRole,
    departmentId: string | null,
    kind: "human" | "agent" = "agent",
  ): void {
    this.require(companyId, actorId, "manage-org");
    if (departmentId && this.department(departmentId)?.companyId !== companyId)
      throw new Error("Cross-company department blocked");
    this.db
      .prepare(
        "INSERT OR REPLACE INTO company_members_v4(company_id,principal_id,role,department_id,kind) VALUES(?,?,?,?,?)",
      )
      .run(companyId, principalId, role, departmentId, kind);
    this.audit(companyId, "COMPANY_MEMBER_SET", {
      actorId,
      principalId,
      role,
      departmentId,
      kind,
    });
  }
  members(companyId: string, actorId: string): CompanyMemberRecord[] {
    this.require(companyId, actorId, "view");
    return this.db
      .prepare(
        "SELECT company_id AS companyId,principal_id AS principalId,role,department_id AS departmentId,kind FROM company_members_v4 WHERE company_id=? ORDER BY principal_id",
      )
      .all(companyId) as unknown as CompanyMemberRecord[];
  }
  bootstrapDemo(principalId: string): unknown {
    if (!principalId) throw new Error("Demo principal required");
    const ids = {
        workspaceId: "demo-workspace",
        companyId: "demo-company",
        departmentId: "demo-studio",
        projectId: "demo-first-delivery",
        milestoneId: "demo-first-delivery-milestone",
        taskId: "demo-first-delivery-task",
      },
      ownerId = "demo-owner";
    if (
      !this.db
        .prepare("SELECT 1 FROM workspaces_v3 WHERE id=?")
        .get(ids.workspaceId)
    )
      this.projects.createWorkspace(ids.workspaceId, "Demo Workspace");
    if (!this.company(ids.companyId))
      this.createCompany(
        {
          id: ids.companyId,
          name: "Demo Company",
          workspaceId: ids.workspaceId,
          budgetLimit: 100,
          mandatoryReviews: ["security"],
          mandatoryApprovals: ["result"],
          allowedTools: ["build", "test", "lint", "security"],
          mode: "demo",
        },
        ownerId,
      );
    if (!this.department(ids.departmentId))
      this.createDepartment(
        {
          id: ids.departmentId,
          companyId: ids.companyId,
          parentId: null,
          name: "Delivery Studio",
          budgetLimit: 100,
        },
        ownerId,
      );
    for (const member of [
      { id: "demo-ceo", role: "executive" as const },
      { id: "demo-pm", role: "department-manager" as const },
      { id: "demo-developer", role: "member" as const },
      { id: "demo-qa", role: "member" as const },
    ])
      if (
        !this.db
          .prepare(
            "SELECT 1 FROM company_members_v4 WHERE company_id=? AND principal_id=?",
          )
          .get(ids.companyId, member.id)
      )
        this.addMember(
          ids.companyId,
          ownerId,
          member.id,
          member.role,
          ids.departmentId,
        );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(ids.companyId, principalId)
    )
      this.addMember(
        ids.companyId,
        ownerId,
        principalId,
        "owner",
        null,
        "human",
      );
    if (!this.projects.project(ids.projectId))
      this.projects.createProject(
        {
          id: ids.projectId,
          workspaceId: ids.workspaceId,
          name: "First Delivery",
          repoPath: ".",
          defaultBranch: "main",
          runtimePath: ".",
          organizationProfile: {
            mode: "demo",
            roles: ["ceo", "pm", "developer", "qa"],
          },
          budgetLimit: 20,
        },
        ownerId,
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM project_members_v3 WHERE project_id=? AND principal_id=?",
        )
        .get(ids.projectId, principalId)
    )
      this.projects.addMember(
        ids.projectId,
        { id: ownerId },
        principalId,
        "owner",
      );
    if (!this.projects.milestone(ids.milestoneId))
      this.projects.createMilestone(
        {
          id: ids.milestoneId,
          projectId: ids.projectId,
          title: "First playable delivery",
          status: "active",
          completionCriteria: [
            "Demo workflow reaches result approval",
            "Completion reward is emitted once",
          ],
          budgetLimit: 20,
          dueAt: null,
        },
        { id: ownerId },
      );
    if (!this.projects.task(ids.taskId))
      this.projects.createTask(
        {
          id: ids.taskId,
          projectId: ids.projectId,
          milestoneId: ids.milestoneId,
          title: "Deliver the first demo change",
          status: "ready",
          priority: 100,
          completionCriteria: [
            "Validation fails once and passes after revision",
            "Approved patch matches delivered patch",
          ],
          budgetLimit: 10,
        },
        { id: ownerId },
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM assignments_v3 WHERE task_id=? AND principal_id=? AND responsibility='executor'",
        )
        .get(ids.taskId, "demo-developer")
    )
      this.projects.assign(
        ids.taskId,
        { id: ownerId },
        "demo-developer",
        "agent",
        "executor",
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM assignments_v3 WHERE task_id=? AND principal_id=? AND responsibility='reviewer'",
        )
        .get(ids.taskId, "demo-qa")
    )
      this.projects.assign(
        ids.taskId,
        { id: ownerId },
        "demo-qa",
        "agent",
        "reviewer",
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM company_projects_v4 WHERE company_id=? AND project_id=?",
        )
        .get(ids.companyId, ids.projectId)
    )
      this.linkProject(
        ids.companyId,
        ids.departmentId,
        ids.projectId,
        100,
        ownerId,
      );
    let developer = this.roleTemplates(ids.companyId).find(
        (x) => x.logicalId === "default-developer",
      ),
      qa = this.roleTemplates(ids.companyId).find(
        (x) => x.logicalId === "default-qa",
      );
    if (!developer)
      developer = this.createRoleTemplate(
        {
          logicalId: "default-developer",
          companyId: ids.companyId,
          departmentId: ids.departmentId,
          name: "Default Developer",
          jobFamily: "engineering",
          responsibility:
            "Implement the approved scope with the smallest coherent change",
          completionCriteria: [
            "requested behavior works",
            "configured validation passes",
          ],
          requiredOutputs: [
            "scoped code changes",
            "validation evidence",
            "changed-file summary",
          ],
          prohibitedActions: [
            {
              action: "change files outside approved paths",
              enforcement: "deterministic-check",
            },
            {
              action: "weaken approval or validation policy",
              enforcement: "deterministic-check",
            },
          ],
          qualityChecklist: [
            "minimal change",
            "tests cover behavior",
            "no unrelated refactor",
          ],
          escalationConditions: [
            "scope ambiguity",
            "missing access",
            "unsafe validation",
          ],
          allowedTools: ["build", "test", "lint", "security"],
          requiredReviews: ["security"],
          requiredApprovals: ["result"],
        },
        ownerId,
      );
    if (!qa)
      qa = this.createRoleTemplate(
        {
          logicalId: "default-qa",
          companyId: ids.companyId,
          departmentId: ids.departmentId,
          name: "Default QA",
          jobFamily: "qa",
          responsibility:
            "Review requirements, actual diff, and validator evidence independently",
          completionCriteria: [
            "risks are evidence-linked",
            "failures include reproduction details",
          ],
          requiredOutputs: [
            "evidence-based review",
            "risk summary",
            "failure reproduction",
          ],
          prohibitedActions: [
            {
              action: "modify production code",
              enforcement: "deterministic-check",
            },
            {
              action: "approve without diff and validator evidence",
              enforcement: "prompt-only",
            },
          ],
          qualityChecklist: [
            "requirements traced",
            "diff reviewed",
            "validator results reviewed",
          ],
          escalationConditions: [
            "missing evidence",
            "security risk",
            "non-reproducible failure",
          ],
          allowedTools: ["test", "security"],
          requiredReviews: ["security"],
          requiredApprovals: ["result"],
        },
        ownerId,
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM role_template_bindings_v15 WHERE company_id=? AND target_type='task' AND target_id=? AND pipeline_role='worker'",
        )
        .get(ids.companyId, ids.taskId)
    )
      this.bindRoleTemplate(
        ids.companyId,
        developer.id,
        "task",
        ids.taskId,
        ownerId,
        "worker",
      );
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM role_template_bindings_v15 WHERE company_id=? AND target_type='task' AND target_id=? AND pipeline_role='reviewer'",
        )
        .get(ids.companyId, ids.taskId)
    )
      this.bindRoleTemplate(
        ids.companyId,
        qa.id,
        "task",
        ids.taskId,
        ownerId,
        "reviewer",
      );
    return {
      created: true,
      ids,
      company: this.company(ids.companyId),
      project: this.projects.project(ids.projectId),
      milestone: this.projects.milestone(ids.milestoneId),
      task: this.projects.task(ids.taskId),
      pixel: this.pixelState(ids.companyId, principalId),
    };
  }
  createDepartment(input: DepartmentRecord, actorId: string): DepartmentRecord {
    this.require(input.companyId, actorId, "manage-org");
    const company = this.company(input.companyId)!;
    if (input.budgetLimit > company.budgetLimit)
      throw new Error("Department budget exceeds company");
    if (
      input.parentId &&
      this.department(input.parentId)?.companyId !== input.companyId
    )
      throw new Error("Cross-company parent blocked");
    this.db
      .prepare("INSERT INTO departments_v4 VALUES(?,?,?,?,?,?)")
      .run(
        input.id,
        input.companyId,
        input.parentId,
        input.name,
        input.budgetLimit,
        now(),
      );
    this.audit(input.companyId, "DEPARTMENT_CREATED", {
      actorId,
      id: input.id,
    });
    return this.department(input.id)!;
  }
  department(id: string): DepartmentRecord | null {
    const x = this.db
      .prepare("SELECT * FROM departments_v4 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          companyId: String(x.company_id),
          parentId: x.parent_id === null ? null : String(x.parent_id),
          name: String(x.name),
          budgetLimit: Number(x.budget_limit),
        }
      : null;
  }
  moveDepartment(id: string, parentId: string | null, actorId: string): void {
    const dept = this.department(id);
    if (!dept) throw new Error("Department missing");
    this.require(dept.companyId, actorId, "manage-org");
    if (parentId) {
      const parent = this.department(parentId);
      if (!parent || parent.companyId !== dept.companyId)
        throw new Error("Cross-company parent blocked");
      const cycle = this.db
        .prepare(
          "WITH RECURSIVE ancestors(id) AS (VALUES(?) UNION SELECT d.parent_id FROM departments_v4 d JOIN ancestors a ON d.id=a.id WHERE d.parent_id IS NOT NULL) SELECT 1 FROM ancestors WHERE id=?",
        )
        .get(parentId, id);
      if (cycle) throw new Error("Organization cycle blocked");
    }
    this.db
      .prepare("UPDATE departments_v4 SET parent_id=? WHERE id=?")
      .run(parentId, id);
    this.audit(dept.companyId, "DEPARTMENT_MOVED", { actorId, id, parentId });
  }
  setDepartmentBudget(
    id: string,
    limit: number,
    actorId: string,
  ): DepartmentRecord {
    const dept = this.department(id);
    if (!dept) throw new Error("Department missing");
    this.require(dept.companyId, actorId, "manage-policy");
    const company = this.company(dept.companyId)!,
      maxProject = Number(
        (
          this.db
            .prepare(
              "SELECT COALESCE(MAX(p.budget_limit),0) n FROM company_projects_v4 cp JOIN projects_v3 p ON p.id=cp.project_id WHERE cp.department_id=?",
            )
            .get(id) as { n: number }
        ).n,
      );
    if (limit > company.budgetLimit || limit < maxProject)
      throw new Error("Department budget violates company/project limits");
    this.db
      .prepare("UPDATE departments_v4 SET budget_limit=? WHERE id=?")
      .run(limit, id);
    this.audit(dept.companyId, "DEPARTMENT_BUDGET_CHANGED", {
      actorId,
      id,
      from: dept.budgetLimit,
      to: limit,
    });
    return this.department(id)!;
  }
  linkProject(
    companyId: string,
    departmentId: string,
    projectId: string,
    priority: number,
    actorId: string,
  ): void {
    this.require(companyId, actorId, "manage-org");
    if (this.department(departmentId)?.companyId !== companyId)
      throw new Error("Cross-company department blocked");
    if (!this.projects.project(projectId)) throw new Error("Project missing");
    const dept = this.department(departmentId)!;
    if (this.projects.project(projectId)!.budgetLimit > dept.budgetLimit)
      throw new Error("Project budget exceeds department");
    this.db
      .prepare("INSERT INTO company_projects_v4 VALUES(?,?,?,?)")
      .run(companyId, departmentId, projectId, priority);
    if (
      this.db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='events_v6'",
        )
        .get()
    ) {
      this.db
        .prepare(
          "INSERT OR IGNORE INTO events_v6(event_id,version,tenant_id,aggregate_type,aggregate_id,type,payload,created_at) SELECT 'project:'||seq,'1.0',?,'project',project_id,type,payload,created_at FROM project_audit_v3 WHERE project_id=? ORDER BY seq",
        )
        .run(companyId, projectId);
      this.db
        .prepare(
          "INSERT OR IGNORE INTO events_v6(event_id,version,tenant_id,aggregate_type,aggregate_id,type,payload,created_at) SELECT 'run:'||a.seq,'1.0',?,'run',a.run_id,a.type,a.payload,a.created_at FROM audit_events a JOIN board_tasks_v3 t ON t.run_id=a.run_id WHERE t.project_id=? ORDER BY a.seq",
        )
        .run(companyId, projectId);
    }
    this.audit(companyId, "PROJECT_LINKED", {
      actorId,
      departmentId,
      projectId,
      priority,
    });
  }
  setProjectPriority(
    companyId: string,
    projectId: string,
    priority: number,
    actorId: string,
  ): void {
    this.require(companyId, actorId, "manage-policy");
    if (
      this.db
        .prepare(
          "UPDATE company_projects_v4 SET priority=? WHERE company_id=? AND project_id=?",
        )
        .run(priority, companyId, projectId).changes !== 1
    )
      throw new Error("Company project link missing");
    this.audit(companyId, "PROJECT_PRIORITY_CHANGED", {
      actorId,
      projectId,
      priority,
    });
  }
  createRoleTemplate(
    input: Omit<
      RoleTemplateRecord,
      | "id"
      | "version"
      | "parentVersionId"
      | "createdAt"
      | "jobFamily"
      | "requiredOutputs"
      | "prohibitedActions"
      | "qualityChecklist"
      | "escalationConditions"
    > &
      Partial<
        Pick<
          RoleTemplateRecord,
          | "jobFamily"
          | "requiredOutputs"
          | "prohibitedActions"
          | "qualityChecklist"
          | "escalationConditions"
        >
      >,
    actorId: string,
  ): RoleTemplateRecord {
    this.require(input.companyId, actorId, "manage-policy");
    const company = this.company(input.companyId)!;
    if (
      input.departmentId &&
      this.department(input.departmentId)?.companyId !== input.companyId
    )
      this.policyDenied(
        input.companyId,
        actorId,
        "cross-company-template",
        "Cross-company template blocked",
      );
    if (
      company.mandatoryReviews.some(
        (x) => !input.requiredReviews.includes(x),
      ) ||
      company.mandatoryApprovals.some(
        (x) => !input.requiredApprovals.includes(x),
      )
    )
      this.policyDenied(
        input.companyId,
        actorId,
        "governance-removal",
        "Required governance cannot be removed",
      );
    if (input.allowedTools.some((x) => !company.allowedTools.includes(x)))
      this.policyDenied(
        input.companyId,
        actorId,
        "tool-escalation",
        "Tool permission escalation blocked",
      );
    if (!input.completionCriteria.length)
      this.policyDenied(
        input.companyId,
        actorId,
        "missing-completion-criteria",
        "Completion criteria required",
      );
    const jobFamily =
        input.jobFamily ??
        (/qa|quality|review|test/i.test(`${input.logicalId} ${input.name}`)
          ? "qa"
          : /plan|owner/i.test(`${input.logicalId} ${input.name}`)
            ? "planning"
            : "engineering"),
      defaults =
        jobFamily === "qa"
          ? {
              requiredOutputs: [
                "evidence-based review",
                "reproduction details for failures",
                "risk summary",
              ],
              prohibitedActions: [
                {
                  action: "modify production code",
                  enforcement: "deterministic-check" as const,
                },
                {
                  action: "approve without validator and diff evidence",
                  enforcement: "prompt-only" as const,
                },
              ],
              qualityChecklist: [
                "requirements traced to evidence",
                "diff reviewed",
                "validator results reviewed",
              ],
              escalationConditions: [
                "missing evidence",
                "security or data-loss risk",
                "non-reproducible failure",
              ],
            }
          : {
              requiredOutputs: [
                "minimal scoped implementation",
                "validation evidence",
                "changed-file summary",
              ],
              prohibitedActions: [
                {
                  action: "change files outside approved paths",
                  enforcement: "deterministic-check" as const,
                },
                {
                  action: "weaken approval, budget, or validation policy",
                  enforcement: "deterministic-check" as const,
                },
              ],
              qualityChecklist: [
                "requested behavior implemented",
                "tests updated where required",
                "validation commands pass",
              ],
              escalationConditions: [
                "scope is ambiguous",
                "required access is unavailable",
                "safe validation cannot be completed",
              ],
            },
      profile = {
        ...input,
        jobFamily,
        requiredOutputs: input.requiredOutputs ?? defaults.requiredOutputs,
        prohibitedActions:
          input.prohibitedActions ?? defaults.prohibitedActions,
        qualityChecklist: input.qualityChecklist ?? defaults.qualityChecklist,
        escalationConditions:
          input.escalationConditions ?? defaults.escalationConditions,
      },
      latest = this.db
        .prepare(
          "SELECT id,version FROM role_templates_v15 WHERE company_id=? AND logical_id=? ORDER BY version DESC LIMIT 1",
        )
        .get(input.companyId, input.logicalId) as
        | { id: string; version: number }
        | undefined,
      id = crypto.randomUUID(),
      version = (latest?.version ?? 0) + 1,
      createdAt = now();
    this.db
      .prepare(
        "INSERT INTO role_templates_v15(id,logical_id,version,parent_version_id,company_id,department_id,name,job_family,responsibility,completion_criteria,required_outputs,prohibited_actions,quality_checklist,escalation_conditions,allowed_tools,required_reviews,required_approvals,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        profile.logicalId,
        version,
        latest?.id ?? null,
        profile.companyId,
        profile.departmentId,
        profile.name,
        profile.jobFamily,
        profile.responsibility,
        json(profile.completionCriteria),
        json(profile.requiredOutputs),
        json(profile.prohibitedActions),
        json(profile.qualityChecklist),
        json(profile.escalationConditions),
        json(profile.allowedTools),
        json(profile.requiredReviews),
        json(profile.requiredApprovals),
        createdAt,
      );
    this.audit(input.companyId, "ROLE_TEMPLATE_VERSIONED", {
      actorId,
      id,
      logicalId: input.logicalId,
      version,
      jobFamily,
      profileHash: sha(stable(profile)),
    });
    return {
      id,
      ...profile,
      version,
      parentVersionId: latest?.id ?? null,
      createdAt,
    };
  }
  roleTemplates(companyId: string): RoleTemplateRecord[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM role_templates_v15 WHERE company_id=? ORDER BY logical_id,version",
        )
        .all(companyId) as Record<string, unknown>[]
    ).map((x) => ({
      id: String(x.id),
      logicalId: String(x.logical_id),
      version: Number(x.version),
      parentVersionId:
        x.parent_version_id === null ? null : String(x.parent_version_id),
      companyId: String(x.company_id),
      departmentId: x.department_id === null ? null : String(x.department_id),
      name: String(x.name),
      jobFamily: String(x.job_family ?? "operations") as JobFamily,
      responsibility: String(x.responsibility),
      completionCriteria: parse(x.completion_criteria),
      requiredOutputs: parse(x.required_outputs ?? "[]"),
      prohibitedActions: parse(x.prohibited_actions ?? "[]"),
      qualityChecklist: parse(x.quality_checklist ?? "[]"),
      escalationConditions: parse(x.escalation_conditions ?? "[]"),
      allowedTools: parse(x.allowed_tools),
      requiredReviews: parse(x.required_reviews),
      requiredApprovals: parse(x.required_approvals),
      createdAt: String(x.created_at),
    }));
  }
  bindRoleTemplate(
    companyId: string,
    templateId: string,
    targetType: "company" | "project" | "task",
    targetId: string,
    actorId: string,
    pipelineRole: CompanyPipelineRole | null = null,
  ): void {
    this.require(companyId, actorId, "manage-policy");
    const template = this.db
      .prepare(
        "SELECT company_id,department_id FROM role_templates_v15 WHERE id=?",
      )
      .get(templateId) as
      | { company_id: string; department_id: string | null }
      | undefined;
    if (!template || template.company_id !== companyId)
      throw new Error("Cross-company template blocked");
    if (targetType === "company") {
      if (targetId !== companyId)
        throw new Error("Company binding target mismatch");
    } else {
      const projectId =
          targetType === "project"
            ? targetId
            : String(
                (
                  this.db
                    .prepare("SELECT project_id FROM board_tasks_v3 WHERE id=?")
                    .get(targetId) as { project_id: string } | undefined
                )?.project_id ?? "",
              ),
        link = this.db
          .prepare(
            "SELECT department_id FROM company_projects_v4 WHERE company_id=? AND project_id=?",
          )
          .get(companyId, projectId) as { department_id: string } | undefined;
      if (!link) throw new Error("Template target is outside company");
      if (
        !pipelineRole &&
        template.department_id &&
        template.department_id !== link.department_id
      )
        throw new Error("Template department mismatch");
    }
    const role = pipelineRole ?? "";
    this.db
      .prepare(
        "INSERT INTO role_template_bindings_v15(template_id,target_type,target_id,company_id,pipeline_role,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(company_id,target_type,target_id,pipeline_role) DO UPDATE SET template_id=excluded.template_id,created_at=excluded.created_at",
      )
      .run(templateId, targetType, targetId, companyId, role, now());
    this.audit(companyId, "ROLE_TEMPLATE_BOUND", {
      actorId,
      templateId,
      targetType,
      targetId,
      pipelineRole,
    });
  }
  setPrimaryAssignment(
    companyId: string,
    taskId: string,
    responsibility: "owner" | "executor" | "reviewer",
    principalId: string,
    actorId: string,
  ): void {
    this.require(companyId, actorId, "manage-org");
    const task = this.db
      .prepare(
        "SELECT cp.company_id FROM board_tasks_v3 t JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE t.id=?",
      )
      .get(taskId) as { company_id: string } | undefined;
    if (!task || task.company_id !== companyId)
      throw new Error("Primary assignment target is outside company");
    const assignment = this.db
      .prepare(
        "SELECT 1 FROM assignments_v3 WHERE task_id=? AND principal_id=? AND responsibility=? AND kind='agent'",
      )
      .get(taskId, principalId, responsibility);
    if (!assignment || !this.role(companyId, principalId))
      throw new Error(
        "Primary assignment must reference a company Agent assignment",
      );
    this.db
      .prepare(
        "INSERT INTO task_role_primaries_v15 VALUES(?,?,?,?,?) ON CONFLICT(task_id,responsibility) DO UPDATE SET principal_id=excluded.principal_id,selected_by=excluded.selected_by,selected_at=excluded.selected_at",
      )
      .run(taskId, principalId, responsibility, actorId, now());
    this.audit(companyId, "TASK_ROLE_PRIMARY_SELECTED", {
      actorId,
      taskId,
      responsibility,
      principalId,
    });
  }
  roleBindings(companyId: string): unknown[] {
    return (
      this.db
        .prepare(
          "SELECT template_id AS templateId,target_type AS targetType,target_id AS targetId,pipeline_role AS pipelineRole,created_at AS createdAt FROM role_template_bindings_v15 WHERE company_id=? ORDER BY target_type,target_id,pipeline_role",
        )
        .all(companyId) as Array<Record<string, unknown>>
    ).map((x) => ({
      ...x,
      pipelineRole: x.pipelineRole === "" ? null : x.pipelineRole,
    }));
  }
  governanceForRun(
    runId: string,
    pipelineRole: CompanyPipelineRole = "worker",
  ): {
    companyId: string;
    requiredReviews: string[];
    requiredApprovals: string[];
    allowedTools: string[];
    templateId: string | null;
    profile: ResolvedRoleProfile;
  } | null {
    const profile = this.roleProfileForRun(runId, pipelineRole);
    if (!profile) return null;
    const company = this.company(profile.companyId)!;
    return {
      companyId: profile.companyId,
      requiredReviews: [
        ...new Set([...profile.requiredReviews, ...company.mandatoryReviews]),
      ].sort(),
      requiredApprovals: [
        ...new Set([
          ...profile.requiredApprovals,
          ...company.mandatoryApprovals,
        ]),
      ].sort(),
      allowedTools: profile.allowedTools
        .filter((x) => company.allowedTools.includes(x))
        .sort(),
      templateId: profile.templateId,
      profile,
    };
  }
  roleProfileForRun(
    runId: string,
    pipelineRole: CompanyPipelineRole,
  ): ResolvedRoleProfile | null {
    const snapshot = this.db
      .prepare(
        "SELECT profile FROM run_role_profile_snapshots_v15 s JOIN run_execution_snapshots_v15 e ON e.id=s.execution_snapshot_id WHERE s.run_id=? AND s.pipeline_role=? AND e.status='complete'",
      )
      .get(runId, pipelineRole) as { profile: string } | undefined;
    return snapshot
      ? parse(snapshot.profile)
      : this.resolveRoleProfile(runId, pipelineRole);
  }
  executionSnapshotId(runId: string): string | null {
    const row = this.db
      .prepare(
        "SELECT id FROM run_execution_snapshots_v15 WHERE run_id=? AND status='complete'",
      )
      .get(runId) as { id: string } | undefined;
    return row?.id ?? null;
  }
  roleProfilesForActor(runId: string, actorId: string): ResolvedRoleProfile[] {
    const context = this.runContext(runId);
    if (!context) throw new Error("Run is not linked to a company");
    this.require(context.companyId, actorId, "view");
    return (["planner", "worker", "reviewer"] as CompanyPipelineRole[])
      .map((role) => this.roleProfileForRun(runId, role))
      .filter((x): x is ResolvedRoleProfile => x !== null);
  }
  prepareExecutionSnapshot(
    runId: string,
    executionSnapshotId: string,
  ): string | null {
    const context = this.runContext(runId);
    if (!context) return null;
    const existing = this.db
      .prepare(
        "SELECT id,status FROM run_execution_snapshots_v15 WHERE run_id=?",
      )
      .get(runId) as { id: string; status: string } | undefined;
    if (existing) {
      if (existing.id !== executionSnapshotId)
        throw new Error("Run execution snapshot identity mismatch");
      return existing.id;
    }
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO run_execution_snapshots_v15 VALUES(?,?,?,'preparing',?,NULL)",
      )
      .run(executionSnapshotId, runId, context.companyId, timestamp);
    for (const role of [
      "planner",
      "worker",
      "reviewer",
    ] as CompanyPipelineRole[]) {
      const live = this.resolveRoleProfile(runId, role);
      if (!live) throw new Error(`Role profile context missing: ${role}`);
      const profile = { ...live, executionSnapshotId },
        profileHash = sha(stable({ ...profile, profileHash: undefined })),
        frozen = { ...profile, profileHash };
      this.db
        .prepare(
          "INSERT INTO run_role_profile_snapshots_v15(execution_snapshot_id,run_id,pipeline_role,template_id,profile,profile_hash,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          executionSnapshotId,
          runId,
          role,
          frozen.templateId,
          json(frozen),
          profileHash,
          timestamp,
        );
    }
    return executionSnapshotId;
  }
  completeExecutionSnapshot(runId: string, executionSnapshotId: string): void {
    const count = Number(
      (
        this.db
          .prepare(
            "SELECT COUNT(*) n FROM run_role_profile_snapshots_v15 WHERE run_id=? AND execution_snapshot_id=?",
          )
          .get(runId, executionSnapshotId) as { n: number }
      ).n,
    );
    if (count !== 3) throw new Error("Incomplete role profile snapshot set");
    this.db
      .prepare(
        "UPDATE run_execution_snapshots_v15 SET status='complete',completed_at=? WHERE run_id=? AND id=?",
      )
      .run(now(), runId, executionSnapshotId);
  }
  startPlanningInExecutionSnapshot(
    runId: string,
    executionSnapshotId: string,
  ): void {
    const snapshot = this.db
      .prepare(
        "SELECT status FROM run_execution_snapshots_v15 WHERE id=? AND run_id=?",
      )
      .get(executionSnapshotId, runId) as { status: string } | undefined;
    if (snapshot?.status !== "complete")
      throw new Error("Complete execution snapshot required before PLANNING");
    const run = this.state.getRun(runId);
    if (!run) throw new Error("Run missing");
    if (run.status === "PLANNING") return;
    if (
      run.status !== "CREATED" ||
      !this.state.transition(runId, ["CREATED"], "PLANNING", {
        ...(run.checkpoint ?? {}),
        executionSnapshotId,
      })
    )
      throw new Error("Run must be CREATED at execution freeze");
    this.state.audit(runId, "RUN_TRANSITIONED", {
      from: "CREATED",
      to: "PLANNING",
      checkpoint: { ...(run.checkpoint ?? {}), executionSnapshotId },
    });
  }
  freezeRunExecution(runId: string): string | null {
    const existing = this.executionSnapshotId(runId);
    if (existing) {
      this.startPlanningInExecutionSnapshot(runId, existing);
      return existing;
    }
    const id = crypto.randomUUID();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const prepared = this.prepareExecutionSnapshot(runId, id);
      if (!prepared) {
        this.db.exec("ROLLBACK");
        return null;
      }
      this.completeExecutionSnapshot(runId, id);
      this.startPlanningInExecutionSnapshot(runId, id);
      const context = this.runContext(runId)!;
      this.audit(context.companyId, "RUN_EXECUTION_SNAPSHOTTED", {
        runId,
        executionSnapshotId: id,
        roles: ["planner", "worker", "reviewer"],
      });
      this.db.exec("COMMIT");
      return id;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  updatePolicy(
    companyId: string,
    actorId: string,
    input: {
      mandatoryReviews: string[];
      mandatoryApprovals: string[];
      allowedTools: string[];
    },
  ): void {
    this.require(companyId, actorId, "manage-policy");
    const current = this.company(companyId)!;
    if (
      current.mandatoryReviews.some(
        (x) => !input.mandatoryReviews.includes(x),
      ) ||
      current.mandatoryApprovals.some(
        (x) => !input.mandatoryApprovals.includes(x),
      )
    )
      this.policyDenied(
        companyId,
        actorId,
        "governance-weakening",
        "Company governance minimum cannot be weakened",
      );
    const version = Number(
      (
        this.db
          .prepare(
            "SELECT COALESCE(MAX(version),0)+1 AS n FROM company_policy_versions_v4 WHERE company_id=?",
          )
          .get(companyId) as { n: number }
      ).n,
    );
    this.db
      .prepare(
        "UPDATE companies_v4 SET mandatory_reviews=?,mandatory_approvals=?,allowed_tools=? WHERE id=?",
      )
      .run(
        json(input.mandatoryReviews),
        json(input.mandatoryApprovals),
        json(input.allowedTools),
        companyId,
      );
    this.db
      .prepare("INSERT INTO company_policy_versions_v4 VALUES(?,?,?,?,?,?,?)")
      .run(
        crypto.randomUUID(),
        companyId,
        version,
        json(input.mandatoryReviews),
        json(input.mandatoryApprovals),
        json(input.allowedTools),
        now(),
      );
    this.audit(companyId, "COMPANY_POLICY_VERSIONED", { actorId, version });
  }
  portfolio(companyId: string, actorId: string): Record<string, unknown> {
    this.require(companyId, actorId, "view");
    const company = this.company(companyId)!;
    const links = this.db
      .prepare(
        "SELECT * FROM company_projects_v4 WHERE company_id=? ORDER BY priority DESC,project_id",
      )
      .all(companyId) as Array<{
      department_id: string;
      project_id: string;
      priority: number;
    }>;
    const departments = (
      this.db
        .prepare("SELECT id FROM departments_v4 WHERE company_id=? ORDER BY id")
        .all(companyId) as Array<{ id: string }>
    ).map((x) => this.department(x.id)!);
    const projects = links.map((link) => {
      const snapshot = this.projects.snapshot(link.project_id, {
        id: this.projectViewer(link.project_id),
      }) as any;
      const tasks = snapshot.tasks as any[];
      return {
        departmentId: link.department_id,
        priority: link.priority,
        project: snapshot.project,
        progress: snapshot.progress,
        milestones: snapshot.milestones,
        tasks,
        risks: {
          blocked: tasks.filter(
            (x) => x.status === "blocked" || x.run?.status === "BLOCKED",
          ).length,
          stale: tasks.reduce((n, x) => n + x.stale.length, 0),
          conflicts: tasks.reduce(
            (n, x) =>
              n + x.mergeAssessments.filter((a: any) => a.conflict).length,
            0,
          ),
          approvals: tasks.reduce(
            (n, x) =>
              n + x.approvals.filter((a: any) => a.status === "PENDING").length,
            0,
          ),
        },
      };
    });
    const facts = {
      company,
      departments,
      projects,
      totals: {
        projects: projects.length,
        tasks: projects.reduce((n, p) => n + p.progress.total, 0),
        done: projects.reduce((n, p) => n + p.progress.done, 0),
        spent: projects.reduce((n, p) => n + Number(p.project.spent), 0),
        budget: projects.reduce((n, p) => n + Number(p.project.budgetLimit), 0),
        blocked: projects.reduce((n, p) => n + p.risks.blocked, 0),
        stale: projects.reduce((n, p) => n + p.risks.stale, 0),
        conflicts: projects.reduce((n, p) => n + p.risks.conflicts, 0),
        approvals: projects.reduce((n, p) => n + p.risks.approvals, 0),
      },
    };
    return {
      ...facts,
      snapshotHash: sha(stable(facts)),
      provenance: links.map((x) => `project:${x.project_id}`),
    };
  }
  private projectViewer(projectId: string): string {
    const x = this.db
      .prepare(
        "SELECT principal_id FROM project_members_v3 WHERE project_id=? AND role IN ('owner','viewer') ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1",
      )
      .get(projectId) as { principal_id: string } | undefined;
    if (!x) throw new Error("Linked project has no readable principal");
    return x.principal_id;
  }
  addReview(
    input: Omit<ReviewInput, "id" | "contentHash" | "createdAt">,
    actorId: string,
  ): ReviewInput {
    this.require(input.companyId, actorId, "view");
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM company_projects_v4 WHERE company_id=? AND project_id=?",
        )
        .get(input.companyId, input.projectId)
    )
      throw new Error("Cross-company review blocked");
    if (this.projects.projectForRun(input.runId) !== input.projectId)
      throw new Error("Review run is not linked to project");
    if (!input.evidenceIds.length)
      throw new Error("Review provenance required");
    for (const id of input.evidenceIds) {
      const artifact = this.state.artifactVersion(id);
      if (!artifact || artifact.runId !== input.runId)
        throw new Error("Review evidence missing");
      if (artifact.stale) throw new Error("Stale review evidence blocked");
    }
    const contentHash = sha(
        stable({
          projectId: input.projectId,
          runId: input.runId,
          reviewerId: input.reviewerId,
          verdict: input.verdict,
          risks: [...new Set(input.risks)].sort(),
          evidenceIds: [...input.evidenceIds].sort(),
          summary: input.summary,
        }),
      ),
      record = {
        ...input,
        id: crypto.randomUUID(),
        contentHash,
        createdAt: now(),
      };
    this.db
      .prepare("INSERT INTO review_inputs_v4 VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        record.id,
        record.companyId,
        record.projectId,
        record.runId,
        record.reviewerId,
        record.verdict,
        json(record.risks),
        json(record.evidenceIds),
        record.summary,
        record.contentHash,
        record.createdAt,
      );
    this.audit(input.companyId, "REVIEW_ADDED", {
      actorId,
      id: record.id,
      projectId: record.projectId,
    });
    return record;
  }
  private review(id: string): ReviewInput | null {
    const x = this.db
      .prepare("SELECT * FROM review_inputs_v4 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          companyId: String(x.company_id),
          projectId: String(x.project_id),
          runId: String(x.run_id),
          reviewerId: String(x.reviewer_id),
          verdict: String(x.verdict) as ReviewInput["verdict"],
          risks: parse(x.risks),
          evidenceIds: parse(x.evidence_ids),
          summary: String(x.summary),
          contentHash: String(x.content_hash),
          createdAt: String(x.created_at),
        }
      : null;
  }
  aggregateReviews(
    companyId: string,
    projectId: string,
    actorId: string,
  ): ReviewMeeting {
    this.require(companyId, actorId, "brief");
    const inputs = (
      this.db
        .prepare(
          "SELECT id FROM review_inputs_v4 WHERE company_id=? AND project_id=? ORDER BY content_hash,id",
        )
        .all(companyId, projectId) as Array<{ id: string }>
    ).map((x) => this.review(x.id)!);
    if (!inputs.length) throw new Error("Review inputs missing");
    const groups = new Map<string, string[]>();
    for (const input of inputs) {
      const key = sha(
        stable({
          verdict: input.verdict,
          risks: [...input.risks].sort(),
          summary: input.summary,
        }),
      );
      groups.set(key, [...(groups.get(key) ?? []), input.id]);
    }
    const duplicates = [...groups.values()]
        .filter((x) => x.length > 1)
        .flatMap((x) => x.slice(1))
        .sort(),
      verdicts = [...new Set(inputs.map((x) => x.verdict))],
      conflicts =
        verdicts.length > 1 ? verdicts.sort().map((x) => `verdict:${x}`) : [],
      unresolvedRisks = [
        ...new Set(
          inputs.filter((x) => x.verdict !== "approve").flatMap((x) => x.risks),
        ),
      ].sort(),
      recommendation = inputs.some((x) => x.verdict === "reject")
        ? "reject"
        : inputs.some((x) => x.verdict === "needs-work")
          ? "needs-work"
          : "approve",
      provenance = [
        ...new Set(inputs.flatMap((x) => [x.id, ...x.evidenceIds])),
      ].sort(),
      body = {
        companyId,
        projectId,
        inputIds: inputs.map((x) => x.id),
        duplicates,
        conflicts,
        unresolvedRisks,
        recommendation,
        provenance,
      },
      record = {
        ...body,
        id: crypto.randomUUID(),
        snapshotHash: sha(stable(body)),
        createdAt: now(),
      } as ReviewMeeting;
    this.db
      .prepare("INSERT INTO review_meetings_v4 VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        record.id,
        companyId,
        projectId,
        json(record.inputIds),
        json(record.duplicates),
        json(record.conflicts),
        json(record.unresolvedRisks),
        record.recommendation,
        json(record.provenance),
        record.snapshotHash,
        record.createdAt,
      );
    this.audit(companyId, "REVIEW_AGGREGATED", {
      actorId,
      id: record.id,
      recommendation,
    });
    return record;
  }
  meetings(companyId: string): ReviewMeeting[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM review_meetings_v4 WHERE company_id=? ORDER BY created_at,id",
        )
        .all(companyId) as Record<string, unknown>[]
    ).map((x) => ({
      id: String(x.id),
      companyId: String(x.company_id),
      projectId: String(x.project_id),
      inputIds: parse(x.input_ids),
      duplicates: parse(x.duplicates),
      conflicts: parse(x.conflicts),
      unresolvedRisks: parse(x.unresolved_risks),
      recommendation: String(
        x.recommendation,
      ) as ReviewMeeting["recommendation"],
      provenance: parse(x.provenance),
      snapshotHash: String(x.snapshot_hash),
      createdAt: String(x.created_at),
    }));
  }
  createBriefing(companyId: string, actorId: string): Briefing {
    this.require(companyId, actorId, "brief");
    const portfolio = this.portfolio(companyId, actorId),
      meetings = this.meetings(companyId),
      totals = portfolio.totals as any,
      risks = [...new Set(meetings.flatMap((x) => x.unresolvedRisks))].sort(),
      facts = {
        totals,
        portfolioHash: portfolio.snapshotHash,
        review: {
          meetings: meetings.length,
          conflicts: meetings.reduce((n, x) => n + x.conflicts.length, 0),
          unresolvedRisks: risks,
        },
      },
      decisions = [
        ...(totals.approvals
          ? [`Resolve ${totals.approvals} pending approvals`]
          : []),
        ...(totals.conflicts || risks.length
          ? ["Resolve merge or review risks"]
          : []),
      ],
      nextActions = [
        ...(totals.blocked ? ["Unblock blocked work"] : []),
        ...(totals.stale ? ["Revalidate stale artifacts"] : []),
        ...(decisions.length
          ? decisions
          : ["Continue approved portfolio plan"]),
      ],
      provenance = [
        String(portfolio.snapshotHash),
        ...meetings.map((x) => x.id),
      ].sort(),
      body = {
        companyId,
        portfolioHash: String(portfolio.snapshotHash),
        meetingIds: meetings.map((x) => x.id),
        facts,
        decisions,
        nextActions,
        provenance,
      },
      record = {
        ...body,
        id: crypto.randomUUID(),
        briefingHash: sha(stable(body)),
        createdAt: now(),
      };
    this.db
      .prepare("INSERT INTO ceo_briefings_v4 VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        record.id,
        companyId,
        record.portfolioHash,
        json(record.meetingIds),
        json(record.facts),
        json(record.decisions),
        json(record.nextActions),
        json(record.provenance),
        record.briefingHash,
        record.createdAt,
      );
    this.audit(companyId, "CEO_BRIEFING_CREATED", {
      actorId,
      id: record.id,
      briefingHash: record.briefingHash,
    });
    return record;
  }
  recommendAssignments(companyId: string, actorId: string): unknown[] {
    this.require(companyId, actorId, "view");
    const rows = this.db
      .prepare(
        `WITH candidates AS (SELECT cp.priority,p.id project_id,t.id task_id,t.title,t.budget_limit,t.spent,cp.department_id,COALESCE((SELECT template_id FROM role_template_bindings_v15 WHERE company_id=cp.company_id AND target_type='task' AND target_id=t.id AND pipeline_role='worker'),(SELECT template_id FROM role_template_bindings_v15 WHERE company_id=cp.company_id AND target_type='project' AND target_id=p.id AND pipeline_role='worker'),(SELECT template_id FROM role_template_bindings_v15 WHERE company_id=cp.company_id AND target_type='task' AND target_id=t.id AND pipeline_role=''),(SELECT template_id FROM role_template_bindings_v15 WHERE company_id=cp.company_id AND target_type='project' AND target_id=p.id AND pipeline_role='')) template_id FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id JOIN projects_v3 p ON p.id=cp.project_id WHERE cp.company_id=? AND t.status='ready' AND t.lease_owner IS NULL AND t.spent<t.budget_limit AND NOT EXISTS(SELECT 1 FROM board_dependencies_v3 d JOIN board_tasks_v3 x ON x.id=d.depends_on_id WHERE d.task_id=t.id AND x.status<>'done')) SELECT * FROM candidates WHERE template_id IS NOT NULL ORDER BY priority DESC,task_id`,
      )
      .all(companyId) as Array<Record<string, unknown>>;
    const company = this.company(companyId)!,
      templates = new Map(this.roleTemplates(companyId).map((x) => [x.id, x]));
    return rows.flatMap((x) => {
      const departmentId = String(x.department_id),
        template = templates.get(String(x.template_id));
      if (
        !template ||
        company.mandatoryReviews.some(
          (r) => !template.requiredReviews.includes(r),
        ) ||
        company.mandatoryApprovals.some(
          (a) => !template.requiredApprovals.includes(a),
        ) ||
        template.allowedTools.some(
          (tool) => !company.allowedTools.includes(tool),
        )
      )
        return [];
      const agent = this.db
        .prepare(
          "SELECT principal_id FROM company_members_v4 WHERE company_id=? AND department_id=? AND role='member' ORDER BY principal_id LIMIT 1",
        )
        .get(companyId, departmentId) as { principal_id: string } | undefined;
      return agent
        ? [
            {
              projectId: x.project_id,
              taskId: x.task_id,
              departmentId,
              templateId: x.template_id,
              suggestedAgent: agent.principal_id,
              reason:
                "priority,valid-template,department,deps-done,lease-free,budget-available",
              requiresApproval: true,
            },
          ]
        : [];
    });
  }
  pixelState(companyId: string, actorId: string): Record<string, unknown> {
    this.require(companyId, actorId, "view");
    const departments = this.db
        .prepare(
          "SELECT id,name,parent_id FROM departments_v4 WHERE company_id=? ORDER BY id",
        )
        .all(companyId) as Array<Record<string, unknown>>,
      agents = this.db
        .prepare(
          "SELECT principal_id,department_id,role,kind FROM company_members_v4 WHERE company_id=? ORDER BY principal_id",
        )
        .all(companyId) as Array<Record<string, unknown>>,
      tasks = this.db
        .prepare(
          "SELECT t.id,t.status,cp.department_id,t.lease_owner FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id WHERE cp.company_id=? ORDER BY t.id",
        )
        .all(companyId) as Array<Record<string, unknown>>,
      body = {
        companyId,
        departments: departments.map((x, i) => ({
          ...x,
          x: (i % 4) * 240,
          y: Math.floor(i / 4) * 180,
        })),
        agents: agents.map((x, i) => ({
          ...x,
          x: (i % 8) * 64,
          y: 64 + Math.floor(i / 8) * 64,
          state: tasks.some((t) => t.lease_owner === x.principal_id)
            ? "working"
            : "idle",
        })),
        tasks,
      };
    return { ...body, stateHash: sha(stable(body)), readOnly: true };
  }
  commandCenter(companyId: string, actorId: string): unknown {
    const briefings = (
      this.db
        .prepare(
          "SELECT id,portfolio_hash AS portfolioHash,meeting_ids AS meetingIds,facts,decisions,next_actions AS nextActions,provenance,briefing_hash AS briefingHash,created_at AS createdAt FROM ceo_briefings_v4 WHERE company_id=? ORDER BY created_at",
        )
        .all(companyId) as Array<Record<string, unknown>>
    ).map((row) => ({
      ...row,
      meetingIds: parse<string[]>(String(row.meetingIds)),
      facts: parse<unknown>(String(row.facts)),
      decisions: parse<string[]>(String(row.decisions)),
      nextActions: parse<string[]>(String(row.nextActions)),
      provenance: parse<string[]>(String(row.provenance)),
    }));
    return {
      portfolio: this.portfolio(companyId, actorId),
      goals: this.goals(companyId, actorId),
      meetingSessions: this.companyMeetings(companyId, actorId),
      meetings: this.meetings(companyId),
      briefings,
      roleTemplates: this.roleTemplates(companyId),
      roleBindings: this.roleBindings(companyId),
      recommendations: this.recommendAssignments(companyId, actorId),
      pixel: this.pixelState(companyId, actorId),
      audit: this.auditEvents(companyId),
    };
  }
  startGoalDeliveryProcess(
    input: {
      id: string;
      companyId: string;
      goalId: string;
      idempotencyKey: string;
      runId?: string | null;
    },
    actorId: string,
  ): GoalDeliverySnapshot {
    this.require(input.companyId, actorId, "manage-org");
    if (!input.id.trim() || !input.idempotencyKey.trim())
      throw new Error("Delivery process id and idempotency key required");
    const replay = this.deliveryCommand(
      input.companyId,
      input.idempotencyKey,
      "start",
    );
    if (replay) return replay;
    const goal = this.goal(input.goalId);
    if (!goal || goal.companyId !== input.companyId)
      throw new Error("Goal missing");
    if (["completed", "cancelled"].includes(goal.status))
      throw new Error("A terminal goal cannot start a delivery process");
    if (input.runId) {
      const linked = this.db
        .prepare(
          "SELECT 1 FROM board_tasks_v3 t JOIN company_goal_projects_v12 gp ON gp.project_id=t.project_id WHERE gp.goal_id=? AND t.run_id=?",
        )
        .get(input.goalId, input.runId);
      if (!linked) throw new Error("Delivery Run must belong to the goal");
    }
    const existing = this.db
      .prepare(
        "SELECT id FROM goal_delivery_processes_v19 WHERE company_id=? AND goal_id=? ORDER BY process_version DESC LIMIT 1",
      )
      .get(input.companyId, input.goalId) as { id: string } | undefined;
    if (existing) {
      const result = this.deliveryProcessSnapshotById(existing.id);
      this.recordDeliveryCommand(
        input.companyId,
        existing.id,
        input.idempotencyKey,
        "start",
        result,
      );
      return result;
    }
    const timestamp = now(),
      stageId = crypto.randomUUID(),
      stageStatus: GoalDeliveryStageStatus = input.runId
        ? "in-progress"
        : "pending";
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO goal_delivery_processes_v19 VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          input.id,
          input.companyId,
          input.goalId,
          1,
          1,
          "discovery",
          "active",
          timestamp,
          timestamp,
          null,
        );
      this.db
        .prepare(
          "INSERT INTO goal_delivery_stage_instances_v19 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          stageId,
          input.id,
          "discovery",
          1,
          stageStatus,
          input.runId ?? null,
          null,
          input.runId ? timestamp : null,
          null,
          timestamp,
          timestamp,
        );
      const result = this.deliveryProcessSnapshotById(input.id);
      this.recordDeliveryCommand(
        input.companyId,
        input.id,
        input.idempotencyKey,
        "start",
        result,
      );
      this.audit(input.companyId, "GOAL_DELIVERY_PROCESS_STARTED", {
        actorId,
        goalId: input.goalId,
        processId: input.id,
        stage: "discovery",
        status: stageStatus,
        runId: input.runId ?? null,
      });
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  goalDeliveryProcess(
    companyId: string,
    goalId: string,
    actorId: string,
  ): GoalDeliverySnapshot | null {
    this.require(companyId, actorId, "view");
    const row = this.db
      .prepare(
        "SELECT id FROM goal_delivery_processes_v19 WHERE company_id=? AND goal_id=? ORDER BY process_version DESC LIMIT 1",
      )
      .get(companyId, goalId) as { id: string } | undefined;
    return row ? this.deliveryProcessSnapshotById(row.id) : null;
  }
  transitionGoalDeliveryStage(
    companyId: string,
    goalId: string,
    input: {
      stageInstanceId: string;
      to: GoalDeliveryStageStatus;
      expectedVersion: number;
      idempotencyKey: string;
      reason?: string;
    },
    actorId: string,
  ): GoalDeliverySnapshot {
    this.require(companyId, actorId, "manage-org");
    if (!input.idempotencyKey.trim())
      throw new Error("Idempotency key required");
    const replay = this.deliveryCommand(
      companyId,
      input.idempotencyKey,
      "transition-stage",
    );
    if (replay) return replay;
    const current = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (!current) throw new Error("Goal delivery process missing");
    if (current.process.version !== input.expectedVersion)
      throw new Error("Goal delivery process version conflict");
    if (current.currentStageInstance.id !== input.stageInstanceId)
      throw new Error("Only the current stage attempt can transition");
    if (["completed", "cancelled"].includes(current.process.status))
      throw new Error("Goal delivery process is terminal");
    const from = current.currentStageInstance.status,
      to = input.to,
      allowed: Record<GoalDeliveryStageStatus, GoalDeliveryStageStatus[]> = {
        pending: ["in-progress", "blocked", "cancelled"],
        "in-progress": ["validation-waiting", "blocked", "cancelled"],
        "validation-waiting": [
          "review-waiting",
          "revision-requested",
          "blocked",
          "cancelled",
        ],
        "review-waiting": [
          "owner-approval-waiting",
          "revision-requested",
          "blocked",
          "cancelled",
        ],
        "owner-approval-waiting": [
          "approved",
          "revision-requested",
          "blocked",
          "cancelled",
        ],
        "revision-requested": [],
        approved: [],
        blocked: [
          "in-progress",
          "owner-approval-waiting",
          "revision-requested",
          "cancelled",
        ],
        cancelled: [],
      };
    if (!allowed[from].includes(to))
      throw new Error("Invalid goal delivery stage transition");
    const timestamp = now(),
      nextVersion = current.process.version + 1;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      let processStatus: GoalDeliveryProcessStatus = current.process.status,
        newStage = current.process.currentStage,
        newCurrentId = input.stageInstanceId;
      if (to === "revision-requested") {
        this.db
          .prepare(
            "UPDATE goal_delivery_stage_instances_v19 SET status=?,completed_at=?,updated_at=? WHERE id=?",
          )
          .run(to, timestamp, timestamp, input.stageInstanceId);
        const nextAttempt = current.currentStageInstance.attempt + 1;
        newCurrentId = crypto.randomUUID();
        this.db
          .prepare(
            "INSERT INTO goal_delivery_stage_instances_v19 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            newCurrentId,
            current.process.id,
            current.process.currentStage,
            nextAttempt,
            "pending",
            null,
            null,
            null,
            null,
            timestamp,
            timestamp,
          );
        const staleIds = current.stages
          .filter(
            (x) =>
              GOAL_DELIVERY_STAGES.indexOf(x.stage) >=
              GOAL_DELIVERY_STAGES.indexOf(current.process.currentStage),
          )
          .map((x) => x.id);
        for (const id of staleIds)
          this.db
            .prepare(
              "UPDATE goal_delivery_artifact_snapshots_v19 SET stale=1,stale_reason=? WHERE stage_instance_id=? AND stale=0",
            )
            .run(input.reason?.trim() || "stage-revision-requested", id);
        processStatus = "active";
      } else if (to === "approved") {
        this.db
          .prepare(
            "UPDATE goal_delivery_stage_instances_v19 SET status='approved',completed_at=?,updated_at=? WHERE id=?",
          )
          .run(timestamp, timestamp, input.stageInstanceId);
        const index = GOAL_DELIVERY_STAGES.indexOf(
          current.process.currentStage,
        );
        if (index === GOAL_DELIVERY_STAGES.length - 1) {
          processStatus = "completed";
        } else {
          newStage = GOAL_DELIVERY_STAGES[index + 1]!;
          newCurrentId = crypto.randomUUID();
          this.db
            .prepare(
              "INSERT INTO goal_delivery_stage_instances_v19 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            )
            .run(
              newCurrentId,
              current.process.id,
              newStage,
              1,
              "pending",
              null,
              null,
              null,
              null,
              timestamp,
              timestamp,
            );
        }
      } else {
        this.db
          .prepare(
            "UPDATE goal_delivery_stage_instances_v19 SET status=?,started_at=CASE WHEN ?='in-progress' THEN COALESCE(started_at,?) ELSE started_at END,completed_at=CASE WHEN ?='cancelled' THEN ? ELSE completed_at END,updated_at=? WHERE id=?",
          )
          .run(
            to,
            to,
            timestamp,
            to,
            timestamp,
            timestamp,
            input.stageInstanceId,
          );
        if (to === "blocked") processStatus = "blocked";
        else if (to === "cancelled") processStatus = "cancelled";
        else if (current.process.status === "blocked") processStatus = "active";
      }
      this.db
        .prepare(
          "UPDATE goal_delivery_processes_v19 SET version=?,current_stage=?,status=?,updated_at=?,completed_at=CASE WHEN ? IN ('completed','cancelled') THEN ? ELSE completed_at END WHERE id=?",
        )
        .run(
          nextVersion,
          newStage,
          processStatus,
          timestamp,
          processStatus,
          timestamp,
          current.process.id,
        );
      const result = this.deliveryProcessSnapshotById(current.process.id);
      this.recordDeliveryCommand(
        companyId,
        current.process.id,
        input.idempotencyKey,
        "transition-stage",
        result,
      );
      this.audit(companyId, "GOAL_DELIVERY_STAGE_TRANSITIONED", {
        actorId,
        goalId,
        processId: current.process.id,
        stage: current.process.currentStage,
        stageInstanceId: input.stageInstanceId,
        newCurrentStageInstanceId: newCurrentId,
        from,
        to,
        reason: input.reason ?? null,
        version: nextVersion,
      });
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  addGoalDeliveryArtifactSnapshot(
    companyId: string,
    goalId: string,
    stageInstanceId: string,
    input: {
      id: string;
      artifactIds: string[];
      expectedVersion: number;
      idempotencyKey: string;
    },
    actorId: string,
  ): GoalDeliverySnapshot {
    this.require(companyId, actorId, "manage-org");
    if (!input.id.trim() || !input.idempotencyKey.trim())
      throw new Error("Artifact snapshot id and idempotency key required");
    const replay = this.deliveryCommand(
      companyId,
      input.idempotencyKey,
      "add-artifact-snapshot",
    );
    if (replay) return replay;
    const current = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (!current) throw new Error("Goal delivery process missing");
    if (current.process.version !== input.expectedVersion)
      throw new Error("Goal delivery process version conflict");
    if (current.currentStageInstance.id !== stageInstanceId)
      throw new Error(
        "Artifacts can only be attached to the current stage attempt",
      );
    if (["approved", "cancelled"].includes(current.currentStageInstance.status))
      throw new Error("The current stage no longer accepts artifacts");
    const artifactIds = [
      ...new Set(input.artifactIds.map((x) => x.trim()).filter(Boolean)),
    ].sort();
    if (!artifactIds.length)
      throw new Error("At least one artifact id is required");
    const version =
        1 +
        Math.max(
          0,
          ...current.artifactSnapshots
            .filter((x) => x.stageInstanceId === stageInstanceId)
            .map((x) => x.version),
        ),
      timestamp = now(),
      snapshotHash = sha(stable({ stageInstanceId, version, artifactIds })),
      nextVersion = current.process.version + 1;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "UPDATE goal_delivery_artifact_snapshots_v19 SET stale=1,stale_reason='superseded-by-new-snapshot' WHERE stage_instance_id=? AND stale=0",
        )
        .run(stageInstanceId);
      this.db
        .prepare(
          "INSERT INTO goal_delivery_artifact_snapshots_v19 VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          input.id,
          stageInstanceId,
          version,
          json(artifactIds),
          snapshotHash,
          0,
          null,
          timestamp,
        );
      this.db
        .prepare(
          "UPDATE goal_delivery_processes_v19 SET version=?,updated_at=? WHERE id=?",
        )
        .run(nextVersion, timestamp, current.process.id);
      const result = this.deliveryProcessSnapshotById(current.process.id);
      this.recordDeliveryCommand(
        companyId,
        current.process.id,
        input.idempotencyKey,
        "add-artifact-snapshot",
        result,
      );
      this.audit(companyId, "GOAL_DELIVERY_ARTIFACT_SNAPSHOT_ADDED", {
        actorId,
        goalId,
        processId: current.process.id,
        stageInstanceId,
        snapshotId: input.id,
        snapshotHash,
        version,
        nextVersion,
      });
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  recordGoalDeliveryBuildEvidence(
    runId: string,
    manifest: BuildReviewEvidenceManifest,
    actorId: string,
  ): BuildReviewEvidenceManifest {
    const row = this.db
      .prepare(
        "SELECT p.company_id companyId,p.goal_id goalId,p.id processId,s.id stageInstanceId,s.stage FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id WHERE s.run_id=? ORDER BY p.process_version DESC,s.attempt DESC LIMIT 1",
      )
      .get(runId) as
      | {
          companyId: string;
          goalId: string;
          processId: string;
          stageInstanceId: string;
          stage: GoalDeliveryStage;
        }
      | undefined;
    if (!row) throw new Error("Goal delivery build stage missing for Run");
    this.require(row.companyId, actorId, "manage-org");
    if (row.stage !== "build")
      throw new Error(
        "Build review evidence can only be recorded for the build stage",
      );
    const result = this.state.runResult(runId);
    if (!result)
      throw new Error("Durable Run result required for build review evidence");
    if (
      manifest.version !== 1 ||
      manifest.runId !== runId ||
      manifest.patchHash !== result.patchHash
    )
      throw new Error(
        "Build review evidence does not match the durable Run result",
      );
    const { snapshotHash, ...body } = manifest;
    if (sha(stable(body)) !== snapshotHash)
      throw new Error("Build review evidence snapshot hash is invalid");
    const existing = this.goalDeliveryBuildEvidence(row.stageInstanceId);
    if (existing) {
      if (existing.snapshotHash !== snapshotHash)
        throw new Error(
          "Build review evidence is immutable for this stage attempt",
        );
      return existing;
    }
    this.db
      .prepare(
        "INSERT INTO goal_delivery_build_evidence_v24 VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        row.stageInstanceId,
        runId,
        1,
        json(manifest),
        snapshotHash,
        manifest.ready ? 1 : 0,
        now(),
      );
    this.audit(row.companyId, "GOAL_DELIVERY_BUILD_EVIDENCE_RECORDED", {
      actorId,
      goalId: row.goalId,
      processId: row.processId,
      stageInstanceId: row.stageInstanceId,
      runId,
      snapshotHash,
      ready: manifest.ready,
      missing: manifest.missing,
    });
    return manifest;
  }
  goalDeliveryBuildEvidence(
    stageInstanceId: string,
  ): BuildReviewEvidenceManifest | null {
    const row = this.db
      .prepare(
        "SELECT manifest FROM goal_delivery_build_evidence_v24 WHERE stage_instance_id=?",
      )
      .get(stageInstanceId) as { manifest: string } | undefined;
    return row ? parse<BuildReviewEvidenceManifest>(row.manifest) : null;
  }
  goalDeliveryBuildEvidenceForRun(
    runId: string,
  ): BuildReviewEvidenceManifest | null {
    const row = this.db
      .prepare(
        "SELECT manifest FROM goal_delivery_build_evidence_v24 WHERE run_id=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(runId) as { manifest: string } | undefined;
    return row ? parse<BuildReviewEvidenceManifest>(row.manifest) : null;
  }
  prepareGoalDeliveryReviewForRun(
    runId: string,
  ): {
    snapshot: GoalDeliverySnapshot;
    meeting: CompanyMeetingRecord;
    actorId: string;
    created: boolean;
  } | null {
    const row = this.db
      .prepare(
        "SELECT p.company_id companyId,p.goal_id goalId,p.id processId,s.id stageInstanceId,s.stage,g.owner_id ownerId FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id JOIN company_goals_v12 g ON g.id=p.goal_id WHERE s.run_id=? AND p.status='active' AND p.current_stage=s.stage ORDER BY p.process_version DESC,s.attempt DESC LIMIT 1",
      )
      .get(runId) as
      | {
          companyId: string;
          goalId: string;
          processId: string;
          stageInstanceId: string;
          stage: GoalDeliveryStage;
          ownerId: string;
        }
      | undefined;
    if (!row) return null;
    const run = this.state.getRun(runId);
    if (run?.status !== "RESULT_APPROVAL_WAITING") return null;
    const validation = [...this.state.auditEvents(runId)]
        .reverse()
        .find((x) => x.type === "VALIDATION_COMPLETED"),
      passed = Boolean(
        (validation?.payload as { passed?: boolean } | undefined)?.passed,
      );
    if (!validation || !passed || !this.state.runResult(runId))
      throw new Error(
        "Goal delivery review requires a passed validation and durable Run result",
      );
    if (
      row.stage === "build" &&
      !this.goalDeliveryBuildEvidence(row.stageInstanceId)
    )
      throw new Error(
        "Build review evidence must be collected before review preparation",
      );
    let snapshot = this.deliveryProcessSnapshotById(row.processId);
    if (snapshot.currentStageInstance.id !== row.stageInstanceId)
      throw new Error("Goal delivery Run is not the current stage attempt");
    const linkedMeeting = snapshot.currentStageInstance.meetingId
      ? this.meeting(snapshot.currentStageInstance.meetingId)
      : null;
    if (
      linkedMeeting &&
      ["review-waiting", "owner-approval-waiting"].includes(
        snapshot.currentStageInstance.status,
      )
    )
      return {
        snapshot,
        meeting: linkedMeeting,
        actorId: row.ownerId,
        created: false,
      };
    if (snapshot.currentStageInstance.status === "in-progress") {
      const result = this.state.runResult(runId)!,
        buildEvidence =
          row.stage === "build"
            ? this.goalDeliveryBuildEvidence(row.stageInstanceId)
            : null,
        artifactIds = [
          `run:${runId}`,
          `run-result:${result.patchHash}`,
          `validation:${validation.seq}`,
          ...this.state
            .artifactVersionsForRun(runId)
            .map((x) => `artifact:${x.id}`),
          ...(buildEvidence
            ? [`build-evidence:${buildEvidence.snapshotHash}`]
            : []),
        ];
      snapshot = this.addGoalDeliveryArtifactSnapshot(
        row.companyId,
        row.goalId,
        row.stageInstanceId,
        {
          id: `delivery-evidence:${row.stageInstanceId}:${runId}`,
          artifactIds,
          expectedVersion: snapshot.process.version,
          idempotencyKey: `delivery-evidence:${row.stageInstanceId}:${runId}`,
        },
        row.ownerId,
      );
    }
    if (snapshot.currentStageInstance.status === "in-progress")
      snapshot = this.transitionGoalDeliveryStage(
        row.companyId,
        row.goalId,
        {
          stageInstanceId: row.stageInstanceId,
          to: "validation-waiting",
          expectedVersion: snapshot.process.version,
          idempotencyKey: `delivery-validation-passed:${row.stageInstanceId}`,
        },
        row.ownerId,
      );
    if (snapshot.currentStageInstance.status === "validation-waiting")
      snapshot = this.transitionGoalDeliveryStage(
        row.companyId,
        row.goalId,
        {
          stageInstanceId: row.stageInstanceId,
          to: "review-waiting",
          expectedVersion: snapshot.process.version,
          idempotencyKey: `delivery-review-ready:${row.stageInstanceId}`,
        },
        row.ownerId,
      );
    if (snapshot.currentStageInstance.status !== "review-waiting")
      throw new Error("Goal delivery stage is not ready for team review");
    const meetingId = `goal-delivery-review-${sha(row.stageInstanceId).slice(0, 24)}`,
      existing = this.meeting(meetingId);
    if (existing)
      return {
        snapshot,
        meeting: existing,
        actorId: row.ownerId,
        created: false,
      };
    const linked = this.db
      .prepare(
        "SELECT t.project_id projectId FROM board_tasks_v3 t WHERE t.run_id=?",
      )
      .get(runId) as { projectId: string } | undefined;
    if (!linked) throw new Error("Goal delivery Run project missing");
    const participants = (
      this.db
        .prepare(
          "SELECT DISTINCT a.principal_id principalId FROM assignments_v3 a JOIN company_members_v4 m ON m.principal_id=a.principal_id WHERE a.task_id=(SELECT id FROM board_tasks_v3 WHERE run_id=?) AND m.company_id=? AND m.kind='agent' ORDER BY a.principal_id",
        )
        .all(runId, row.companyId) as Array<{ principalId: string }>
    ).map((x) => x.principalId);
    if (!participants.length)
      throw new Error(
        "Goal delivery team review requires assigned Agent participants",
      );
    const stageName: Record<GoalDeliveryStage, string> = {
        discovery: "기획",
        "delivery-planning": "실행계획",
        build: "개발",
        release: "배포",
        operate: "운영·완료",
      },
      meeting = this.createMeeting(
        {
          id: meetingId,
          companyId: row.companyId,
          goalId: row.goalId,
          projectId: linked.projectId,
          runId,
          title: `${stageName[snapshot.process.currentStage]} 단계 팀 검토`,
          purpose:
            "단계 산출물의 완료 기준, 위험, 미해결 항목을 근거와 함께 검토합니다.",
          hostId: row.ownerId,
          participantIds: participants,
          agenda: [
            "완료 기준 충족 여부",
            "검증 근거와 위험",
            "오너에게 전달할 수정·승인 후보",
          ],
          scheduledAt: null,
        },
        row.ownerId,
      ),
      timestamp = now();
    this.db
      .prepare(
        "UPDATE goal_delivery_stage_instances_v19 SET meeting_id=?,updated_at=? WHERE id=?",
      )
      .run(meetingId, timestamp, row.stageInstanceId);
    this.db
      .prepare(
        "UPDATE goal_delivery_processes_v19 SET version=version+1,updated_at=? WHERE id=?",
      )
      .run(timestamp, row.processId);
    this.audit(row.companyId, "GOAL_DELIVERY_REVIEW_MEETING_LINKED", {
      processId: row.processId,
      stageInstanceId: row.stageInstanceId,
      meetingId,
      runId,
      participants,
    });
    return {
      snapshot: this.deliveryProcessSnapshotById(row.processId),
      meeting,
      actorId: row.ownerId,
      created: true,
    };
  }
  private buildOwnerReviewPacket(input: {
    reviewId: string;
    companyId: string;
    goalId: string;
    stage: GoalDeliveryStage;
    meetingId: string;
    runId: string | null;
    summary: string;
    decisions: string[];
    risks: string[];
    openItems: string[];
    evidenceIds: string[];
    createdAt: string;
  }): OwnerReviewPacket {
    const goal = this.goal(input.goalId);
    if (!goal) throw new Error("Goal missing for owner review packet");
    const stageLabel: Record<GoalDeliveryStage, string> = {
        discovery: "기획",
        "delivery-planning": "실행계획",
        build: "개발",
        release: "배포",
        operate: "운영·완료",
      },
      kindOf = (id: string): OwnerReviewEvidenceItem["kind"] =>
        id.startsWith("run-result:")
          ? "run-result"
          : id.startsWith("validation:")
            ? "validation"
            : id.startsWith("artifact:")
              ? "artifact"
              : id.startsWith("run:")
                ? "run"
                : "other",
      evidence: OwnerReviewEvidenceItem[] = input.evidenceIds.map((id) => {
        const kind = kindOf(id),
          artifact =
            kind === "artifact"
              ? this.state.artifactVersion(id.slice("artifact:".length))
              : null,
          stale = Boolean(artifact?.stale),
          url =
            kind === "run" ||
            kind === "run-result" ||
            kind === "validation" ||
            kind === "artifact"
              ? `/execution?companyId=${encodeURIComponent(input.companyId)}&goalId=${encodeURIComponent(input.goalId)}${input.runId ? `&runId=${encodeURIComponent(input.runId)}` : ""}`
              : null;
        return {
          id,
          kind,
          label:
            kind === "run-result"
              ? "실행 결과"
              : kind === "validation"
                ? "자동 검증"
                : kind === "artifact"
                  ? `산출물 · ${artifact?.path ?? id.slice(9)}`
                  : kind === "run"
                    ? "Agent 실행"
                    : "추가 근거",
          status: stale ? "stale" : "available",
          url,
        };
      });
    evidence.push({
      id: `meeting:${input.meetingId}`,
      kind: "meeting",
      label: "직원 검토 회의",
      status: "available",
      url: `/meetings?companyId=${encodeURIComponent(input.companyId)}&goalId=${encodeURIComponent(input.goalId)}&meetingId=${encodeURIComponent(input.meetingId)}`,
    });
    const buildEvidence =
        input.stage === "build" && input.runId
          ? this.goalDeliveryBuildEvidenceForRun(input.runId)
          : null,
      frontendReady = Boolean(
        buildEvidence &&
          (buildEvidence.frontend.status === "captured" ||
            buildEvidence.frontend.status === "exempted") &&
          buildEvidence.frontend.missingStates.length === 0 &&
          (!buildEvidence.frontend.observedVersion ||
            buildEvidence.frontend.observedVersion ===
              buildEvidence.frontend.expectedVersion),
      ),
      present: string[] = [...new Set(evidence.map((x) => x.kind))].sort(),
      required: string[] = [
        "run-result",
        "validation",
        "meeting",
        ...(input.stage === "build"
          ? ["backend-readiness", "frontend-evidence"]
          : []),
      ];
    if (buildEvidence?.backend.ready) present.push("backend-readiness");
    if (frontendReady) present.push("frontend-evidence");
    const missing = [
        ...required.filter((x) => !present.includes(x)),
        ...(buildEvidence?.missing ?? []),
      ].filter((value, index, items) => items.indexOf(value) === index),
      staleEvidenceIds = evidence
        .filter((x) => x.status === "stale")
        .map((x) => x.id),
      sections = [
        {
          id: "scope",
          title:
            input.stage === "discovery"
              ? "기획 핵심"
              : input.stage === "delivery-planning"
                ? "실행계획 핵심"
                : input.stage === "build"
                  ? "개발 결과 핵심"
                  : input.stage === "release"
                    ? "배포 판단 핵심"
                    : "운영·완료 핵심",
          items: [
            goal.description || "목표 설명 없음",
            ...goal.completionCriteria,
          ],
        },
        {
          id: "decisions",
          title: "팀 합의와 이견",
          items: [
            ...input.decisions,
            ...input.risks.map((x) => `위험: ${x}`),
            ...input.openItems.map((x) => `미해결: ${x}`),
          ],
        },
      ],
      base = {
        version: 2 as const,
        stage: input.stage,
        stageLabel: stageLabel[input.stage],
        goal: {
          id: goal.id,
          title: goal.title,
          description: goal.description,
          completionCriteria: goal.completionCriteria,
        },
        summary: input.summary,
        sections,
        deterministicFacts: [
          {
            label: "단계",
            value: stageLabel[input.stage],
            source: `stage:${input.stage}`,
          },
          {
            label: "검증 근거",
            value: `${evidence.length}개`,
            source: "goal-delivery-artifact-snapshot",
          },
          {
            label: "회의 상태",
            value: "직원 검토 완료",
            source: `meeting:${input.meetingId}`,
          },
        ],
        teamInterpretation: {
          decisions: input.decisions,
          risks: input.risks,
          openItems: input.openItems,
        },
        evidence,
        buildEvidence,
        completeness: {
          required,
          present,
          missing,
          staleEvidenceIds,
          ready: missing.length === 0 && staleEvidenceIds.length === 0,
        },
        createdAt: input.createdAt,
      },
      snapshotHash = sha(stable(base));
    return { ...base, snapshotHash };
  }
  completeGoalDeliveryTeamReview(meetingId: string): GoalDeliverySnapshot {
    const row = this.db
      .prepare(
        "SELECT p.company_id companyId,p.goal_id goalId,p.id processId,s.id stageInstanceId,g.owner_id ownerId FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id JOIN company_goals_v12 g ON g.id=p.goal_id WHERE s.meeting_id=? ORDER BY p.process_version DESC,s.attempt DESC LIMIT 1",
      )
      .get(meetingId) as
      | {
          companyId: string;
          goalId: string;
          processId: string;
          stageInstanceId: string;
          ownerId: string;
        }
      | undefined;
    if (!row) throw new Error("Goal delivery review meeting is not linked");
    const meeting = this.meeting(meetingId),
      summary = this.meetingSummary(meetingId) as {
        status: string;
        paragraph: string;
        decisions: string[];
        risks: string[];
        openItems: string[];
      } | null;
    if (!meeting || meeting.status !== "ended" || !summary)
      throw new Error("Ended meeting summary required");
    const existing = this.ownerReviewForStage(row.stageInstanceId);
    if (existing) return this.deliveryProcessSnapshotById(row.processId);
    let snapshot = this.deliveryProcessSnapshotById(row.processId);
    if (
      snapshot.currentStageInstance.id !== row.stageInstanceId ||
      snapshot.currentStageInstance.status !== "review-waiting"
    )
      throw new Error("Goal delivery stage is not waiting for team review");
    const evidenceIds = snapshot.artifactSnapshots
        .filter((x) => x.stageInstanceId === row.stageInstanceId && !x.stale)
        .flatMap((x) => x.artifactIds),
      stageName: Record<GoalDeliveryStage, string> = {
        discovery: "기획",
        "delivery-planning": "실행계획",
        build: "개발",
        release: "배포",
        operate: "운영·완료",
      },
      koreanSummary = `${stageName[snapshot.process.currentStage]} 단계의 직원 검토 회의가 완료되었습니다. 결정 후보 ${summary.decisions.length}건, 위험 ${summary.risks.length}건, 미해결 항목 ${summary.openItems.length}건을 확인해 진행 또는 수정을 결정해 주세요. ${summary.paragraph}`,
      timestamp = now(),
      reviewId = `owner-review-${sha(row.stageInstanceId).slice(0, 24)}`,
      packet = this.buildOwnerReviewPacket({
        reviewId,
        companyId: row.companyId,
        goalId: row.goalId,
        stage: snapshot.process.currentStage,
        meetingId,
        runId: snapshot.currentStageInstance.runId,
        summary: koreanSummary,
        decisions: summary.decisions,
        risks: summary.risks,
        openItems: summary.openItems,
        evidenceIds,
        createdAt: timestamp,
      }),
      packetHash = packet.snapshotHash;
    this.db
      .prepare(
        "INSERT INTO goal_delivery_owner_reviews_v20 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        reviewId,
        row.processId,
        row.stageInstanceId,
        row.companyId,
        row.goalId,
        meetingId,
        snapshot.currentStageInstance.runId,
        "pending",
        koreanSummary,
        json(summary.decisions),
        json(summary.risks),
        json(summary.openItems),
        json(evidenceIds),
        packetHash,
        timestamp,
        null,
        null,
      );
    this.db
      .prepare("INSERT INTO goal_delivery_review_packets_v23 VALUES(?,?,?,?,?)")
      .run(reviewId, 2, json(packet), packetHash, timestamp);
    snapshot = this.transitionGoalDeliveryStage(
      row.companyId,
      row.goalId,
      {
        stageInstanceId: row.stageInstanceId,
        to: "owner-approval-waiting",
        expectedVersion: snapshot.process.version,
        idempotencyKey: `delivery-owner-review:${row.stageInstanceId}`,
      },
      row.ownerId,
    );
    this.audit(row.companyId, "GOAL_DELIVERY_OWNER_REVIEW_REQUESTED", {
      processId: row.processId,
      stageInstanceId: row.stageInstanceId,
      meetingId,
      reviewId,
      snapshotHash: packetHash,
      packetVersion: 2,
      complete: packet.completeness.ready,
    });
    return this.deliveryProcessSnapshotById(row.processId);
  }
  requestGoalDeployment(
    companyId: string,
    goalId: string,
    input: {
      action: "deploy" | "skip";
      environment: "preview" | "production";
      targetProjectId?: string | null;
      targetChannel?: string | null;
      expectedSnapshotHash: string;
      confirmation?: string;
    },
    actorId: string,
  ): GoalDeploymentRecord {
    const snapshot = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (
      !snapshot ||
      snapshot.process.currentStage !== "release" ||
      snapshot.currentStageInstance.status !== "owner-approval-waiting" ||
      !snapshot.ownerReview ||
      snapshot.ownerReview.status !== "pending"
    )
      throw new Error(
        "Release owner review is required before a deployment decision",
      );
    const member = this.db
        .prepare(
          "SELECT role,kind FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(companyId, actorId) as { role: string; kind: string } | undefined,
      goal = this.goal(goalId);
    if (
      !goal ||
      !member ||
      member.kind !== "human" ||
      (actorId !== goal.ownerId &&
        !(member.role === "owner" || member.role === "executive"))
    )
      throw new Error("Human goal owner or company executive required");
    if (input.expectedSnapshotHash !== snapshot.ownerReview.snapshotHash)
      throw new Error("Deployment approval snapshot changed");
    const existing = this.goalDeploymentForStage(
      snapshot.currentStageInstance.id,
    );
    if (existing) {
      if (
        existing.action !== input.action ||
        existing.environment !== input.environment ||
        existing.targetProjectId !== (input.targetProjectId?.trim() || null)
      )
        throw new Error(
          "Deployment decision is immutable for this release attempt",
        );
      return existing;
    }
    const targetProjectId = input.targetProjectId?.trim() || null,
      targetChannel = input.targetChannel?.trim() || null;
    if (input.action === "deploy" && !targetProjectId)
      throw new Error("Firebase target project is required");
    if (
      input.action === "deploy" &&
      input.environment === "production" &&
      input.confirmation !== `DEPLOY ${targetProjectId}`
    )
      throw new Error(
        "Production deployment confirmation does not match the target",
      );
    const id = `goal-deployment-${sha(snapshot.currentStageInstance.id).slice(0, 24)}`,
      timestamp = now(),
      status: GoalDeploymentRecord["status"] =
        input.action === "skip" ? "skipped" : "approved";
    this.db
      .prepare(
        "INSERT INTO goal_deployments_v21 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        snapshot.process.id,
        snapshot.currentStageInstance.id,
        companyId,
        goalId,
        "firebase",
        input.environment,
        input.action,
        targetProjectId,
        targetChannel,
        snapshot.ownerReview.snapshotHash,
        status,
        actorId,
        timestamp,
        null,
        null,
        null,
        timestamp,
      );
    this.audit(companyId, "GOAL_DEPLOYMENT_DECIDED", {
      actorId,
      goalId,
      processId: snapshot.process.id,
      stageInstanceId: snapshot.currentStageInstance.id,
      deploymentId: id,
      provider: "firebase",
      environment: input.environment,
      action: input.action,
      targetProjectId: targetProjectId ?? null,
      targetChannel: targetChannel ?? null,
      snapshotHash: snapshot.ownerReview.snapshotHash,
      credentialStored: false,
    });
    return this.goalDeploymentForStage(snapshot.currentStageInstance.id)!;
  }
  beginGoalDeployment(id: string): GoalDeploymentRecord {
    const current = this.goalDeployment(id);
    if (
      !current ||
      current.action !== "deploy" ||
      !(current.status === "approved" || current.status === "failed")
    )
      throw new Error("Approved or retryable deployment required");
    this.db
      .prepare(
        "UPDATE goal_deployments_v21 SET status='deploying',failure=NULL,updated_at=? WHERE id=? AND status IN ('approved','failed')",
      )
      .run(now(), id);
    this.audit(
      current.companyId,
      current.status === "failed"
        ? "GOAL_DEPLOYMENT_RETRIED"
        : "GOAL_DEPLOYMENT_STARTED",
      {
        deploymentId: id,
        provider: current.provider,
        environment: current.environment,
        targetProjectId: current.targetProjectId,
      },
    );
    return this.goalDeployment(id)!;
  }
  completeGoalDeployment(
    id: string,
    receipt: NonNullable<GoalDeploymentRecord["receipt"]>,
  ): GoalDeploymentRecord {
    const current = this.goalDeployment(id);
    if (!current || current.status !== "deploying")
      throw new Error("Deploying record required");
    if (
      !receipt.providerReceiptId.trim() ||
      !receipt.verifiedAt ||
      !Number.isFinite(Date.parse(receipt.verifiedAt))
    )
      throw new Error("Verified provider receipt required");
    this.db
      .prepare(
        "UPDATE goal_deployments_v21 SET status='succeeded',receipt=?,failure=NULL,updated_at=? WHERE id=? AND status='deploying'",
      )
      .run(json(receipt), now(), id);
    this.audit(current.companyId, "GOAL_DEPLOYMENT_SUCCEEDED", {
      deploymentId: id,
      providerReceiptId: receipt.providerReceiptId,
      url: receipt.url,
      version: receipt.version,
      verifiedAt: receipt.verifiedAt,
      rollbackAvailable: Boolean(receipt.rollbackRef),
    });
    return this.goalDeployment(id)!;
  }
  failGoalDeployment(id: string, error: unknown): GoalDeploymentRecord {
    const current = this.goalDeployment(id);
    if (!current || current.status !== "deploying")
      throw new Error("Deploying record required");
    const failure = error instanceof Error ? error.message : String(error);
    this.db
      .prepare(
        "UPDATE goal_deployments_v21 SET status='failed',failure=?,updated_at=? WHERE id=? AND status='deploying'",
      )
      .run(failure.slice(0, 2000), now(), id);
    this.audit(current.companyId, "GOAL_DEPLOYMENT_FAILED", {
      deploymentId: id,
      failure: failure.slice(0, 500),
      recoverable: true,
    });
    return this.goalDeployment(id)!;
  }
  completeGoalDeploymentRollback(
    id: string,
    verifiedAt: string,
  ): GoalDeploymentRecord {
    const current = this.goalDeployment(id);
    if (
      !current ||
      current.status !== "succeeded" ||
      !current.receipt?.rollbackRef
    )
      throw new Error("Succeeded deployment with rollback receipt required");
    if (!Number.isFinite(Date.parse(verifiedAt)))
      throw new Error("Rollback verification time required");
    this.db
      .prepare(
        "UPDATE goal_deployments_v21 SET status='rolled-back',rolled_back_at=?,updated_at=? WHERE id=? AND status='succeeded'",
      )
      .run(verifiedAt, now(), id);
    this.audit(current.companyId, "GOAL_DEPLOYMENT_ROLLED_BACK", {
      deploymentId: id,
      rollbackRef: current.receipt.rollbackRef,
      verifiedAt,
    });
    return this.goalDeployment(id)!;
  }
  submitGoalChangeRequest(
    companyId: string,
    goalId: string,
    input: { id: string; message: string },
    actorId: string,
  ): GoalDeliverySnapshot {
    const existing = this.goalChangeRequest(input.id);
    if (existing) {
      if (existing.companyId !== companyId || existing.goalId !== goalId)
        throw new Error("Cross-goal change request blocked");
      return this.deliveryProcessSnapshotById(existing.newProcessId);
    }
    const source = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (!source || source.process.status !== "completed")
      throw new Error(
        "A completed delivery process is required for an additional request",
      );
    const goal = this.goal(goalId),
      member = this.db
        .prepare(
          "SELECT role,kind FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(companyId, actorId) as { role: string; kind: string } | undefined,
      message = input.message.trim();
    if (
      !goal ||
      !member ||
      member.kind !== "human" ||
      (actorId !== goal.ownerId &&
        !(member.role === "owner" || member.role === "executive"))
    )
      throw new Error("Human goal owner or company executive required");
    if (!message || message.length > 8000)
      throw new Error(
        "Additional requirement must be between 1 and 8000 characters",
      );
    const lower = message.toLowerCase(),
      impactStage: GoalChangeRequestRecord["impactStage"] =
        /deploy|release|hosting|firebase|domain|배포|도메인|호스팅/.test(lower)
          ? "release"
          : /bug|fix|code|api|ui|test|develop|버그|수정|개발|화면|테스트/.test(
                lower,
              )
            ? "build"
            : /schedule|task|dependency|budget|plan|일정|작업|의존|예산|실행계획/.test(
                  lower,
                )
              ? "delivery-planning"
              : "discovery",
      rationale = [
        impactStage === "release"
          ? "배포·호스팅 영향 키워드 감지"
          : impactStage === "build"
            ? "구현·검증 영향 키워드 감지"
            : impactStage === "delivery-planning"
              ? "일정·작업·의존성 영향 키워드 감지"
              : "요구사항·범위 재검토 필요",
        "이전 완료본을 변경하지 않고 새 프로세스 버전으로 재진입",
      ],
      sourceCompletionHash = sha(
        stable({
          process: source.process,
          stages: source.stages,
          artifactSnapshots: source.artifactSnapshots,
          deployment: source.deployment,
        }),
      ),
      processVersion = Number(
        (
          this.db
            .prepare(
              "SELECT COALESCE(MAX(process_version),0)+1 n FROM goal_delivery_processes_v19 WHERE goal_id=?",
            )
            .get(goalId) as { n: number }
        ).n,
      ),
      newProcessId = crypto.randomUUID(),
      stageInstanceId = crypto.randomUUID(),
      timestamp = now(),
      evidenceId = `change-evidence-${sha(input.id).slice(0, 24)}`;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO goal_delivery_processes_v19 VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          newProcessId,
          companyId,
          goalId,
          processVersion,
          1,
          impactStage,
          "active",
          timestamp,
          timestamp,
          null,
        );
      this.db
        .prepare(
          "INSERT INTO goal_delivery_stage_instances_v19 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          stageInstanceId,
          newProcessId,
          impactStage,
          1,
          "pending",
          null,
          null,
          null,
          null,
          timestamp,
          timestamp,
        );
      this.db
        .prepare(
          "INSERT INTO goal_delivery_artifact_snapshots_v19 VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          evidenceId,
          stageInstanceId,
          1,
          json([
            `change-request:${input.id}`,
            `completed-process:${source.process.id}`,
            `completion-hash:${sourceCompletionHash}`,
          ]),
          sha(stable({ stageInstanceId, sourceCompletionHash, message })),
          0,
          null,
          timestamp,
        );
      this.db
        .prepare(
          "INSERT INTO goal_change_requests_v22 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          input.id,
          companyId,
          goalId,
          source.process.id,
          newProcessId,
          message,
          impactStage,
          json(rationale),
          sourceCompletionHash,
          "accepted",
          actorId,
          timestamp,
        );
      this.db
        .prepare(
          "UPDATE company_goals_v12 SET status='active',updated_at=? WHERE id=?",
        )
        .run(timestamp, goalId);
      this.audit(companyId, "GOAL_CHANGE_REQUEST_ACCEPTED", {
        actorId,
        goalId,
        changeRequestId: input.id,
        sourceProcessId: source.process.id,
        newProcessId,
        impactStage,
        rationale,
        sourceCompletionHash,
        immutableSource: true,
      });
      this.db.exec("COMMIT");
      return this.deliveryProcessSnapshotById(newProcessId);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  resolveGoalDeliveryOwnerReview(
    companyId: string,
    goalId: string,
    decision: "approved" | "revision-requested" | "on-hold",
    reason: string,
    actorId: string,
  ): GoalDeliverySnapshot {
    const snapshot = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (
      !snapshot ||
      !snapshot.ownerReview ||
      snapshot.ownerReview.status !== "pending"
    )
      throw new Error("Pending owner review required");
    const member = this.db
        .prepare(
          "SELECT role,kind FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(companyId, actorId) as { role: string; kind: string } | undefined,
      goal = this.goal(goalId);
    if (
      !goal ||
      !member ||
      member.kind !== "human" ||
      (actorId !== goal.ownerId &&
        !(["owner", "executive"] as string[]).includes(member.role))
    )
      throw new Error("Human goal owner or company executive required");
    if (decision !== "approved" && !reason.trim())
      throw new Error("Owner review reason required");
    if (decision === "approved") {
      if (!snapshot.ownerReview.packet.completeness.ready)
        throw new Error(
          `Owner review packet incomplete: ${[...snapshot.ownerReview.packet.completeness.missing, ...snapshot.ownerReview.packet.completeness.staleEvidenceIds].join(", ")}`,
        );
      if (
        snapshot.ownerReview.runId &&
        this.state.getRun(snapshot.ownerReview.runId)?.status !== "COMPLETED"
      )
        throw new Error(
          "Run result approval must complete before stage approval",
        );
      if (
        (
          this.meetingSummary(snapshot.ownerReview.meetingId) as {
            status?: string;
          } | null
        )?.status !== "confirmed"
      )
        throw new Error(
          "Meeting summary confirmation must complete before stage approval",
        );
      if (
        snapshot.process.currentStage === "release" &&
        !(["succeeded", "skipped"] as string[]).includes(
          snapshot.deployment?.status ?? "",
        )
      )
        throw new Error(
          "Release requires a verified deployment receipt or an explicit skip decision",
        );
    }
    const to: GoalDeliveryStageStatus =
        decision === "approved"
          ? "approved"
          : decision === "revision-requested"
            ? "revision-requested"
            : "blocked",
      trimmedReason = reason.trim(),
      result = this.transitionGoalDeliveryStage(
        companyId,
        goalId,
        {
          stageInstanceId: snapshot.currentStageInstance.id,
          to,
          expectedVersion: snapshot.process.version,
          idempotencyKey: `owner-review:${snapshot.ownerReview.id}:${decision}`,
          ...(trimmedReason ? { reason: trimmedReason } : {}),
        },
        actorId,
      ),
      timestamp = now(),
      decisionBody = {
        ownerReviewId: snapshot.ownerReview.id,
        companyId,
        goalId,
        decision,
        reason: trimmedReason,
        packetHash: snapshot.ownerReview.snapshotHash,
        packet: snapshot.ownerReview.packet,
        decidedBy: actorId,
        decidedAt: timestamp,
      },
      decisionHash = sha(stable(decisionBody));
    this.db
      .prepare(
        "INSERT OR IGNORE INTO goal_delivery_review_decisions_v23 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        `owner-decision-${decisionHash.slice(0, 24)}`,
        snapshot.ownerReview.id,
        companyId,
        goalId,
        decision,
        trimmedReason,
        snapshot.ownerReview.snapshotHash,
        json(snapshot.ownerReview.packet),
        actorId,
        timestamp,
        decisionHash,
      );
    this.db
      .prepare(
        "UPDATE goal_delivery_owner_reviews_v20 SET status=?,resolved_at=?,resolved_by=? WHERE id=? AND status='pending'",
      )
      .run(decision, timestamp, actorId, snapshot.ownerReview.id);
    this.audit(companyId, "GOAL_DELIVERY_OWNER_REVIEW_RESOLVED", {
      actorId,
      goalId,
      processId: snapshot.process.id,
      stageInstanceId: snapshot.currentStageInstance.id,
      reviewId: snapshot.ownerReview.id,
      decision,
      reason: trimmedReason || null,
      packetHash: snapshot.ownerReview.snapshotHash,
      decisionHash,
    });
    return this.deliveryProcessSnapshotById(result.process.id);
  }
  resumeGoalDeliveryOwnerReview(
    companyId: string,
    goalId: string,
    actorId: string,
  ): GoalDeliverySnapshot {
    const snapshot = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (
      !snapshot ||
      !snapshot.ownerReview ||
      snapshot.ownerReview.status !== "on-hold" ||
      snapshot.currentStageInstance.status !== "blocked"
    )
      throw new Error("On-hold owner review required");
    const member = this.db
        .prepare(
          "SELECT role,kind FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(companyId, actorId) as { role: string; kind: string } | undefined,
      goal = this.goal(goalId);
    if (
      !goal ||
      !member ||
      member.kind !== "human" ||
      (actorId !== goal.ownerId &&
        !(["owner", "executive"] as string[]).includes(member.role))
    )
      throw new Error("Human goal owner or company executive required");
    const result = this.transitionGoalDeliveryStage(
      companyId,
      goalId,
      {
        stageInstanceId: snapshot.currentStageInstance.id,
        to: "owner-approval-waiting",
        expectedVersion: snapshot.process.version,
        idempotencyKey: `owner-review:${snapshot.ownerReview.id}:resume`,
        reason: "오너 검토 재개",
      },
      actorId,
    );
    this.db
      .prepare(
        "UPDATE goal_delivery_owner_reviews_v20 SET status='pending',resolved_at=NULL,resolved_by=NULL WHERE id=? AND status='on-hold'",
      )
      .run(snapshot.ownerReview.id);
    this.audit(companyId, "GOAL_DELIVERY_OWNER_REVIEW_RESUMED", {
      actorId,
      goalId,
      processId: snapshot.process.id,
      stageInstanceId: snapshot.currentStageInstance.id,
      reviewId: snapshot.ownerReview.id,
    });
    return this.deliveryProcessSnapshotById(result.process.id);
  }
  recordGoalDeliveryAutomationFailure(runId: string, error: unknown): void {
    const row = this.db
      .prepare(
        "SELECT p.company_id companyId,p.id processId,s.id stageInstanceId,s.meeting_id meetingId FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id WHERE s.run_id=? ORDER BY p.process_version DESC,s.attempt DESC LIMIT 1",
      )
      .get(runId) as
      | {
          companyId: string;
          processId: string;
          stageInstanceId: string;
          meetingId: string | null;
        }
      | undefined;
    if (row)
      this.audit(row.companyId, "GOAL_DELIVERY_AUTOMATION_FAILED", {
        runId,
        processId: row.processId,
        stageInstanceId: row.stageInstanceId,
        meetingId: row.meetingId,
        error: error instanceof Error ? error.message : String(error),
        recoverable: true,
      });
  }
  pendingGoalDeliveryStageWork(): GoalDeliveryStageWorkItem[] {
    return this.db
      .prepare(
        `SELECT p.company_id companyId,p.goal_id goalId,p.id processId,s.id stageInstanceId,s.stage,s.attempt,s.status,s.run_id runId,g.owner_id ownerId FROM goal_delivery_processes_v19 p JOIN goal_delivery_stage_instances_v19 s ON s.process_id=p.id AND s.id=(SELECT x.id FROM goal_delivery_stage_instances_v19 x WHERE x.process_id=p.id AND x.stage=p.current_stage ORDER BY x.attempt DESC LIMIT 1) JOIN company_goals_v12 g ON g.id=p.goal_id WHERE p.status='active' AND s.status IN ('pending','in-progress','review-waiting') ORDER BY p.updated_at,p.id`,
      )
      .all() as unknown as GoalDeliveryStageWorkItem[];
  }
  goalDeliveryPlanAuthorization(
    runId: string,
  ): GoalDeliveryStageWorkItem | null {
    const row = this.db
      .prepare(
        `SELECT p.company_id companyId,p.goal_id goalId,p.id processId,s.id stageInstanceId,s.stage,s.attempt,s.status,s.run_id runId,g.owner_id ownerId FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id JOIN company_goals_v12 g ON g.id=p.goal_id JOIN board_tasks_v3 t ON t.run_id=s.run_id JOIN company_goal_projects_v12 gp ON gp.goal_id=p.goal_id AND gp.project_id=t.project_id WHERE s.run_id=? AND p.status='active' AND p.current_stage=s.stage AND s.status='in-progress'`,
      )
      .get(runId) as GoalDeliveryStageWorkItem | undefined;
    if (!row || this.state.getRun(runId)?.status !== "PLAN_APPROVAL_WAITING")
      return null;
    const assigned = this.db
        .prepare(
          "SELECT responsibility,COUNT(*) n FROM assignments_v3 WHERE task_id=(SELECT id FROM board_tasks_v3 WHERE run_id=?) AND kind='agent' GROUP BY responsibility",
        )
        .all(runId) as Array<{ responsibility: string; n: number }>,
      hasExecutor = assigned.some(
        (x) => x.responsibility === "executor" && Number(x.n) > 0,
      ),
      hasReviewer = assigned.some(
        (x) => x.responsibility === "reviewer" && Number(x.n) > 0,
      );
    if (!hasExecutor || !hasReviewer)
      throw new Error(
        "Goal delivery execution requires assigned executor and reviewer Agents",
      );
    const stageIndex = GOAL_DELIVERY_STAGES.indexOf(row.stage);
    if (stageIndex > 0) {
      const previous = GOAL_DELIVERY_STAGES[stageIndex - 1]!,
        approved = this.db
          .prepare(
            "SELECT 1 FROM goal_delivery_stage_instances_v19 WHERE process_id=? AND stage=? AND status='approved' LIMIT 1",
          )
          .get(row.processId, previous),
        changeReentry = this.db
          .prepare(
            "SELECT 1 FROM goal_change_requests_v22 WHERE new_process_id=? AND impact_stage=? AND status='accepted'",
          )
          .get(row.processId, row.stage);
      if (!approved && !changeReentry)
        throw new Error(
          "Previous goal delivery stage approval or accepted change request required",
        );
    } else if (row.attempt > 1) {
      const revision = this.db
        .prepare(
          "SELECT 1 FROM goal_delivery_stage_instances_v19 WHERE process_id=? AND stage=? AND attempt<? AND status='revision-requested' LIMIT 1",
        )
        .get(row.processId, row.stage, row.attempt);
      if (!revision)
        throw new Error("Revision authorization evidence required");
    }
    return row;
  }
  recordGoalDeliveryPlanAuthorized(work: GoalDeliveryStageWorkItem): void {
    this.audit(work.companyId, "GOAL_DELIVERY_EXECUTION_PLAN_AUTHORIZED", {
      goalId: work.goalId,
      processId: work.processId,
      stageInstanceId: work.stageInstanceId,
      stage: work.stage,
      attempt: work.attempt,
      runId: work.runId,
      actorId: work.ownerId,
      authority:
        work.stage === "discovery" && work.attempt === 1
          ? "human-created-goal-scope"
          : work.attempt > 1
            ? "human-revision-request"
            : "previous-stage-human-approval",
      meetingDecisionPromoted: false,
    });
  }
  attachGoalDeliveryStageRun(
    companyId: string,
    goalId: string,
    stageInstanceId: string,
    runId: string,
    actorId: string,
  ): GoalDeliverySnapshot {
    this.require(companyId, actorId, "manage-org");
    const current = this.goalDeliveryProcess(companyId, goalId, actorId);
    if (!current || current.currentStageInstance.id !== stageInstanceId)
      throw new Error("Current goal delivery stage required");
    if (current.currentStageInstance.runId === runId) return current;
    if (
      current.currentStageInstance.runId ||
      current.currentStageInstance.status !== "pending"
    )
      throw new Error("Goal delivery stage already started");
    const linked = this.db
      .prepare(
        "SELECT 1 FROM board_tasks_v3 t JOIN company_goal_projects_v12 gp ON gp.project_id=t.project_id WHERE gp.goal_id=? AND t.run_id=?",
      )
      .get(goalId, runId);
    if (!linked)
      throw new Error("Goal delivery Run must belong to the goal project");
    const timestamp = now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const changed = this.db
        .prepare(
          "UPDATE goal_delivery_stage_instances_v19 SET run_id=?,status='in-progress',started_at=?,updated_at=? WHERE id=? AND status='pending' AND run_id IS NULL",
        )
        .run(runId, timestamp, timestamp, stageInstanceId).changes;
      if (changed !== 1) throw new Error("Goal delivery stage start conflict");
      this.db
        .prepare(
          "UPDATE goal_delivery_processes_v19 SET version=version+1,updated_at=? WHERE id=?",
        )
        .run(timestamp, current.process.id);
      this.audit(companyId, "GOAL_DELIVERY_STAGE_RUN_LINKED", {
        actorId,
        goalId,
        processId: current.process.id,
        stageInstanceId,
        stage: current.currentStageInstance.stage,
        attempt: current.currentStageInstance.attempt,
        runId,
      });
      this.db.exec("COMMIT");
      return this.deliveryProcessSnapshotById(current.process.id);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  recordGoalDeliveryStageProvisionFailure(
    work: GoalDeliveryStageWorkItem,
    error: unknown,
  ): void {
    this.audit(work.companyId, "GOAL_DELIVERY_STAGE_PROVISION_FAILED", {
      goalId: work.goalId,
      processId: work.processId,
      stageInstanceId: work.stageInstanceId,
      stage: work.stage,
      attempt: work.attempt,
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    });
  }
  private ownerReviewForStage(
    stageInstanceId: string,
  ): GoalDeliveryOwnerReviewRecord | null {
    const x = this.db
      .prepare(
        "SELECT r.*,s.stage FROM goal_delivery_owner_reviews_v20 r JOIN goal_delivery_stage_instances_v19 s ON s.id=r.stage_instance_id WHERE r.stage_instance_id=?",
      )
      .get(stageInstanceId) as Record<string, unknown> | undefined;
    if (!x) return null;
    const decisions = parse<string[]>(x.decisions),
      risks = parse<string[]>(x.risks),
      openItems = parse<string[]>(x.open_items),
      evidenceIds = parse<string[]>(x.evidence_ids),
      packetRow = this.db
        .prepare(
          "SELECT packet FROM goal_delivery_review_packets_v23 WHERE owner_review_id=?",
        )
        .get(String(x.id)) as { packet: string } | undefined,
      packet = packetRow
        ? parse<OwnerReviewPacket>(packetRow.packet)
        : this.buildOwnerReviewPacket({
            reviewId: String(x.id),
            companyId: String(x.company_id),
            goalId: String(x.goal_id),
            stage: String(x.stage) as GoalDeliveryStage,
            meetingId: String(x.meeting_id),
            runId: x.run_id === null ? null : String(x.run_id),
            summary: String(x.korean_summary),
            decisions,
            risks,
            openItems,
            evidenceIds,
            createdAt: String(x.created_at),
          });
    return {
      id: String(x.id),
      processId: String(x.process_id),
      stageInstanceId: String(x.stage_instance_id),
      companyId: String(x.company_id),
      goalId: String(x.goal_id),
      meetingId: String(x.meeting_id),
      runId: x.run_id === null ? null : String(x.run_id),
      status: String(x.status) as GoalDeliveryOwnerReviewRecord["status"],
      koreanSummary: String(x.korean_summary),
      decisions,
      risks,
      openItems,
      evidenceIds,
      snapshotHash: String(x.snapshot_hash),
      packet: {
        ...packet,
        buildEvidence: packet.buildEvidence ?? null,
        snapshotHash: String(x.snapshot_hash),
      },
      createdAt: String(x.created_at),
      resolvedAt: x.resolved_at === null ? null : String(x.resolved_at),
      resolvedBy: x.resolved_by === null ? null : String(x.resolved_by),
    };
  }
  ownerReviewQueue(
    companyId: string,
    actorId: string,
    includeResolved = false,
  ): OwnerReviewQueueItem[] {
    this.require(companyId, actorId, "view");
    const rows = this.db
        .prepare(
          `SELECT r.stage_instance_id,g.title FROM goal_delivery_owner_reviews_v20 r JOIN company_goals_v12 g ON g.id=r.goal_id WHERE r.company_id=? ${includeResolved ? "" : "AND r.status IN ('pending','on-hold')"} ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'on-hold' THEN 1 ELSE 2 END,r.created_at DESC,r.id`,
        )
        .all(companyId) as Array<{ stage_instance_id: string; title: string }>,
      labels: Record<GoalDeliveryStage, string> = {
        discovery: "기획",
        "delivery-planning": "실행계획",
        build: "개발",
        release: "배포",
        operate: "운영·완료",
      };
    return rows.map((row) => {
      const review = this.ownerReviewForStage(row.stage_instance_id)!,
        stage = review.packet.stage;
      return {
        review,
        goalTitle: row.title,
        stage,
        stageLabel: labels[stage],
        urgency:
          review.risks.length || review.openItems.length ? "high" : "normal",
        requestedAt: review.createdAt,
      };
    });
  }
  private goalDeployment(id: string): GoalDeploymentRecord | null {
    const x = this.db
      .prepare("SELECT * FROM goal_deployments_v21 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          processId: String(x.process_id),
          stageInstanceId: String(x.stage_instance_id),
          companyId: String(x.company_id),
          goalId: String(x.goal_id),
          provider: "firebase",
          environment: String(
            x.environment,
          ) as GoalDeploymentRecord["environment"],
          action: String(x.action) as GoalDeploymentRecord["action"],
          targetProjectId:
            x.target_project_id === null ? null : String(x.target_project_id),
          targetChannel:
            x.target_channel === null ? null : String(x.target_channel),
          artifactSnapshotHash: String(x.artifact_snapshot_hash),
          status: String(x.status) as GoalDeploymentRecord["status"],
          approvedBy: String(x.approved_by),
          approvedAt: String(x.approved_at),
          receipt: x.receipt === null ? null : parse(x.receipt),
          failure: x.failure === null ? null : String(x.failure),
          rolledBackAt:
            x.rolled_back_at === null ? null : String(x.rolled_back_at),
          updatedAt: String(x.updated_at),
        }
      : null;
  }
  private goalDeploymentForStage(
    stageInstanceId: string,
  ): GoalDeploymentRecord | null {
    const row = this.db
      .prepare("SELECT id FROM goal_deployments_v21 WHERE stage_instance_id=?")
      .get(stageInstanceId) as { id: string } | undefined;
    return row ? this.goalDeployment(row.id) : null;
  }
  private goalChangeRequest(id: string): GoalChangeRequestRecord | null {
    const x = this.db
      .prepare("SELECT * FROM goal_change_requests_v22 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          companyId: String(x.company_id),
          goalId: String(x.goal_id),
          sourceProcessId: String(x.source_process_id),
          newProcessId: String(x.new_process_id),
          message: String(x.message),
          impactStage: String(
            x.impact_stage,
          ) as GoalChangeRequestRecord["impactStage"],
          rationale: parse(x.rationale),
          sourceCompletionHash: String(x.source_completion_hash),
          status: "accepted",
          createdBy: String(x.created_by),
          createdAt: String(x.created_at),
        }
      : null;
  }
  private deliveryProcessSnapshotById(processId: string): GoalDeliverySnapshot {
    const p = this.db
      .prepare("SELECT * FROM goal_delivery_processes_v19 WHERE id=?")
      .get(processId) as Record<string, unknown> | undefined;
    if (!p) throw new Error("Goal delivery process missing");
    const process: GoalDeliveryProcessRecord = {
        id: String(p.id),
        companyId: String(p.company_id),
        goalId: String(p.goal_id),
        processVersion: Number(p.process_version),
        version: Number(p.version),
        currentStage: String(p.current_stage) as GoalDeliveryStage,
        status: String(p.status) as GoalDeliveryProcessStatus,
        createdAt: String(p.created_at),
        updatedAt: String(p.updated_at),
        completedAt: p.completed_at === null ? null : String(p.completed_at),
      },
      stages = (
        this.db
          .prepare(
            "SELECT * FROM goal_delivery_stage_instances_v19 WHERE process_id=? ORDER BY CASE stage WHEN 'discovery' THEN 0 WHEN 'delivery-planning' THEN 1 WHEN 'build' THEN 2 WHEN 'release' THEN 3 ELSE 4 END,attempt",
          )
          .all(processId) as Array<Record<string, unknown>>
      ).map((x) => ({
        id: String(x.id),
        processId: String(x.process_id),
        stage: String(x.stage) as GoalDeliveryStage,
        attempt: Number(x.attempt),
        status: String(x.status) as GoalDeliveryStageStatus,
        runId: x.run_id === null ? null : String(x.run_id),
        meetingId: x.meeting_id === null ? null : String(x.meeting_id),
        startedAt: x.started_at === null ? null : String(x.started_at),
        completedAt: x.completed_at === null ? null : String(x.completed_at),
        createdAt: String(x.created_at),
        updatedAt: String(x.updated_at),
      })),
      ids = stages.map((x) => x.id),
      artifactSnapshots = ids.length
        ? (
            this.db
              .prepare(
                `SELECT a.* FROM goal_delivery_artifact_snapshots_v19 a JOIN goal_delivery_stage_instances_v19 s ON s.id=a.stage_instance_id WHERE s.process_id=? ORDER BY s.stage,a.version`,
              )
              .all(processId) as Array<Record<string, unknown>>
          ).map((x) => ({
            id: String(x.id),
            stageInstanceId: String(x.stage_instance_id),
            version: Number(x.version),
            artifactIds: parse<string[]>(x.artifact_ids),
            snapshotHash: String(x.snapshot_hash),
            stale: Boolean(x.stale),
            staleReason:
              x.stale_reason === null ? null : String(x.stale_reason),
            createdAt: String(x.created_at),
          }))
        : [],
      currentStageInstance =
        [...stages]
          .reverse()
          .find(
            (x) =>
              x.stage === process.currentStage &&
              !(
                [
                  "approved",
                  "revision-requested",
                  "cancelled",
                ] as GoalDeliveryStageStatus[]
              ).includes(x.status),
          ) ?? stages.at(-1);
    if (!currentStageInstance)
      throw new Error("Goal delivery current stage missing");
    const deploymentRow = this.db
      .prepare(
        "SELECT id FROM goal_deployments_v21 WHERE process_id=? ORDER BY approved_at DESC LIMIT 1",
      )
      .get(processId) as { id: string } | undefined;
    return {
      process,
      currentStageInstance,
      stages,
      artifactSnapshots,
      ownerReview: this.ownerReviewForStage(currentStageInstance.id),
      deployment: deploymentRow ? this.goalDeployment(deploymentRow.id) : null,
    };
  }
  private deliveryCommand(
    companyId: string,
    key: string,
    type: string,
  ): GoalDeliverySnapshot | null {
    const row = this.db
      .prepare(
        "SELECT command_type,result FROM goal_delivery_commands_v19 WHERE company_id=? AND idempotency_key=?",
      )
      .get(companyId, key) as
      | { command_type: string; result: string }
      | undefined;
    if (!row) return null;
    if (row.command_type !== type)
      throw new Error("Idempotency key was already used for another command");
    return parse<GoalDeliverySnapshot>(row.result);
  }
  private recordDeliveryCommand(
    companyId: string,
    processId: string,
    key: string,
    type: string,
    result: GoalDeliverySnapshot,
  ): void {
    this.db
      .prepare("INSERT INTO goal_delivery_commands_v19 VALUES(?,?,?,?,?,?)")
      .run(companyId, processId, key, type, json(result), now());
  }
  createGoal(
    input: Omit<CompanyGoalRecord, "createdAt" | "updatedAt" | "status"> & {
      status?: CompanyGoalStatus;
    },
    actorId: string,
  ): CompanyGoalRecord {
    this.require(input.companyId, actorId, "manage-org");
    const company = this.company(input.companyId);
    if (!company) throw new Error("Company missing");
    if (!input.title.trim()) throw new Error("Goal title required");
    if (
      !input.completionCriteria.length ||
      input.completionCriteria.some((x) => !x.trim())
    )
      throw new Error("Goal completion criteria required");
    if (!this.role(input.companyId, input.ownerId))
      throw new Error("Goal owner must be a company member");
    if (
      !Number.isFinite(input.budgetLimit) ||
      input.budgetLimit < 0 ||
      input.budgetLimit > company.budgetLimit
    )
      throw new Error("Goal budget violates company limit");
    const timestamp = now(),
      status = input.status ?? "draft";
    this.db
      .prepare("INSERT INTO company_goals_v12 VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        input.id,
        input.companyId,
        input.title.trim(),
        input.description.trim(),
        status,
        input.ownerId,
        json(input.completionCriteria.map((x) => x.trim())),
        input.budgetLimit,
        input.dueAt,
        timestamp,
        timestamp,
      );
    this.audit(input.companyId, "COMPANY_GOAL_CREATED", {
      actorId,
      goalId: input.id,
      status,
    });
    return this.goal(input.id)!;
  }
  goal(id: string): CompanyGoalRecord | null {
    const row = this.db
      .prepare("SELECT * FROM company_goals_v12 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return row
      ? {
          id: String(row.id),
          companyId: String(row.company_id),
          title: String(row.title),
          description: String(row.description),
          status: String(row.status) as CompanyGoalStatus,
          ownerId: String(row.owner_id),
          completionCriteria: parse<string[]>(row.completion_criteria),
          budgetLimit: Number(row.budget_limit),
          dueAt: row.due_at === null ? null : String(row.due_at),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        }
      : null;
  }
  goals(
    companyId: string,
    actorId: string,
  ): Array<
    CompanyGoalRecord & {
      projectCount: number;
      projectIds: string[];
      progress: number;
      blocked: number;
      pendingApprovals: number;
      spent: number;
    }
  > {
    this.require(companyId, actorId, "view");
    return (
      this.db
        .prepare(
          "SELECT g.id,(SELECT COUNT(*) FROM company_goal_projects_v12 gp WHERE gp.goal_id=g.id) project_count,(SELECT GROUP_CONCAT(gp.project_id) FROM company_goal_projects_v12 gp WHERE gp.goal_id=g.id) project_ids FROM company_goals_v12 g WHERE g.company_id=? ORDER BY CASE g.status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,g.due_at,g.created_at",
        )
        .all(companyId) as Array<{
        id: string;
        project_count: number;
        project_ids: string | null;
      }>
    ).map((row) => {
      const goal = this.goal(row.id)!,
        stats = this.goalMetrics(row.id);
      return {
        ...goal,
        projectCount: Number(row.project_count),
        projectIds: row.project_ids ? String(row.project_ids).split(",") : [],
        ...stats,
      };
    });
  }
  linkGoalProject(
    companyId: string,
    goalId: string,
    projectId: string,
    actorId: string,
  ): void {
    this.require(companyId, actorId, "manage-org");
    if (this.goal(goalId)?.companyId !== companyId)
      throw new Error("Cross-company goal blocked");
    if (
      !this.db
        .prepare(
          "SELECT 1 FROM company_projects_v4 WHERE company_id=? AND project_id=?",
        )
        .get(companyId, projectId)
    )
      throw new Error("Goal project must belong to company");
    const linked = this.db
      .prepare(
        "SELECT goal_id FROM company_goal_projects_v12 WHERE company_id=? AND project_id=?",
      )
      .get(companyId, projectId) as { goal_id: string } | undefined;
    if (linked)
      throw new Error(
        linked.goal_id === goalId
          ? "Project is already linked to this goal"
          : "Project is already linked to another goal; unlink it there first",
      );
    this.db
      .prepare("INSERT INTO company_goal_projects_v12 VALUES(?,?,?,?)")
      .run(goalId, companyId, projectId, now());
    this.db
      .prepare("UPDATE company_goals_v12 SET updated_at=? WHERE id=?")
      .run(now(), goalId);
    this.audit(companyId, "COMPANY_GOAL_PROJECT_LINKED", {
      actorId,
      goalId,
      projectId,
    });
  }
  transitionGoal(
    companyId: string,
    goalId: string,
    to: CompanyGoalStatus,
    actorId: string,
  ): CompanyGoalRecord {
    this.require(companyId, actorId, "manage-org");
    const goal = this.goal(goalId);
    if (!goal || goal.companyId !== companyId) throw new Error("Goal missing");
    const allowed: Record<CompanyGoalStatus, CompanyGoalStatus[]> = {
      draft: ["active", "cancelled"],
      active: ["blocked", "completed", "cancelled"],
      blocked: ["active", "cancelled"],
      completed: [],
      cancelled: [],
    };
    if (!allowed[goal.status].includes(to))
      throw new Error("Invalid goal transition");
    const metrics = this.goalMetrics(goalId);
    if (
      to === "completed" &&
      (metrics.total === 0 ||
        metrics.done !== metrics.total ||
        metrics.pendingApprovals > 0 ||
        metrics.validationFailures > 0)
    )
      throw new Error("Goal evidence is incomplete");
    this.db
      .prepare("UPDATE company_goals_v12 SET status=?,updated_at=? WHERE id=?")
      .run(to, now(), goalId);
    this.audit(companyId, "COMPANY_GOAL_TRANSITIONED", {
      actorId,
      goalId,
      from: goal.status,
      to,
    });
    return this.goal(goalId)!;
  }
  goalSnapshot(companyId: string, goalId: string, actorId: string): unknown {
    this.require(companyId, actorId, "view");
    const goal = this.goal(goalId);
    if (!goal || goal.companyId !== companyId) throw new Error("Goal missing");
    const projectIds = (
        this.db
          .prepare(
            "SELECT project_id FROM company_goal_projects_v12 WHERE goal_id=? ORDER BY linked_at,project_id",
          )
          .all(goalId) as Array<{ project_id: string }>
      ).map((x) => x.project_id),
      projects = projectIds.map(
        (projectId) =>
          this.projects.snapshot(projectId, {
            id: this.projectViewer(projectId),
          }) as any,
      ),
      metrics = this.goalMetrics(goalId),
      deliveryProcess = this.goalDeliveryProcess(companyId, goalId, actorId),
      timeline = [
        { type: "goal.created", createdAt: goal.createdAt, goalId },
        ...(
          this.db
            .prepare(
              `SELECT a.type,a.payload,a.created_at AS createdAt,a.project_id AS projectId FROM project_audit_v3 a JOIN company_goal_projects_v12 gp ON gp.project_id=a.project_id WHERE gp.goal_id=? ORDER BY a.created_at DESC LIMIT 200`,
            )
            .all(goalId) as Array<Record<string, unknown>>
        ).map((x) => ({ ...x, payload: parse(String(x.payload)) })),
      ];
    return {
      goal,
      deliveryProcess,
      metrics,
      projects,
      nextActions: [
        ...(metrics.blocked ? [`차단된 Task ${metrics.blocked}개 해소`] : []),
        ...(metrics.pendingApprovals
          ? [`대기 승인 ${metrics.pendingApprovals}건 처리`]
          : []),
        ...(metrics.validationFailures
          ? [`검증 실패 ${metrics.validationFailures}건 재검증`]
          : []),
        ...(!metrics.total
          ? ["프로젝트와 Task를 연결"]
          : metrics.done < metrics.total
            ? ["진행 중 Task를 완료"]
            : []),
      ],
      timeline,
      provenance: projectIds.map((x) => `project:${x}`),
      snapshotHash: sha(stable({ goal, deliveryProcess, metrics, projectIds })),
    };
  }
  private goalMetrics(goalId: string): {
    total: number;
    done: number;
    progress: number;
    blocked: number;
    pendingApprovals: number;
    validationFailures: number;
    spent: number;
    budget: number;
  } {
    const activeAttempt = `NOT EXISTS (SELECT 1 FROM goal_delivery_stage_instances_v19 s JOIN goal_delivery_processes_v19 p ON p.id=s.process_id WHERE s.run_id=t.run_id AND p.goal_id=gp.goal_id AND s.status='revision-requested')`,
      tasks = this.db
        .prepare(
          `SELECT COUNT(*) total,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) done,SUM(CASE WHEN t.status='blocked' OR r.status='BLOCKED' THEN 1 ELSE 0 END) blocked,COALESCE(SUM(t.spent),0) spent,COALESCE(SUM(t.budget_limit),0) budget FROM company_goal_projects_v12 gp JOIN board_tasks_v3 t ON t.project_id=gp.project_id LEFT JOIN runs r ON r.id=t.run_id WHERE gp.goal_id=? AND ${activeAttempt}`,
        )
        .get(goalId) as Record<string, unknown>,
      approvals = this.db
        .prepare(
          `SELECT COUNT(*) n FROM approvals a JOIN board_tasks_v3 t ON t.run_id=a.run_id JOIN company_goal_projects_v12 gp ON gp.project_id=t.project_id WHERE gp.goal_id=? AND a.status='PENDING' AND ${activeAttempt}`,
        )
        .get(goalId) as { n: number },
      failures = this.db
        .prepare(
          `SELECT COUNT(*) n FROM audit_events ae JOIN board_tasks_v3 t ON t.run_id=ae.run_id JOIN company_goal_projects_v12 gp ON gp.project_id=t.project_id WHERE gp.goal_id=? AND ae.type='VALIDATION_COMPLETED' AND json_extract(ae.payload,'$.passed')=0 AND ${activeAttempt}`,
        )
        .get(goalId) as { n: number },
      total = Number(tasks.total ?? 0),
      done = Number(tasks.done ?? 0);
    return {
      total,
      done,
      progress: total ? Math.round((done / total) * 100) : 0,
      blocked: Number(tasks.blocked ?? 0),
      pendingApprovals: Number(approvals.n),
      validationFailures: Number(failures.n),
      spent: Number(tasks.spent ?? 0),
      budget: Number(tasks.budget ?? 0),
    };
  }
  createMeeting(
    input: {
      id: string;
      companyId: string;
      goalId: string | null;
      projectId: string | null;
      runId: string | null;
      title: string;
      purpose: string;
      hostId: string;
      participantIds: string[];
      agenda: string[];
      scheduledAt: string | null;
    },
    actorId: string,
  ): CompanyMeetingRecord {
    this.require(input.companyId, actorId, "manage-org");
    if (!input.title.trim() || !input.purpose.trim() || !input.agenda.length)
      throw new Error("Meeting title, purpose and agenda required");
    if (!this.role(input.companyId, input.hostId))
      throw new Error("Meeting host must be a company member");
    for (const id of input.participantIds)
      if (!this.role(input.companyId, id))
        throw new Error("Meeting participant must belong to company");
    if (input.goalId && this.goal(input.goalId)?.companyId !== input.companyId)
      throw new Error("Cross-company meeting goal blocked");
    if (
      input.projectId &&
      !this.db
        .prepare(
          "SELECT 1 FROM company_projects_v4 WHERE company_id=? AND project_id=?",
        )
        .get(input.companyId, input.projectId)
    )
      throw new Error("Meeting project must belong to company");
    if (input.runId) {
      const projectId = (
        this.db
          .prepare("SELECT project_id FROM board_tasks_v3 WHERE run_id=?")
          .get(input.runId) as { project_id: string } | undefined
      )?.project_id;
      if (!projectId || projectId !== input.projectId)
        throw new Error("Meeting Run does not belong to project");
    }
    const timestamp = now(),
      participants = [...new Set([input.hostId, ...input.participantIds])];
    this.db
      .prepare(
        "INSERT INTO company_meetings_v13 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        input.id,
        input.companyId,
        input.goalId,
        input.projectId,
        input.runId,
        input.title.trim(),
        input.purpose.trim(),
        input.hostId,
        json(participants),
        json(input.agenda.map((x) => x.trim()).filter(Boolean)),
        "scheduled",
        input.scheduledAt,
        null,
        null,
        0,
        timestamp,
        timestamp,
      );
    this.audit(input.companyId, "MEETING_CREATED", {
      actorId,
      meetingId: input.id,
      goalId: input.goalId,
      projectId: input.projectId,
      runId: input.runId,
    });
    return this.meeting(input.id)!;
  }
  meeting(id: string): CompanyMeetingRecord | null {
    const x = this.db
      .prepare("SELECT * FROM company_meetings_v13 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          companyId: String(x.company_id),
          goalId: x.goal_id === null ? null : String(x.goal_id),
          projectId: x.project_id === null ? null : String(x.project_id),
          runId: x.run_id === null ? null : String(x.run_id),
          title: String(x.title),
          purpose: String(x.purpose),
          hostId: String(x.host_id),
          participantIds: parse(x.participant_ids),
          agenda: parse(x.agenda),
          status: String(x.status) as CompanyMeetingStatus,
          scheduledAt: x.scheduled_at === null ? null : String(x.scheduled_at),
          startedAt: x.started_at === null ? null : String(x.started_at),
          endedAt: x.ended_at === null ? null : String(x.ended_at),
          paused: Boolean(x.paused),
          createdAt: String(x.created_at),
          updatedAt: String(x.updated_at),
        }
      : null;
  }
  companyMeetings(
    companyId: string,
    actorId: string,
  ): Array<
    CompanyMeetingRecord & {
      messageCount: number;
      decisionCount: number;
      canParticipate: boolean;
    }
  > {
    this.require(companyId, actorId, "view");
    return (
      this.db
        .prepare(
          "SELECT id FROM company_meetings_v13 WHERE company_id=? ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'decision-pending' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,COALESCE(scheduled_at,created_at) DESC",
        )
        .all(companyId) as Array<{ id: string }>
    ).map((x) => {
      const meeting = this.meeting(x.id)!,
        counts = this.db
          .prepare(
            "SELECT COUNT(*) messages,SUM(CASE WHEN kind='decision' THEN 1 ELSE 0 END) decisions FROM meeting_messages_v13 WHERE meeting_id=?",
          )
          .get(x.id) as { messages: number; decisions: number };
      return {
        ...meeting,
        messageCount: Number(counts.messages),
        decisionCount: Number(counts.decisions ?? 0),
        canParticipate: meeting.participantIds.includes(actorId),
      };
    });
  }
  meetingSnapshot(
    companyId: string,
    meetingId: string,
    actorId: string,
  ): unknown {
    this.require(companyId, actorId, "view");
    const meeting = this.meeting(meetingId);
    if (!meeting || meeting.companyId !== companyId)
      throw new Error("Meeting missing");
    const messages = this.meetingMessages(meetingId),
      summary = this.meetingSummary(meetingId),
      members = this.db
        .prepare(
          "SELECT principal_id AS principalId,role,department_id AS departmentId,kind FROM company_members_v4 WHERE company_id=? ORDER BY principal_id",
        )
        .all(companyId) as unknown[];
    return {
      meeting,
      messages,
      summary,
      members,
      context: {
        goal: meeting.goalId ? this.goal(meeting.goalId) : null,
        project: meeting.projectId
          ? this.projects.project(meeting.projectId)
          : null,
        run: meeting.runId ? this.state.getRun(meeting.runId) : null,
      },
      audit: (this.auditEvents(companyId) as any[]).filter((x) =>
        String(x.payload).includes(meetingId),
      ),
    };
  }
  transitionMeeting(
    companyId: string,
    meetingId: string,
    to: CompanyMeetingStatus,
    actorId: string,
  ): CompanyMeetingRecord {
    const meeting = this.meeting(meetingId);
    if (!meeting || meeting.companyId !== companyId)
      throw new Error("Meeting missing");
    this.requireMeetingControl(meeting, actorId);
    const allowed: Record<CompanyMeetingStatus, CompanyMeetingStatus[]> = {
      scheduled: ["live", "cancelled"],
      live: ["decision-pending", "ended", "cancelled"],
      "decision-pending": ["live", "ended", "cancelled"],
      ended: [],
      cancelled: [],
    };
    if (!allowed[meeting.status].includes(to))
      throw new Error("Invalid meeting transition");
    const timestamp = now();
    this.db
      .prepare(
        "UPDATE company_meetings_v13 SET status=?,started_at=CASE WHEN ?='live' THEN COALESCE(started_at,?) ELSE started_at END,ended_at=CASE WHEN ? IN ('ended','cancelled') THEN ? ELSE ended_at END,paused=CASE WHEN ?='live' THEN 0 ELSE paused END,updated_at=? WHERE id=?",
      )
      .run(to, to, timestamp, to, timestamp, to, timestamp, meetingId);
    this.audit(companyId, "MEETING_TRANSITIONED", {
      actorId,
      meetingId,
      from: meeting.status,
      to,
    });
    if (to === "ended") this.generateMeetingSummary(meetingId);
    return this.meeting(meetingId)!;
  }
  setMeetingPaused(
    companyId: string,
    meetingId: string,
    paused: boolean,
    actorId: string,
  ): CompanyMeetingRecord {
    const meeting = this.meeting(meetingId);
    if (!meeting || meeting.companyId !== companyId)
      throw new Error("Meeting missing");
    this.requireMeetingControl(meeting, actorId);
    if (meeting.status !== "live")
      throw new Error("Only a live meeting can be paused");
    this.db
      .prepare(
        "UPDATE company_meetings_v13 SET paused=?,updated_at=? WHERE id=?",
      )
      .run(paused ? 1 : 0, now(), meetingId);
    this.audit(companyId, paused ? "MEETING_PAUSED" : "MEETING_RESUMED", {
      actorId,
      meetingId,
    });
    return this.meeting(meetingId)!;
  }
  authorizeMeetingControl(
    companyId: string,
    meetingId: string,
    actorId: string,
  ): void {
    const meeting = this.meeting(meetingId);
    if (!meeting || meeting.companyId !== companyId)
      throw new Error("Meeting missing");
    this.requireMeetingControl(meeting, actorId);
  }
  addMeetingMessage(
    companyId: string,
    meetingId: string,
    input: {
      id: string;
      kind: MeetingMessageKind;
      targetType: "all" | "member" | "agenda" | "goal-task";
      targetId: string | null;
      content: string;
      evidence: string[];
      followUp?: MeetingMessageRecord["followUp"];
    },
    actorId: string,
  ): MeetingMessageRecord {
    const meeting = this.meeting(meetingId);
    if (!meeting || meeting.companyId !== companyId)
      throw new Error("Meeting missing");
    this.require(companyId, actorId, "view");
    if (meeting.status !== "live" || meeting.paused)
      throw new Error("Meeting is not accepting messages");
    if (!meeting.participantIds.includes(actorId))
      throw new Error("Meeting participation denied");
    if (
      ["instruction", "decision"].includes(input.kind) &&
      !["owner", "executive", "department-manager"].includes(
        this.role(companyId, actorId) ?? "",
      )
    )
      throw new Error("Meeting intervention permission denied");
    if (!input.content.trim())
      throw new Error("Meeting message content required");
    if (
      input.targetType === "member" &&
      (!input.targetId || !meeting.participantIds.includes(input.targetId))
    )
      throw new Error("Meeting target participant missing");
    const timestamp = now();
    this.db
      .prepare("INSERT INTO meeting_messages_v13 VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        input.id,
        meetingId,
        companyId,
        actorId,
        input.kind,
        input.targetType,
        input.targetId,
        input.content.trim(),
        json(input.evidence),
        input.followUp ? json(input.followUp) : null,
        timestamp,
      );
    this.audit(companyId, "MEETING_MESSAGE_ADDED", {
      actorId,
      meetingId,
      messageId: input.id,
      kind: input.kind,
      targetType: input.targetType,
      targetId: input.targetId,
      evidence: input.evidence,
    });
    return this.meetingMessage(input.id)!;
  }
  appendAgentMeetingMessage(input: {
    companyId: string;
    meetingId: string;
    messageId: string;
    participantId: string;
    kind: "opinion" | "question";
    content: string;
    evidenceIds: string[];
    turnId: string;
    round: number;
    generatedBy: string;
    profileSnapshotId: string;
    backendSnapshotId: string;
    promptHash: string;
  }): MeetingMessageRecord {
    const prior = this.meetingMessage(input.messageId);
    if (prior) return prior;
    const meeting = this.meeting(input.meetingId),
      member = this.db
        .prepare(
          "SELECT kind FROM company_members_v4 WHERE company_id=? AND principal_id=?",
        )
        .get(input.companyId, input.participantId) as
        | { kind: string }
        | undefined;
    if (
      !meeting ||
      meeting.companyId !== input.companyId ||
      meeting.status !== "live" ||
      meeting.paused
    )
      throw new Error("Meeting is not accepting Agent messages");
    if (
      !meeting.participantIds.includes(input.participantId) ||
      member?.kind !== "agent"
    )
      throw new Error("Meeting Agent participant denied");
    if (!input.content.trim() || input.content.length > 4000)
      throw new Error("Meeting Agent output size invalid");
    const timestamp = now(),
      evidence = [...new Set(input.evidenceIds)].sort();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO meeting_messages_v13 VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          input.messageId,
          input.meetingId,
          input.companyId,
          input.participantId,
          input.kind,
          "all",
          null,
          input.content.trim(),
          json(evidence),
          null,
          timestamp,
        );
      this.db
        .prepare(
          "INSERT INTO meeting_agent_message_provenance_v18 VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          input.messageId,
          input.turnId,
          input.round,
          input.generatedBy,
          input.profileSnapshotId,
          input.backendSnapshotId,
          input.promptHash,
          json(evidence),
          timestamp,
        );
      this.audit(input.companyId, "MEETING_AGENT_MESSAGE_PROJECTED", {
        meetingId: input.meetingId,
        messageId: input.messageId,
        turnId: input.turnId,
        participantId: input.participantId,
        round: input.round,
        generatedBy: input.generatedBy,
        profileSnapshotId: input.profileSnapshotId,
        backendSnapshotId: input.backendSnapshotId,
        promptHash: input.promptHash,
        evidenceIds: evidence,
      });
      this.db.exec("COMMIT");
      return this.meetingMessage(input.messageId)!;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  meetingMessage(id: string): MeetingMessageRecord | null {
    const x = this.db
      .prepare("SELECT * FROM meeting_messages_v13 WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return x
      ? {
          id: String(x.id),
          meetingId: String(x.meeting_id),
          companyId: String(x.company_id),
          speakerId: String(x.speaker_id),
          kind: String(x.kind) as MeetingMessageKind,
          targetType: String(
            x.target_type,
          ) as MeetingMessageRecord["targetType"],
          targetId: x.target_id === null ? null : String(x.target_id),
          content: String(x.content),
          evidence: parse(x.evidence),
          followUp: x.follow_up === null ? null : parse(x.follow_up),
          createdAt: String(x.created_at),
        }
      : null;
  }
  meetingMessages(meetingId: string): MeetingMessageRecord[] {
    return (
      this.db
        .prepare(
          "SELECT id FROM meeting_messages_v13 WHERE meeting_id=? ORDER BY created_at,id",
        )
        .all(meetingId) as Array<{ id: string }>
    ).map((x) => this.meetingMessage(x.id)!);
  }
  meetingSummary(meetingId: string): unknown | null {
    const x = this.db
      .prepare("SELECT * FROM meeting_summaries_v13 WHERE meeting_id=?")
      .get(meetingId) as Record<string, unknown> | undefined;
    return x
      ? {
          meetingId,
          status: String(x.status),
          paragraph: String(x.paragraph),
          agendaSummaries: parse(x.agenda_summaries),
          decisions: parse(x.decisions),
          openItems: parse(x.open_items),
          risks: parse(x.risks),
          interventionMessageIds: parse(x.intervention_message_ids),
          followUps: parse(x.follow_ups),
          createdTaskIds: parse(x.created_task_ids),
          confirmedBy: x.confirmed_by === null ? null : String(x.confirmed_by),
          confirmedAt: x.confirmed_at === null ? null : String(x.confirmed_at),
          createdAt: String(x.created_at),
          updatedAt: String(x.updated_at),
        }
      : null;
  }
  confirmMeetingSummary(
    companyId: string,
    meetingId: string,
    actorId: string,
  ): unknown {
    this.require(companyId, actorId, "manage-policy");
    const meeting = this.meeting(meetingId);
    if (
      !meeting ||
      meeting.companyId !== companyId ||
      meeting.status !== "ended"
    )
      throw new Error("Ended meeting required");
    const summary = this.meetingSummary(meetingId) as any;
    if (!summary || summary.status !== "draft")
      throw new Error("Meeting summary draft missing");
    const taskIds: string[] = [];
    if (meeting.projectId)
      for (const followUp of summary.followUps as Array<any>) {
        const id = crypto.randomUUID();
        this.projects.createTask(
          {
            id,
            projectId: meeting.projectId,
            milestoneId: null,
            title: String(followUp.title),
            status: "backlog",
            priority: 50,
            completionCriteria:
              Array.isArray(followUp.completionCriteria) &&
              followUp.completionCriteria.length
                ? followUp.completionCriteria
                : ["회의 결정 이행"],
            budgetLimit: Math.max(0, Number(followUp.budgetLimit ?? 0)),
          },
          { id: this.projectViewer(meeting.projectId) },
        );
        if (followUp.assigneeId)
          this.projects.assign(
            id,
            { id: this.projectViewer(meeting.projectId) },
            followUp.assigneeId,
            "human",
            "executor",
          );
        taskIds.push(id);
      }
    const timestamp = now();
    this.db
      .prepare(
        "UPDATE meeting_summaries_v13 SET status='confirmed',created_task_ids=?,confirmed_by=?,confirmed_at=?,updated_at=? WHERE meeting_id=?",
      )
      .run(json(taskIds), actorId, timestamp, timestamp, meetingId);
    this.audit(companyId, "MEETING_SUMMARY_CONFIRMED", {
      actorId,
      meetingId,
      goalId: meeting.goalId,
      projectId: meeting.projectId,
      taskIds,
      decisions: summary.decisions,
    });
    return this.meetingSummary(meetingId);
  }
  private generateMeetingSummary(meetingId: string): void {
    if (this.meetingSummary(meetingId)) return;
    const meeting = this.meeting(meetingId)!,
      messages = this.meetingMessages(meetingId),
      decisions = messages
        .filter((x) => x.kind === "decision")
        .map((x) => x.content),
      openItems = messages
        .filter((x) => x.kind === "question")
        .map((x) => x.content),
      risks = messages
        .filter(
          (x) => x.kind === "opinion" && /위험|risk|우려/i.test(x.content),
        )
        .map((x) => x.content),
      followUps = messages.flatMap((x) => (x.followUp ? [x.followUp] : [])),
      interventions = messages
        .filter((x) =>
          ["question", "opinion", "instruction", "decision"].includes(x.kind),
        )
        .map((x) => x.id),
      paragraph = messages.length
        ? `${meeting.title}에서 발언 ${messages.length}건을 검토했습니다. 명시적 결정 ${decisions.length}건, 위험 ${risks.length}건, 미해결 질문 ${openItems.length}건, 후속 작업 ${followUps.length}건이 기록되었습니다.`
        : "발언 없이 종료된 회의입니다. 명시적인 결정과 후속 작업이 없습니다.",
      agendaSummaries = meeting.agenda.map((agenda) => {
        const count = messages.filter(
          (x) => x.targetType === "agenda" && x.targetId === agenda,
        ).length;
        return {
          agenda,
          summary: count
            ? `관련 발언 ${count}건이 기록되었습니다. 원문은 기술 근거에서 확인할 수 있습니다.`
            : "논의 기록 없음",
        };
      }),
      timestamp = now();
    this.db
      .prepare(
        "INSERT INTO meeting_summaries_v13 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        meetingId,
        "draft",
        paragraph,
        json(agendaSummaries),
        json(decisions),
        json(openItems),
        json(risks),
        json(interventions),
        json(followUps),
        json([]),
        null,
        null,
        timestamp,
        timestamp,
      );
    this.audit(meeting.companyId, "MEETING_SUMMARY_DRAFTED", {
      meetingId,
      decisions: decisions.length,
      followUps: followUps.length,
    });
  }
  private requireMeetingControl(
    meeting: CompanyMeetingRecord,
    actorId: string,
  ): void {
    const role = this.role(meeting.companyId, actorId);
    if (
      actorId !== meeting.hostId &&
      !["owner", "executive", "department-manager"].includes(role ?? "")
    )
      throw new Error("Meeting control permission denied");
  }
  searchCompany(
    companyId: string,
    actorId: string,
    query: string,
  ): CompanySearchResult[] {
    this.require(companyId, actorId, "view");
    const q = query.trim();
    if (q.length < 2 || q.length > 100)
      throw new Error("Search query must be 2-100 characters");
    const like = `%${q}%`,
      results: CompanySearchResult[] = [];
    for (const x of this.db
      .prepare(
        "SELECT id,title,description,status,created_at FROM company_goals_v12 WHERE company_id=? AND (title LIKE ? OR description LIKE ?) ORDER BY updated_at DESC LIMIT 20",
      )
      .all(companyId, like, like) as Array<any>)
      results.push({
        kind: "goal",
        id: x.id,
        title: x.title,
        description: x.description,
        status: x.status,
        url: `/goals?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT p.id,p.name,p.status,p.created_at FROM projects_v3 p JOIN company_projects_v4 cp ON cp.project_id=p.id WHERE cp.company_id=? AND p.name LIKE ? ORDER BY p.created_at DESC LIMIT 20",
      )
      .all(companyId, like) as Array<any>)
      results.push({
        kind: "project",
        id: x.id,
        title: x.name,
        description: "회사 프로젝트",
        status: x.status,
        url: `/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT t.id,t.title,t.status,t.project_id,t.run_id,t.created_at FROM board_tasks_v3 t JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE cp.company_id=? AND t.title LIKE ? ORDER BY t.created_at DESC LIMIT 20",
      )
      .all(companyId, like) as Array<any>)
      results.push({
        kind: "task",
        id: x.id,
        title: x.title,
        description: `Project ${x.project_id}`,
        status: x.status,
        url: `/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.project_id)}&taskId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT r.id,r.goal,r.status,r.updated_at,t.project_id FROM runs r JOIN board_tasks_v3 t ON t.run_id=r.id JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE cp.company_id=? AND (r.id LIKE ? OR r.goal LIKE ?) ORDER BY r.updated_at DESC LIMIT 20",
      )
      .all(companyId, like, like) as Array<any>)
      results.push({
        kind: "run",
        id: x.id,
        title: x.goal,
        description: x.id,
        status: x.status,
        url: `/execution?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.project_id)}&runId=${encodeURIComponent(x.id)}`,
        createdAt: x.updated_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT principal_id,role,kind FROM company_members_v4 WHERE company_id=? AND (principal_id LIKE ? OR role LIKE ?) ORDER BY principal_id LIMIT 20",
      )
      .all(companyId, like, like) as Array<any>)
      results.push({
        kind: "member",
        id: x.principal_id,
        title: x.principal_id,
        description: `${x.role} · ${x.kind}`,
        status: null,
        url: `/employees?companyId=${encodeURIComponent(companyId)}&agentId=${encodeURIComponent(x.principal_id)}`,
        createdAt: null,
      });
    for (const x of this.db
      .prepare(
        "SELECT id,title,purpose,status,created_at FROM company_meetings_v13 WHERE company_id=? AND (title LIKE ? OR purpose LIKE ?) ORDER BY updated_at DESC LIMIT 20",
      )
      .all(companyId, like, like) as Array<any>)
      results.push({
        kind: "meeting",
        id: x.id,
        title: x.title,
        description: x.purpose,
        status: x.status,
        url: `/meetings?companyId=${encodeURIComponent(companyId)}&meetingId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT m.id,m.meeting_id,m.content,m.created_at FROM meeting_messages_v13 m WHERE m.company_id=? AND m.kind='decision' AND m.content LIKE ? ORDER BY m.created_at DESC LIMIT 20",
      )
      .all(companyId, like) as Array<any>)
      results.push({
        kind: "decision",
        id: x.id,
        title: x.content,
        description: "회의 결정",
        status: null,
        url: `/meetings?companyId=${encodeURIComponent(companyId)}&meetingId=${encodeURIComponent(x.meeting_id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT seq,type,payload,created_at FROM company_audit_v4 WHERE company_id=? AND (type LIKE ? OR payload LIKE ?) ORDER BY seq DESC LIMIT 20",
      )
      .all(companyId, like, like) as Array<any>)
      results.push({
        kind: "audit",
        id: String(x.seq),
        title: x.type,
        description: String(x.payload).slice(0, 240),
        status: null,
        url: `/activity?companyId=${encodeURIComponent(companyId)}&audit=${x.seq}`,
        createdAt: x.created_at,
      });
    return results.slice(0, 100);
  }
  companyAlerts(companyId: string, actorId: string): CompanyAlert[] {
    this.require(companyId, actorId, "view");
    const read = new Map(
        (
          this.db
            .prepare(
              "SELECT alert_key,read_at FROM company_alert_reads_v14 WHERE company_id=? AND principal_id=?",
            )
            .all(companyId, actorId) as Array<{
            alert_key: string;
            read_at: string;
          }>
        ).map((x) => [x.alert_key, x.read_at]),
      ),
      alerts: CompanyAlert[] = [],
      push = (x: Omit<CompanyAlert, "readAt">) =>
        alerts.push({ ...x, readAt: read.get(x.key) ?? null });
    for (const x of this.db
      .prepare(
        "SELECT t.id,t.title,t.project_id,t.created_at,r.id run_id FROM board_tasks_v3 t JOIN company_projects_v4 cp ON cp.project_id=t.project_id LEFT JOIN runs r ON r.id=t.run_id WHERE cp.company_id=? AND (t.status='blocked' OR r.status='BLOCKED')",
      )
      .all(companyId) as Array<any>)
      push({
        key: `blocked:${x.id}`,
        kind: "blocked",
        severity: "critical",
        title: `차단: ${x.title}`,
        description: x.run_id ? `Run ${x.run_id} 차단` : `Task 차단`,
        url: `/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.project_id)}&taskId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT a.id,a.kind,a.requested_at,t.project_id,r.id run_id FROM approvals a JOIN runs r ON r.id=a.run_id JOIN board_tasks_v3 t ON t.run_id=r.id JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE cp.company_id=? AND a.status='PENDING' AND ((a.kind='plan' AND r.status='PLAN_APPROVAL_WAITING') OR (a.kind='result' AND r.status='RESULT_APPROVAL_WAITING')) AND NOT EXISTS (SELECT 1 FROM goal_delivery_stage_instances_v19 s WHERE s.run_id=r.id AND s.status='revision-requested')",
      )
      .all(companyId) as Array<any>)
      push({
        key: `approval:${x.id}`,
        kind: "approval",
        severity: "warning",
        title: `승인 대기: ${x.kind}`,
        description: `Run ${x.run_id}`,
        url: `/execution?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.project_id)}&runId=${encodeURIComponent(x.run_id)}`,
        createdAt: x.requested_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT ae.seq,ae.run_id,ae.created_at,t.project_id FROM audit_events ae JOIN board_tasks_v3 t ON t.run_id=ae.run_id JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE cp.company_id=? AND ae.type='VALIDATION_COMPLETED' AND json_extract(ae.payload,'$.passed')=0 ORDER BY ae.seq DESC LIMIT 20",
      )
      .all(companyId) as Array<any>)
      push({
        key: `validation:${x.seq}`,
        kind: "validation",
        severity: "critical",
        title: "검증 실패",
        description: `Run ${x.run_id} 재검증 필요`,
        url: `/execution?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.project_id)}&runId=${encodeURIComponent(x.run_id)}`,
        createdAt: x.created_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT id,title,status,updated_at FROM company_meetings_v13 WHERE company_id=? AND status IN ('live','decision-pending')",
      )
      .all(companyId) as Array<any>)
      push({
        key: `meeting:${x.id}`,
        kind: "meeting",
        severity: x.status === "decision-pending" ? "warning" : "info",
        title:
          x.status === "decision-pending"
            ? `결정 대기: ${x.title}`
            : `진행 중 회의: ${x.title}`,
        description: "회의 참여 가능",
        url: `/meetings?companyId=${encodeURIComponent(companyId)}&meetingId=${encodeURIComponent(x.id)}`,
        createdAt: x.updated_at,
      });
    for (const x of this.db
      .prepare(
        "SELECT p.id,p.name,p.spent,p.budget_limit,p.created_at FROM projects_v3 p JOIN company_projects_v4 cp ON cp.project_id=p.id WHERE cp.company_id=? AND p.budget_limit>0 AND p.spent/p.budget_limit>=0.8",
      )
      .all(companyId) as Array<any>)
      push({
        key: `budget:${x.id}`,
        kind: "budget",
        severity:
          Number(x.spent) >= Number(x.budget_limit) ? "critical" : "warning",
        title: `예산 위험: ${x.name}`,
        description: `${x.spent}/${x.budget_limit} 사용`,
        url: `/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(x.id)}`,
        createdAt: x.created_at,
      });
    for (const project of this.db
      .prepare("SELECT project_id FROM company_projects_v4 WHERE company_id=?")
      .all(companyId) as Array<{ project_id: string }>)
      for (const x of this.projects
        .actionableNotifications(project.project_id)
        .filter((item) => item.readAt === null)) {
        const described = describeNotification(x.type, x.payload);
        push({
          key: `notification:${x.id}`,
          kind: "notification",
          severity: "warning",
          title: described.title,
          description: described.description,
          url: `/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(project.project_id)}`,
          createdAt: x.createdAt,
        });
      }
    if (
      this.role(companyId, actorId) === "owner" &&
      this.db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='deterministic_reports_v17'",
        )
        .get()
    )
      for (const x of this.db
        .prepare(
          "SELECT id,current_state,created_at FROM deterministic_reports_v17 WHERE company_id=? AND status='unroutable' ORDER BY source_cursor DESC LIMIT 20",
        )
        .all(companyId) as Array<any>)
        push({
          key: `report-unroutable:${x.id}`,
          kind: "notification",
          severity: "critical",
          title: "보고 수신자 구성 필요",
          description: String(x.current_state),
          url: `/activity?companyId=${encodeURIComponent(companyId)}&tab=reports`,
          createdAt: x.created_at,
        });
    const rank = { critical: 0, warning: 1, info: 2 };
    return alerts.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        b.createdAt.localeCompare(a.createdAt),
    );
  }
  readCompanyAlert(companyId: string, alertKey: string, actorId: string): void {
    this.require(companyId, actorId, "view");
    if (!this.companyAlerts(companyId, actorId).some((x) => x.key === alertKey))
      throw new Error("Company alert missing");
    const timestamp = now();
    this.db
      .prepare("INSERT OR REPLACE INTO company_alert_reads_v14 VALUES(?,?,?,?)")
      .run(companyId, actorId, alertKey, timestamp);
    this.audit(companyId, "COMPANY_ALERT_READ", { actorId, alertKey });
  }
  requestCompanyDeletion(
    companyId: string,
    actorId: string,
    typedName: string,
  ): unknown {
    this.require(companyId, actorId, "manage-policy");
    const company = this.company(companyId);
    if (!company) throw new Error("Company missing");
    if (company.status !== "archived")
      throw new Error("Company must be archived before deletion request");
    if (typedName !== company.name)
      throw new Error("Company name confirmation mismatch");
    const impact = this.companyDeletionImpact(companyId);
    if (impact.blockers.length)
      throw new Error(
        `Company deletion blocked: ${impact.blockers.join(", ")}`,
      );
    const timestamp = now();
    this.db
      .prepare(
        "INSERT OR REPLACE INTO company_deletion_requests_v14 VALUES(?,?,?,?,?,?,NULL)",
      )
      .run(companyId, actorId, typedName, json(impact), "pending", timestamp);
    this.audit(companyId, "COMPANY_DELETION_REQUESTED", { actorId, impact });
    return this.companyDeletionRequest(companyId);
  }
  cancelCompanyDeletion(companyId: string, actorId: string): unknown {
    this.require(companyId, actorId, "manage-policy");
    const timestamp = now();
    if (
      this.db
        .prepare(
          "UPDATE company_deletion_requests_v14 SET status='cancelled',cancelled_at=? WHERE company_id=? AND status='pending'",
        )
        .run(timestamp, companyId).changes !== 1
    )
      throw new Error("Pending deletion request missing");
    this.audit(companyId, "COMPANY_DELETION_CANCELLED", { actorId });
    return this.companyDeletionRequest(companyId);
  }
  companyDeletionRequest(companyId: string): unknown | null {
    const x = this.db
      .prepare("SELECT * FROM company_deletion_requests_v14 WHERE company_id=?")
      .get(companyId) as Record<string, unknown> | undefined;
    return x
      ? {
          companyId,
          status: String(x.status),
          requestedBy: String(x.requested_by),
          impact: parse(x.impact),
          requestedAt: String(x.requested_at),
          cancelledAt: x.cancelled_at === null ? null : String(x.cancelled_at),
        }
      : null;
  }
  companyDeletionImpact(companyId: string): {
    projects: number;
    members: number;
    goals: number;
    meetings: number;
    runs: number;
    auditEvents: number;
    blockers: string[];
  } {
    const n = (sql: string) =>
        Number((this.db.prepare(sql).get(companyId) as { n: number }).n),
      runs = n(
        "SELECT COUNT(*) n FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id JOIN runs r ON r.id=t.run_id WHERE cp.company_id=? AND r.status NOT IN ('COMPLETED','FAILED','CANCELLED') AND NOT EXISTS (SELECT 1 FROM goal_delivery_stage_instances_v19 s WHERE s.run_id=r.id AND s.status='revision-requested')",
      ),
      meetings = n(
        "SELECT COUNT(*) n FROM company_meetings_v13 WHERE company_id=? AND status IN ('scheduled','live','decision-pending')",
      ),
      approvals = n(
        "SELECT COUNT(*) n FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id JOIN approvals a ON a.run_id=t.run_id JOIN runs r ON r.id=a.run_id WHERE cp.company_id=? AND a.status='PENDING' AND ((a.kind='plan' AND r.status='PLAN_APPROVAL_WAITING') OR (a.kind='result' AND r.status='RESULT_APPROVAL_WAITING')) AND NOT EXISTS (SELECT 1 FROM goal_delivery_stage_instances_v19 s WHERE s.run_id=r.id AND s.status='revision-requested')",
      ),
      summaries = n(
        "SELECT COUNT(*) n FROM meeting_summaries_v13 s JOIN company_meetings_v13 m ON m.id=s.meeting_id WHERE m.company_id=? AND s.status='draft' AND NOT EXISTS (SELECT 1 FROM goal_delivery_stage_instances_v19 d WHERE d.meeting_id=m.id AND d.status='revision-requested')",
      ),
      blockers = [
        ...(runs ? [`${runs} active Run(s)`] : []),
        ...(meetings ? [`${meetings} active meeting(s)`] : []),
        ...(approvals ? [`${approvals} pending approval(s)`] : []),
        ...(summaries ? [`${summaries} draft meeting summary(s)`] : []),
      ];
    return {
      projects: n(
        "SELECT COUNT(*) n FROM company_projects_v4 WHERE company_id=?",
      ),
      members: n(
        "SELECT COUNT(*) n FROM company_members_v4 WHERE company_id=?",
      ),
      goals: n("SELECT COUNT(*) n FROM company_goals_v12 WHERE company_id=?"),
      meetings: n(
        "SELECT COUNT(*) n FROM company_meetings_v13 WHERE company_id=?",
      ),
      runs: n(
        "SELECT COUNT(*) n FROM company_projects_v4 cp JOIN board_tasks_v3 t ON t.project_id=cp.project_id WHERE cp.company_id=? AND t.run_id IS NOT NULL",
      ),
      auditEvents: n(
        "SELECT COUNT(*) n FROM company_audit_v4 WHERE company_id=?",
      ),
      blockers,
    };
  }
  auditEvents(companyId: string): unknown[] {
    return this.db
      .prepare(
        "SELECT seq,type,payload,created_at AS createdAt FROM company_audit_v4 WHERE company_id=? ORDER BY seq",
      )
      .all(companyId) as unknown[];
  }
  auditRunPolicyDenied(runId: string, payload: unknown): void {
    const governance = this.governanceForRun(runId);
    if (governance)
      this.audit(governance.companyId, "RUN_POLICY_DENIED", {
        runId,
        ...(payload as object),
      });
  }
  private runContext(
    runId: string,
  ): {
    companyId: string;
    projectId: string;
    taskId: string;
    projectDepartmentId: string;
  } | null {
    const row = this.db
      .prepare(
        "SELECT cp.company_id AS companyId,t.project_id AS projectId,t.id AS taskId,cp.department_id AS projectDepartmentId FROM board_tasks_v3 t JOIN company_projects_v4 cp ON cp.project_id=t.project_id WHERE t.run_id=?",
      )
      .get(runId) as
      | {
          companyId: string;
          projectId: string;
          taskId: string;
          projectDepartmentId: string;
        }
      | undefined;
    return row ?? null;
  }
  private assignedMember(
    context: { companyId: string; taskId: string },
    pipelineRole: CompanyPipelineRole,
  ): {
    memberId: string | null;
    responsibility: "owner" | "executor" | "reviewer";
    departmentId: string | null;
  } {
    const responsibility = (
        pipelineRole === "planner"
          ? "owner"
          : pipelineRole === "worker"
            ? "executor"
            : "reviewer"
      ) as "owner" | "executor" | "reviewer",
      rows = this.db
        .prepare(
          "SELECT a.principal_id,m.department_id FROM assignments_v3 a LEFT JOIN company_members_v4 m ON m.company_id=? AND m.principal_id=a.principal_id WHERE a.task_id=? AND a.responsibility=? AND a.kind='agent' ORDER BY a.principal_id",
        )
        .all(context.companyId, context.taskId, responsibility) as Array<{
        principal_id: string;
        department_id: string | null;
      }>;
    if (
      rows.some(
        (x) =>
          x.department_id === null &&
          !this.role(context.companyId, x.principal_id),
      )
    )
      throw new Error(`Cross-company ${pipelineRole} assignment blocked`);
    if (!rows.length)
      return { memberId: null, responsibility, departmentId: null };
    let selected = rows[0]!;
    if (rows.length > 1) {
      const primary = this.db
        .prepare(
          "SELECT principal_id FROM task_role_primaries_v15 WHERE task_id=? AND responsibility=?",
        )
        .get(context.taskId, responsibility) as
        | { principal_id: string }
        | undefined;
      if (!primary) throw new Error(`Ambiguous ${pipelineRole} assignment`);
      const match = rows.find((x) => x.principal_id === primary.principal_id);
      if (!match) throw new Error(`Invalid primary ${pipelineRole} assignment`);
      selected = match;
    }
    return {
      memberId: selected.principal_id,
      responsibility,
      departmentId: selected.department_id,
    };
  }
  private resolveRoleProfile(
    runId: string,
    pipelineRole: CompanyPipelineRole,
  ): ResolvedRoleProfile | null {
    const context = this.runContext(runId);
    if (!context) return null;
    const company = this.company(context.companyId)!;
    const member = this.assignedMember(context, pipelineRole),
      targets: Array<{
        targetType: "company" | "project" | "task";
        targetId: string;
        pipelineRole: CompanyPipelineRole | null;
      }> = [
        { targetType: "task", targetId: context.taskId, pipelineRole },
        { targetType: "project", targetId: context.projectId, pipelineRole },
        { targetType: "task", targetId: context.taskId, pipelineRole: null },
        {
          targetType: "project",
          targetId: context.projectId,
          pipelineRole: null,
        },
        { targetType: "company", targetId: context.companyId, pipelineRole },
        {
          targetType: "company",
          targetId: context.companyId,
          pipelineRole: null,
        },
      ];
    let template: RoleTemplateRecord | null = null,
      bindingSource: ResolvedRoleProfile["bindingSource"] = null;
    for (const target of targets) {
      const row = this.db
        .prepare(
          "SELECT template_id FROM role_template_bindings_v15 WHERE company_id=? AND target_type=? AND target_id=? AND pipeline_role=?",
        )
        .get(
          context.companyId,
          target.targetType,
          target.targetId,
          target.pipelineRole ?? "",
        ) as { template_id: string } | undefined;
      if (!row) continue;
      template =
        this.roleTemplates(context.companyId).find(
          (x) => x.id === row.template_id,
        ) ?? null;
      if (!template) throw new Error("Role template binding target missing");
      bindingSource = target;
      break;
    }
    if (template?.departmentId) {
      const expected = member.memberId
        ? member.departmentId
        : context.projectDepartmentId;
      if (template.departmentId !== expected)
        throw new Error(`Template department mismatch for ${pipelineRole}`);
    }
    const templateTools = template?.allowedTools ?? company.allowedTools,
      base = {
        executionSnapshotId: null,
        companyId: context.companyId,
        projectId: context.projectId,
        taskId: context.taskId,
        pipelineRole,
        memberId: member.memberId,
        assignmentResponsibility: member.responsibility,
        departmentId: member.departmentId ?? context.projectDepartmentId,
        templateId: template?.id ?? null,
        templateLogicalId: template?.logicalId ?? null,
        templateVersion: template?.version ?? null,
        templateName: template?.name ?? null,
        jobFamily:
          template?.jobFamily ??
          ((pipelineRole === "planner"
            ? "planning"
            : pipelineRole === "reviewer"
              ? "qa"
              : "engineering") as JobFamily),
        bindingSource,
        responsibility: template?.responsibility ?? null,
        completionCriteria: template?.completionCriteria ?? [],
        requiredOutputs: template?.requiredOutputs ?? [],
        prohibitedActions: template?.prohibitedActions ?? [],
        qualityChecklist: template?.qualityChecklist ?? [],
        escalationConditions: template?.escalationConditions ?? [],
        allowedTools: templateTools
          .filter((x) => company.allowedTools.includes(x))
          .sort(),
        requiredReviews: [
          ...new Set([
            ...company.mandatoryReviews,
            ...(template?.requiredReviews ?? []),
          ]),
        ].sort(),
        requiredApprovals: [
          ...new Set([
            ...company.mandatoryApprovals,
            ...(template?.requiredApprovals ?? []),
          ]),
        ].sort(),
      };
    return { ...base, profileHash: sha(stable(base)) };
  }
  private policyDenied(
    companyId: string,
    actorId: string,
    reason: string,
    message: string,
  ): never {
    this.audit(companyId, "COMPANY_POLICY_DENIED", { actorId, reason });
    throw new Error(message);
  }
  private audit(companyId: string, type: string, payload: unknown): void {
    this.db
      .prepare(
        "INSERT INTO company_audit_v4(company_id,type,payload,created_at) VALUES(?,?,?,?)",
      )
      .run(companyId, type, json(payload), now());
  }
}
export { sha as companyHash };
export class CompanyRunGovernance {
  constructor(private readonly companies: CompanyOperations) {}
  freeze(runId: string): string | null {
    return this.companies.freezeRunExecution(runId);
  }
  requiresReviewer(runId: string): boolean {
    return (
      (this.companies.governanceForRun(runId, "reviewer")?.requiredReviews
        .length ?? 0) > 0
    );
  }
  context(runId: string, role: CompanyPipelineRole = "worker"): unknown {
    return this.companies.governanceForRun(runId, role);
  }
  assertTools(runId: string, tools: readonly string[]): void {
    const governance = this.companies.governanceForRun(runId, "worker");
    if (!governance) return;
    const denied = tools.filter((x) => !governance.allowedTools.includes(x));
    if (denied.length) {
      this.companies.auditRunPolicyDenied(runId, {
        reason: "tool-denied",
        denied,
      });
      throw new Error(
        `Company role template blocks tools: ${denied.join(",")}`,
      );
    }
  }
}
