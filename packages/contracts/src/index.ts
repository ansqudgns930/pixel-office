export const CONTRACT_VERSION = "1.0";

export type ExecutionStrategy = "single_agent" | "manager_subagents" | "role_pipeline";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface UserContext { userId: string; roles: string[] }
export interface ModelInfo { id: string; label: string }
export interface ModelRequest {
  contractVersion: string;
  requestId: string;
  hostId: string;
  deadline: number;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}
export interface ModelResult { requestId: string; text: string; tokens: number; cost: number; estimated?: boolean }
export interface UsageRecord { requestId: string; tokens: number; cost: number; estimated?: boolean | undefined }
export interface AgentEvent { id: string; type: string; runId: string; payload: Record<string, unknown> }

export type ActorType = "user" | "agent" | "system";
export type CompanyMode = "demo" | "live";

// Standard event envelope (more.md §35.1). Legacy SCREAMING_SNAKE_CASE audit events are
// translated into this shape by packages/event-mapper rather than emitted directly.
export interface AgentCompanyEventV2 {
  eventId: string;
  eventVersion: 2;
  type: string;
  sequence: number;
  occurredAt: string;

  companyId: string;
  workspaceId?: string;
  projectId?: string;
  runId?: string;
  taskId?: string;
  agentId?: string;

  correlationId: string;
  causationId?: string;
  actor: { type: ActorType; id: string };

  mode: CompanyMode;
  payload: Record<string, unknown>;
}
export interface HostCapabilities { auth: boolean; models: boolean; usage: boolean; events: boolean; streamingAbort: boolean }

export interface WorkRequest {
  runId: string;
  requestId: string;
  strategy: ExecutionStrategy;
  risk: RiskLevel;
  goal: string;
  approved: boolean;
  allowedPaths: string[];
  requestedPaths: string[];
  maxCost: number;
}

export interface AuditEntry { at: string; runId: string; type: string; detail: Record<string, unknown> }
export interface ArtifactRecord { path: string; kind: "code" | "test"; sha256: string; basedOn: string; validation: "passed" | "failed" }
export interface WorkResult {
  runId: string;
  status: "completed" | "blocked" | "failed";
  cost: number;
  durationMs: number;
  validationPassed: boolean;
  artifacts: ArtifactRecord[];
  checkpointId?: string;
  audit: AuditEntry[];
}
