import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MergeCandidateRecord, MergeAssessmentRecord, StateStore } from "../../persistence/src/index.js";
const exec = promisify(execFile);
const lines = (value: string) => value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

export class MergeConflictAnalyzer {
  constructor(private readonly git: string, private readonly repo: string, private readonly store: StateStore) {}
  async analyze(candidate: MergeCandidateRecord, targetRef = "HEAD"): Promise<MergeAssessmentRecord> {
    const currentHead = (await exec(this.git, ["-C", this.repo, "rev-parse", targetRef])).stdout.trim(), candidateFiles = lines((await exec(this.git, ["-C", this.repo, "diff", "--name-only", `${candidate.baseCommit}..${candidate.commit}`])).stdout), targetFiles = currentHead === candidate.baseCommit ? [] : lines((await exec(this.git, ["-C", this.repo, "diff", "--name-only", `${candidate.baseCommit}..${currentHead}`])).stdout), targetSet = new Set(targetFiles), overlappingFiles = candidateFiles.filter(path => targetSet.has(path));
    let conflict = false, conflictedFiles: string[] = [];
    try { await exec(this.git, ["-C", this.repo, "merge-tree", "--write-tree", currentHead, candidate.commit]); }
    catch (error) { conflict = true; const output = `${(error as { stdout?: string }).stdout ?? ""}\n${(error as { stderr?: string }).stderr ?? ""}`; conflictedFiles = [...new Set(lines(output).flatMap(line => { const match = line.match(/(?:CONFLICT.* in |^)([^ ]+\.[^ ]+)$/); return match?.[1] ? [match[1]] : []; }))]; if (!conflictedFiles.length) conflictedFiles = overlappingFiles; }
    const baseMoved = currentHead !== candidate.baseCommit, revalidationRequired = baseMoved || conflict; const record = this.store.saveMergeAssessment({ runId: candidate.runId, currentHead, baseMoved, overlappingFiles, conflictedFiles, conflict, revalidationRequired }); this.store.audit(candidate.runId, "MERGE_ASSESSED", { currentHead, baseMoved, overlappingFiles, conflictedFiles, conflict, revalidationRequired }); return record;
  }
}
