import { execFile } from "node:child_process";
import { dirname, basename, delimiter, resolve } from "node:path";
import { promisify } from "node:util";
import type { StateStore } from "../../persistence/src/index.js";

const exec = promisify(execFile);
export interface CommandPolicy { file: string; args: readonly string[]; timeoutMs?: number; maxOutputBytes?: number }
export interface SandboxResult { stdout: string; stderr: string }
export interface ExecutionSandbox { execute(runId: string, name: string): Promise<SandboxResult> }
export interface LocalSandboxOptions { maxConcurrent?: number; environmentAllowlist?: readonly string[]; environment?: Readonly<Record<string, string>> }
export class SandboxPolicyViolation extends Error {}

const FORBIDDEN_NAME = /^(deploy|external[-_]?send|send|publish|upload|install|uninstall|delete|remove|destroy)$/i;
const FORBIDDEN_EXECUTABLE = /^(cmd|powershell|pwsh|bash|sh|curl|wget|scp|ssh|ftp)(\.exe)?$/i;
const FORBIDDEN_ARGUMENT = /^(?:-e|--eval|-c|\/c|install|uninstall|ci|add|publish|deploy|upload)$/i;

export class LocalProcessSandbox implements ExecutionSandbox {
  private active = 0;
  private readonly maxConcurrent: number;
  private readonly env: NodeJS.ProcessEnv;

  constructor(private readonly store: StateStore, private readonly workspace: string, private readonly commands: Readonly<Record<string, CommandPolicy>>, options: LocalSandboxOptions = {}) {
    this.workspace = resolve(workspace); this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 2);
    const allowed = options.environmentAllowlist ?? ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATHEXT"];
    this.env = {};
    for (const key of allowed) { const value = options.environment?.[key] ?? process.env[key]; if (value !== undefined) this.env[key] = value; }
    const executablePaths = [...new Set(Object.values(commands).map(command => dirname(resolve(command.file))))];
    this.env.PATH = executablePaths.join(delimiter);
  }

  async execute(runId: string, name: string): Promise<SandboxResult> {
    const policy = this.commands[name];
    if (!policy) return this.block(runId, name, "not-allowlisted");
    if (FORBIDDEN_NAME.test(name)) return this.block(runId, name, "forbidden-side-effect");
    if (FORBIDDEN_EXECUTABLE.test(basename(policy.file))) return this.block(runId, name, "forbidden-executable");
    if (policy.args.some(argument => FORBIDDEN_ARGUMENT.test(argument.trim()))) return this.block(runId, name, "forbidden-argument");
    if (this.active >= this.maxConcurrent) return this.block(runId, name, "concurrency-limit");
    this.active++;
    this.store.audit(runId, "LOCAL_SANDBOX_STARTED", { name, file: basename(policy.file), args: policy.args, environmentKeys: Object.keys(this.env) });
    try {
      const result = await exec(policy.file, [...policy.args], { cwd: this.workspace, env: this.env, timeout: policy.timeoutMs ?? 120_000, windowsHide: true, maxBuffer: policy.maxOutputBytes ?? 10 * 1024 * 1024, shell: false });
      this.store.audit(runId, "LOCAL_SANDBOX_COMPLETED", { name }); return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      this.store.audit(runId, "LOCAL_SANDBOX_FAILED", { name, error: error instanceof Error ? error.message : String(error) }); throw error;
    } finally { this.active--; }
  }

  private block(runId: string, name: string, reason: string): never { this.store.audit(runId, "LOCAL_SANDBOX_BLOCKED", { name, reason }); throw new SandboxPolicyViolation(`${name} blocked: ${reason}`); }
}
