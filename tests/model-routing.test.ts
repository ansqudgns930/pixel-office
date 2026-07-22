import test from "node:test";
import assert from "node:assert/strict";
import { recommendModelRouting } from "../packages/model-routing/src/index.js";

test("strategy and planning work recommends a high reasoning planner", () => {
  const plan = recommendModelRouting({ rough: "신제품 전략과 우선순위를 판단해서 실행 계획을 만들어줘", risk: "medium" });
  const planner = plan.recommendations.find(item => item.role === "planner");
  assert.equal(planner?.recommendedTier, "high-reasoning");
  assert.equal(planner?.priority, "critical");
  assert.ok(plan.signals.includes("strategy"));
});

test("security and external action work recommends high verification reviewer", () => {
  const plan = recommendModelRouting({ rough: "계정 토큰 권한을 점검하고 외부 게시 승인 위험을 검토해줘", risk: "high" });
  const reviewer = plan.recommendations.find(item => item.role === "reviewer");
  assert.equal(reviewer?.recommendedTier, "high-verification");
  assert.equal(reviewer?.priority, "critical");
  assert.ok(plan.signals.includes("security"));
  assert.ok(plan.signals.includes("external-action"));
});

test("coding work recommends a coding worker", () => {
  const plan = recommendModelRouting({ rough: "React 프론트엔드 버그를 수정하고 테스트를 추가해줘", risk: "medium" });
  const worker = plan.recommendations.find(item => item.role === "worker");
  assert.equal(worker?.recommendedTier, "coding");
  assert.equal(worker?.priority, "high");
});

test("simple copy draft can use a cheaper draft worker", () => {
  const plan = recommendModelRouting({ rough: "버튼 문구 후보 5개만 만들어줘", risk: "low" });
  const worker = plan.recommendations.find(item => item.role === "worker");
  assert.equal(worker?.recommendedTier, "cheap-draft");
  assert.equal(worker?.priority, "low");
});
