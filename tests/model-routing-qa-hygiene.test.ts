import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/verify-model-routing-workflow.cjs", "utf8");

test("model routing browser QA reuses a stable generated company by default", () => {
  assert.match(script, /AGENT_COMPANY_MODEL_ROUTING_QA_COMPANY \|\| 'model-routing-qa-workflow'/);
  assert.doesNotMatch(script, /model-routing-qa-\$\{Date\.now\(\)\}/);
});
