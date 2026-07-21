const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

async function main() {
  const root = path.resolve(__dirname, "../..");
  const server = spawn(process.execPath, [path.join(root, "apps/web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", "4174"], { cwd: path.join(root, "apps/web"), stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch("http://127.0.0.1:4174")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
    if (i === 39) throw new Error("Vite preview did not start");
  }
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true }), errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem("agent-company-os.apiToken", "qa-token");
      localStorage.setItem("agent-company-os.actorId", "owner");
      localStorage.setItem("agent-company-os.username", "qa");
      localStorage.setItem("agent-company-os.role", "owner");
      localStorage.setItem("agent-company-os.lastCompany", "qa-company");
    });
    const page = await context.newPage(), createdAt = new Date().toISOString();
    const reports = [{ id: "report-1", reportType: "decision", status: "unread", currentState: "PATCH_HASH_BLOCKED", completed: [], blocked: ["hash mismatch"], decisionRequired: true, evidenceIds: ["event-1", "run-1"], nextAction: "Review evidence and record a decision", recipientId: "owner", createdAt }];
    const delegations = [{ id: "handoff-1", sourceDepartmentId: "engineering", targetDepartmentId: "qa", ownerId: "owner", assigneeId: "owner", completionCriteria: ["accepted"], allowedScope: ["docs/**"], evidence: [{ id: "event-1", provenance: "event:event-1", trust: "untrusted-evidence" }], deadline: new Date(Date.now() + 3600000).toISOString(), status: "approved", reviewReason: "accepted", completionEvidenceIds: [], failureReason: null, createdAt }];
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
    page.on("pageerror", error => errors.push(`page: ${error.message}`));
    page.on("response", response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
    await page.route("**/favicon.ico", route => route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method();
      if (url.pathname === "/api/health") return route.fulfill({ json: { status: "ready", sqlite: "ready" } });
      if (url.pathname === "/api/companies") return route.fulfill({ json: [{ id: "qa-company", name: "QA Company", status: "active", role: "owner" }] });
      if (url.pathname.endsWith("/alerts")) return route.fulfill({ json: [] });
      if (url.pathname.endsWith("/reports") && method === "GET") return route.fulfill({ json: reports });
      if (url.pathname.endsWith("/delegations") && method === "GET") return route.fulfill({ json: delegations });
      if (url.pathname.endsWith("/deletion-request")) return route.fulfill({ json: { request: null, impact: { projects: 1, members: 3, goals: 0, meetings: 0, runs: 1, auditEvents: 2, blockers: [] } } });
      if (url.pathname.includes("/reports/report-1/acknowledge")) { reports[0].status = "acknowledged"; return route.fulfill({ json: reports[0] }); }
      if (url.pathname.includes("/delegations/handoff-1/actions/start")) { delegations[0].status = "in-progress"; return route.fulfill({ json: delegations[0] }); }
      if (url.pathname === "/api/events") return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" });
      return route.fulfill({ status: 404, json: { error: "mock route missing" } });
    });
    await page.goto("http://127.0.0.1:4174/activity?companyId=qa-company&tab=reports", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "통합 검색·알림" }).waitFor();
    await page.locator(".activity-tabs button", { hasText: /^보고/ }).click();
    await page.getByRole("feed", { name: "결정론적 보고함" }).waitFor();
    assert.equal(await page.locator(".activity-feed h2", { hasText: "PATCH_HASH_BLOCKED" }).count(), 1);
    assert.equal(await page.getByText(/engineering → qa/).count(), 1);
    await page.getByRole("button", { name: "확인 완료" }).click();
    await page.getByText(/decision · acknowledged/).waitFor();
    await page.getByRole("button", { name: "업무 시작" }).click();
    await page.getByText(/engineering → qa · in-progress/).waitFor();
    const desktop = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, labels: document.querySelectorAll("[aria-label]").length, reports: document.querySelectorAll('[aria-label="결정론적 보고함"] article').length, handoffs: document.querySelectorAll('[aria-label="부서 간 위임과 인계"] article').length }));
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert.equal(desktop.reports, 1); assert.equal(desktop.handoffs, 1); assert.ok(desktop.labels >= 5); assert.ok(desktop.scrollWidth <= desktop.clientWidth); assert.ok(mobile.scrollWidth <= mobile.clientWidth); assert.deepEqual(errors, []);
    console.log(JSON.stringify({ reports: desktop.reports, handoffs: desktop.handoffs, reportStatus: reports[0].status, handoffStatus: delegations[0].status, ariaLabels: desktop.labels, mobileOverflow: mobile.scrollWidth - mobile.clientWidth, errors }));
  } finally { await browser.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exit(1); });
