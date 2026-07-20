import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type RunStatus = "CREATED" | "PLANNING" | "PLAN_APPROVAL_WAITING" | "READY" | "RUNNING" | "VALIDATING" | "REVISION_REQUIRED" | "RESULT_APPROVAL_WAITING" | "COMPLETED" | "PAUSED" | "CANCELLING" | "CANCELLED" | "FAILED" | "BLOCKED";
export type TaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface StoredRun { id: string; requestId: string; goal: string; risk: string; status: RunStatus; budgetLimit: number; spent: number; checkpoint: Record<string, unknown> | null }
export interface StoredTask { id: string; runId: string; role: string; status: TaskStatus; input: unknown; output: unknown | null; ordinal: number; completionCriteria: string[]; validationCommands: string[]; dependsOn: string[] }
export interface ApprovalRecord { id: string; runId: string; kind: string; status: "PENDING" | "APPROVED" | "REJECTED"; expectedPatchHash: string | null;requestedAt?:string;expiresAt?:string|null }
export interface RunLineage { modelCalls: Record<string, unknown>[]; toolCalls: Record<string, unknown>[]; validations: Record<string, unknown>[]; usage: Record<string, unknown>[]; artifacts: Record<string, unknown>[] }
export interface MergeCandidateRecord { runId: string; branch: string; commit: string; baseCommit: string; patchHash: string }
export interface StoredRunResult { runId: string; worktree: string; patch: string; patchHash: string; files: string[]; validation: unknown[] }
export type ArtifactKind = "requirement" | "task" | "code" | "test" | "validation" | "context" | "review";
export interface ArtifactVersionRecord { id: string; logicalId: string; version: number; parentVersionId: string | null; runId: string; kind: ArtifactKind; path: string | null; baseCommit: string; contentHash: string; stale: boolean; staleReason: string | null; createdAt: string }
export interface ArtifactRelationRecord { id: string; fromVersionId: string; toVersionId: string; type: string; evidence: unknown; createdAt: string }
export interface StoredContextBuild { id: string; runId: string; bundleHash: string; bundle: unknown; createdAt: string }
export interface MergeAssessmentRecord { id: string; runId: string; currentHead: string; baseMoved: boolean; overlappingFiles: string[]; conflictedFiles: string[]; conflict: boolean; revalidationRequired: boolean; createdAt: string }

export interface StateStore {
  createRun(run: StoredRun): void;
  getRun(id: string): StoredRun | null;
  listRuns(limit?: number): Array<StoredRun & { updatedAt: string }>;
  recoverableRuns(): StoredRun[];
  transition(id: string, from: RunStatus[], to: RunStatus, checkpoint?: Record<string, unknown>): boolean;
  updateRun(id:string,expected:RunStatus,checkpoint:Record<string,unknown>,budgetLimit?:number):boolean;
  spend(id: string, amount: number): boolean;
  addTask(task: StoredTask): void;
  tasks(runId: string): StoredTask[];
  completeTask(id: string, output: unknown): void;
  resetTask(id:string,input:unknown):void;
  createApproval(record: ApprovalRecord): void;
  bindApprovalHash(id: string, expectedPatchHash: string): boolean;
  decideApproval(id: string, approved: boolean, userId: string): boolean;
  approval(id: string): ApprovalRecord | null;
  addArtifact(runId: string, path: string, sha256: string, kind: string, metadata?: unknown): void;
  recordModelCall(runId: string, role: string, requestId: string, status: string, tokens: number, cost: number, output: unknown): void;
  recordToolCall(runId: string, name: string, status: string, detail?: unknown): void;
  recordValidation(runId: string, kind: string, passed: boolean, output: string): void;
  recordUsage(runId: string, requestId: string, tokens: number, cost: number, estimated?: boolean): void;
  lineage(runId: string): RunLineage;
  addMergeCandidate(candidate: MergeCandidateRecord): void;
  mergeCandidate(runId: string): MergeCandidateRecord | null;
  saveRunResult(result: StoredRunResult): void;
  runResult(runId: string): StoredRunResult | null;
  approvals(runId: string): ApprovalRecord[];
  auditEvents(runId: string): Array<{ seq: number; type: string; payload: unknown; createdAt: string }>;
  createArtifactVersion(input: Omit<ArtifactVersionRecord, "id" | "version" | "stale" | "staleReason" | "createdAt">): ArtifactVersionRecord;
  artifactVersions(logicalId: string): ArtifactVersionRecord[];
  artifactVersionsForRun(runId: string): ArtifactVersionRecord[];
  artifactVersion(id: string): ArtifactVersionRecord | null;
  addArtifactRelation(fromVersionId: string, toVersionId: string, type: string, evidence?: unknown): ArtifactRelationRecord;
  artifactRelations(versionId?: string): ArtifactRelationRecord[];
  markArtifactStale(versionId: string, reason: string): string[];
  staleArtifactsForRun(runId: string): ArtifactVersionRecord[];
  artifactNeighborhood(versionIds: readonly string[]): ArtifactVersionRecord[];
  latestArtifactVersionsByPaths(paths: readonly string[]): ArtifactVersionRecord[];
  saveContextBuild(runId: string, bundleHash: string, bundle: unknown): StoredContextBuild;
  contextBuilds(runId: string): StoredContextBuild[];
  saveMergeAssessment(input: Omit<MergeAssessmentRecord, "id" | "createdAt">): MergeAssessmentRecord;
  mergeAssessments(runId: string): MergeAssessmentRecord[];
  audit(runId: string, type: string, payload?: unknown): void;
  close(): void;
}

const MIGRATIONS = [`
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs(
 id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, goal TEXT NOT NULL, risk TEXT NOT NULL,
 status TEXT NOT NULL, budget_limit REAL NOT NULL, spent REAL NOT NULL DEFAULT 0,
 checkpoint TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks(
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 role TEXT NOT NULL, status TEXT NOT NULL, input TEXT NOT NULL, output TEXT,
 ordinal INTEGER NOT NULL, UNIQUE(run_id, ordinal)
);
CREATE TABLE IF NOT EXISTS approvals(
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, status TEXT NOT NULL, expected_patch_hash TEXT,
 decided_by TEXT, decided_at TEXT
);
CREATE TABLE IF NOT EXISTS artifacts(
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 path TEXT NOT NULL, sha256 TEXT NOT NULL, kind TEXT NOT NULL, metadata TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events(
 seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
 run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_run ON tasks(run_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_audit_run ON audit_events(run_id, seq);
`, `
ALTER TABLE tasks ADD COLUMN completion_criteria TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN validation_commands TEXT NOT NULL DEFAULT '[]';
CREATE TABLE task_dependencies(task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, PRIMARY KEY(task_id,depends_on_task_id));
CREATE TABLE model_calls(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, role TEXT NOT NULL, request_id TEXT NOT NULL, status TEXT NOT NULL, tokens INTEGER NOT NULL, cost REAL NOT NULL, output TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id,request_id));
CREATE TABLE tool_calls(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, name TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE validation_results(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, kind TEXT NOT NULL, passed INTEGER NOT NULL, output TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE usage_records(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, request_id TEXT NOT NULL, tokens INTEGER NOT NULL, cost REAL NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id,request_id));
CREATE INDEX idx_model_calls_run ON model_calls(run_id,created_at);
CREATE INDEX idx_tool_calls_run ON tool_calls(run_id,created_at);
CREATE INDEX idx_validation_run ON validation_results(run_id,created_at);
CREATE INDEX idx_usage_run ON usage_records(run_id,created_at);
`, `
CREATE TABLE merge_candidates(run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE, branch TEXT UNIQUE NOT NULL, commit_hash TEXT NOT NULL, base_commit TEXT NOT NULL, patch_hash TEXT NOT NULL, created_at TEXT NOT NULL);
`, `
CREATE TABLE run_results(run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE, worktree TEXT NOT NULL, patch TEXT NOT NULL, patch_hash TEXT NOT NULL, files TEXT NOT NULL, validation TEXT NOT NULL, created_at TEXT NOT NULL);
`, `
CREATE TABLE artifact_entities(logical_id TEXT PRIMARY KEY, kind TEXT NOT NULL, path TEXT);
CREATE TABLE artifact_versions_v2(id TEXT PRIMARY KEY, logical_id TEXT NOT NULL REFERENCES artifact_entities(logical_id) ON DELETE CASCADE, version INTEGER NOT NULL, parent_version_id TEXT REFERENCES artifact_versions_v2(id), run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, base_commit TEXT NOT NULL, content_hash TEXT NOT NULL, stale INTEGER NOT NULL DEFAULT 0, stale_reason TEXT, created_at TEXT NOT NULL, UNIQUE(logical_id,version));
CREATE TABLE artifact_relations(id TEXT PRIMARY KEY, from_version_id TEXT NOT NULL REFERENCES artifact_versions_v2(id) ON DELETE CASCADE, to_version_id TEXT NOT NULL REFERENCES artifact_versions_v2(id) ON DELETE CASCADE, type TEXT NOT NULL, evidence TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(from_version_id,to_version_id,type), CHECK(from_version_id<>to_version_id));
CREATE INDEX idx_artifact_versions_logical ON artifact_versions_v2(logical_id,version);
CREATE INDEX idx_artifact_relations_from ON artifact_relations(from_version_id);
CREATE INDEX idx_artifact_relations_to ON artifact_relations(to_version_id);
`, `
CREATE TABLE context_builds(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, bundle_hash TEXT NOT NULL, bundle TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_context_builds_run ON context_builds(run_id,created_at);
`, `
CREATE TABLE merge_assessments(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, current_head TEXT NOT NULL, base_moved INTEGER NOT NULL, overlapping_files TEXT NOT NULL, conflicted_files TEXT NOT NULL, conflict INTEGER NOT NULL, revalidation_required INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_merge_assessments_run ON merge_assessments(run_id,created_at);
`, `
ALTER TABLE approvals ADD COLUMN requested_at TEXT;
ALTER TABLE approvals ADD COLUMN expires_at TEXT;
`, `
CREATE TABLE agent_bindings_v7(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,target_kind TEXT NOT NULL CHECK(target_kind IN ('company','role','member')),target_id TEXT NOT NULL,backend TEXT NOT NULL,model_id TEXT NOT NULL,config TEXT NOT NULL,version INTEGER NOT NULL,changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,UNIQUE(company_id,target_kind,target_id));
CREATE TABLE run_agent_binding_snapshots_v7(run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,role TEXT NOT NULL,company_id TEXT NOT NULL,member_id TEXT,binding TEXT NOT NULL,resolution TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(run_id,role));
CREATE INDEX idx_agent_bindings_v7_company ON agent_bindings_v7(company_id,target_kind,target_id);
`, `
ALTER TABLE usage_records ADD COLUMN estimated INTEGER NOT NULL DEFAULT 0;
`];

const json = (value: unknown): string => JSON.stringify(value ?? null);
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;

export class SQLiteStateStore implements StateStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    const has = this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?");
    const add = this.db.prepare("INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)");
    for (let i = 0; i < MIGRATIONS.length; i++) if (!has.get(i + 1)) {
      this.db.exec("BEGIN IMMEDIATE");
      try { this.db.exec(MIGRATIONS[i]!); add.run(i + 1, new Date().toISOString()); this.db.exec("COMMIT"); }
      catch (error) { this.db.exec("ROLLBACK"); throw error; }
    }
  }

  createRun(run: StoredRun): void {
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO runs(id,request_id,goal,risk,status,budget_limit,spent,checkpoint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(run.id, run.requestId, run.goal, run.risk, run.status, run.budgetLimit, run.spent, run.checkpoint ? json(run.checkpoint) : null, now, now);
  }
  getRun(id: string): StoredRun | null {
    const x = this.db.prepare("SELECT * FROM runs WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return x ? { id: String(x.id), requestId: String(x.request_id), goal: String(x.goal), risk: String(x.risk), status: String(x.status) as RunStatus, budgetLimit: Number(x.budget_limit), spent: Number(x.spent), checkpoint: x.checkpoint ? parse<Record<string, unknown>>(x.checkpoint) : null } : null;
  }
  listRuns(limit = 50): Array<StoredRun & { updatedAt: string }> {
    return (this.db.prepare("SELECT id, updated_at FROM runs ORDER BY updated_at DESC, id LIMIT ?").all(Math.max(1, Math.min(200, limit))) as Array<{ id: string; updated_at: string }>).map(row => ({ ...this.getRun(row.id)!, updatedAt: row.updated_at }));
  }
  recoverableRuns(): StoredRun[] {
    const terminal = ["COMPLETED", "CANCELLED", "FAILED", "BLOCKED"];
    const marks = terminal.map(() => "?").join(",");
    return (this.db.prepare(`SELECT id FROM runs WHERE status NOT IN (${marks}) ORDER BY created_at`).all(...terminal) as Array<{ id: string }>).map(row => this.getRun(row.id)!);
  }
  transition(id: string, from: RunStatus[], to: RunStatus, checkpoint?: Record<string, unknown>): boolean {
    if (!from.length) return false;
    const marks = from.map(() => "?").join(",");
    const result = this.db.prepare(`UPDATE runs SET status=?,checkpoint=COALESCE(?,checkpoint),updated_at=? WHERE id=? AND status IN (${marks})`).run(to, checkpoint ? json(checkpoint) : null, new Date().toISOString(), id, ...from);
    return result.changes === 1;
  }
  updateRun(id:string,expected:RunStatus,checkpoint:Record<string,unknown>,budgetLimit?:number):boolean { const result=this.db.prepare("UPDATE runs SET checkpoint=?,budget_limit=COALESCE(?,budget_limit),updated_at=? WHERE id=? AND status=? AND (? IS NULL OR ?>=spent)").run(json(checkpoint),budgetLimit??null,new Date().toISOString(),id,expected,budgetLimit??null,budgetLimit??null);return result.changes===1; }
  spend(id: string, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    return this.db.prepare("UPDATE runs SET spent=spent+?,updated_at=? WHERE id=? AND spent+?<=budget_limit").run(amount, new Date().toISOString(), id, amount).changes === 1;
  }
  addTask(task: StoredTask): void {
    if (!task.completionCriteria.length) throw new Error(`Task ${task.id} requires completion criteria`);
    this.db.exec("BEGIN IMMEDIATE"); try {
      this.db.prepare("INSERT OR IGNORE INTO tasks(id,run_id,role,status,input,output,ordinal,completion_criteria,validation_commands) VALUES(?,?,?,?,?,?,?,?,?)").run(task.id, task.runId, task.role, task.status, json(task.input), task.output === null ? null : json(task.output), task.ordinal, json(task.completionCriteria), json(task.validationCommands));
      const dependency = this.db.prepare("INSERT OR IGNORE INTO task_dependencies(task_id,depends_on_task_id) VALUES(?,?)"); for (const id of task.dependsOn) dependency.run(task.id, id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  tasks(runId: string): StoredTask[] { return (this.db.prepare("SELECT * FROM tasks WHERE run_id=? ORDER BY ordinal").all(runId) as Record<string, unknown>[]).map(x => ({ id: String(x.id), runId: String(x.run_id), role: String(x.role), status: String(x.status) as TaskStatus, input: parse(x.input), output: x.output === null ? null : parse(x.output), ordinal: Number(x.ordinal), completionCriteria: parse<string[]>(x.completion_criteria), validationCommands: parse<string[]>(x.validation_commands), dependsOn: (this.db.prepare("SELECT depends_on_task_id AS id FROM task_dependencies WHERE task_id=? ORDER BY depends_on_task_id").all(String(x.id)) as Array<{id:string}>).map(row => row.id) })); }
  completeTask(id: string, output: unknown): void { this.db.prepare("UPDATE tasks SET status='COMPLETED',output=? WHERE id=?").run(json(output), id); }
  resetTask(id:string,input:unknown):void{this.db.prepare("UPDATE tasks SET status='PENDING',input=?,output=NULL WHERE id=?").run(json(input),id);}
  createApproval(record: ApprovalRecord): void {const requestedAt=record.requestedAt??new Date().toISOString(),expiresAt=record.expiresAt===undefined?new Date(Date.parse(requestedAt)+15*60_000).toISOString():record.expiresAt;this.db.prepare("INSERT OR IGNORE INTO approvals(id,run_id,kind,status,expected_patch_hash,requested_at,expires_at) VALUES(?,?,?,?,?,?,?)").run(record.id, record.runId, record.kind, record.status, record.expectedPatchHash,requestedAt,expiresAt); }
  bindApprovalHash(id: string, expectedPatchHash: string): boolean { return this.db.prepare("UPDATE approvals SET expected_patch_hash=? WHERE id=? AND status='PENDING' AND expected_patch_hash IS NULL").run(expectedPatchHash, id).changes === 1; }
  decideApproval(id: string, approved: boolean, userId: string): boolean { const now=new Date().toISOString();return this.db.prepare("UPDATE approvals SET status=?,decided_by=?,decided_at=? WHERE id=? AND status='PENDING' AND (expires_at IS NULL OR expires_at>?)").run(approved ? "APPROVED" : "REJECTED", userId, now, id,now).changes === 1; }
  approval(id: string): ApprovalRecord | null { const x = this.db.prepare("SELECT * FROM approvals WHERE id=?").get(id) as Record<string, unknown> | undefined; return x ? { id: String(x.id), runId: String(x.run_id), kind: String(x.kind), status: String(x.status) as ApprovalRecord["status"], expectedPatchHash: x.expected_patch_hash === null ? null : String(x.expected_patch_hash),requestedAt:String(x.requested_at??""),expiresAt:x.expires_at===null?null:String(x.expires_at) } : null; }
  addArtifact(runId: string, path: string, sha256: string, kind: string, metadata: unknown = {}): void { this.db.prepare("INSERT INTO artifacts(id,run_id,path,sha256,kind,metadata) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(), runId, path, sha256, kind, json(metadata)); }
  recordModelCall(runId: string, role: string, requestId: string, status: string, tokens: number, cost: number, output: unknown): void { this.db.prepare("INSERT OR IGNORE INTO model_calls(id,run_id,role,request_id,status,tokens,cost,output,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), runId, role, requestId, status, tokens, cost, json(output), new Date().toISOString()); }
  recordToolCall(runId: string, name: string, status: string, detail: unknown = {}): void { this.db.prepare("INSERT INTO tool_calls(id,run_id,name,status,detail,created_at) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(), runId, name, status, json(detail), new Date().toISOString()); }
  recordValidation(runId: string, kind: string, passed: boolean, output: string): void { this.db.prepare("INSERT INTO validation_results(id,run_id,kind,passed,output,created_at) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(), runId, kind, passed ? 1 : 0, output, new Date().toISOString()); }
  recordUsage(runId: string, requestId: string, tokens: number, cost: number, estimated=false): void { this.db.prepare("INSERT OR IGNORE INTO usage_records(id,run_id,request_id,tokens,cost,created_at,estimated) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(), runId, requestId, tokens, cost, new Date().toISOString(),estimated?1:0); }
  lineage(runId: string): RunLineage { const rows = (table: string) => this.db.prepare(`SELECT * FROM ${table} WHERE run_id=? ORDER BY created_at`).all(runId) as Record<string, unknown>[]; return { modelCalls: rows("model_calls"), toolCalls: rows("tool_calls"), validations: rows("validation_results"), usage: rows("usage_records"), artifacts: this.db.prepare("SELECT * FROM artifacts WHERE run_id=?").all(runId) as Record<string, unknown>[] }; }
  addMergeCandidate(candidate: MergeCandidateRecord): void { this.db.prepare("INSERT INTO merge_candidates(run_id,branch,commit_hash,base_commit,patch_hash,created_at) VALUES(?,?,?,?,?,?)").run(candidate.runId, candidate.branch, candidate.commit, candidate.baseCommit, candidate.patchHash, new Date().toISOString()); }
  mergeCandidate(runId: string): MergeCandidateRecord | null { const x = this.db.prepare("SELECT * FROM merge_candidates WHERE run_id=?").get(runId) as Record<string, unknown> | undefined; return x ? { runId: String(x.run_id), branch: String(x.branch), commit: String(x.commit_hash), baseCommit: String(x.base_commit), patchHash: String(x.patch_hash) } : null; }
  saveRunResult(result: StoredRunResult): void { this.db.prepare("INSERT OR REPLACE INTO run_results(run_id,worktree,patch,patch_hash,files,validation,created_at) VALUES(?,?,?,?,?,?,?)").run(result.runId, result.worktree, result.patch, result.patchHash, json(result.files), json(result.validation), new Date().toISOString()); }
  runResult(runId: string): StoredRunResult | null { const x = this.db.prepare("SELECT * FROM run_results WHERE run_id=?").get(runId) as Record<string, unknown> | undefined; return x ? { runId: String(x.run_id), worktree: String(x.worktree), patch: String(x.patch), patchHash: String(x.patch_hash), files: parse<string[]>(x.files), validation: parse<unknown[]>(x.validation) } : null; }
  approvals(runId: string): ApprovalRecord[] { return (this.db.prepare("SELECT * FROM approvals WHERE run_id=? ORDER BY rowid").all(runId) as Record<string, unknown>[]).map(x => ({ id: String(x.id), runId: String(x.run_id), kind: String(x.kind), status: String(x.status) as ApprovalRecord["status"], expectedPatchHash: x.expected_patch_hash === null ? null : String(x.expected_patch_hash),requestedAt:String(x.requested_at??""),expiresAt:x.expires_at===null?null:String(x.expires_at) })); }
  auditEvents(runId: string): Array<{ seq: number; type: string; payload: unknown; createdAt: string }> { return (this.db.prepare("SELECT seq,type,payload,created_at FROM audit_events WHERE run_id=? ORDER BY seq").all(runId) as Record<string, unknown>[]).map(x => ({ seq: Number(x.seq), type: String(x.type), payload: parse(x.payload), createdAt: String(x.created_at) })); }
  createArtifactVersion(input: Omit<ArtifactVersionRecord, "id" | "version" | "stale" | "staleReason" | "createdAt">): ArtifactVersionRecord {
    if (!/^[a-f0-9]{64}$/.test(input.contentHash)) throw new Error("Artifact content hash must be SHA-256");
    const entity = this.db.prepare("SELECT kind,path FROM artifact_entities WHERE logical_id=?").get(input.logicalId) as { kind: string; path: string | null } | undefined;
    if (entity && (entity.kind !== input.kind || entity.path !== input.path)) throw new Error("Artifact logical identity kind/path mismatch");
    const latest = this.db.prepare("SELECT id,version FROM artifact_versions_v2 WHERE logical_id=? ORDER BY version DESC LIMIT 1").get(input.logicalId) as { id: string; version: number } | undefined;
    if (!latest && input.parentVersionId !== null) throw new Error("First artifact version cannot have a parent");
    if (latest && input.parentVersionId !== latest.id) throw new Error("Artifact parent must be the latest version");
    const record: ArtifactVersionRecord = { ...input, id: crypto.randomUUID(), version: (latest?.version ?? 0) + 1, stale: false, staleReason: null, createdAt: new Date().toISOString() };
    this.db.exec("BEGIN IMMEDIATE"); try { this.db.prepare("INSERT OR IGNORE INTO artifact_entities(logical_id,kind,path) VALUES(?,?,?)").run(record.logicalId, record.kind, record.path); this.db.prepare("INSERT INTO artifact_versions_v2(id,logical_id,version,parent_version_id,run_id,base_commit,content_hash,stale,stale_reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(record.id, record.logicalId, record.version, record.parentVersionId, record.runId, record.baseCommit, record.contentHash, 0, null, record.createdAt); this.db.exec("COMMIT"); if (latest) this.markArtifactStale(latest.id, `superseded-by:${record.id}`); return record; } catch (error) { try { this.db.exec("ROLLBACK"); } catch { /* transaction already committed */ } throw error; }
  }
  artifactVersions(logicalId: string): ArtifactVersionRecord[] { return (this.db.prepare("SELECT v.*,e.kind,e.path FROM artifact_versions_v2 v JOIN artifact_entities e USING(logical_id) WHERE logical_id=? ORDER BY version").all(logicalId) as Record<string, unknown>[]).map(x => this.mapArtifactVersion(x)); }
  artifactVersionsForRun(runId: string): ArtifactVersionRecord[] { return (this.db.prepare("SELECT v.*,e.kind,e.path FROM artifact_versions_v2 v JOIN artifact_entities e USING(logical_id) WHERE v.run_id=? ORDER BY v.created_at,v.id").all(runId) as Record<string, unknown>[]).map(x => this.mapArtifactVersion(x)); }
  artifactVersion(id: string): ArtifactVersionRecord | null { const x = this.db.prepare("SELECT v.*,e.kind,e.path FROM artifact_versions_v2 v JOIN artifact_entities e USING(logical_id) WHERE v.id=?").get(id) as Record<string, unknown> | undefined; return x ? this.mapArtifactVersion(x) : null; }
  addArtifactRelation(fromVersionId: string, toVersionId: string, type: string, evidence: unknown = {}): ArtifactRelationRecord {
    if (!this.artifactVersion(fromVersionId) || !this.artifactVersion(toVersionId)) throw new Error("Artifact relation endpoint missing");
    const cycle = this.db.prepare("WITH RECURSIVE reach(id) AS (SELECT to_version_id FROM artifact_relations WHERE from_version_id=? UNION SELECT r.to_version_id FROM artifact_relations r JOIN reach ON r.from_version_id=reach.id) SELECT 1 AS found FROM reach WHERE id=? LIMIT 1").get(toVersionId, fromVersionId);
    if (cycle || fromVersionId === toVersionId) throw new Error("Artifact relation cycle blocked");
    const record = { id: crypto.randomUUID(), fromVersionId, toVersionId, type, evidence, createdAt: new Date().toISOString() }; this.db.prepare("INSERT INTO artifact_relations(id,from_version_id,to_version_id,type,evidence,created_at) VALUES(?,?,?,?,?,?)").run(record.id, fromVersionId, toVersionId, type, json(evidence), record.createdAt); return record;
  }
  artifactRelations(versionId?: string): ArtifactRelationRecord[] { const rows = versionId ? this.db.prepare("SELECT * FROM artifact_relations WHERE from_version_id=? OR to_version_id=? ORDER BY created_at").all(versionId, versionId) : this.db.prepare("SELECT * FROM artifact_relations ORDER BY created_at").all(); return (rows as Record<string, unknown>[]).map(x => ({ id: String(x.id), fromVersionId: String(x.from_version_id), toVersionId: String(x.to_version_id), type: String(x.type), evidence: parse(x.evidence), createdAt: String(x.created_at) })); }
  markArtifactStale(versionId: string, reason: string): string[] { if (!this.artifactVersion(versionId)) throw new Error("Artifact version missing"); const rows = this.db.prepare("WITH RECURSIVE affected(id) AS (VALUES(?) UNION SELECT r.to_version_id FROM artifact_relations r JOIN affected a ON r.from_version_id=a.id) SELECT id FROM affected").all(versionId) as Array<{ id: string }>; const ids = rows.map(x => x.id); const update = this.db.prepare("UPDATE artifact_versions_v2 SET stale=1,stale_reason=? WHERE id=?"); this.db.exec("BEGIN IMMEDIATE"); try { for (const id of ids) update.run(reason, id); this.db.exec("COMMIT"); return ids; } catch (error) { this.db.exec("ROLLBACK"); throw error; } }
  staleArtifactsForRun(runId: string): ArtifactVersionRecord[] { return (this.db.prepare("SELECT v.*,e.kind,e.path FROM artifact_versions_v2 v JOIN artifact_entities e USING(logical_id) WHERE v.run_id=? AND v.stale=1 ORDER BY v.created_at").all(runId) as Record<string, unknown>[]).map(x => this.mapArtifactVersion(x)); }
  artifactNeighborhood(versionIds: readonly string[]): ArtifactVersionRecord[] { if (!versionIds.length) return []; const marks = versionIds.map(() => "?").join(","); const rows = this.db.prepare(`WITH RECURSIVE related(id) AS (SELECT id FROM artifact_versions_v2 WHERE id IN (${marks}) UNION SELECT r.to_version_id FROM artifact_relations r JOIN related x ON r.from_version_id=x.id UNION SELECT r.from_version_id FROM artifact_relations r JOIN related x ON r.to_version_id=x.id) SELECT v.*,e.kind,e.path FROM related x JOIN artifact_versions_v2 v ON v.id=x.id JOIN artifact_entities e USING(logical_id) ORDER BY v.created_at,v.id`).all(...versionIds) as Record<string, unknown>[]; return rows.map(x => this.mapArtifactVersion(x)); }
  latestArtifactVersionsByPaths(paths: readonly string[]): ArtifactVersionRecord[] { if (!paths.length) return []; const marks = paths.map(() => "?").join(","); const rows = this.db.prepare(`SELECT v.*,e.kind,e.path FROM artifact_entities e JOIN artifact_versions_v2 v ON v.logical_id=e.logical_id WHERE e.path IN (${marks}) AND v.version=(SELECT MAX(v2.version) FROM artifact_versions_v2 v2 WHERE v2.logical_id=v.logical_id) ORDER BY e.path`).all(...paths) as Record<string, unknown>[]; return rows.map(x => this.mapArtifactVersion(x)); }
  saveContextBuild(runId: string, bundleHash: string, bundle: unknown): StoredContextBuild { const record = { id: crypto.randomUUID(), runId, bundleHash, bundle, createdAt: new Date().toISOString() }; this.db.prepare("INSERT INTO context_builds(id,run_id,bundle_hash,bundle,created_at) VALUES(?,?,?,?,?)").run(record.id, runId, bundleHash, json(bundle), record.createdAt); return record; }
  contextBuilds(runId: string): StoredContextBuild[] { return (this.db.prepare("SELECT * FROM context_builds WHERE run_id=? ORDER BY created_at").all(runId) as Record<string, unknown>[]).map(x => ({ id: String(x.id), runId: String(x.run_id), bundleHash: String(x.bundle_hash), bundle: parse(x.bundle), createdAt: String(x.created_at) })); }
  saveMergeAssessment(input: Omit<MergeAssessmentRecord, "id" | "createdAt">): MergeAssessmentRecord { const record = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; this.db.prepare("INSERT INTO merge_assessments(id,run_id,current_head,base_moved,overlapping_files,conflicted_files,conflict,revalidation_required,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(record.id, record.runId, record.currentHead, record.baseMoved ? 1 : 0, json(record.overlappingFiles), json(record.conflictedFiles), record.conflict ? 1 : 0, record.revalidationRequired ? 1 : 0, record.createdAt); return record; }
  mergeAssessments(runId: string): MergeAssessmentRecord[] { return (this.db.prepare("SELECT * FROM merge_assessments WHERE run_id=? ORDER BY created_at").all(runId) as Record<string, unknown>[]).map(x => ({ id: String(x.id), runId: String(x.run_id), currentHead: String(x.current_head), baseMoved: Number(x.base_moved) === 1, overlappingFiles: parse<string[]>(x.overlapping_files), conflictedFiles: parse<string[]>(x.conflicted_files), conflict: Number(x.conflict) === 1, revalidationRequired: Number(x.revalidation_required) === 1, createdAt: String(x.created_at) })); }
  private mapArtifactVersion(x: Record<string, unknown>): ArtifactVersionRecord { return { id: String(x.id), logicalId: String(x.logical_id), version: Number(x.version), parentVersionId: x.parent_version_id === null ? null : String(x.parent_version_id), runId: String(x.run_id), kind: String(x.kind) as ArtifactKind, path: x.path === null ? null : String(x.path), baseCommit: String(x.base_commit), contentHash: String(x.content_hash), stale: Number(x.stale) === 1, staleReason: x.stale_reason === null ? null : String(x.stale_reason), createdAt: String(x.created_at) }; }
  audit(runId: string, type: string, payload: unknown = {}): void { this.db.prepare("INSERT INTO audit_events(id,run_id,type,payload,created_at) VALUES(?,?,?,?,?)").run(crypto.randomUUID(), runId, type, json(payload), new Date().toISOString()); }
  close(): void { this.db.close(); }
}
