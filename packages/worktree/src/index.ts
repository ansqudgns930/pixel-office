import { mkdir, rm, lstat, realpath, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import type { StateStore } from "../../persistence/src/index.js";
import { inside } from "../../tool-gateway/src/index.js";

const exec = promisify(execFile);
export class WorktreeManager {
  private executionRepoPromise:Promise<string>|null=null;
  constructor(private readonly git: string, private readonly repo: string, private readonly worktreeRoot: string, private readonly store: StateStore) {}
  private executionRepo():Promise<string>{return this.executionRepoPromise??=this.resolveExecutionRepo();}
  private async resolveExecutionRepo():Promise<string>{
    try{await exec(this.git,["-C",this.repo,"rev-parse","--git-dir"],{windowsHide:true});return this.repo;}
    catch{
      const managed=resolve(this.worktreeRoot,"_managed-repo");await mkdir(managed,{recursive:true});
      try{await exec(this.git,["-C",managed,"rev-parse","--git-dir"],{windowsHide:true});}
      catch{await exec(this.git,["init",managed],{windowsHide:true});await exec(this.git,["-C",managed,"config","user.email","agent-company@local.invalid"],{windowsHide:true});await exec(this.git,["-C",managed,"config","user.name","Agent Company OS"],{windowsHide:true});await writeFile(join(managed,"README.md"),"# Agent Company managed workspace\n","utf8");await writeFile(join(managed,"health.js"),"export const ready = true;\n","utf8");await exec(this.git,["-C",managed,"add","--all","--","."],{windowsHide:true});await exec(this.git,["-C",managed,"commit","-m","agent-company: initialize managed workspace"],{windowsHide:true});}
      return managed;
    }
  }
  async create(runId: string, ref = "HEAD"): Promise<string> {
    const path = resolve(this.worktreeRoot, runId); if (!inside(this.worktreeRoot, path)) throw new Error("Invalid worktree path");
    const sourceRepo=await this.executionRepo();await mkdir(dirname(path), { recursive: true }); await exec(this.git, ["-C", sourceRepo, "worktree", "add", "--detach", path, ref], { windowsHide: true });
    this.store.audit(runId, "WORKTREE_CREATED", { path, ref,sourceRepo,managed:sourceRepo!==this.repo }); return path;
  }
  async head(path?:string): Promise<string> { const target=path??await this.executionRepo(),{ stdout } = await exec(this.git, ["-C", target, "rev-parse", "HEAD"], { windowsHide: true }); return stdout.trim(); }
  async diff(runId: string, path: string): Promise<{ patch: string; hash: string; files: string[] }> {
    if (!inside(this.worktreeRoot, path)) throw new Error("Worktree outside managed root");
    await exec(this.git, ["-C", path, "add", "-N", "--", "."]);
    const [{ stdout: patch }, { stdout: names }] = await Promise.all([exec(this.git, ["-C", path, "diff", "--binary", "--no-ext-diff"]), exec(this.git, ["-C", path, "diff", "--name-only"])]);
    const hash = createHash("sha256").update(patch).digest("hex"); const files = names.split(/\r?\n/).filter(Boolean);
    this.store.audit(runId, "DIFF_CREATED", { hash, files }); return { patch, hash, files };
  }
  async assertScope(runId: string, path: string, files: readonly string[], allowedPaths: readonly string[]): Promise<void> {
    if (!inside(this.worktreeRoot, path)) throw new WorktreeScopeViolation("Worktree outside managed root");
    const realRoot = await realpath(path);
    for (const file of files) {
      const target = resolve(path, file), pathAllowed = inside(path, target) && allowedPaths.some(prefix => inside(resolve(path, prefix), target));
      if (!pathAllowed) { this.store.audit(runId, "SCOPE_BLOCKED", { file, reason: "diff-outside-approved-path" }); throw new WorktreeScopeViolation(`Diff outside approved path: ${file}`); }
      try {
        const stat = await lstat(target); if (stat.isSymbolicLink()) throw new WorktreeScopeViolation(`Symbolic link change blocked: ${file}`);
        const actual = await realpath(target); if (!inside(realRoot, actual)) throw new WorktreeScopeViolation(`Real path escapes worktree: ${file}`);
      } catch (error) {
        if (error instanceof WorktreeScopeViolation) { this.store.audit(runId, "SCOPE_BLOCKED", { file, reason: error.message }); throw error; }
        const code = (error as NodeJS.ErrnoException).code; if (code !== "ENOENT") throw error;
      }
    }
    this.store.audit(runId, "DIFF_SCOPE_VALIDATED", { files, allowedPaths });
  }
  async remove(runId: string, path: string): Promise<void> {
    if (!inside(this.worktreeRoot, path)) throw new Error("Worktree outside managed root");
    const sourceRepo=await this.executionRepo();await exec(this.git, ["-C", sourceRepo, "worktree", "remove", "--force", path], { windowsHide: true }).catch(async () => rm(path, { recursive: true, force: true }));
    this.store.audit(runId, "WORKTREE_REMOVED", { path: relative(this.worktreeRoot, path) });
  }
  async createCandidate(runId: string, path: string): Promise<{ branch: string; commit: string; baseCommit: string }> {
    if (!inside(this.worktreeRoot, path)) throw new Error("Worktree outside managed root");
    const safe = runId.replace(/[^a-zA-Z0-9._-]/g, "-"); if (!safe) throw new Error("Invalid candidate run id"); const branch = `agent-company/${safe}`;
    const sourceRepo=await this.executionRepo(),{ stdout: baseOut } = await exec(this.git, ["-C", path, "rev-parse", "HEAD"]); const baseCommit = baseOut.trim();
    await exec(this.git, ["-C", path, "add", "--all", "--", "."]); await exec(this.git, ["-C", path, "commit", "-m", `agent-company: candidate ${safe}`]);
    const { stdout: commitOut } = await exec(this.git, ["-C", path, "rev-parse", "HEAD"]); const commit = commitOut.trim(); await exec(this.git, ["-C", sourceRepo, "branch", branch, commit]);
    this.store.audit(runId, "MERGE_CANDIDATE_CREATED", { branch, commit, baseCommit }); return { branch, commit, baseCommit };
  }
}

export class WorktreeScopeViolation extends Error {}
