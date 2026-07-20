import type { AgentCompanyEventV2, CompanyMode } from "../../contracts/src/index.js";

export interface LegacyEventRow {
  cursor: number;
  eventId: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  timestamp: string;
  payload: unknown;
}

// Maps every legacy SCREAMING_SNAKE_CASE audit event type (as of this repo's Phase 1-6
// implementation) to a dot-notation v2 type. Unmapped types fall back to a `legacy.*`
// namespace in mapLegacyEventType rather than throwing, so a new audit call site never
// silently breaks the event stream.
export const LEGACY_EVENT_TYPE_MAP: Readonly<Record<string, string>> = {
  // Run lifecycle
  RUN_CREATED: "run.created",
  RUN_TRANSITIONED: "run.transitioned",
  RUN_POLICY_DENIED: "run.policy_denied",
  POLICY_DECIDED: "risk.assessed",
  GOAL_CREATED: "goal.created",
  PLAN_CREATED: "plan.created",
  REVISION_CREATED: "task.revision_created",
  WORKFLOW_COMPLETED: "workflow.completed",

  // Plan / result approval
  PLAN_APPROVED: "plan.approved",
  RESULT_APPROVED: "result.approved",
  RESULT_HASH_BOUND: "approval.result_hash_bound",
  STALE_APPROVAL_BLOCKED: "approval.stale_blocked",
  PATCH_HASH_BLOCKED: "approval.patch_hash_blocked",

  // Role pipeline
  ROLE_SKIPPED: "role.skipped",
  ROLE_COMPLETED: "role.completed",
  BUDGET_BLOCKED: "budget.exceeded",

  // Validation / context
  VALIDATION_COMPLETED: "validation.completed",
  VALIDATION_FAILED: "validation.failed",
  CONTEXT_BUILT: "context.built",

  // Worktree / diff / merge / artifact
  WORKTREE_CREATED: "worktree.created",
  WORKTREE_REMOVED: "worktree.removed",
  DIFF_CREATED: "artifact.diff_created",
  DIFF_SCOPE_VALIDATED: "worktree.diff_scope_validated",
  SCOPE_BLOCKED: "tool.scope_blocked",
  MERGE_CANDIDATE_CREATED: "merge.candidate_created",
  MERGE_ASSESSED: "merge.assessed",
  ARTIFACT_GRAPH_CAPTURED: "artifact.graph_captured",

  // Tool gateway
  TOOL_STARTED: "tool.call_started",
  TOOL_COMPLETED: "tool.call_completed",
  TOOL_FAILED: "tool.call_failed",
  TOOL_BLOCKED: "tool.call_blocked",

  // Sandbox
  LOCAL_SANDBOX_STARTED: "sandbox.local_started",
  LOCAL_SANDBOX_COMPLETED: "sandbox.local_completed",
  LOCAL_SANDBOX_FAILED: "sandbox.local_failed",
  LOCAL_SANDBOX_BLOCKED: "sandbox.local_blocked",
  SANDBOX_STARTED: "sandbox.docker_started",
  SANDBOX_COMPLETED: "sandbox.docker_completed",
  SANDBOX_FAILED: "sandbox.docker_failed",

  // Worker
  WORKER_FAILED: "task.worker_failed",

  // Company
  COMPANY_AUTHORIZATION_DENIED: "company.authorization_denied",
  COMPANY_MEMBER_SET: "company.member_set",
  DEPARTMENT_CREATED: "company.department_created",
  DEPARTMENT_MOVED: "company.department_moved",
  DEPARTMENT_BUDGET_CHANGED: "company.department_budget_changed",
  PROJECT_LINKED: "company.project_linked",
  PROJECT_PRIORITY_CHANGED: "company.project_priority_changed",
  ROLE_TEMPLATE_VERSIONED: "company.role_template_versioned",
  ROLE_TEMPLATE_BOUND: "company.role_template_bound",
  COMPANY_POLICY_VERSIONED: "company.policy_versioned",
  COMPANY_POLICY_DENIED: "company.policy_denied",
  REVIEW_ADDED: "review.added",
  REVIEW_AGGREGATED: "review.aggregated",
  CEO_BRIEFING_CREATED: "briefing.created",

  // Platform / workflow / plugin
  WORKFLOW_DRAFT_CREATED: "workflow.draft_created",
  WORKFLOW_ACCESS_DENIED: "workflow.access_denied",
  WORKFLOW_POLICY_DENIED: "workflow.policy_denied",
  WORKFLOW_INVALID: "workflow.invalid",
  WORKFLOW_VALIDATED: "workflow.validated",
  WORKFLOW_TAMPERED: "workflow.tampered",
  WORKFLOW_PUBLISHED: "workflow.published",
  WORKFLOW_BINDING_DENIED: "workflow.binding_denied",
  WORKFLOW_BOUND: "workflow.bound",
  WORKFLOW_RUN_POLICY_DENIED: "workflow.run_policy_denied",
  ADAPTER_REGISTERED: "adapter.registered",
  PLUGIN_DENIED: "plugin.denied",
  PLUGIN_REGISTERED: "plugin.registered",
  TOOL_GATEWAY_DENIED: "tool.gateway_denied",
  TOOL_GATEWAY_ALLOWED: "tool.gateway_allowed",
  INDUSTRY_TEMPLATE_INSTALLED: "platform.industry_installed",
  EXTERNAL_ADAPTER_INVOKED: "adapter.external_invoked",

  // Project ops
  MEMBER_SET: "project.member_set",
  AUTHORIZATION_DENIED: "project.authorization_denied",
  MILESTONE_CREATED: "project.milestone_created",
  MILESTONE_TRANSITIONED: "project.milestone_transitioned",
  PROJECT_BUDGET_CHANGED: "project.budget_changed",
  BOARD_TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_TRANSITION_DENIED: "task.transition_denied",
  TASK_TRANSITIONED: "task.transitioned",
  RUN_LINK_DENIED: "project.run_link_denied",
  RUN_LINKED: "project.run_linked",
  TASK_CLAIMED: "task.claimed",
  TASK_CLAIM_DENIED: "task.claim_denied",
  TASK_HEARTBEAT: "task.heartbeat",
  TASK_HEARTBEAT_DENIED: "task.heartbeat_denied",
  EXPIRED_LEASES_RECOVERED: "project.leases_recovered",
  PROJECT_RUNS_RECOVERED: "project.runs_recovered",
  PROJECT_BUDGET_BLOCKED: "project.budget_blocked",
  PROJECT_BUDGET_RESERVED: "project.budget_reserved",
  PROJECT_BUDGET_SETTLED: "project.budget_settled",
  NOTIFICATION_READ: "notification.read",

  // Security (not yet wired into events_v6; mapped for when/if that trigger is added)
  AUTHENTICATION_DENIED: "security.authentication_denied",
  LOGIN_SUCCEEDED: "security.login_succeeded"
};

export function mapLegacyEventType(legacyType: string): string {
  const mapped = LEGACY_EVENT_TYPE_MAP[legacyType];
  if (mapped) return mapped;
  return `legacy.${legacyType.toLowerCase()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringField(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) { const value = payload[key]; if (typeof value === "string" && value) return value; }
  return undefined;
}

// Legacy audit rows carry no structured actor; only some payloads include an actorId/userId.
// This is a best-effort inference, not a guarantee — treat `actor.type` as approximate for
// events mapped from legacy data.
function inferActor(payload: Record<string, unknown>): { type: "user" | "agent" | "system"; id: string } {
  const id = stringField(payload, "actorId", "userId", "principalId");
  if (id) return { type: "user", id };
  return { type: "system", id: "system" };
}

export function mapLegacyEvent(row: LegacyEventRow, mode: CompanyMode = "live"): AgentCompanyEventV2 {
  const payload = asRecord(row.payload);
  const projectId = stringField(payload, "projectId") ?? (row.aggregateType === "project" ? row.aggregateId : undefined);
  const runId = stringField(payload, "runId") ?? (row.aggregateType === "run" ? row.aggregateId : undefined);
  const taskId = stringField(payload, "taskId") ?? (row.type === "BOARD_TASK_CREATED" ? stringField(payload, "id") : undefined);
  const agentId = stringField(payload, "agentId", "principalId", "suggestedAgent", "owner");
  const correlationId = runId ?? projectId ?? row.aggregateId ?? row.eventId;

  return {
    eventId: row.eventId,
    eventVersion: 2,
    type: mapLegacyEventType(row.type),
    sequence: row.cursor,
    occurredAt: row.timestamp,
    companyId: row.tenantId,
    ...(projectId ? { projectId } : {}),
    ...(runId ? { runId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(agentId ? { agentId } : {}),
    correlationId,
    actor: inferActor(payload),
    mode,
    payload
  };
}
