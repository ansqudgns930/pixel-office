import type { StateStore } from "../../persistence/src/index.js";
import type { ToolGateway } from "../../tool-gateway/src/index.js";

export type ValidationKind = "build" | "typecheck" | "test" | "lint" | "security";
export interface ValidationResult { kind: ValidationKind; passed: boolean; output: string }
export class DeterministicValidator {
  constructor(private readonly gateway: ToolGateway, private readonly store: StateStore) {}
  async validate(runId: string, checks: readonly ValidationKind[] = ["build", "test", "lint", "security"]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    for (const kind of checks) try { const result = await this.gateway.execute(runId, kind); const output = `${result.stdout}${result.stderr}`; results.push({ kind, passed: true, output }); this.store.recordValidation(runId, kind, true, output); }
    catch (error) { const output = error instanceof Error ? error.message : String(error); results.push({ kind, passed: false, output }); this.store.recordValidation(runId, kind, false, output); }
    this.store.audit(runId, "VALIDATION_COMPLETED", { passed: results.every(x => x.passed), checks: results.map(x => ({ kind: x.kind, passed: x.passed })) }); return results;
  }
}
