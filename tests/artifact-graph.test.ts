import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { SQLiteStateStore, type ArtifactKind } from "../packages/persistence/src/index.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
test("artifact versions and requirement-to-validation lineage survive restart with stale propagation", t => {
  const dir = mkdtempSync(join(tmpdir(), "artifact-graph-")); t.after(() => rmSync(dir, { recursive: true, force: true })); const db = join(dir, "state.sqlite"); let store = new SQLiteStateStore(db); store.createRun({ id: "run", requestId: "req", goal: "trace", risk: "medium", status: "RUNNING", budgetLimit: 2, spent: 0, checkpoint: null });
  const make = (logicalId: string, kind: ArtifactKind, path: string | null) => store.createArtifactVersion({ logicalId, parentVersionId: null, runId: "run", kind, path, baseCommit: "base-a", contentHash: hash(logicalId) });
  const requirement = make("requirement:R1", "requirement", null), task = make("task:T1", "task", null), code = make("code:src/a.ts", "code", "src/a.ts"), testArtifact = make("test:test/a.test.ts", "test", "test/a.test.ts"), validation = make("validation:run", "validation", null);
  store.addArtifactRelation(requirement.id, task.id, "satisfied-by", { source: "plan" }); store.addArtifactRelation(task.id, code.id, "implemented-by"); store.addArtifactRelation(code.id, testArtifact.id, "verified-by"); store.addArtifactRelation(testArtifact.id, validation.id, "validated-by");
  assert.throws(() => store.addArtifactRelation(validation.id, requirement.id, "cycle"), /cycle/); assert.throws(() => store.addArtifactRelation("missing", code.id, "orphan"), /endpoint missing/); assert.throws(() => store.createArtifactVersion({ logicalId: "code:src/a.ts", parentVersionId: requirement.id, runId: "run", kind: "code", path: "src/a.ts", baseCommit: "base-b", contentHash: hash("changed") }), /latest version/);
  const code2 = store.createArtifactVersion({ logicalId: code.logicalId, parentVersionId: code.id, runId: "run", kind: "code", path: code.path, baseCommit: "base-b", contentHash: hash("changed") }); assert.equal(code2.version, 2); assert.equal(store.artifactVersion(code.id)?.stale, true); assert.equal(store.artifactVersion(testArtifact.id)?.stale, true); assert.equal(store.artifactVersion(validation.id)?.stale, true); store.close();
  store = new SQLiteStateStore(db); assert.deepEqual(store.artifactVersions(code.logicalId).map(x => x.version), [1, 2]); assert.equal(store.artifactRelations().length, 4); assert.match(store.artifactVersion(validation.id)?.staleReason ?? "", /superseded-by/); store.close();
});
