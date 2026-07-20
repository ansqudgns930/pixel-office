import type { StateStore, MergeCandidateRecord } from "../../persistence/src/index.js";
import type { ApprovalIntegrity } from "../../approval/src/index.js";
import type { WorktreeManager } from "../../worktree/src/index.js";

export class MergeCandidateService {
  constructor(private readonly store: StateStore, private readonly approvals: ApprovalIntegrity, private readonly worktrees: WorktreeManager) {}
  async approveAndCreate(runId: string, _requestedPatchHash: string, userId: string, worktree: string): Promise<MergeCandidateRecord> {
    const run = this.store.getRun(runId); if (!run) throw new Error("Run not found"); if (this.store.staleArtifactsForRun(runId).length) throw new Error("Stale artifacts cannot create a merge candidate");
    if(worktree.startsWith("goal-delivery-artifact:")){
      const durable=this.store.runResult(runId);if(!durable)throw new Error("Goal delivery artifact result missing");
      const artifactOnly={runId,branch:"artifact-only",commit:durable.patchHash,baseCommit:"artifact-only",patchHash:durable.patchHash};
      const approved=await this.approvals.approveResult(runId,durable.patchHash,userId,async()=>artifactOnly);
      if(!approved)throw new Error("Goal delivery artifact was not approved");
      this.store.audit(runId,"GOAL_DELIVERY_ARTIFACT_APPROVED",{userId,patchHash:durable.patchHash});return approved;
    }
    const actual = await this.worktrees.diff(runId, worktree); const allowedPaths = (run.checkpoint?.requestedPaths as string[] | undefined) ?? []; await this.worktrees.assertScope(runId, worktree, actual.files, allowedPaths);
    const result = await this.approvals.approveResult(runId, actual.hash, userId, async () => {
      const candidate = await this.worktrees.createCandidate(runId, worktree); const record = { runId, ...candidate, patchHash: actual.hash }; this.store.addMergeCandidate(record); return record;
    });
    if (!result) throw new Error("Merge candidate was not created"); return result;
  }
}
