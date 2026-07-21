import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";
import { AgentBindingStore } from "../packages/agent-bindings/src/index.js";
import { MeetingAgentRunner } from "../packages/meeting-runner/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";
import { collectBuildReviewEvidence } from "../packages/review-evidence/src/index.js";

function fixture() {
  const state = new SQLiteStateStore(":memory:");
  const projects = new ProjectOperations(state.db, state);
  const companies = new CompanyOperations(state.db, state, projects);
  projects.createWorkspace("w", "Workspace");
  companies.createCompany({ id: "c", name: "Company", workspaceId: "w", budgetLimit: 100, mandatoryReviews: ["review"], mandatoryApprovals: ["result"], allowedTools: ["build", "test"] }, "owner");
  companies.createGoal({ id: "g", companyId: "c", title: "제품 출시", description: "첫 번째 버전", ownerId: "owner", completionCriteria: ["검증 통과"], budgetLimit: 20, dueAt: null, status: "active" }, "owner");
  return { state, companies };
}

function reviewFixture() {
  const state = new SQLiteStateStore(":memory:");
  const projects = new ProjectOperations(state.db, state);
  const companies = new CompanyOperations(state.db, state, projects);
  projects.createWorkspace("w", "Workspace");
  projects.createProject({ id: "p", workspaceId: "w", name: "Delivery", repoPath: ".", defaultBranch: "main", runtimePath: ".", organizationProfile: {}, budgetLimit: 30 }, "owner");
  companies.createCompany({ id: "c", name: "Company", workspaceId: "w", budgetLimit: 100, mandatoryReviews: ["review"], mandatoryApprovals: ["result"], allowedTools: ["build", "test"] }, "owner");
  companies.createDepartment({ id: "d", companyId: "c", parentId: null, name: "Product", budgetLimit: 30 }, "owner");
  companies.addMember("c", "owner", "agent-a", "member", "d", "agent");
  companies.addMember("c", "owner", "agent-b", "member", "d", "agent");
  companies.linkProject("c", "d", "p", 1, "owner");
  companies.createGoal({ id: "g", companyId: "c", title: "제품 출시", description: "", ownerId: "owner", completionCriteria: ["검증 통과"], budgetLimit: 20, dueAt: null, status: "active" }, "owner");
  companies.linkGoalProject("c", "g", "p", "owner");
  projects.createTask({ id: "t", projectId: "p", milestoneId: null, title: "기획", status: "ready", priority: 1, completionCriteria: ["기획 검토"], budgetLimit: 20 }, { id: "owner" });
  state.createRun({ id: "r", requestId: "request-r", goal: "기획", risk: "medium", status: "RESULT_APPROVAL_WAITING", budgetLimit: 20, spent: 2, checkpoint: { requestedPaths: ["src"] } });
  projects.linkRun("t", "r", { id: "owner" });
  projects.assign("t", { id: "owner" }, "agent-a", "agent", "executor");
  projects.assign("t", { id: "owner" }, "agent-b", "agent", "reviewer");
  companies.startGoalDeliveryProcess({ id: "dp", companyId: "c", goalId: "g", idempotencyKey: "start-review", runId: "r" }, "owner");
  state.audit("r", "VALIDATION_COMPLETED", { passed: true, checks: [{ kind: "test", passed: true }] });
  state.saveRunResult({ runId: "r", worktree: ".", patch: "diff", patchHash: "patch-hash", files: ["src/index.ts"], validation: [{ kind: "test", passed: true }] });
  return { state, projects, companies };
}

function finishTeamMeeting(companies: CompanyOperations) {
  const prepared = companies.prepareGoalDeliveryReviewForRun("r");
  assert.ok(prepared);
  assert.equal(prepared.snapshot.currentStageInstance.status, "review-waiting");
  assert.equal(prepared.meeting.status, "scheduled");
  assert.deepEqual(prepared.meeting.participantIds.sort(), ["agent-a", "agent-b", "owner"]);
  assert.equal(companies.prepareGoalDeliveryReviewForRun("r")?.created, false);
  companies.transitionMeeting("c", prepared.meeting.id, "live", "owner");
  companies.addMeetingMessage("c", prepared.meeting.id, { id: "opinion", kind: "opinion", targetType: "all", targetId: null, content: "모바일 범위에 일정 위험이 있습니다.", evidence: ["validation:1"], followUp: null }, "agent-a");
  companies.addMeetingMessage("c", prepared.meeting.id, { id: "question", kind: "question", targetType: "all", targetId: null, content: "롤백 기준이 명확합니까?", evidence: ["run:r"], followUp: null }, "agent-b");
  companies.transitionMeeting("c", prepared.meeting.id, "ended", "owner");
  const reviewed = companies.completeGoalDeliveryTeamReview(prepared.meeting.id);
  assert.equal(reviewed.currentStageInstance.status, "owner-approval-waiting");
  assert.equal(reviewed.ownerReview?.status, "pending");
  assert.match(reviewed.ownerReview?.koreanSummary ?? "", /직원 검토 회의가 완료/);
  assert.ok((reviewed.ownerReview?.evidenceIds.length ?? 0) >= 3);
  assert.equal(reviewed.ownerReview?.packet.version, 2);
  assert.equal(reviewed.ownerReview?.packet.completeness.ready, true);
  assert.ok(reviewed.ownerReview?.packet.sections.some(section => section.items.includes("검증 통과")));
  assert.ok(reviewed.ownerReview?.packet.evidence.some(item => item.kind === "meeting" && item.url?.includes("/meetings")));
  return { prepared, reviewed };
}

function buildReviewFixture() {
  const fixture = reviewFixture(), { state, projects, companies } = fixture;
  let snapshot = companies.goalDeliveryProcess("c", "g", "owner")!;
  const approveDirectly = () => {
    for (const [to, key] of [["validation-waiting", "validation"], ["review-waiting", "review"], ["owner-approval-waiting", "owner"], ["approved", "approved"]] as const) {
      snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to, expectedVersion: snapshot.process.version, idempotencyKey: `${snapshot.process.currentStage}-${key}` }, "owner");
    }
  };
  approveDirectly();
  snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to: "in-progress", expectedVersion: snapshot.process.version, idempotencyKey: "planning-start" }, "owner");
  approveDirectly();
  assert.equal(snapshot.process.currentStage, "build");
  projects.createTask({ id: "t-build", projectId: "p", milestoneId: null, title: "개발", status: "ready", priority: 3, completionCriteria: ["검증 통과"], budgetLimit: 20 }, { id: "owner" });
  state.createRun({ id: "r-build", requestId: "request-build", goal: "개발", risk: "medium", status: "RESULT_APPROVAL_WAITING", budgetLimit: 20, spent: 2, checkpoint: { requestedPaths: ["src"] } });
  projects.linkRun("t-build", "r-build", { id: "owner" });
  projects.assign("t-build", { id: "owner" }, "agent-a", "agent", "executor");
  projects.assign("t-build", { id: "owner" }, "agent-b", "agent", "reviewer");
  snapshot = companies.attachGoalDeliveryStageRun("c", "g", snapshot.currentStageInstance.id, "r-build", "owner");
  state.audit("r-build", "VALIDATION_COMPLETED", { passed: true, checks: ["build", "test", "security"] });
  state.saveRunResult({ runId: "r-build", worktree: ".", patch: "diff", patchHash: "build-patch", files: ["src/api.ts", "tests/api.test.ts", "tests/api.integration.test.ts", "src/security.ts", "package.json"], validation: [{ kind: "build", passed: true }, { kind: "typecheck", passed: true }, { kind: "test", passed: true }, { kind: "security", passed: true }] });
  return { ...fixture, snapshot };
}

function finishBuildMeeting(companies: CompanyOperations) {
  const prepared = companies.prepareGoalDeliveryReviewForRun("r-build")!;
  companies.transitionMeeting("c", prepared.meeting.id, "live", "owner");
  companies.addMeetingMessage("c", prepared.meeting.id, { id: "build-opinion", kind: "opinion", targetType: "all", targetId: null, content: "개발 검증 결과를 확인했습니다.", evidence: ["build-evidence"], followUp: null }, "agent-a");
  companies.transitionMeeting("c", prepared.meeting.id, "ended", "owner");
  return companies.completeGoalDeliveryTeamReview(prepared.meeting.id);
}

test("goal delivery process versions stages, replays commands, and invalidates revised evidence", () => {
  const { state, companies } = fixture();
  const started = companies.startGoalDeliveryProcess({ id: "dp", companyId: "c", goalId: "g", idempotencyKey: "start-1" }, "owner");
  assert.equal(started.process.version, 1);
  assert.equal(started.process.currentStage, "discovery");
  assert.equal(started.currentStageInstance.status, "pending");
  assert.deepEqual(companies.startGoalDeliveryProcess({ id: "ignored", companyId: "c", goalId: "g", idempotencyKey: "start-1" }, "owner"), started);

  let snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: started.currentStageInstance.id, to: "in-progress", expectedVersion: 1, idempotencyKey: "transition-1" }, "owner");
  assert.equal(snapshot.process.version, 2);
  snapshot = companies.addGoalDeliveryArtifactSnapshot("c", "g", snapshot.currentStageInstance.id, { id: "evidence-v1", artifactIds: ["artifact:b", "artifact:a", "artifact:a"], expectedVersion: 2, idempotencyKey: "artifact-1" }, "owner");
  assert.deepEqual(snapshot.artifactSnapshots[0]!.artifactIds, ["artifact:a", "artifact:b"]);
  assert.equal(snapshot.artifactSnapshots[0]!.stale, false);

  for (const [to, key] of [["validation-waiting", "transition-2"], ["review-waiting", "transition-3"], ["owner-approval-waiting", "transition-4"]] as const) {
    snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to, expectedVersion: snapshot.process.version, idempotencyKey: key }, "owner");
  }
  const revisionRequest = { stageInstanceId: snapshot.currentStageInstance.id, to: "revision-requested" as const, expectedVersion: snapshot.process.version, idempotencyKey: "transition-revision", reason: "사용자 범위 수정" };
  snapshot = companies.transitionGoalDeliveryStage("c", "g", revisionRequest, "owner");
  assert.equal(snapshot.currentStageInstance.attempt, 2);
  assert.equal(snapshot.currentStageInstance.status, "pending");
  assert.equal(snapshot.artifactSnapshots[0]!.stale, true);
  assert.equal(snapshot.artifactSnapshots[0]!.staleReason, "사용자 범위 수정");
  assert.deepEqual(companies.transitionGoalDeliveryStage("c", "g", revisionRequest, "owner"), snapshot);
  assert.throws(() => companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to: "in-progress", expectedVersion: 1, idempotencyKey: "stale-version" }, "owner"), /version conflict/);

  snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to: "in-progress", expectedVersion: snapshot.process.version, idempotencyKey: "revision-start" }, "owner");
  snapshot = companies.addGoalDeliveryArtifactSnapshot("c", "g", snapshot.currentStageInstance.id, { id: "evidence-v2", artifactIds: ["artifact:c"], expectedVersion: snapshot.process.version, idempotencyKey: "artifact-2" }, "owner");
  for (const [to, key] of [["validation-waiting", "revision-validation"], ["review-waiting", "revision-review"], ["owner-approval-waiting", "revision-owner"], ["approved", "revision-approved"]] as const) {
    snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to, expectedVersion: snapshot.process.version, idempotencyKey: key }, "owner");
  }
  assert.equal(snapshot.process.currentStage, "delivery-planning");
  assert.equal(snapshot.currentStageInstance.status, "pending");
  assert.equal(snapshot.stages.filter(stage => stage.stage === "discovery").length, 2);
  assert.ok((companies.auditEvents("c") as Array<{ type: string }>).some(event => event.type === "GOAL_DELIVERY_STAGE_TRANSITIONED"));
  state.close();
});

test("goal delivery process enforces current attempts and terminal transitions", () => {
  const { state, companies } = fixture();
  let snapshot = companies.startGoalDeliveryProcess({ id: "dp", companyId: "c", goalId: "g", idempotencyKey: "start" }, "owner");
  assert.throws(() => companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: "not-current", to: "in-progress", expectedVersion: snapshot.process.version, idempotencyKey: "wrong-stage" }, "owner"), /current stage attempt/);
  snapshot = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to: "cancelled", expectedVersion: snapshot.process.version, idempotencyKey: "cancel" }, "owner");
  assert.equal(snapshot.process.status, "cancelled");
  assert.throws(() => companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: snapshot.currentStageInstance.id, to: "in-progress", expectedVersion: snapshot.process.version, idempotencyKey: "after-cancel" }, "owner"), /terminal/);
  state.close();
});

test("goal delivery process and command replay survive a SQLite restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "goal-delivery-"));
  const database = join(directory, "state.sqlite");
  try {
    let state = new SQLiteStateStore(database);
    let projects = new ProjectOperations(state.db, state);
    let companies = new CompanyOperations(state.db, state, projects);
    projects.createWorkspace("w", "Workspace");
    companies.createCompany({ id: "c", name: "Company", workspaceId: "w", budgetLimit: 100, mandatoryReviews: ["review"], mandatoryApprovals: ["result"], allowedTools: ["build", "test"] }, "owner");
    companies.createGoal({ id: "g", companyId: "c", title: "재시작 검증", description: "", ownerId: "owner", completionCriteria: ["상태 유지"], budgetLimit: 20, dueAt: null, status: "active" }, "owner");
    const started = companies.startGoalDeliveryProcess({ id: "dp", companyId: "c", goalId: "g", idempotencyKey: "durable-start" }, "owner");
    const transitioned = companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: started.currentStageInstance.id, to: "in-progress", expectedVersion: 1, idempotencyKey: "durable-transition" }, "owner");
    state.close();

    state = new SQLiteStateStore(database);
    projects = new ProjectOperations(state.db, state);
    companies = new CompanyOperations(state.db, state, projects);
    assert.deepEqual(companies.goalDeliveryProcess("c", "g", "owner"), transitioned);
    assert.deepEqual(companies.transitionGoalDeliveryStage("c", "g", { stageInstanceId: started.currentStageInstance.id, to: "in-progress", expectedVersion: 1, idempotencyKey: "durable-transition" }, "owner"), transitioned);
    const migration = state.db.prepare("SELECT 1 present FROM schema_migrations WHERE version=1900").get() as { present: number } | undefined;
    assert.equal(migration?.present, 1);
    state.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("passed Run evidence creates a related-team meeting and an evidence-bound Korean owner packet", () => {
  const { state, companies } = reviewFixture();
  const { prepared, reviewed } = finishTeamMeeting(companies);
  const queue = companies.ownerReviewQueue("c", "owner");
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.review.id, reviewed.ownerReview?.id);
  assert.equal(queue[0]?.stageLabel, "기획");
  assert.throws(() => companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner"), /Run result approval/);
  companies.confirmMeetingSummary("c", prepared.meeting.id, "owner");
  assert.equal(state.transition("r", ["RESULT_APPROVAL_WAITING"], "COMPLETED"), true);
  const approved = companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner");
  assert.equal(approved.process.currentStage, "delivery-planning");
  assert.equal(approved.currentStageInstance.status, "pending");
  const stored = state.db.prepare("SELECT status,resolved_by FROM goal_delivery_owner_reviews_v20 WHERE id=?").get(reviewed.ownerReview!.id) as { status: string; resolved_by: string };
  assert.equal(stored.status, "approved");
  assert.equal(stored.resolved_by, "owner");
  const decision = state.db.prepare("SELECT packet_hash,decision_hash,packet FROM goal_delivery_review_decisions_v23 WHERE owner_review_id=?").get(reviewed.ownerReview!.id) as {packet_hash:string;decision_hash:string;packet:string};
  assert.equal(decision.packet_hash, reviewed.ownerReview!.snapshotHash);
  assert.match(decision.decision_hash, /^[a-f0-9]{64}$/);
  assert.equal((JSON.parse(decision.packet) as {version:number}).version, 2);
  assert.equal(companies.ownerReviewQueue("c", "owner").length, 0);
  assert.equal(companies.ownerReviewQueue("c", "owner", true)[0]?.review.status, "approved");
  state.close();
});

test("build review requires immutable evidence and includes a ready backend and frontend exemption packet", async () => {
  const { state, companies } = buildReviewFixture();
  assert.throws(() => companies.prepareGoalDeliveryReviewForRun("r-build"), /evidence must be collected/);
  const manifest = await collectBuildReviewEvidence({
    runId: "r-build",
    patchHash: "build-patch",
    files: [
      { path: "src/api.ts", content: "router.post('/api/items'); parse(input); logger.info('ok')" },
      { path: "tests/api.test.ts", content: "test('unit', () => assert(valid))" },
      { path: "tests/api.integration.test.ts", content: "test('integration', () => request('/api/items'))" },
      { path: "src/security.ts", content: "authorization; rate limit; audit(event)" },
      { path: "package.json", content: "build environment" },
    ],
    validations: [{ kind: "build", passed: true }, { kind: "typecheck", passed: true }, { kind: "test", passed: true }, { kind: "security", passed: true }],
    artifactIds: ["validation:build", "validation:test", "validation:security"],
    frontendExemption: "이번 변경은 API 전용이며 프론트엔드 변경 파일이 없습니다.",
  }, null);
  assert.equal(manifest.ready, true);
  assert.equal(companies.recordGoalDeliveryBuildEvidence("r-build", manifest, "owner").snapshotHash, manifest.snapshotHash);
  assert.equal(companies.recordGoalDeliveryBuildEvidence("r-build", manifest, "owner").snapshotHash, manifest.snapshotHash);
  const reviewed = finishBuildMeeting(companies);
  assert.equal(reviewed.ownerReview?.packet.buildEvidence?.snapshotHash, manifest.snapshotHash);
  assert.equal(reviewed.ownerReview?.packet.completeness.ready, true);
  assert.ok(reviewed.ownerReview?.packet.completeness.present.includes("backend-readiness"));
  assert.ok(reviewed.ownerReview?.packet.completeness.present.includes("frontend-evidence"));
  const changed = await collectBuildReviewEvidence({ runId: "r-build", patchHash: "build-patch", files: [], validations: [], artifactIds: [], frontendExemption: "different" }, null);
  assert.throws(() => companies.recordGoalDeliveryBuildEvidence("r-build", changed, "owner"), /immutable/);
  state.close();
});

test("failed build capture remains visible but blocks owner approval", async () => {
  const { state, companies } = buildReviewFixture();
  const failed = await collectBuildReviewEvidence({ runId: "r-build", patchHash: "build-patch", files: [{ path: "src/App.tsx", content: "react" }], validations: [{ kind: "build", passed: true }], artifactIds: [] }, null);
  assert.equal(failed.ready, false);
  companies.recordGoalDeliveryBuildEvidence("r-build", failed, "owner");
  const reviewed = finishBuildMeeting(companies);
  assert.equal(reviewed.ownerReview?.packet.completeness.ready, false);
  assert.ok(reviewed.ownerReview?.packet.completeness.missing.some((item) => item.startsWith("frontend:")));
  assert.throws(() => companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner"), /packet incomplete/);
  state.close();
});

test("a human-approved stage attaches the next Task and Run and authorizes only its bounded execution plan", () => {
  const { state, projects, companies } = reviewFixture();
  const { prepared } = finishTeamMeeting(companies);
  companies.confirmMeetingSummary("c", prepared.meeting.id, "owner");
  assert.equal(state.transition("r", ["RESULT_APPROVAL_WAITING"], "COMPLETED"), true);
  let snapshot = companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner");
  assert.equal(snapshot.currentStageInstance.status, "pending");
  projects.createTask({ id: "t-plan", projectId: "p", milestoneId: null, title: "실행계획", status: "ready", priority: 2, completionCriteria: ["검증 통과"], budgetLimit: 20 }, { id: "owner" });
  state.createRun({ id: "r-plan", requestId: "request-plan", goal: "실행계획", risk: "medium", status: "PLAN_APPROVAL_WAITING", budgetLimit: 20, spent: 0, checkpoint: { requestedPaths: ["src"] } });
  projects.linkRun("t-plan", "r-plan", { id: "owner" });
  projects.assign("t-plan", { id: "owner" }, "agent-a", "agent", "executor");
  projects.assign("t-plan", { id: "owner" }, "agent-b", "agent", "reviewer");
  snapshot = companies.attachGoalDeliveryStageRun("c", "g", snapshot.currentStageInstance.id, "r-plan", "owner");
  assert.equal(snapshot.currentStageInstance.status, "in-progress");
  assert.equal(snapshot.currentStageInstance.runId, "r-plan");
  assert.equal(companies.pendingGoalDeliveryStageWork().find(item => item.runId === "r-plan")?.stage, "delivery-planning");
  const authorization = companies.goalDeliveryPlanAuthorization("r-plan");
  assert.equal(authorization?.stage, "delivery-planning");
  assert.equal(authorization?.ownerId, "owner");
  companies.recordGoalDeliveryPlanAuthorized(authorization!);
  assert.ok((companies.auditEvents("c") as Array<{ type: string; payload: string }>).some(event => event.type === "GOAL_DELIVERY_EXECUTION_PLAN_AUTHORIZED" && event.payload.includes('"meetingDecisionPromoted":false')));
  assert.deepEqual(companies.attachGoalDeliveryStageRun("c", "g", snapshot.currentStageInstance.id, "r-plan", "owner"), snapshot);
  state.close();
});

test("goal delivery plan authorization fails closed without both assigned Agent responsibilities", () => {
  const { state, projects, companies } = reviewFixture();
  state.db.prepare("UPDATE runs SET status='PLAN_APPROVAL_WAITING' WHERE id='r'").run();
  state.db.prepare("DELETE FROM assignments_v3 WHERE task_id='t' AND responsibility='reviewer'").run();
  assert.throws(() => companies.goalDeliveryPlanAuthorization("r"), /executor and reviewer/);
  projects.assign("t", { id: "owner" }, "agent-b", "agent", "reviewer");
  assert.equal(companies.goalDeliveryPlanAuthorization("r")?.stage, "discovery");
  state.close();
});

test("release approval requires an immutable explicit deploy-or-skip decision", () => {
  const { state, companies } = reviewFixture();
  const { prepared, reviewed } = finishTeamMeeting(companies);
  state.db.prepare("UPDATE goal_delivery_processes_v19 SET current_stage='release' WHERE id='dp'").run();
  state.db.prepare("UPDATE goal_delivery_stage_instances_v19 SET stage='release' WHERE process_id='dp'").run();
  assert.throws(() => companies.requestGoalDeployment("c", "g", { action: "skip", environment: "preview", expectedSnapshotHash: "stale" }, "owner"), /snapshot changed/);
  const decision = companies.requestGoalDeployment("c", "g", { action: "skip", environment: "preview", expectedSnapshotHash: reviewed.ownerReview!.snapshotHash }, "owner");
  assert.equal(decision.status, "skipped");
  assert.equal(decision.targetProjectId, null);
  assert.deepEqual(companies.requestGoalDeployment("c", "g", { action: "skip", environment: "preview", expectedSnapshotHash: reviewed.ownerReview!.snapshotHash }, "owner"), decision);
  companies.confirmMeetingSummary("c", prepared.meeting.id, "owner");
  state.transition("r", ["RESULT_APPROVAL_WAITING"], "COMPLETED");
  const approved = companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner");
  assert.equal(approved.process.currentStage, "operate");
  assert.equal(approved.deployment?.status, "skipped");
  state.close();
});

test("production deployment binds human confirmation, verified receipt, and rollback evidence", () => {
  const { state, companies } = reviewFixture();
  const { prepared, reviewed } = finishTeamMeeting(companies);
  state.db.prepare("UPDATE goal_delivery_processes_v19 SET current_stage='release' WHERE id='dp'").run();
  state.db.prepare("UPDATE goal_delivery_stage_instances_v19 SET stage='release' WHERE process_id='dp'").run();
  const input = { action: "deploy" as const, environment: "production" as const, targetProjectId: "firebase-prod", targetChannel: null, expectedSnapshotHash: reviewed.ownerReview!.snapshotHash };
  assert.throws(() => companies.requestGoalDeployment("c", "g", input, "owner"), /confirmation/);
  let deployment = companies.requestGoalDeployment("c", "g", { ...input, confirmation: "DEPLOY firebase-prod" }, "owner");
  assert.equal(deployment.status, "approved");
  deployment = companies.beginGoalDeployment(deployment.id);
  assert.equal(deployment.status, "deploying");
  deployment = companies.completeGoalDeployment(deployment.id, { providerReceiptId: "release/42", url: "https://firebase-prod.web.app", version: "42", verifiedAt: new Date().toISOString(), rollbackRef: "41" });
  assert.equal(deployment.status, "succeeded");
  assert.throws(() => companies.requestGoalDeployment("c", "g", { action: "skip", environment: "preview", expectedSnapshotHash: reviewed.ownerReview!.snapshotHash }, "owner"), /immutable/);
  companies.confirmMeetingSummary("c", prepared.meeting.id, "owner");
  state.transition("r", ["RESULT_APPROVAL_WAITING"], "COMPLETED");
  const approved = companies.resolveGoalDeliveryOwnerReview("c", "g", "approved", "", "owner");
  assert.equal(approved.deployment?.receipt?.providerReceiptId, "release/42");
  const rolledBack = companies.completeGoalDeploymentRollback(deployment.id, new Date().toISOString());
  assert.equal(rolledBack.status, "rolled-back");
  state.close();
});

test("completed delivery stays immutable while a chat change request re-enters at the classified stage", () => {
  const { state, projects, companies } = reviewFixture();
  state.db.prepare("UPDATE goal_delivery_stage_instances_v19 SET status='approved',completed_at='2026-01-01T00:00:00.000Z' WHERE process_id='dp'").run();
  state.db.prepare("UPDATE goal_delivery_processes_v19 SET status='completed',current_stage='operate',completed_at='2026-01-01T00:00:00.000Z' WHERE id='dp'").run();
  const immutableBefore = state.db.prepare("SELECT * FROM goal_delivery_processes_v19 WHERE id='dp'").get();
  let reentry = companies.submitGoalChangeRequest("c", "g", { id: "change-1", message: "관리자 모바일 화면의 필터 UI 버그를 수정하고 테스트해 줘" }, "owner");
  assert.equal(reentry.process.processVersion, 2);
  assert.equal(reentry.process.currentStage, "build");
  assert.equal(reentry.currentStageInstance.status, "pending");
  assert.ok(reentry.artifactSnapshots[0]?.artifactIds.some(id => id === "completed-process:dp"));
  assert.deepEqual(state.db.prepare("SELECT * FROM goal_delivery_processes_v19 WHERE id='dp'").get(), immutableBefore);
  assert.deepEqual(companies.submitGoalChangeRequest("c", "g", { id: "change-1", message: "ignored replay body" }, "owner"), reentry);
  projects.createTask({ id: "t-change", projectId: "p", milestoneId: null, title: "변경 개발", status: "ready", priority: 3, completionCriteria: ["검증 통과"], budgetLimit: 20 }, { id: "owner" });
  state.createRun({ id: "r-change", requestId: "request-change", goal: "변경 개발", risk: "medium", status: "PLAN_APPROVAL_WAITING", budgetLimit: 20, spent: 0, checkpoint: { requestedPaths: ["src"] } });
  projects.linkRun("t-change", "r-change", { id: "owner" });
  projects.assign("t-change", { id: "owner" }, "agent-a", "agent", "executor");
  projects.assign("t-change", { id: "owner" }, "agent-b", "agent", "reviewer");
  reentry = companies.attachGoalDeliveryStageRun("c", "g", reentry.currentStageInstance.id, "r-change", "owner");
  assert.equal(companies.goalDeliveryPlanAuthorization("r-change")?.stage, "build");
  assert.equal(reentry.currentStageInstance.status, "in-progress");
  const change = state.db.prepare("SELECT impact_stage,source_completion_hash,status FROM goal_change_requests_v22 WHERE id='change-1'").get() as {impact_stage:string;source_completion_hash:string;status:string};
  assert.equal(change.impact_stage, "build");
  assert.match(change.source_completion_hash, /^[a-f0-9]{64}$/);
  assert.equal(change.status, "accepted");
  state.close();
});

test("change impact routing distinguishes requirements, planning, development, and deployment", () => {
  const cases:[[string,string],...Array<[string,string]>]=[["신규 사용자 요구사항과 완료 기준을 추가해 줘","discovery"],["작업 의존성과 일정 계획을 바꿔 줘","delivery-planning"],["API 버그를 수정해 줘","build"],["Firebase 도메인 배포 설정을 바꿔 줘","release"]];
  for(const [message,expected] of cases){const {state,companies}=fixture();const started=companies.startGoalDeliveryProcess({id:"dp",companyId:"c",goalId:"g",idempotencyKey:"start"},"owner");state.db.prepare("UPDATE goal_delivery_stage_instances_v19 SET status='approved',completed_at=? WHERE id=?").run(new Date().toISOString(),started.currentStageInstance.id);state.db.prepare("UPDATE goal_delivery_processes_v19 SET status='completed',current_stage='operate',completed_at=? WHERE id='dp'").run(new Date().toISOString());const result=companies.submitGoalChangeRequest("c","g",{id:`change-${expected}`,message},"owner");assert.equal(result.process.currentStage,expected);state.close();}
});

test("owner can hold, resume, and request a versioned rework without mutating prior evidence", () => {
  const { state, companies } = reviewFixture();
  const { reviewed } = finishTeamMeeting(companies);
  let snapshot = companies.resolveGoalDeliveryOwnerReview("c", "g", "on-hold", "외부 일정 확인", "owner");
  assert.equal(snapshot.process.status, "blocked");
  assert.equal(snapshot.ownerReview?.status, "on-hold");
  snapshot = companies.resumeGoalDeliveryOwnerReview("c", "g", "owner");
  assert.equal(snapshot.currentStageInstance.status, "owner-approval-waiting");
  assert.equal(snapshot.ownerReview?.status, "pending");
  snapshot = companies.resolveGoalDeliveryOwnerReview("c", "g", "revision-requested", "모바일 완료 기준 추가", "owner");
  assert.equal(snapshot.currentStageInstance.attempt, 2);
  assert.equal(snapshot.currentStageInstance.status, "pending");
  assert.equal(snapshot.artifactSnapshots.every(item => item.stale), true);
  const stored = state.db.prepare("SELECT status FROM goal_delivery_owner_reviews_v20 WHERE id=?").get(reviewed.ownerReview!.id) as { status: string };
  assert.equal(stored.status, "revision-requested");
  state.close();
});

test("bounded Agent meeting automatically produces review messages before the owner gate", async () => {
  const { state, companies } = reviewFixture();
  const prepared = companies.prepareGoalDeliveryReviewForRun("r");
  assert.ok(prepared);
  companies.transitionMeeting("c", prepared.meeting.id, "live", "owner");
  const bindings = new AgentBindingStore(state.db, companies, { host: "standalone", model: "meeting-model", baseUrl: null });
  let calls = 0;
  const host = { hostId: "meeting-test", async capabilities(){return{auth:false,models:true,usage:true,events:false,streamingAbort:false};},async authenticate(){return{userId:"test",roles:[]};},async listModels(){return[];},async invokeModel(request:any){calls++;return{requestId:request.requestId,text:JSON.stringify({kind:"opinion",content:"검증 근거를 기준으로 위험을 검토했습니다.",evidenceIds:["r"],uncertainty:null,escalation:false}),tokens:5,cost:.01};},async recordUsage(){},async publishEvent(){}};
  const runner = new MeetingAgentRunner(state.db, companies, bindings, { resolve(){return host;} });
  runner.initialize(prepared.meeting.id, { maxTokens: 3000, maxCost: 1, maxRounds: 3, deadline: new Date(Date.now() + 60_000).toISOString(), maxTokensPerTurn: 500, maxCostPerTurn: .15, maxRetries: 1, leaseMs: 1000, maxOutputBytes: 2000 });
  const protocol = await runner.runProtocol(prepared.meeting.id, "goal-delivery-test");
  assert.equal(protocol.status, "decision-pending");
  assert.equal(protocol.turns.length, 6);
  assert.equal(calls, 6);
  assert.equal(companies.meetingMessages(prepared.meeting.id).length, 6);
  companies.transitionMeeting("c", prepared.meeting.id, "ended", "owner");
  const snapshot = companies.completeGoalDeliveryTeamReview(prepared.meeting.id);
  assert.equal(snapshot.currentStageInstance.status, "owner-approval-waiting");
  assert.equal(snapshot.ownerReview?.status, "pending");
  state.close();
});

test("owner review API blocks generic approval bypass and resolves through the human approval callback", async t => {
  const { state, projects, companies } = reviewFixture();
  const { prepared, reviewed } = finishTeamMeeting(companies);
  let approvalCallbacks = 0;
  const controller = new RunController(state, { async enqueue(){}, async remove(){return false;} });
  const intake = new RunIntakeService(state, controller);
  let stageStartCallbacks = 0;
  const server = new ControlPlaneApi(state, intake, controller, { approvePlan(){}, approveResult(){}, async approveGoalDeliveryStage(companyId, goalId, actorId){approvalCallbacks++;companies.confirmMeetingSummary(companyId, prepared.meeting.id, actorId);state.transition("r", ["RESULT_APPROVAL_WAITING"], "COMPLETED");assert.equal(goalId, "g");},async startGoalDeliveryStage(companyId,goalId,actorId){stageStartCallbacks++;const current=companies.goalDeliveryProcess(companyId,goalId,actorId)!;companies.transitionGoalDeliveryStage(companyId,goalId,{stageInstanceId:current.currentStageInstance.id,to:"in-progress",expectedVersion:current.process.version,idempotencyKey:"api-auto-start"},actorId);} }, projects, companies).server();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.close(); state.close(); });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const queueResponse = await fetch(`${base}/api/companies/c/owner-reviews?actor=owner`);
  assert.equal(queueResponse.status, 200);
  const queue = await queueResponse.json() as Array<{review:{id:string;packet:{version:number;completeness:{ready:boolean}}}}>;
  assert.equal(queue[0]?.review.id, reviewed.ownerReview?.id);
  assert.equal(queue[0]?.review.packet.version, 2);
  assert.equal(queue[0]?.review.packet.completeness.ready, true);
  const bypass = await fetch(`${base}/api/companies/c/goals/g/delivery-process/actions/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: "owner", stageInstanceId: reviewed.currentStageInstance.id, to: "approved", expectedVersion: reviewed.process.version, idempotencyKey: "bypass" }) });
  assert.equal(bypass.status, 400);
  assert.match(String((await bypass.json() as { error: string }).error), /owner review decision endpoint/);
  const response = await fetch(`${base}/api/companies/c/goals/g/delivery-process/owner-review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: "owner", decision: "approved" }) });
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.process.currentStage, "delivery-planning");
  assert.equal(body.currentStageInstance.status, "in-progress");
  assert.equal(approvalCallbacks, 1);
  assert.equal(stageStartCallbacks, 1);
});
