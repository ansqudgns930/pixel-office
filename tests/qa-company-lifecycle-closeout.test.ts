import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/closeout-generated-qa-lifecycle.cjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("generated QA lifecycle closeout defaults to dry-run and requires explicit execute confirmation", () => {
  assert.match(script, /Default is dry-run only/);
  assert.match(script, /execute requires --confirm=generated-qa-lifecycle-closeout/);
  assert.match(script, /execute requires at least one --family or --company-id allowlist/);
  assert.match(script, /--archive-after only when archive is explicitly approved/);
});

test("generated QA lifecycle closeout uses normal APIs instead of direct database writes", () => {
  assert.doesNotMatch(script, /better-sqlite3|UPDATE runs|DELETE FROM|INSERT INTO/);
  assert.match(script, /\/api\/runs\/.*\/actions\/cancel/);
  assert.match(script, /\/summary\/confirm/);
  assert.match(script, /\/actions\/archive/);
});

test("generated QA lifecycle closeout protects stable QA companies and unexpected blockers", () => {
  assert.match(script, /protectedStableCompanyIds/);
  assert.match(script, /stable QA company requires --include-stable and explicit --company-id/);
  assert.match(script, /unexpected blocker/);
});

test("package exposes generated QA lifecycle closeout script", () => {
  assert.equal(pkg.scripts["qa-companies:closeout-lifecycle"], "node scripts/closeout-generated-qa-lifecycle.cjs");
});
