import { timingSafeEqual } from "node:crypto";
import type { StateStore } from "../../persistence/src/index.js";
import type { RunController } from "../../runtime/src/index.js";

const sameHash = (a: string, b: string): boolean => {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};

export class ApprovalIntegrity {
  constructor(private readonly store: StateStore, private readonly controller: RunController) {}
  bindResult(runId: string, patchHash: string): void {
    if (!/^[a-f0-9]{64}$/.test(patchHash)) throw new Error("Invalid patch hash");
    if (!this.store.bindApprovalHash(`${runId}:result`, patchHash)) throw new Error("Result approval is missing, decided, or already bound");
    this.store.audit(runId, "RESULT_HASH_BOUND", { patchHash });
  }
  async approveResult<T = void>(runId: string, actualPatchHash: string, userId: string, beforeComplete?: () => Promise<T>): Promise<T | undefined> {
    const run = this.store.getRun(runId); if (!run || run.status !== "RESULT_APPROVAL_WAITING") throw new Error("Run is not waiting for result approval");
    if(run.checkpoint?.humanReview===true&&run.checkpoint.humanReviewerId!==userId){this.store.audit(runId,"HUMAN_REVIEW_BLOCKED",{requiredReviewer:run.checkpoint.humanReviewerId??null,userId});throw new Error("Assigned human reviewer must approve the result");}
    const stale = this.store.staleArtifactsForRun(runId); if (stale.length) { this.store.audit(runId, "STALE_APPROVAL_BLOCKED", { artifactVersionIds: stale.map(x => x.id) }); this.controller.move(runId, "BLOCKED", { reason: "stale-artifact" }); throw new Error("Stale artifacts require revalidation"); }
    const approval = this.store.approval(`${runId}:result`);
    if(approval?.expiresAt&&Date.parse(approval.expiresAt)<=Date.now()){this.store.audit(runId,"APPROVAL_EXPIRED",{approvalId:approval.id,kind:"result",expiresAt:approval.expiresAt});this.controller.move(runId,"BLOCKED",{reason:"approval-expired"});throw new Error("Result approval expired");}
    if (!approval?.expectedPatchHash || !sameHash(approval.expectedPatchHash, actualPatchHash)) {
      this.store.audit(runId, "PATCH_HASH_BLOCKED", { expected: approval?.expectedPatchHash ?? null, actual: actualPatchHash }); this.controller.move(runId, "BLOCKED", { reason: "patch-hash-mismatch" }); throw new Error("Patch changed after approval was requested");
    }
    const result = beforeComplete ? await beforeComplete() : undefined;
    if (!this.store.decideApproval(approval.id, true, userId)) throw new Error("Result approval already decided");
    this.store.audit(runId, "RESULT_APPROVED", { userId, patchHash: actualPatchHash }); this.controller.move(runId, "COMPLETED");
    return result;
  }
}
