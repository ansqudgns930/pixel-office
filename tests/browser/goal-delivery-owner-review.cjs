const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

async function main() {
  const root = path.resolve(__dirname, "../..");
  const port = 4176;
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [path.join(root, "apps/web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port)], { cwd: path.join(root, "apps/web"), stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); if (i === 39) throw new Error("Vite preview did not start"); }
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => { localStorage.setItem("agent-company-os.apiToken", "qa-token"); localStorage.setItem("agent-company-os.actorId", "owner"); localStorage.setItem("agent-company-os.username", "qa"); localStorage.setItem("agent-company-os.role", "owner"); localStorage.setItem("agent-company-os.lastCompany", "qa-company"); });
    let mode = "pending";
    const goal = { id: "goal-1", companyId: "qa-company", title: "고객 온보딩 자동화 출시", description: "신규 고객의 첫 프로젝트 시작을 자동화합니다.", status: "active", ownerId: "owner", completionCriteria: ["모바일 검증", "자동 검증 통과"], budgetLimit: 20, dueAt: null, projectCount: 1, projectIds: ["project-1"], progress: 25, blocked: 0, pendingApprovals: 1, validationFailures: 0, spent: 4 };
    const snapshot = () => { const review = { id: "review-1", status: mode === "held" ? "on-hold" : "pending", koreanSummary: "기획 단계의 직원 검토 회의가 완료되었습니다. 위험과 미해결 항목을 확인해 주세요.", decisions: ["진행 후보"], risks: ["모바일 일정"], openItems: ["롤백 기준"], evidenceIds: ["run:1", "validation:1", "meeting:1"], snapshotHash: "1234567890abcdef" }; const approved = mode === "approved", revised = mode === "revised", held = mode === "held"; return { goal, deliveryProcess: { process: { id: "delivery-1", version: approved || revised ? 7 : 6, currentStage: approved ? "delivery-planning" : "discovery", status: held ? "blocked" : "active" }, currentStageInstance: approved ? { id: "stage-plan", stage: "delivery-planning", attempt: 1, status: "pending", runId: null, meetingId: null } : revised ? { id: "stage-revision", stage: "discovery", attempt: 2, status: "pending", runId: null, meetingId: null } : { id: "stage-1", stage: "discovery", attempt: 1, status: held ? "blocked" : "owner-approval-waiting", runId: "run-1", meetingId: "meeting-1" }, stages: approved ? [{ id: "stage-1", stage: "discovery", attempt: 1, status: "approved", runId: "run-1", meetingId: "meeting-1" }, { id: "stage-plan", stage: "delivery-planning", attempt: 1, status: "pending", runId: null, meetingId: null }] : [{ id: "stage-1", stage: "discovery", attempt: 1, status: revised ? "revision-requested" : held ? "blocked" : "owner-approval-waiting", runId: "run-1", meetingId: "meeting-1" }, ...(revised ? [{ id: "stage-revision", stage: "discovery", attempt: 2, status: "pending", runId: null, meetingId: null }] : [])], artifactSnapshots: [{ id: "evidence", stageInstanceId: "stage-1", version: 1, artifactIds: review.evidenceIds, stale: revised }], ownerReview: approved || revised ? null : review }, metrics: { total: 4, done: 1, progress: 25, blocked: 0, pendingApprovals: 1, validationFailures: 0, spent: 4, budget: 20 }, projects: [{ project: { id: "project-1", name: "온보딩 실행 프로젝트", spent: 4, budgetLimit: 20 }, milestones: [], tasks: [{ id: "task-1", projectId: "project-1", milestoneId: null, title: "기획", status: "review", runId: "run-1", spent: 4, budgetLimit: 20, assignments: [{ principalId: "planner", responsibility: "executor" }, { principalId: "reviewer", responsibility: "reviewer" }], run: { id: "run-1", status: "RESULT_APPROVAL_WAITING", spent: 4 }, approvals: [{ status: "PENDING" }], artifacts: [], stale: [] }] }], nextActions: [], timeline: [], snapshotHash: "qa" }; };
    await context.route("**/favicon.ico", route => route.fulfill({ status: 204, body: "" }));
    await context.route("**/api/**", async route => { const request = route.request(), p = new URL(request.url()).pathname; if (p === "/api/companies") return route.fulfill({ json: [{ id: "qa-company", name: "QA Company", role: "owner", projectCount: 1, status: "active" }] }); if (p === "/api/companies/qa-company/goals") return route.fulfill({ json: [goal] }); if (p === "/api/companies/qa-company/goals/goal-1" && request.method() === "GET") return route.fulfill({ json: snapshot() }); if (p === "/api/companies/qa-company") return route.fulfill({ json: { portfolio: { projects: [{ project: { id: "project-1", name: "온보딩 실행 프로젝트" } }] } } }); if (p.endsWith("/delivery-process/owner-review") && request.method() === "POST") { const body = JSON.parse(request.postData() || "{}"); mode = body.decision === "on-hold" ? "held" : body.decision === "resume" ? "pending" : body.decision === "revision-requested" ? "revised" : "approved"; return route.fulfill({ json: snapshot().deliveryProcess }); } if (p === "/api/events") return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" }); return route.fulfill({ status: 200, json: {} }); });
    const page = await context.newPage();
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    const url = `${base}/goals?companyId=qa-company&goalId=goal-1`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("complementary", { name: "오너 검토 요청" }).waitFor();
    await page.getByLabel("수정 또는 보류할 사항").fill("외부 일정을 먼저 확인합니다.");
    await page.getByRole("button", { name: "보류", exact: true }).click();
    await page.getByRole("button", { name: "검토 재개", exact: true }).waitFor();
    await page.getByRole("button", { name: "검토 재개", exact: true }).click();
    await page.getByRole("button", { name: "진행 승인", exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, "outputs", "goal-delivery-owner-review-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "진행 승인", exact: true }).click();
    await page.getByText("실행계획", { exact: true }).waitFor();
    mode = "pending";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("complementary", { name: "오너 검토 요청" }).waitFor();
    const mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, reviewWidth: document.querySelector(".owner-review")?.getBoundingClientRect().width, sidebarOpen: document.querySelector(".app-sidebar")?.classList.contains("open") }));
    assert.equal(mobile.overflow, 0); assert.equal(mobile.sidebarOpen, false); assert.ok((mobile.reviewWidth || 0) <= 358);
    await page.locator(".owner-review").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(root, "outputs", "goal-delivery-owner-review-mobile.png"), fullPage: false });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ mobile, errors }));
  } finally { await browser.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exit(1); });
