import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const modelRoutingScript = readFileSync("scripts/verify-model-routing-workflow.cjs", "utf8");
const employeeScript = readFileSync("scripts/verify-employee-workflow.cjs", "utf8");
const delegatedScript = readFileSync("scripts/verify-delegated-work-flow.cjs", "utf8");

test("browser QA scripts reuse stable generated companies by default", () => {
  assert.match(modelRoutingScript, /AGENT_COMPANY_MODEL_ROUTING_QA_COMPANY \|\| 'model-routing-qa-workflow'/);
  assert.match(employeeScript, /AGENT_COMPANY_EMPLOYEE_QA_COMPANY \|\| 'employee-workflow-qa-workflow'/);
  assert.match(delegatedScript, /AGENT_COMPANY_FLOW_QA_COMPANY \|\| 'delegated-work-flow-qa-workflow'/);
});

test("browser QA scripts do not create timestamped generated companies by default", () => {
  assert.doesNotMatch(modelRoutingScript, /model-routing-qa-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(employeeScript, /employee-workflow-qa-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(delegatedScript, /delegated-work-flow-qa-\$\{Date\.now\(\)\}/);
});

test("delegated browser QA can authenticate without a pre-seeded QA_TOKEN", () => {
  assert.match(delegatedScript, /async function ensureAuthToken/);
  assert.match(delegatedScript, /AGENT_COMPANY_QA_USERNAME/);
  assert.match(delegatedScript, /authToken/);
});
