import test from "node:test";
import assert from "node:assert/strict";
import { customEmployeeDraftExamples, employeeProfileForStaff, employeeProfileFromPreset, professionalEmployeePresets } from "../apps/web/src/employeeProfiles.js";
import { deriveWorkStaffingPlan } from "../packages/staffing-rules/src/index.js";

const baseInput = {
  companyId: "company-1",
  kind: "agent" as const,
  role: "member",
  departmentId: null,
  specialty: null,
  characterStyle: "worker",
};

test("security-sensitive staff resolves to Security Engineer core profile", () => {
  const profile = employeeProfileForStaff({ ...baseInput, principalId: "security-engineer", specialty: "security" });
  assert.equal(profile.name, "Security Engineer");
  assert.equal(profile.roleTitle, "보안과 권한 검토 담당자");
  assert.match(profile.summary, /prompt injection/);
  assert.match(profile.generatedFrom ?? "", /professional-v2/);
  assert.deepEqual(profile.internalRoleMapping, ["reviewer"]);
  assert.ok(profile.forbiddenActions.some((item) => /비밀값/.test(item)));
});

test("project manager profile includes preconditions and replanning discipline", () => {
  const profile = employeeProfileForStaff({ ...baseInput, principalId: "project-manager", role: "department-manager", characterStyle: "planner" });
  const text = [profile.summary, ...profile.responsibilities, ...profile.workStyle, ...profile.promptProfile.taskInstructions].join("\n");
  assert.match(text, /선행 조건/);
  assert.match(text, /목표 상태/);
  assert.match(text, /재계획/);
});

test("QA profile includes production readiness and mock fake stub checks", () => {
  const profile = employeeProfileForStaff({ ...baseInput, principalId: "qa-engineer", specialty: "qa", characterStyle: "reviewer" });
  const text = [profile.summary, ...profile.responsibilities, ...profile.workStyle, ...profile.successCriteria, ...profile.promptProfile.taskInstructions].join("\n");
  assert.match(text, /production readiness/);
  assert.match(text, /mock\/fake\/stub\/TODO/);
  assert.match(text, /증거가 없으면 완료로 판단하지 않습니다/);
});

test("security work staffing includes Security and explicit prompt injection risk step", () => {
  const plan = deriveWorkStaffingPlan("OAuth 인증 토큰과 prompt injection 위험을 점검하고 권한 정책을 개선해줘");
  assert.ok(plan.staff.includes("Security"));
  assert.equal(plan.risk, "high");
  assert.ok(plan.steps.some((step) => /보안 엔지니어/.test(step) && /prompt injection/.test(step)));
});


test("professional preset catalog is separate from direct custom employee drafting", () => {
  const presetKeys = professionalEmployeePresets.map((preset) => preset.key);
  assert.ok(presetKeys.includes("program-manager"));
  assert.ok(presetKeys.includes("sre"));
  assert.ok(presetKeys.includes("finops-manager"));
  assert.ok(presetKeys.includes("technical-writer"));
  assert.ok(presetKeys.includes("release-manager"));
  assert.ok(presetKeys.includes("legal-policy-manager"));
  assert.equal(new Set(presetKeys).size, professionalEmployeePresets.length);
  assert.ok(customEmployeeDraftExamples.some((example) => /만들어줘/.test(example)));
  assert.ok(!customEmployeeDraftExamples.some((example) => /Program Manager|SRE|FinOps Manager/.test(example)));
});

test("preset profile activation creates a governed employee profile", () => {
  const preset = professionalEmployeePresets.find((item) => item.key === "release-manager");
  assert.ok(preset);
  const profile = employeeProfileFromPreset("company-1", preset.key, preset);
  assert.equal(profile.principalId, "release-manager");
  assert.equal(profile.name, "Release Manager");
  assert.equal(profile.generatedFrom, "professional-preset-catalog");
  assert.equal(profile.status, "active");
  assert.ok(profile.promptProfile.taskInstructions.some((item) => /전문가 판단/.test(item)));
  assert.ok(profile.approvalRequiredActions.some((item) => /외부|결제|개인정보|계정/.test(item)));
});
