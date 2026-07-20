export type RunStatus =
  | "CREATED" | "PLANNING" | "PLAN_APPROVAL_WAITING" | "READY" | "RUNNING" | "VALIDATING"
  | "RESULT_APPROVAL_WAITING" | "COMPLETED" | "PAUSED" | "BLOCKED" | "RETRY_WAITING"
  | "REVISION_REQUIRED" | "CANCELLING" | "CANCELLED" | "FAILED";

export interface StoredRun {
  id: string;
  requestId: string;
  goal: string;
  risk: string;
  status: RunStatus;
  budgetLimit: number;
  spent: number;
  checkpoint: Record<string, unknown> | null;
}

export interface StoredTask {
  id: string;
  runId: string;
  role: string;
  status: string;
  input: unknown;
  output: unknown | null;
  ordinal: number;
  completionCriteria: string[];
  validationCommands: string[];
  dependsOn: string[];
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  kind: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  expectedPatchHash: string | null;
  requestedAt?: string;
  expiresAt?: string | null;
}

export interface StoredRunResult {
  runId: string;
  worktree: string;
  patch: string;
  patchHash: string;
  files: string[];
  validation: unknown[];
}

export interface AuditEvent { seq: number; type: string; payload: unknown; createdAt: string }
export interface MergeCandidateRecord { runId: string; branch: string; commit: string; baseCommit: string; patchHash: string }

export interface Phase2Bundle {
  artifacts: unknown[];
  relations: unknown[];
  stale: unknown[];
  impact: unknown | null;
  contexts: unknown[];
  mergeAssessments: unknown[];
}

export interface RunDetail {
  run: StoredRun | null;
  tasks: StoredTask[];
  approvals: ApprovalRecord[];
  result: StoredRunResult | null;
  lineage: unknown;
  audit: AuditEvent[];
  candidate: MergeCandidateRecord | null;
  agentBindings: ResolvedAgentBinding[];
  phase2: Phase2Bundle;
}

export type RunAction = "approve-plan" | "approve-result" | "pause" | "retry" | "cancel";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RunSummary { id: string; goal: string; risk: string; status: RunStatus; budgetLimit: number; spent: number; updatedAt: string }

export interface PlatformMetrics {
  sampleCount: number;
  period: { from: string | null; to: string };
  completionRate: number;
  validationRate: number;
  staleCount: number;
  cost: number;
}

export interface ExpansionRecommendation {
  kind: string;
  reason: string;
  evidence: unknown;
  requiresApproval: boolean;
  action: string;
}

export interface ExpansionRecommendations { items: ExpansionRecommendation[] }

export interface GameState {
  milestones: string[];
  badges: string[];
  progress: { completed: number; total: number };
  stateHash: string;
}

export type WorkflowStatus = "draft" | "validated" | "published";
export interface WorkflowStep { id: string; roleTemplateId: string; dependsOn: string[]; completionCriteria: string[]; tools: string[] }
export interface WorkflowRecord {
  id: string; logicalId: string; version: number; parentVersionId: string | null; companyId: string;
  name: string; status: WorkflowStatus; steps: WorkflowStep[]; requiredReviews: string[]; requiredApprovals: string[];
  budgetLimit: number; contentHash: string; createdAt: string; publishedAt: string | null;
}

export type IndustryName = "software" | "public-sector" | "data";
export interface IndustryBundle { version: number; departments: string[]; roles: string[]; workflow: string[] }
export interface IndustryPreview { industry: IndustryName; bundle: IndustryBundle; hash: string; installed: unknown; diff: string[]; requiresApproval: boolean }

export interface ExternalAdapterStatus { id: string; contractVersion: string; status: "ready" | "open" | "disabled"; failures: number; openedUntil: string | null }

export interface PlatformSnapshot {
  workflows: WorkflowRecord[];
  industries: IndustryPreview[];
  adapters: ExternalAdapterStatus[];
  metrics: PlatformMetrics;
  recommendations: ExpansionRecommendations;
  game: GameState;
}

export type BoardStatus = "backlog" | "ready" | "in-progress" | "review" | "blocked" | "done";
export type AssigneeKind = "human" | "agent";
export type ProjectResponsibility = "owner" | "executor" | "reviewer";

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  repoPath: string;
  defaultBranch: string;
  runtimePath: string;
  organizationProfile: unknown;
  budgetLimit: number;
  spent: number;
  status: "active" | "archived";
}

export interface MilestoneSnapshot {
  id: string;
  projectId: string;
  title: string;
  status: "planned" | "active" | "completed" | "cancelled";
  completionCriteria: string[];
  budgetLimit: number;
  spent: number;
  dueAt: string | null;
  progress: { total: number; done: number };
}

export interface AssignmentRecord { taskId: string; principalId: string; kind: AssigneeKind; responsibility: ProjectResponsibility }

export interface TaskSnapshot {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  status: BoardStatus;
  priority: number;
  completionCriteria: string[];
  budgetLimit: number;
  spent: number;
  runId: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  assignments: AssignmentRecord[];
}

export interface NotificationRecord {
  id: string;
  projectId: string;
  dedupeKey: string;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export interface ProjectSnapshot {
  project: ProjectRecord;
  milestones: MilestoneSnapshot[];
  tasks: TaskSnapshot[];
  supersededTasks?: TaskSnapshot[];
  notifications: NotificationRecord[];
  progress: { total: number; done: number };
}

export const BOARD_STATUSES: BoardStatus[] = ["backlog", "ready", "in-progress", "review", "blocked", "done"];

export type CompanyMode = "demo" | "live";

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

export interface DepartmentRecord { id: string; companyId: string; parentId: string | null; name: string; budgetLimit: number }

export interface PortfolioTotals {
  projects: number; tasks: number; done: number; spent: number; budget: number;
  blocked: number; stale: number; conflicts: number; approvals: number;
}

export interface Portfolio {
  company: CompanyRecord;
  departments: DepartmentRecord[];
  projects: Array<{
    departmentId: string;
    priority: number;
    project: ProjectRecord;
    progress: { total: number; done: number };
    risks: { blocked: number; stale: number; conflicts: number; approvals: number };
  }>;
  totals: PortfolioTotals;
  snapshotHash: string;
}

export interface BriefingRecord {
  id: string;
  companyId: string;
  portfolioHash: string;
  decisions: string[];
  nextActions: string[];
  briefingHash: string;
  createdAt: string;
}

export interface AssignmentRecommendation {
  projectId: string;
  taskId: string;
  departmentId: string;
  templateId: string;
  suggestedAgent: string;
  reason: string;
  requiresApproval: boolean;
}

export interface CompanyCommandCenterSnapshot {
  portfolio: Portfolio;
  briefings: BriefingRecord[];
  recommendations: AssignmentRecommendation[];
  meetings: Array<{id:string;projectId:string;recommendation:string;createdAt:string}>;
  meetingSessions: Array<{id:string;title:string;status:"scheduled"|"live"|"decision-pending"|"ended"|"cancelled";messageCount:number;decisionCount:number}>;
  pixel: {agents:Array<{principal_id:string;state?:string;role:string}>};
  audit: Array<{seq:number;type:string;createdAt:string}>;
  roleTemplates: RoleTemplate[];
  roleBindings: Array<{templateId:string;targetType:"company"|"project"|"task";targetId:string;pipelineRole:"planner"|"worker"|"reviewer"|null;createdAt:string}>;
}
export interface RoleTemplate {id:string;logicalId:string;version:number;parentVersionId:string|null;companyId:string;departmentId:string|null;name:string;jobFamily:"planning"|"engineering"|"design"|"qa"|"security"|"operations";responsibility:string;completionCriteria:string[];requiredOutputs:string[];prohibitedActions:Array<{action:string;enforcement:"deterministic-check"|"prompt-only"}>;qualityChecklist:string[];escalationConditions:string[];allowedTools:string[];requiredReviews:string[];requiredApprovals:string[];createdAt:string}
export type AgentBackendType="standalone"|"legacy-nvidia"|"openai-compatible"|"claude-cli"|"codex-cli";
export interface AgentBinding {id:string;companyId:string;targetKind:"company"|"role"|"member";targetId:string;backend:AgentBackendType;modelId:string;config:Record<string,unknown>;version:number;changedBy:string;changedAt:string}
export interface ResolvedAgentBinding {executionSnapshotId:string|null;companyId:string;role:"planner"|"worker"|"reviewer";memberId:string|null;backend:AgentBackendType;modelId:string;resolution:"demo-mode"|"member"|"role"|"company"|"runtime-default";bindingId:string|null;bindingVersion:number|null}
