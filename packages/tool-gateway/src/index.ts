import { mkdir, writeFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { StateStore } from "../../persistence/src/index.js";
import { LocalProcessSandbox, type CommandPolicy, type ExecutionSandbox } from "../../execution-sandbox/src/index.js";

export class ToolPolicyViolation extends Error {}

function inside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate)); return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export class ToolGateway {
  private readonly sandbox: ExecutionSandbox;
  constructor(private readonly store: StateStore, private readonly workspace: string, private readonly allowedPaths: readonly string[], commands: Readonly<Record<string, CommandPolicy>>, sandbox?: ExecutionSandbox) { this.sandbox = sandbox ?? new LocalProcessSandbox(store, workspace, commands); }

  async write(runId: string, path: string, content: string): Promise<void> {
    const target = resolve(this.workspace, path);
    const allowed = inside(this.workspace, target) && this.allowedPaths.some(prefix => inside(resolve(this.workspace, prefix), target));
    if (!allowed) { this.store.audit(runId, "TOOL_BLOCKED", { tool: "write", path, reason: "path-scope" }); throw new ToolPolicyViolation(`Path outside approved scope: ${path}`); }
    await mkdir(dirname(target), { recursive: true });
    const [realWorkspace, realParent] = await Promise.all([realpath(this.workspace), realpath(dirname(target))]);
    if (!inside(realWorkspace, realParent)) { this.store.audit(runId, "TOOL_BLOCKED", { tool: "write", path, reason: "symlink-escape" }); throw new ToolPolicyViolation(`Symlink escapes workspace: ${path}`); }
    await writeFile(target, content, "utf8"); this.store.recordToolCall(runId, "write", "COMPLETED", { path }); this.store.audit(runId, "TOOL_COMPLETED", { tool: "write", path });
  }

  async execute(runId: string, name: string): Promise<{ stdout: string; stderr: string }> {
    if (/^(deploy|external[-_]?send|send|publish|upload|delete|remove|destroy)$/i.test(name)) { this.store.audit(runId, "TOOL_BLOCKED", { tool: "command", name, reason: "forbidden-side-effect" }); throw new ToolPolicyViolation(`Forbidden side effect: ${name}`); }
    this.store.audit(runId, "TOOL_STARTED", { tool: "command", name });
    try {
      const result = await this.sandbox.execute(runId, name);
      this.store.recordToolCall(runId, name, "COMPLETED", { exitCode: 0 }); this.store.audit(runId, "TOOL_COMPLETED", { tool: "command", name, exitCode: 0 }); return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const detail = error as Error & { code?: number; stdout?: string; stderr?: string }; this.store.recordToolCall(runId, name, "FAILED", { exitCode: detail.code ?? -1, error: detail.message }); this.store.audit(runId, "TOOL_FAILED", { tool: "command", name, exitCode: detail.code ?? -1, error: detail.message }); throw error;
    }
  }
}

export { inside, type CommandPolicy };
