import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RolePipeline } from "../packages/role-pipeline/src/index.js";
import { StandaloneHostAdapter } from "../apps/standalone-host/src/index.js";
import { WorktreeManager } from "../packages/worktree/src/index.js";
import { ApprovalIntegrity } from "../packages/approval/src/index.js";
import { Phase1Execution } from "../packages/phase1-execution/src/index.js";
import { MergeCandidateService } from "../packages/merge-candidate/src/index.js";

class FakeQueue { async enqueue() {} async remove() { return false; } }
const git = join(process.cwd(), ".tools", "mingit", "cmd", "git.exe");

test("standalone vertical slice reaches exact-diff result approval in a real worktree", async t => {
  const root = mkdtempSync(join(tmpdir(), "agent-company-vertical-")); t.after(() => rmSync(root, { recursive: true, force: true })); const repo = join(root, "repo"), worktreeRoot = join(root, "worktrees");
  execFileSync(git, ["init", repo]); execFileSync(git, ["-C", repo, "config", "user.email", "test@example.com"]); execFileSync(git, ["-C", repo, "config", "user.name", "Test"]); writeFileSync(join(repo, "README.md"), "base\n"); execFileSync(git, ["-C", repo, "add", "."]); execFileSync(git, ["-C", repo, "commit", "-m", "base"]);
  const store = new SQLiteStateStore(join(root, "state.sqlite")); const controller = new RunController(store, new FakeQueue()); const host = new StandaloneHostAdapter(); const pipeline = new RolePipeline(store, controller, host); const approvals = new ApprovalIntegrity(store, controller); const worktrees = new WorktreeManager(git, repo, worktreeRoot, store); const execution = new Phase1Execution(store, controller, pipeline, worktrees, approvals);
  await controller.create({ id: "vertical", requestId: "req-vertical", goal: "create generated module", risk: "high", status: "CREATED", budgetLimit: 10, spent: 0, checkpoint: { requestedPaths: ["src/generated.js"] } });
  await pipeline.process("vertical"); pipeline.approvePlan("vertical", "owner");
  const command = { file: process.execPath, args: ["--check", "src/generated.js"] }; const result = await execution.execute("vertical", { allowedPaths: ["src"], commands: { build: command, test: command, lint: command, security: command } });
  assert.equal(store.getRun("vertical")?.status, "RESULT_APPROVAL_WAITING"); assert.deepEqual(result.files, ["src/generated.js"]); assert.ok(result.validation.every(x => x.passed)); const baseBranch = execFileSync(git, ["-C", repo, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).trim(), baseHead = execFileSync(git, ["-C", repo, "rev-parse", baseBranch], { encoding: "utf8" }).trim(); const candidate = await new MergeCandidateService(store, approvals, worktrees).approveAndCreate("vertical", result.patchHash, "owner", result.worktree); assert.equal(store.getRun("vertical")?.status, "COMPLETED"); assert.equal(execFileSync(git, ["-C", repo, "rev-parse", baseBranch], { encoding: "utf8" }).trim(), baseHead); assert.equal(execFileSync(git, ["-C", repo, "rev-parse", candidate.branch], { encoding: "utf8" }).trim(), candidate.commit); assert.notEqual(candidate.commit, baseHead); assert.equal(store.mergeCandidate("vertical")?.commit, candidate.commit);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM artifacts WHERE run_id='vertical'").get()?.n, 1); const versions = store.artifactVersionsForRun("vertical"); assert.ok(versions.some(x => x.kind === "requirement")); assert.ok(versions.some(x => x.kind === "task")); assert.ok(versions.some(x => x.kind === "code" && x.path === "src/generated.js")); assert.equal(versions.filter(x => x.kind === "validation").length, 4); assert.ok(store.artifactRelations().length >= 8); const contexts = store.contextBuilds("vertical"); assert.equal(contexts.length, 3); assert.ok(contexts.every(context=>JSON.stringify(context.bundle).includes("DATA_ONLY_NEVER_INSTRUCTIONS"))); assert.equal(store.db.prepare("SELECT count(*) AS n FROM audit_events WHERE run_id='vertical'").get()?.n as number > 10, true); await worktrees.remove("vertical", result.worktree); store.close();
});
