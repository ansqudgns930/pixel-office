import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/report-generated-qa-blockers.cjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("blocked generated QA report groups known QA company families", () => {
  for (const token of [
    "model-routing-qa-",
    "employee-workflow-qa-",
    "delegated-work-flow-qa-",
    "employee-api-probe-",
    "ui-ux-review",
  ]) {
    assert.match(script, new RegExp(token));
  }
});

test("blocked generated QA report classifies lifecycle blockers", () => {
  for (const token of ["active-runs", "pending-approvals", "draft-meeting-summaries", "active-meetings"]) {
    assert.match(script, new RegExp(token));
  }
});

test("blocked generated QA report stays non-destructive", () => {
  assert.match(script, /Do not force-archive blocked generated QA companies automatically/);
  assert.doesNotMatch(script, /--archive/);
  assert.equal(pkg.scripts["qa-companies:blockers-report"], "node scripts/report-generated-qa-blockers.cjs");
});
