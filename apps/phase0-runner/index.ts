import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentCompanyCore } from "../../packages/agent-core/src/index.js";
import type { ExecutionStrategy, RiskLevel, WorkRequest, WorkResult } from "../../packages/contracts/src/index.js";
import { StandaloneHostAdapter } from "../standalone-host/src/index.js";

const strategies: ExecutionStrategy[] = ["single_agent", "manager_subagents", "role_pipeline"];
const scenarios: Array<{ id: string; risk: RiskLevel; goal: string; paths: string[] }> = [
  { id: "low-copy", risk: "low", goal: "small copy change", paths: ["src/copy.ts"] },
  { id: "medium-feature", risk: "medium", goal: "small feature with tests", paths: ["src/feature.ts", "tests/feature.test.ts"] },
  { id: "high-auth", risk: "high", goal: "authentication security fix", paths: ["src/auth/token.ts", "tests/auth.test.ts"] }
];

export interface ComparisonRow { scenario: string; risk: RiskLevel; strategy: ExecutionStrategy; repetition: number; result: WorkResult }
export interface StrategySummary { strategy: ExecutionStrategy; runs: number; completed: number; validationPasses: number; totalCost: number; totalDurationMs: number; modelCalls: number; auditEntries: number }

export async function runComparison(repetitions = 5): Promise<ComparisonRow[]> {
  const rows: ComparisonRow[] = [];
  for (const scenario of scenarios) for (const strategy of strategies) for (let repetition = 1; repetition <= repetitions; repetition++) {
    const host = new StandaloneHostAdapter(); const core = new AgentCompanyCore(host);
    const id = `${scenario.id}:${strategy}:${repetition}`;
    const request: WorkRequest = { runId: id, requestId: id, strategy, risk: scenario.risk, goal: scenario.goal, approved: true, allowedPaths: ["src/**", "tests/**"], requestedPaths: scenario.paths, maxCost: 2 };
    rows.push({ scenario: scenario.id, risk: scenario.risk, strategy, repetition, result: await core.execute(request) });
  }
  return rows;
}

export function summarize(rows: ComparisonRow[]): StrategySummary[] {
  return strategies.map(strategy => {
    const selected = rows.filter(row => row.strategy === strategy);
    return {
      strategy,
      runs: selected.length,
      completed: selected.filter(row => row.result.status === "completed").length,
      validationPasses: selected.filter(row => row.result.validationPassed).length,
      totalCost: selected.reduce((sum, row) => sum + row.result.cost, 0),
      totalDurationMs: selected.reduce((sum, row) => sum + row.result.durationMs, 0),
      modelCalls: selected.reduce((sum, row) => sum + row.result.audit.filter(entry => entry.type === "MODEL_CALLED").length, 0),
      auditEntries: selected.reduce((sum, row) => sum + row.result.audit.length, 0)
    };
  });
}

async function main(): Promise<void> {
  const rows = await runComparison();
  const output = resolve(dirname(fileURLToPath(import.meta.url)), "../../../outputs/phase0-report.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), controls: { repetitions: 5, sameModel: true, sameBudget: true, blindHumanEvaluation: "pending" }, summary: summarize(rows), rows }, null, 2));
  console.log(`phase0 smoke: ${rows.length} runs, report=${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
