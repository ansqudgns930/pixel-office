import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/cleanup-generated-qa-companies.cjs", "utf8");

test("generated QA cleanup defaults to dry-run and protects stable QA companies", () => {
  assert.match(script, /const archive = args\.has\('--archive'\)/);
  assert.match(script, /protectedStableCompanyIds/);
  assert.match(script, /model-routing-qa-workflow/);
  assert.match(script, /employee-workflow-qa-workflow/);
  assert.match(script, /delegated-work-flow-qa-workflow/);
  assert.match(script, /includeStable \|\| !isProtectedStableCompany/);
  assert.match(script, /Dry run only/);
});

test("generated QA cleanup recognizes known browser QA company families", () => {
  for (const token of [
    "model-routing-qa",
    "employee-workflow-qa",
    "delegated-work-flow-qa",
    "employee-api-probe",
    "ui-ux-review-company",
  ]) {
    assert.match(script, new RegExp(token));
  }
});
