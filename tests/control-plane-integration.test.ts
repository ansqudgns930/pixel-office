import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { startLocalControlPlane } from "../apps/local-control-plane/index.js";

const git = join(process.cwd(), ".tools", "mingit", "cmd", "git.exe");
async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> { const end = Date.now() + 10_000; while (true) { const value = await read(); if (accept(value)) return value; if (Date.now() > end) throw new Error("Control plane state timeout"); await new Promise(resolve => setTimeout(resolve, 40)); } }

test("local Control Plane API drives goal through approvals to merge candidate", { skip: process.env.REDIS_INTEGRATION !== "1", timeout: 20_000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), "control-plane-live-")), repo = join(root, "repo"); execFileSync(git, ["init", repo]); execFileSync(git, ["-C", repo, "config", "user.email", "test@example.com"]); execFileSync(git, ["-C", repo, "config", "user.name", "Test"]); writeFileSync(join(repo, "README.md"), "base\n"); execFileSync(git, ["-C", repo, "add", "."]); execFileSync(git, ["-C", repo, "commit", "-m", "base"]); const baseBranch = execFileSync(git, ["-C", repo, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).trim(), baseHead = execFileSync(git, ["-C", repo, "rev-parse", baseBranch], { encoding: "utf8" }).trim();
  const command = { file: process.execPath, args: ["--check", "src/generated.js"] }; const app = await startLocalControlPlane({ repo, runtimeDir: join(root, "runtime"), git, commands: { build: command, test: command, lint: command, security: command } }); t.after(async () => { await app.close(); rmSync(root, { recursive: true, force: true }); }); const id = `live-${crypto.randomUUID()}`;
  await fetch(`${app.url}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, requestId: `req-${id}`, goal: "change authentication safely", requestedPaths: ["src/generated.js"], requestedRisk: "low", budgetLimit: 10 }) });
  const get = async () => await (await fetch(`${app.url}/api/runs/${id}`)).json() as { run: { status: string; risk: string }; result?: { patchHash: string }; candidate?: { branch: string; commit: string } };
  let state = await waitFor(get, value => value.run.status === "PLAN_APPROVAL_WAITING"); assert.equal(state.run.risk, "high"); await fetch(`${app.url}/api/runs/${id}/actions/approve-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); state = await waitFor(get, value => value.run.status === "RESULT_APPROVAL_WAITING"); assert.ok(state.result?.patchHash);
  await fetch(`${app.url}/api/runs/${id}/actions/approve-result`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); state = await waitFor(get, value => value.run.status === "COMPLETED"); assert.ok(state.candidate?.branch); assert.equal(execFileSync(git, ["-C", repo, "rev-parse", baseBranch], { encoding: "utf8" }).trim(), baseHead); assert.equal(execFileSync(git, ["-C", repo, "rev-parse", state.candidate!.branch], { encoding: "utf8" }).trim(), state.candidate!.commit);
});
