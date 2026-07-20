import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import type { StateStore } from "../../persistence/src/index.js";

const exec = promisify(execFile);
export type SandboxRunner = (file: string, args: string[], options: { timeout: number; windowsHide: boolean }) => Promise<{ stdout: string; stderr: string }>;
export interface SandboxRequest { runId: string; workspace: string; image: string; command: readonly string[]; timeoutMs?: number }

export class DockerSandbox {
  constructor(private readonly docker: string, private readonly store: StateStore, private readonly runner: SandboxRunner = async (file, args, options) => exec(file, args, options)) {}
  async run(request: SandboxRequest): Promise<{ stdout: string; stderr: string }> {
    if (!/^[a-z0-9][a-z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/.test(request.image)) throw new Error("Invalid Docker image");
    if (!request.command.length) throw new Error("Sandbox command required");
    const workspace = resolve(request.workspace);
    const args = ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--memory", "1g", "--cpus", "1", "--mount", `type=bind,src=${workspace},dst=/workspace`, "--workdir", "/workspace", "--tmpfs", "/tmp:rw,noexec,nosuid,size=128m", request.image, ...request.command];
    this.store.audit(request.runId, "SANDBOX_STARTED", { image: request.image, network: "none", command: request.command });
    try { const result = await this.runner(this.docker, args, { timeout: request.timeoutMs ?? 120_000, windowsHide: true }); this.store.audit(request.runId, "SANDBOX_COMPLETED", { image: request.image }); return result; }
    catch (error) { this.store.audit(request.runId, "SANDBOX_FAILED", { image: request.image, error: error instanceof Error ? error.message : String(error) }); throw error; }
  }
}
