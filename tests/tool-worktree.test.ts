import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ToolGateway, ToolPolicyViolation } from "../packages/tool-gateway/src/index.js";
import { WorktreeManager } from "../packages/worktree/src/index.js";
import { DeterministicValidator } from "../packages/validator/src/index.js";

const git = join(process.cwd(), ".tools", "mingit", "cmd", "git.exe");
test("Tool Gateway isolates a worktree, blocks scope escape and validates deterministic checks", async t => {
  const root = mkdtempSync(join(tmpdir(), "agent-company-git-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, "repo"), worktrees = join(root, "worktrees"); execFileSync(git, ["init", repo]); execFileSync(git, ["-C", repo, "config", "user.email", "test@example.com"]); execFileSync(git, ["-C", repo, "config", "user.name", "Test"]); writeFileSync(join(repo, "README.md"), "base\n"); execFileSync(git, ["-C", repo, "add", "."]); execFileSync(git, ["-C", repo, "commit", "-m", "base"]);
  const store = new SQLiteStateStore(":memory:"); store.createRun({ id: "run", requestId: "req", goal: "edit", risk: "high", status: "RUNNING", budgetLimit: 1, spent: 0, checkpoint: null });
  const manager = new WorktreeManager(git, repo, worktrees, store); const path = await manager.create("run");
  const node = process.execPath; const harmless = { file: node, args: ["--version"] }; const gateway = new ToolGateway(store, path, ["src"], { build: { file: node, args: ["--check", "src/main.js"] },typecheck:{file:node,args:["--check","src/main.js"]}, test: { file: node, args: ["--check", "src/main.js"] }, lint: { file: node, args: ["--check", "src/main.js"] }, security: { file: node, args: ["--check", "src/main.js"] }, deploy: harmless, external_send: harmless, delete: harmless });
  await gateway.write("run", "src/main.js", "export const value = 1;\n"); await assert.rejects(gateway.write("run", "../escaped.js", "bad"), ToolPolicyViolation); for (const forbidden of ["deploy", "external_send", "delete"]) await assert.rejects(gateway.execute("run", forbidden), ToolPolicyViolation);
  const outside = join(root, "outside"); mkdirSync(outside); symlinkSync(outside, join(path, "src", "linked"), "junction"); await assert.rejects(gateway.write("run", "src/linked/escaped.js", "bad"), ToolPolicyViolation); assert.equal(existsSync(join(outside, "escaped.js")), false);
  const results = await new DeterministicValidator(gateway, store).validate("run",["build","typecheck","test","lint","security"]); assert.ok(results.every(x => x.passed));assert.ok(results.some(x=>x.kind==="typecheck"));
  const diff = await manager.diff("run", path); assert.deepEqual(diff.files, ["src/main.js"]); await manager.assertScope("run", path, diff.files, ["src"]); assert.match(diff.patch, /value = 1/); assert.match(diff.hash, /^[a-f0-9]{64}$/);
  mkdirSync(join(path, "docs")); writeFileSync(join(path, "docs", "validator-side-effect.md"), "outside approval\n"); const unsafeDiff = await manager.diff("run", path); await assert.rejects(manager.assertScope("run", path, unsafeDiff.files, ["src"]), /outside approved path/);
  const status = execFileSync(git, ["-C", path, "status", "--porcelain"], { encoding: "utf8" }); assert.match(status, /src\//);
  assert.ok((store.db.prepare("SELECT count(*) AS n FROM audit_events WHERE type='TOOL_BLOCKED'").get() as { n: number }).n >= 4);
  await manager.remove("run", path); store.close();
});

test("Worktree Manager uses a managed repository when the configured path is not Git",async t=>{const root=mkdtempSync(join(tmpdir(),"agent-company-managed-git-"));t.after(()=>rmSync(root,{recursive:true,force:true}));const invalidRepo=join(root,"plain-folder"),worktrees=join(root,"worktrees");mkdirSync(invalidRepo);const store=new SQLiteStateStore(":memory:");store.createRun({id:"managed",requestId:"req",goal:"edit",risk:"medium",status:"RUNNING",budgetLimit:1,spent:0,checkpoint:null});const manager=new WorktreeManager(git,invalidRepo,worktrees,store),path=await manager.create("managed");assert.equal(existsSync(join(path,"health.js")),true);assert.match(execFileSync(git,["-C",path,"rev-parse","HEAD"],{encoding:"utf8"}),/^[a-f0-9]+/);assert.match(JSON.stringify(store.auditEvents("managed")),/"managed":true/);await manager.remove("managed",path);store.close();});
