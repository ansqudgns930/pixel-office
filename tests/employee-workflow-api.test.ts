import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { RunController } from "../packages/runtime/src/index.js";
import { RunIntakeService } from "../packages/policy/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations, type EmployeeProfileRecord } from "../packages/company-ops/src/index.js";
import { ControlPlaneApi } from "../apps/control-plane/src/index.js";

class Queue {
  jobs: Array<{ runId: string; requestId: string }> = [];
  async enqueue(job: { runId: string; requestId: string }) { this.jobs.push(job); }
  async remove() { return false; }
}

function snsMarketerProfile(companyId = "c", principalId = "sns-marketer"): EmployeeProfileRecord {
  const timestamp = new Date().toISOString();
  return {
    id: "profile-sns-marketer",
    companyId,
    principalId,
    name: "SNS Marketer",
    department: "Marketing",
    roleTitle: "Instagram Marketing Specialist",
    summary: "Plans Instagram promotion strategy and content calendars.",
    specialties: ["instagram", "sns", "marketing", "content"],
    responsibilities: ["promotion planning", "content calendar", "approval split"],
    workStyle: ["draft first", "approval before external posting"],
    deliverableFormat: ["campaign brief", "content calendar", "approval checklist"],
    successCriteria: ["approval-required external actions are separated"],
    allowedActions: ["draft content", "suggest schedule"],
    approvalRequiredActions: ["actual posting", "ad spend"],
    forbiddenActions: ["request account tokens", "unsolicited DM sending"],
    toolHints: ["browser"],
    internalRoleMapping: ["worker"],
    promptProfile: {
      systemAddendum: "Work as a safe SNS marketing specialist focused on drafts.",
      taskInstructions: ["Separate draft work from approval-required external actions."],
      reportTemplate: "summary / approval needed / risks / next actions",
      safetyConstraints: ["Require approval before external posting or ad spend."],
    },
    status: "active",
    version: 1,
    generatedFrom: "api-test",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("employee draft, activation, staffing recommendation and goal launch provenance are connected", async t => {
  const state = new SQLiteStateStore(":memory:"), queue = new Queue(), controller = new RunController(state, queue as never), intake = new RunIntakeService(state, controller), projects = new ProjectOperations(state.db, state), companies = new CompanyOperations(state.db, state, projects);
  projects.createWorkspace("w", "Workspace");
  companies.createCompany({ id: "c", name: "Company", workspaceId: "w", budgetLimit: 100, mandatoryReviews: ["review"], mandatoryApprovals: ["result"], allowedTools: ["build", "test", "browser"] }, "owner");
  const server = new ControlPlaneApi(state, intake, controller, { approvePlan() {}, approveResult() {}, async draftEmployeeProfile() { return { status: "fallback", profile: snsMarketerProfile(), warnings: [] }; } }, projects, companies).server();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.close(); state.close(); });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (pathname: string, body: unknown) => fetch(`${base}${pathname}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const draftedResponse = await post("/api/companies/c/employees/draft", { actorId: "owner", rough: "Need an Instagram marketing specialist" });
  assert.equal(draftedResponse.status, 200);
  const drafted = await draftedResponse.json() as { profile: EmployeeProfileRecord };
  assert.equal(drafted.profile.roleTitle, "Instagram Marketing Specialist");

  const activatedResponse = await post("/api/companies/c/employees/activate", { actorId: "owner", principalId: "sns-marketer", profile: drafted.profile });
  assert.equal(activatedResponse.status, 201);
  const activated = await activatedResponse.json() as EmployeeProfileRecord;
  assert.equal(activated.status, "active");
  assert.equal(activated.principalId, "sns-marketer");

  const profiles = await (await fetch(`${base}/api/companies/c/employees/profiles?actor=owner`)).json() as EmployeeProfileRecord[];
  assert.deepEqual(profiles.map(profile => profile.principalId), ["sns-marketer"]);

  const staffingResponse = await post("/api/companies/c/staffing/plan", { actorId: "owner", rough: "Make an Instagram promotion plan for this week" });
  assert.equal(staffingResponse.status, 200);
  const staffing = await staffingResponse.json() as { recommendedEmployees: Array<{ employeeId: string; reason: string; riskNotes: string[] }>; modelRouting: { overallRisk: string; signals: string[]; recommendations: Array<{ role: string; priority: string; recommendedTier: string; reason: string }>; summary: string } };
  assert.equal(staffing.recommendedEmployees[0]?.employeeId, "sns-marketer");
  assert.ok(staffing.recommendedEmployees[0]?.riskNotes.some(note => note.includes("actual posting")));

  const launchResponse = await post("/api/companies/c/goals/launch", { actorId: "owner", id: "g", title: "Instagram promotion plan", description: "Weekly promotion plan", ownerId: "owner", completionCriteria: ["Promotion calendar is drafted."], budgetLimit: 10, requestedPaths: ["src"], requestedRisk: "medium", employeeProfileSnapshots: staffing.recommendedEmployees.map(employee => ({ principalId: employee.employeeId, reason: employee.reason })), modelRoutingRecommendation: { ...staffing.modelRouting, settingsStatus: staffing.modelRouting.recommendations.map(item => ({ role: item.role, recommendedTier: item.recommendedTier, expectedBackend: item.role === "worker" ? "codex-cli" : "openai-compatible", expectedModel: item.role === "worker" ? "gpt-5" : "nvidia/nemotron-3-ultra-550b-a55b", savedBackend: null, savedModel: null, status: "missing", detail: "No saved role binding at launch preview; company default or runtime fallback may be used." })) } });
  assert.equal(launchResponse.status, 201);
  const launched = await launchResponse.json() as any;
  assert.equal(launched.provisioning.employeeProfileSnapshots[0].principalId, "sns-marketer");
  assert.equal(launched.provisioning.employeeProfileSnapshots[0].profileVersion, 1);
  assert.equal(launched.snapshot.employeeProfileSnapshots[0].profile.roleTitle, "Instagram Marketing Specialist");
  assert.equal(launched.provisioning.modelRoutingRecommendation.recommendation.recommendations.length, 3);
  assert.equal(launched.provisioning.modelRoutingRecommendation.source, "company-plan-preview");
  assert.equal(launched.snapshot.modelRoutingRecommendation.recommendationHash, launched.provisioning.modelRoutingRecommendation.recommendationHash);
  assert.equal(launched.snapshot.modelRoutingRecommendation.recommendation.settingsStatus.length, 3);
  assert.equal(launched.snapshot.modelRoutingRecommendation.recommendation.settingsStatus[0].status, "missing");
  assert.match(launched.snapshot.provenance.join(" "), /employee-profile:sns-marketer:/);
  assert.match(launched.snapshot.provenance.join(" "), /model-routing:/);

  const runDetailResponse = await fetch(`${base}/api/runs/${launched.provisioning.runId}?actor=owner`);
  assert.equal(runDetailResponse.status, 200);
  const runDetail = await runDetailResponse.json() as any;
  assert.equal(runDetail.modelRoutingRecommendation.recommendationHash, launched.provisioning.modelRoutingRecommendation.recommendationHash);
  assert.equal(runDetail.modelRoutingRecommendation.source, "company-plan-preview");
  assert.equal(runDetail.modelRoutingRecommendation.recommendation.recommendations.length, 3);
  assert.deepEqual(queue.jobs, [{ runId: launched.provisioning.runId, requestId: "goal-launch:g" }]);
});
