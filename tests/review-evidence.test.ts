import test from "node:test";
import assert from "node:assert/strict";
import {
  collectBackendReadiness,
  collectBuildReviewEvidence,
  type FrontendCaptureAdapter,
  type FrontendCaptureRequest,
  type FrontendEvidenceManifest,
  type FrontendState,
} from "../packages/review-evidence/src/index.js";

const files = [
  { path: "src/api.ts", content: "router.post('/api/items'); parse(input); logger.info('ok')" },
  { path: "tests/api.test.ts", content: "test('unit', () => assert(valid))" },
  { path: "tests/api.integration.test.ts", content: "test('integration', () => request('/api/items'))" },
  { path: "src/security.ts", content: "authorization; rate limit; audit(event)" },
  { path: "package.json", content: "{\"scripts\":{\"build\":\"tsc\"}}" },
];
const validations = [
  { kind: "build", passed: true },
  { kind: "typecheck", passed: true },
  { kind: "test", passed: true },
  { kind: "security", passed: true },
];

function captured(request: FrontendCaptureRequest, observed = request.expectedVersion): FrontendEvidenceManifest {
  const states: FrontendState[] = ["primary", "loading", "empty", "error", "permission"],
    captures: FrontendEvidenceManifest["captures"] = states.map((state) => ({
      state,
      viewport: "desktop" as const,
      url: new URL(request.routes[state], request.previewUrl).toString(),
      status: "captured" as const,
      mimeType: "image/png" as const,
      sha256: `sha-${state}`,
      dataUrl: "data:image/png;base64,AA==",
      width: 1440,
      height: 1000,
      capturedAt: "2026-07-19T00:00:00.000Z",
      failure: null,
    }));
  captures.push({ ...captures[0]!, viewport: "mobile", width: 390, height: 844 });
  return { applicability: "web", status: "captured", previewUrl: request.previewUrl, expectedVersion: request.expectedVersion, observedVersion: observed, scenario: request.scenario, manual: request.manual, captures, missingStates: [], failure: null, exemptionReason: null };
}

test("backend readiness is deterministic and fails closed on required missing evidence", () => {
  const ready = collectBackendReadiness({ runId: "r", patchHash: "p", files, validations, artifactIds: ["validation:test"] });
  assert.equal(ready.ready, true);
  assert.equal(ready.items.find((item) => item.key === "api")?.status, "passed");
  const failed = collectBackendReadiness({ runId: "r", patchHash: "p", files: [{ path: "src/api.ts", content: "router.post('/api')" }], validations: [], artifactIds: [] });
  assert.equal(failed.ready, false);
  assert.ok(failed.failedKeys.includes("unit-tests"));
  assert.equal(collectBackendReadiness({ runId: "r", patchHash: "p", files: [{ path: "README.md" }], validations: [], artifactIds: [] }).items.find((item) => item.key === "api")?.status, "not-applicable");
});

test("non-web evidence requires an explicit exemption", async () => {
  const base = { runId: "r", patchHash: "p", files, validations, artifactIds: ["validation:test"] };
  const denied = await collectBuildReviewEvidence(base, null);
  assert.equal(denied.frontend.status, "failed");
  assert.ok(denied.missing.includes("frontend:capture"));
  const exempted = await collectBuildReviewEvidence({ ...base, frontendExemption: "CLI 전용 변경이며 UI 경로가 없습니다." }, null);
  assert.equal(exempted.frontend.status, "exempted");
  assert.equal(exempted.ready, true);
});

test("web evidence requires every state, mobile primary, and the exact patch version", async () => {
  const webFiles = [...files, { path: "src/App.tsx", content: "export function App(){ return <main/> }" }, { path: "tests/browser.e2e.ts", content: "playwright test" }],
    request: FrontendCaptureRequest = { previewUrl: "http://127.0.0.1:5173", expectedVersion: "ignored", scenario: "핵심 흐름", routes: { primary: "/", loading: "/loading", empty: "/empty", error: "/error", permission: "/permission" }, manual: ["확인"] },
    adapter: FrontendCaptureAdapter = { async capture(value) { return captured(value); } };
  const ready = await collectBuildReviewEvidence({ runId: "r", patchHash: "patch-v1", files: webFiles, validations, artifactIds: ["validation:test"] }, request, adapter);
  assert.equal(ready.ready, true);
  assert.equal(ready.frontend.expectedVersion, "patch-v1");
  const mismatch = await collectBuildReviewEvidence({ runId: "r", patchHash: "patch-v1", files: webFiles, validations, artifactIds: [] }, request, { async capture(value) { return captured(value, "old-build"); } });
  assert.equal(mismatch.ready, false);
  assert.ok(mismatch.missing.includes("frontend:preview-version-mismatch"));
  const incomplete = await collectBuildReviewEvidence({ runId: "r", patchHash: "patch-v1", files: webFiles, validations, artifactIds: [] }, request, { async capture(value) { const result = captured(value); result.captures = result.captures.filter((item) => item.state !== "error" && item.viewport !== "mobile"); return result; } });
  assert.ok(incomplete.missing.includes("frontend:error"));
  assert.ok(incomplete.missing.includes("frontend:primary-mobile"));
});

test("capture adapter errors become durable failed evidence instead of disappearing", async () => {
  const manifest = await collectBuildReviewEvidence({ runId: "r", patchHash: "p", files: [{ path: "src/App.tsx", content: "react" }], validations, artifactIds: [] }, { previewUrl: "http://127.0.0.1", expectedVersion: "p", scenario: "scenario", routes: { primary: "/", loading: "/loading", empty: "/empty", error: "/error", permission: "/permission" }, manual: [] }, { async capture() { throw new Error("browser unavailable"); } });
  assert.equal(manifest.frontend.status, "failed");
  assert.match(manifest.frontend.failure ?? "", /browser unavailable/);
  assert.equal(manifest.ready, false);
});
