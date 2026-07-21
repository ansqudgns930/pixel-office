import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { LocalProcessSandbox, SandboxPolicyViolation } from "../packages/execution-sandbox/src/index.js";

test("LocalProcessSandbox uses a minimal environment and fixed worktree", async t => {
  const workspace = mkdtempSync(join(tmpdir(), "local-sandbox-")); t.after(() => rmSync(workspace, { recursive: true, force: true }));
  writeFileSync(join(workspace, "inspect.mjs"), "console.log(JSON.stringify({cwd:process.cwd(),secret:process.env.SECRET_TOKEN,path:process.env.PATH,custom:process.env.SAFE_VALUE}))");
  const store = new SQLiteStateStore(":memory:"); store.createRun({ id: "run", requestId: "req", goal: "inspect", risk: "low", status: "RUNNING", budgetLimit: 1, spent: 0, checkpoint: null });
  const sandbox = new LocalProcessSandbox(store, workspace, { inspect: { file: process.execPath, args: ["inspect.mjs"] } }, { environmentAllowlist: ["SAFE_VALUE"], environment: { SAFE_VALUE: "allowed", SECRET_TOKEN: "must-not-leak" } });
  const result = JSON.parse((await sandbox.execute("run", "inspect")).stdout) as { cwd: string; secret?: string; path: string; custom: string };
  assert.equal(result.cwd, workspace); assert.equal(result.secret, undefined); assert.equal(result.custom, "allowed"); assert.equal(result.path, dirname(process.execPath)); store.close();
});

test("LocalProcessSandbox blocks shell, inline code, installs, side effects, output overflow and concurrency", async t => {
  const workspace = mkdtempSync(join(tmpdir(), "local-sandbox-policy-")); t.after(() => rmSync(workspace, { recursive: true, force: true }));
  writeFileSync(join(workspace, "slow.mjs"), "setTimeout(()=>console.log('done'),300)"); writeFileSync(join(workspace, "loud.mjs"), "console.log('x'.repeat(4096))");
  const store = new SQLiteStateStore(":memory:"); store.createRun({ id: "run", requestId: "req", goal: "policy", risk: "high", status: "RUNNING", budgetLimit: 1, spent: 0, checkpoint: null }); const node = process.execPath;
  const sandbox = new LocalProcessSandbox(store, workspace, { shell: { file: "powershell.exe", args: ["-File", "x.ps1"] }, inline: { file: node, args: ["-e", "console.log(1)"] }, install: { file: node, args: ["--version"] }, sneaky: { file: node, args: ["install"] }, deploy: { file: node, args: ["--version"] }, loud: { file: node, args: ["loud.mjs"], maxOutputBytes: 128 }, slow: { file: node, args: ["slow.mjs"] } }, { maxConcurrent: 1 });
  for (const name of ["shell", "inline", "install", "sneaky", "deploy"]) await assert.rejects(sandbox.execute("run", name), SandboxPolicyViolation);
  await assert.rejects(sandbox.execute("run", "loud")); const first = sandbox.execute("run", "slow"); await assert.rejects(sandbox.execute("run", "slow"), SandboxPolicyViolation); await first;
  assert.ok((store.db.prepare("SELECT count(*) AS n FROM audit_events WHERE type='LOCAL_SANDBOX_BLOCKED'").get() as { n: number }).n >= 6); store.close();
});
