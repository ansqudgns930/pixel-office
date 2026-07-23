import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/plan-generated-qa-closeout.cjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("generated QA closeout plan is plan-only and non-destructive", () => {
  assert.match(script, /mode: 'plan-only'/);
  assert.match(script, /destructiveActionsExecuted: false/);
  assert.match(script, /Default dry-run/);
  assert.doesNotMatch(script, /args\.has\(\'--execute\'\)/);
  assert.doesNotMatch(script, /process\.argv\.slice/);
});

test("generated QA closeout plan preserves stable QA company guardrails", () => {
  assert.match(script, /protectedStableCompanyIds/);
  assert.match(script, /Never include protected stable QA companies/);
  assert.match(script, /generated QA detection/);
});

test("generated QA closeout plan names required lifecycle capabilities", () => {
  for (const token of [
    "Run cancellation",
    "Approval terminal-resolution",
    "Meeting summary confirm",
    "qa-companies:archive",
  ]) {
    assert.match(script, new RegExp(token));
  }
});

test("package exposes generated QA closeout planning script", () => {
  assert.equal(pkg.scripts["qa-companies:closeout-plan"], "node scripts/plan-generated-qa-closeout.cjs");
});
