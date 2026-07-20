import { createHash } from "node:crypto";
import type { ArtifactKind, ArtifactVersionRecord, StateStore } from "../../persistence/src/index.js";
import type { RunController } from "../../runtime/src/index.js";
import type { RolePipeline } from "../../role-pipeline/src/index.js";
import { ToolGateway, type CommandPolicy } from "../../tool-gateway/src/index.js";
import type { WorktreeManager } from "../../worktree/src/index.js";
import { DeterministicValidator, type ValidationKind, type ValidationResult } from "../../validator/src/index.js";
import type { ApprovalIntegrity } from "../../approval/src/index.js";

interface Change { path: string; content: string }
export interface ExecutionConfig { allowedPaths: string[]; commands: Readonly<Record<string, CommandPolicy>>;validatorChecks?:ValidationKind[] }
export interface ExecutionResult { worktree: string; patch: string; patchHash: string; files: string[]; validation: ValidationResult[] }
export interface ExecutionGovernance {assertTools(runId:string,tools:readonly string[]):void}
export const interventionForbiddenChange=(changes:readonly Change[],restricted:readonly string[]):Change|undefined=>changes.find(change=>restricted.some(raw=>{const path=raw.replaceAll("\\","/").replace(/\/$/,""),file=change.path.replaceAll("\\","/");return file===path||file.startsWith(`${path}/`);}));
export const effectiveValidationChecks=(configured:readonly ValidationKind[],requested:readonly unknown[]):ValidationKind[]=>[...new Set([...configured,...requested.filter((x):x is ValidationKind=>typeof x==="string"&&["build","typecheck","test","lint","security"].includes(x))])];

export class Phase1Execution {
  constructor(private readonly store: StateStore, private readonly controller: RunController, private readonly pipeline: RolePipeline, private readonly worktrees: WorktreeManager, private readonly approvals: ApprovalIntegrity,private readonly governance?:ExecutionGovernance) {}

  async execute(runId: string, config: ExecutionConfig): Promise<ExecutionResult> {
    return this.executeAttempt(runId,config,0);
  }
  private async executeAttempt(runId:string,config:ExecutionConfig,attempt:number):Promise<ExecutionResult>{
    await this.pipeline.process(runId,attempt);
    this.governance?.assertTools(runId,Object.keys(config.commands));
    const run = this.store.getRun(runId); if (!run || run.status !== "VALIDATING") throw new Error("Role pipeline did not reach validation");
    const worker = this.store.tasks(runId).find(task => task.role === "worker" && task.status === "COMPLETED"); if (!worker) throw new Error("Completed worker output missing");
    const changes = this.parseChanges(worker.output); if (!changes.length) throw new Error("Worker produced no changes");
    const restricted=Array.isArray(run.checkpoint?.restrictedPaths)?run.checkpoint.restrictedPaths.filter((x):x is string=>typeof x==="string"):[],blockedChange=interventionForbiddenChange(changes,restricted);if(blockedChange){this.store.audit(runId,"INTERVENTION_PATH_BLOCKED",{path:blockedChange.path,restricted});this.controller.move(runId,"BLOCKED",{reason:"intervention-path-restriction",path:blockedChange.path});throw new Error(`Intervention forbids modifying ${blockedChange.path}`);}
    const worktree = await this.worktrees.create(runId); const baseCommit = await this.worktrees.head(worktree); const gateway = new ToolGateway(this.store, worktree, config.allowedPaths, config.commands);
    for (const change of changes) await gateway.write(runId, change.path, change.content);
    const diff = await this.worktrees.diff(runId, worktree);
    if (!diff.files.length) { this.controller.move(runId, "FAILED", { worktree, reason: "empty-diff" }); throw new Error("Worker produced no Git diff"); }
    try { await this.worktrees.assertScope(runId, worktree, diff.files, config.allowedPaths); }
    catch (error) { this.controller.move(runId, "BLOCKED", { worktree, reason: "diff-scope" }); throw error; }
    const requested=Array.isArray(run.checkpoint?.requestedTests)?run.checkpoint.requestedTests:[],checks=effectiveValidationChecks(config.validatorChecks??["build","test","lint","security"],requested);if(checks.some(check=>!config.commands[check]))throw new Error(`Validator command missing: ${checks.find(check=>!config.commands[check])}`);this.store.audit(runId,"VALIDATOR_PROFILE_APPLIED",{checks,interventionRequested:requested});const validation = await new DeterministicValidator(gateway, this.store).validate(runId,checks);
    if (!validation.every(result => result.passed)) {if(attempt>=2){this.controller.move(runId,"FAILED",{worktree,reason:"validation",attempts:attempt+1});throw new Error("Validation failed after revision limit");}await this.worktrees.remove(runId,worktree);this.pipeline.requestRevision(runId,validation);return this.executeAttempt(runId,config,attempt+1);}
    await this.pipeline.review(runId,{validation,diff:{patch:diff.patch,patchHash:diff.hash,files:diff.files},requirements:{goal:run.goal,allowedPaths:config.allowedPaths,completionCriteria:worker.completionCriteria}});
    for (const change of changes) if (diff.files.includes(change.path.replaceAll("\\", "/"))) this.store.addArtifact(runId, change.path, createHash("sha256").update(change.content).digest("hex"), "code", { patchHash: diff.hash });
    this.captureArtifactGraph(runId, run.goal, baseCommit, changes.filter(change => diff.files.includes(change.path.replaceAll("\\", "/"))), validation);
    this.store.createApproval({ id: `${runId}:result`, runId, kind: "result", status: "PENDING", expectedPatchHash: null }); this.approvals.bindResult(runId, diff.hash);
    this.controller.move(runId, "RESULT_APPROVAL_WAITING", { worktree, patchHash: diff.hash, files: diff.files,...(attempt?{revision:attempt}:{}) });
    const executionResult = { worktree, patch: diff.patch, patchHash: diff.hash, files: diff.files, validation }; this.store.saveRunResult({ runId, ...executionResult }); return executionResult;
  }

  private parseChanges(output: unknown): Change[] {
    const envelope = output as { text?: unknown }; if (typeof envelope?.text !== "string") throw new Error("Worker output text missing");
    const parsed = JSON.parse(envelope.text) as { changes?: unknown };
    if (!Array.isArray(parsed.changes)) throw new Error("Worker output does not match change contract");
    return parsed.changes.map(item => { const x = item as Partial<Change>; if (typeof x.path !== "string" || typeof x.content !== "string") throw new Error("Invalid worker change"); return { path: x.path, content: x.content }; });
  }
  private captureArtifactGraph(runId: string, goal: string, baseCommit: string, changes: readonly Change[], validation: readonly ValidationResult[]): void {
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    const make = (logicalId: string, kind: ArtifactKind, path: string | null, content: string): ArtifactVersionRecord => { const versions = this.store.artifactVersions(logicalId); return this.store.createArtifactVersion({ logicalId, parentVersionId: versions.at(-1)?.id ?? null, runId, kind, path, baseCommit, contentHash: hash(content) }); };
    const requirement = make(`requirement:${runId}`, "requirement", null, goal), tasks = this.store.tasks(runId).map(task => make(`task:${task.id}`, "task", null, JSON.stringify({ input: task.input, output: task.output, criteria: task.completionCriteria })));
    for (const task of tasks) this.store.addArtifactRelation(requirement.id, task.id, "planned-as", { runId });
    const workerTask = tasks[this.store.tasks(runId).findIndex(task => task.role === "worker")]; const code: ArtifactVersionRecord[] = [], tests: ArtifactVersionRecord[] = [];
    for (const change of changes) { const path = change.path.replaceAll("\\", "/"), kind: ArtifactKind = /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/i.test(path) ? "test" : "code"; const artifact = make(`${kind}:${path}`, kind, path, change.content); (kind === "test" ? tests : code).push(artifact); if (workerTask) this.store.addArtifactRelation(workerTask.id, artifact.id, "implemented-by", { path }); }
    for (const source of code) for (const test of tests) this.store.addArtifactRelation(source.id, test.id, "verified-by", { runId });
    const validationArtifacts: Array<{ artifact: ArtifactVersionRecord; content: string }> = [];
    for (const result of validation) { const content = JSON.stringify(result), artifact = make(`validation:${runId}:${result.kind}`, "validation", null, content); validationArtifacts.push({ artifact, content }); const sources = tests.length ? tests : code; for (const source of sources) this.store.addArtifactRelation(source.id, artifact.id, "validated-by", { kind: result.kind }); }
    this.store.audit(runId, "ARTIFACT_GRAPH_CAPTURED", { requirement: requirement.id, tasks: tasks.length, code: code.length, tests: tests.length, validation: validation.length });
  }
}
