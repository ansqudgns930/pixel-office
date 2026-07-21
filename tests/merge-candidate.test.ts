import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { ApprovalIntegrity } from "../packages/approval/src/index.js";
import { WorktreeManager } from "../packages/worktree/src/index.js";
import { MergeCandidateService } from "../packages/merge-candidate/src/index.js";

class FakeQueue { async enqueue() {} async remove() { return false; } }
const git = join(process.cwd(), ".tools", "mingit", "cmd", "git.exe");
test("merge candidate recomputes live worktree hash and blocks post-review mutation", async t => {
  const root = mkdtempSync(join(tmpdir(), "candidate-tamper-")); t.after(() => rmSync(root, { recursive: true, force: true })); const repo = join(root, "repo"), worktreeRoot = join(root, "worktrees"); execFileSync(git, ["init", repo]); execFileSync(git, ["-C", repo, "config", "user.email", "test@example.com"]); execFileSync(git, ["-C", repo, "config", "user.name", "Test"]); writeFileSync(join(repo, "README.md"), "base\n"); execFileSync(git, ["-C", repo, "add", "."]); execFileSync(git, ["-C", repo, "commit", "-m", "base"]); const base = execFileSync(git, ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const store = new SQLiteStateStore(":memory:"); store.createRun({ id: "tamper", requestId: "req", goal: "edit", risk: "high", status: "RESULT_APPROVAL_WAITING", budgetLimit: 1, spent: 0, checkpoint: { requestedPaths: ["src/file.js"] } }); store.createApproval({ id: "tamper:result", runId: "tamper", kind: "result", status: "PENDING", expectedPatchHash: null }); const controller = new RunController(store, new FakeQueue()), approvals = new ApprovalIntegrity(store, controller), worktrees = new WorktreeManager(git, repo, worktreeRoot, store), service = new MergeCandidateService(store, approvals, worktrees), path = await worktrees.create("tamper"); mkdirSync(join(path, "src")); writeFileSync(join(path, "src", "file.js"), "export const value = 1;\n"); const reviewed = await worktrees.diff("tamper", path); approvals.bindResult("tamper", reviewed.hash);
  writeFileSync(join(path, "src", "file.js"), "export const value = 2;\n"); await assert.rejects(service.approveAndCreate("tamper", reviewed.hash, "owner", path), /changed/); assert.equal(store.getRun("tamper")?.status, "BLOCKED"); assert.equal(store.mergeCandidate("tamper"), null); assert.equal(execFileSync(git, ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), base); await worktrees.remove("tamper", path); store.close();
});
