const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const root = path.resolve(__dirname, "../.."), port = 4182, base = `http://127.0.0.1:${port}`,
    output = path.join(root, "outputs", "build-review-evidence");
  fs.mkdirSync(output, { recursive: true });
  const server = spawn(process.execPath, [path.join(root, "apps/web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port)], { cwd: path.join(root, "apps/web"), stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); if (i === 39) throw new Error("Vite preview did not start"); }
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true }), errors = [];
  try {
    const capturePage = await browser.newPage({ viewport: { width: 960, height: 600 } });
    async function screen(state, mobile = false) {
      await capturePage.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 960, height: 600 });
      await capturePage.setContent(`<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;background:#f3f6fb;color:#172033}.top{height:62px;padding:18px 28px;background:#132238;color:white;font-weight:800}.wrap{display:grid;grid-template-columns:${mobile ? "1fr" : "220px 1fr"};gap:18px;padding:24px}.side{padding:18px;border-radius:12px;background:#fff}.main{padding:22px;border-radius:12px;background:#fff}.hero{padding:20px;border-radius:10px;background:#eaf3ff}.cards{display:grid;grid-template-columns:repeat(${mobile ? 1 : 3},1fr);gap:10px;margin-top:16px}.card{height:110px;padding:14px;border:1px solid #d8e0ea;border-radius:9px}.badge{display:inline-block;padding:5px 8px;border-radius:20px;background:${state === "error" ? "#fee9e7" : state === "permission" ? "#fff1d6" : "#e7f8ed"};color:#27364a;font-size:12px}</style><div class="top">Customer Operations</div><div class="wrap">${mobile ? "" : "<aside class='side'>대시보드<br><br>고객<br><br>자동화</aside>"}<main class="main"><span class="badge">${state}</span><div class="hero"><h1>${state === "primary" ? "고객 온보딩 현황" : state === "loading" ? "데이터를 불러오는 중" : state === "empty" ? "첫 고객을 등록하세요" : state === "error" ? "연결을 확인해 주세요" : "접근 권한이 필요합니다"}</h1><p>핵심 상태와 다음 행동을 명확하게 안내합니다.</p></div><div class="cards"><div class="card">진행 중<br><strong>24</strong></div><div class="card">완료율<br><strong>87%</strong></div><div class="card">주의 필요<br><strong>2</strong></div></div></main></div>`);
      return `data:image/png;base64,${(await capturePage.screenshot({ type: "png", fullPage: true })).toString("base64")}`;
    }
    const states = ["primary", "loading", "empty", "error", "permission"], images = {};
    for (const state of states) images[state] = await screen(state);
    images.mobile = await screen("primary", true);
    await capturePage.close();
    const backendItems = [
      ["api", "API"], ["database", "데이터베이스"], ["authentication", "인증·권한"], ["input-validation", "입력 검증"], ["unit-tests", "단위 테스트"], ["integration-tests", "통합 테스트"], ["e2e-tests", "E2E 테스트"], ["security", "보안"], ["observability", "관측성"], ["environment", "환경 구성"],
    ].map(([key, label]) => ({ key, label, applicability: "required", status: "passed", summary: `${label} 구현과 자동 검증을 확인했습니다.`, evidenceIds: [`validation:${key}`] }));
    const captures = [...states.map(state => ({ state, viewport: "desktop", url: `${base}/?reviewState=${state}`, status: "captured", dataUrl: images[state], width: 960, height: 600, capturedAt: "2026-07-19T00:00:00.000Z", failure: null })), { state: "primary", viewport: "mobile", url: `${base}/`, status: "captured", dataUrl: images.mobile, width: 390, height: 844, capturedAt: "2026-07-19T00:00:00.000Z", failure: null }];
    const packet = (ready, id) => ({ version: 2, stage: "build", stageLabel: "개발", goal: { id, title: ready ? "고객 온보딩 자동화 개발" : "결제 화면 보완", description: "승인된 계획에 따라 백엔드와 프론트 화면을 구현했습니다.", completionCriteria: ["핵심 API 검증 통과", "모바일 화면 확인", "오류 상태 복구 가능"] }, summary: "개발 단계의 직원 검토 회의가 완료되었습니다. 핵심 구현과 검증 증거를 확인해 주세요.", sections: [{ id: "scope", title: "개발 결과 핵심", items: ["고객 등록 API와 권한 검증", "데스크톱·모바일 온보딩 화면", "로딩·빈 상태·오류·권한 제한 화면"] }, { id: "decisions", title: "팀 합의와 이견", items: ["자동 검증과 시각 검토를 모두 통과했습니다."] }], deterministicFacts: [{ label: "단계", value: "개발", source: "stage:build" }, { label: "검증 근거", value: "12개", source: "artifact-snapshot" }, { label: "회의 상태", value: "직원 검토 완료", source: "meeting:1" }], teamInterpretation: { decisions: ["진행 권고"], risks: [], openItems: [] }, evidence: [{ id: "run-result:patch-v1", kind: "run-result", label: "실행 결과", status: "available", url: "/execution" }, { id: "validation:test", kind: "validation", label: "자동 검증", status: "available", url: "/execution" }, { id: "meeting:1", kind: "meeting", label: "직원 검토 회의", status: "available", url: "/meetings" }], buildEvidence: { ready, snapshotHash: `evidence-${id}`, missing: ready ? [] : ["frontend:error"], backend: { ready, items: ready ? backendItems : backendItems.map((item, index) => index === 7 ? { ...item, status: "needs-evidence", summary: "보안 검증 근거가 없습니다." } : item) }, frontend: { applicability: "web", status: ready ? "captured" : "failed", previewUrl: base, expectedVersion: "patch-v1", observedVersion: ready ? "patch-v1" : "old-patch", scenario: "신규 고객 등록부터 첫 프로젝트 생성까지", manual: ["신규 고객을 등록하고 완료 안내를 확인합니다.", "오류 상태에서 다시 시도 동작을 확인합니다.", "모바일에서 주요 버튼과 정보가 잘리지 않는지 확인합니다."], missingStates: ready ? [] : ["error"], failure: ready ? null : "오류 상태 캡처와 현재 빌드 버전이 확인되지 않았습니다.", exemptionReason: null, captures: ready ? captures : captures.filter(item => item.state !== "error") } }, completeness: { required: ["run-result", "validation", "meeting", "backend-readiness", "frontend-evidence"], present: ready ? ["run-result", "validation", "meeting", "backend-readiness", "frontend-evidence"] : ["run-result", "validation", "meeting"], missing: ready ? [] : ["backend-readiness", "frontend-evidence", "backend:security", "frontend:error", "frontend:preview-version-mismatch"], staleEvidenceIds: [], ready }, snapshotHash: `packet-${id}`, createdAt: "2026-07-19T00:00:00.000Z" });
    const queue = [true, false].map((ready, index) => ({ goalTitle: ready ? "고객 온보딩 자동화 개발" : "결제 화면 보완", stage: "build", stageLabel: "개발", urgency: ready ? "normal" : "high", requestedAt: `2026-07-19T0${index}:00:00.000Z`, review: { id: `review-${index}`, goalId: `goal-${index}`, meetingId: `meeting-${index}`, runId: `run-${index}`, status: "pending", snapshotHash: `packet-${index}`, packet: packet(ready, `goal-${index}`) } }));
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => { localStorage.setItem("agent-company-os.apiToken", "qa-token"); localStorage.setItem("agent-company-os.actorId", "owner"); localStorage.setItem("agent-company-os.username", "qa"); localStorage.setItem("agent-company-os.role", "owner"); localStorage.setItem("agent-company-os.lastCompany", "qa-company"); });
    await context.route("**/api/**", route => { const url = new URL(route.request().url()); if (url.pathname === "/api/companies") return route.fulfill({ json: [{ id: "qa-company", name: "UI 검증 회사", role: "owner", status: "active" }] }); if (url.pathname.endsWith("/owner-reviews")) return route.fulfill({ json: queue }); if (url.pathname === "/api/events") return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" }); return route.fulfill({ json: {} }); });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`page: ${error.message}`));
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(`console: ${message.text()}`); });
    await page.goto(`${base}/reviews?companyId=qa-company`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "오너 결정 센터", exact: true }).waitFor();
    const approve = page.getByRole("button", { name: "다음 단계 진행 승인", exact: true });
    assert.equal(await approve.isEnabled(), true);
    await page.screenshot({ path: path.join(output, "01-decision-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "기술 검토", exact: true }).click();
    assert.equal(await page.locator(".backend-readiness tbody tr").count(), 10);
    await page.screenshot({ path: path.join(output, "02-technical-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "전체 근거", exact: true }).click();
    assert.equal(await page.locator(".capture-gallery figure").count(), 6);
    assert.equal(await page.locator(".capture-gallery img").evaluateAll(nodes => nodes.every(node => node.naturalWidth > 0)), true);
    await page.screenshot({ path: path.join(output, "03-evidence-desktop.png"), fullPage: true });
    const blockedQueueItem = page.locator(".owner-review-queue>button").filter({ hasText: "결제 화면 보완" });
    assert.equal(await blockedQueueItem.count(), 1);
    await blockedQueueItem.click();
    assert.equal(await approve.isEnabled(), false);
    assert.equal(await page.getByText("근거 보완 필요", { exact: true }).isVisible(), true);
    await page.screenshot({ path: path.join(output, "04-blocked-decision.png"), fullPage: true });
    await page.getByRole("button", { name: "전체 근거", exact: true }).click();
    assert.equal(await page.getByText("누락 상태: 오류", { exact: true }).isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    const mobileBlockedItem = page.locator(".owner-review-queue>button").filter({ hasText: "결제 화면 보완" });
    assert.equal(await mobileBlockedItem.count(), 1);
    await mobileBlockedItem.click();
    await page.getByRole("button", { name: "전체 근거", exact: true }).click();
    const mobileMetrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, cards: document.querySelectorAll(".capture-gallery figure").length, rows: document.querySelectorAll(".backend-readiness tbody tr").length, sidebarOpen: document.querySelector(".app-sidebar")?.classList.contains("open"), sidebarTransform: getComputedStyle(document.querySelector(".app-sidebar")).transform, mainLeft: document.querySelector(".app-main")?.getBoundingClientRect().left }));
    assert.equal(mobileMetrics.scrollWidth, mobileMetrics.clientWidth);
    assert.equal(mobileMetrics.sidebarOpen, false);
    assert.equal(mobileMetrics.mainLeft, 0);
    await page.screenshot({ path: path.join(output, "05-evidence-mobile.png"), fullPage: true });
    const mobileReadyItem = page.locator(".owner-review-queue>button").filter({ hasText: "고객 온보딩 자동화 개발" });
    assert.equal(await mobileReadyItem.count(), 1);
    await mobileReadyItem.click();
    await page.getByRole("button", { name: "기술 검토", exact: true }).click();
    assert.equal(await page.locator(".backend-readiness tbody tr").count(), 10);
    await page.locator(".backend-readiness").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "06-technical-mobile.png"), fullPage: false });
    await page.getByRole("button", { name: "전체 근거", exact: true }).click();
    await page.locator(".capture-gallery").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "07-gallery-mobile.png"), fullPage: false });
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ mobileMetrics, errors }, null, 2));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ mobileMetrics, errors, output }));
  } finally { await browser.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exit(1); });
