import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { DockerSandbox } from "../packages/docker-sandbox/src/index.js";

test("Docker Sandbox forces no network, read-only root and reduced privileges", async () => {
  const store = new SQLiteStateStore(":memory:"); store.createRun({ id: "run", requestId: "req", goal: "validate", risk: "high", status: "VALIDATING", budgetLimit: 1, spent: 0, checkpoint: null });
  let received: string[] = []; const sandbox = new DockerSandbox("docker", store, async (_file, args) => { received = args; return { stdout: "ok", stderr: "" }; });
  await sandbox.run({ runId: "run", workspace: process.cwd(), image: "node:24-alpine", command: ["npm", "test"] });
  assert.ok(received.includes("none")); assert.ok(received.includes("--read-only")); assert.ok(received.includes("ALL")); assert.ok(received.includes("no-new-privileges")); assert.ok(received.some(x => x.startsWith("type=bind,"))); assert.equal(received.at(-2), "npm"); assert.equal(received.at(-1), "test"); store.close();
});
