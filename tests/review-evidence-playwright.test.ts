import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { PlaywrightFrontendCaptureAdapter } from "../packages/review-evidence/src/playwright.js";

test("Playwright adapter captures actual desktop states and mobile primary with exact version proof", async (t) => {
  const executable = process.env.BROWSER_AUTOMATION_EXECUTABLE;
  if (!executable) return t.skip("BROWSER_AUTOMATION_EXECUTABLE is not configured");
  const version = "actual-preview-v1",
    server = createServer((request, response) => {
      const state = new URL(request.url ?? "/", "http://localhost").searchParams.get("state") ?? "primary";
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><meta name="agent-company-build-version" content="${version}"><style>body{font-family:system-ui;margin:0;background:#f3f6fb}.card{margin:40px;padding:32px;border-radius:16px;background:white}</style></head><body><main class="card"><h1>${state}</h1><button>다음 단계</button></main></body></html>`);
    });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`,
    manifest = await new PlaywrightFrontendCaptureAdapter(executable, 10_000).capture({
      previewUrl: base,
      expectedVersion: version,
      scenario: "실제 브라우저 화면 증거",
      routes: { primary: "/?state=primary", loading: "/?state=loading", empty: "/?state=empty", error: "/?state=error", permission: "/?state=permission" },
      manual: ["상태를 확인합니다."],
    });
  assert.equal(manifest.status, "captured");
  assert.equal(manifest.observedVersion, version);
  assert.equal(manifest.captures.length, 6);
  assert.equal(manifest.captures.filter((capture) => capture.viewport === "mobile").length, 1);
  assert.ok(manifest.captures.every((capture) => capture.dataUrl?.startsWith("data:image/png;base64,")));
  assert.ok(manifest.captures.every((capture) => /^[a-f0-9]{64}$/.test(capture.sha256 ?? "")));
});
