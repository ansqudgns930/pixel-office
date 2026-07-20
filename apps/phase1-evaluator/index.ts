import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION, type ExecutionStrategy, type RiskLevel } from "../../packages/contracts/src/index.js";
import { LegacyNvidiaHostAdapter } from "../legacy-nvidia-host/src/index.js";
import { NvidiaHttpClient } from "../legacy-nvidia-host/src/http-client.js";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../");
const git = resolve(root, ".tools/mingit/cmd/git.exe");
const node = process.execPath;
const phaseDir = resolve(root, ".phase1");
const repoDir = resolve(phaseDir, "fixture-repo");
const worktreesDir = resolve(phaseDir, "worktrees");
const output = resolve(root, "outputs/phase1-live-report.json");

interface Scenario { id: string; risk: RiskLevel; requirement: string; tests: string }
const scenarios: Scenario[] = [
  { id: "low-normalize", risk: "low", requirement: "Export default function normalizeLabel(value). For strings trim edges and collapse any whitespace run to one space. For non-strings return empty string.", tests: `import test from 'node:test';import assert from 'node:assert/strict';import fn from './candidate.mjs';test('normalize',()=>{assert.equal(fn('  hello   world  '),'hello world');assert.equal(fn(null),'');assert.equal(fn('a\\n\\tb'),'a b')});` },
  { id: "medium-clamp", risk: "medium", requirement: "Export default function clamp(value,min,max). Return value bounded inclusively. Throw TypeError unless all inputs are finite numbers. Throw RangeError when min is greater than max.", tests: `import test from 'node:test';import assert from 'node:assert/strict';import fn from './candidate.mjs';test('clamp',()=>{assert.equal(fn(5,0,10),5);assert.equal(fn(-1,0,10),0);assert.equal(fn(20,0,10),10);assert.throws(()=>fn('5',0,10),TypeError);assert.throws(()=>fn(1,2,1),RangeError)});` },
  { id: "high-redirect", risk: "high", requirement: "Export default function safeRedirect(value). Return the input only when it is a local absolute path beginning with exactly one slash. Reject protocol-relative //, backslashes, control characters, and URL schemes by returning '/'. Non-strings return '/'.", tests: `import test from 'node:test';import assert from 'node:assert/strict';import fn from './candidate.mjs';test('redirect',()=>{assert.equal(fn('/account'),'/account');for(const x of ['//evil.com','https://evil.com','/\\\\evil','/ok\\nno'])assert.equal(fn(x),'/');assert.equal(fn(null),'/')});` }
];
const strategies: ExecutionStrategy[] = ["single_agent", "manager_subagents", "role_pipeline"];

function strategyInstruction(strategy: ExecutionStrategy): string {
  if (strategy === "single_agent") return "Solve directly as one coding agent.";
  if (strategy === "manager_subagents") return "Internally plan the requirement, identify edge cases, then implement as a manager delegating only necessary checks.";
  return "Internally act as planner, implementer, and security reviewer in sequence before producing the result.";
}

function extractCode(text: string): string {
  const fenced = text.match(/```(?:js|javascript|mjs)?\s*([\s\S]*?)```/i)?.[1];
  const code = (fenced ?? text).trim();
  const start = code.indexOf("export default");
  return start >= 0 ? code.slice(start) : code;
}

async function prepareRepo(): Promise<void> {
  await rm(phaseDir, { recursive: true, force: true }); await mkdir(repoDir, { recursive: true });
  await writeFile(resolve(repoDir, "candidate.mjs"), "export default function placeholder(){ throw new Error('not implemented') }\n");
  await exec(git, ["init", "-b", "main"], { cwd: repoDir });
  await exec(git, ["config", "user.email", "phase0@example.invalid"], { cwd: repoDir });
  await exec(git, ["config", "user.name", "Phase Evaluator"], { cwd: repoDir });
  await exec(git, ["add", "."], { cwd: repoDir }); await exec(git, ["commit", "-m", "fixture baseline"], { cwd: repoDir });
  await mkdir(worktreesDir, { recursive: true });
}

export async function runLive(baseUrl = "http://127.0.0.1:8787", model = "nvidia/nemotron-3-ultra-550b-a55b") {
  await prepareRepo(); const client = new NvidiaHttpClient(baseUrl, 320); assertLive(await client.health());
  const adapter = new LegacyNvidiaHostAdapter(client); const rows = []; const repetitions = Math.max(1, Number(process.env.PHASE1_REPETITIONS ?? 5));
  for (const scenario of scenarios) for (const strategy of strategies) for (let repetition = 1; repetition <= repetitions; repetition++) {
    const anonymousId = randomUUID(); const worktree = resolve(worktreesDir, anonymousId);
    await exec(git, ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: repoDir });
    const prompt = `${strategyInstruction(strategy)}\n${scenario.requirement}\nOutput only valid JavaScript source. No markdown, explanation, tests, imports, or tool calls.`;
    const usageBefore = await client.usageTotals(); const started = Date.now();
    const response = await adapter.invokeModel({ contractVersion: CONTRACT_VERSION, requestId: anonymousId, hostId: adapter.hostId, deadline: Date.now() + 120_000, model, prompt });
    const usageAfter = await client.usageTotals();
    const code = extractCode(response.text); await writeFile(resolve(worktree, "candidate.mjs"), `${code}\n`); await writeFile(resolve(worktree, "candidate.test.mjs"), scenario.tests);
    let passed = false; let validationOutput = "";
    try { const result = await exec(node, ["--test", "candidate.test.mjs"], { cwd: worktree, timeout: 30_000 }); passed = true; validationOutput = result.stdout; } catch (error) { validationOutput = error instanceof Error ? error.message : String(error); }
    await exec(git, ["add", "."], { cwd: worktree }); await exec(git, ["commit", "-m", `candidate ${anonymousId}`], { cwd: worktree });
    const commit = (await exec(git, ["rev-parse", "HEAD"], { cwd: worktree })).stdout.trim();
    rows.push({ anonymousId, scenario: scenario.id, risk: scenario.risk, strategy, repetition, passed, durationMs: Date.now() - started, tokens: usageAfter.tokens - usageBefore.tokens, requests: usageAfter.requests - usageBefore.requests, cost: response.cost, commit, sha256: createHash("sha256").update(code).digest("hex"), validationOutput: validationOutput.slice(-1000) });
  }
  const report = { generatedAt: new Date().toISOString(), model, baseUrl, repetitions, blindKey: Object.fromEntries(rows.map(row => [row.anonymousId, { scenario: row.scenario, strategy: row.strategy, repetition: row.repetition }])), candidates: rows.map(({ strategy: _strategy, scenario: _scenario, ...row }) => row), results: rows };
  await writeFile(output, JSON.stringify(report, null, 2)); return report;
}

function assertLive(ok: boolean): asserts ok { if (!ok) throw new Error("NVIDIA host is unavailable"); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runLive(); console.log(`phase1 live: ${report.results.length} candidates, passed=${report.results.filter(x => x.passed).length}, report=${output}`);
}
