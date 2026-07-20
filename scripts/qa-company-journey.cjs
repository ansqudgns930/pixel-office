const { chromium } = require("playwright-core");

const apiBase = "http://127.0.0.1:4310";
const webBase = "http://127.0.0.1:4173";
const companyId = "demo-company";
const projectId = "demo-first-delivery";
const meetingId = "p4-journey-meeting";
const runId = "p4-journey-run";
const taskId = "p4-journey-task";

async function api(path, options = {}) {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: { authorization: `Bearer ${process.env.QA_TOKEN}`, "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${path}: ${JSON.stringify(body)}`);
  return body;
}

async function setup() {
  await api("/api/demo/bootstrap", { method: "POST", body: "{}" });
  const meetings = await api(`/api/companies/${companyId}/meetings?actor=admin`);
  if (!meetings.some((item) => item.id === meetingId)) {
    await api(`/api/companies/${companyId}/meetings`, { method: "POST", body: JSON.stringify({
      actorId: "admin", id: meetingId, goalId: "demo-company-goal", projectId, runId: null,
      title: "P4 전체 사용자 여정 회의", purpose: "사용자 개입부터 후속 Task 확정까지 검증합니다.",
      hostId: "admin", participantIds: ["demo-pm", "demo-developer", "demo-qa"],
      agenda: ["출시 결정", "후속 업무"], scheduledAt: null,
    }) });
    await api(`/api/companies/${companyId}/meetings/${meetingId}/actions/transition`, { method: "POST", body: JSON.stringify({ actorId: "admin", status: "live" }) });
  }
  const runs = await api("/api/runs?limit=100");
  if (!runs.some((item) => item.id === runId)) {
    await api("/api/runs", { method: "POST", body: JSON.stringify({ id: runId, requestId: "p4-journey-request", goal: "P4 사용자 여정 Run 근거", requestedPaths: ["README.md"], requestedRisk: "low", budgetLimit: 1 }) });
  }
  const project = await api(`/api/projects/${projectId}?actor=admin`);
  if (!project.tasks.some((item) => item.id === taskId)) {
    await api(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({ actorId: "admin", id: taskId, milestoneId: null, title: "P4 사용자 여정 Run 근거", status: "ready", priority: 1, completionCriteria: ["Run 근거 화면 확인"], budgetLimit: 1 }) });
    await api(`/api/projects/${projectId}/tasks/${taskId}/actions/link-run`, { method: "POST", body: JSON.stringify({ actorId: "admin", runId }) });
  }
}

async function main() {
  if (!process.env.QA_TOKEN || !process.env.BROWSER_AUTOMATION_EXECUTABLE) throw new Error("QA_TOKEN and BROWSER_AUTOMATION_EXECUTABLE are required");
  await setup();
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    let intentionalDisconnect = false;
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error" && !(intentionalDisconnect && message.text().includes("ERR_FAILED"))) errors.push(`console: ${message.text()}`); });
    await page.goto(`${webBase}/login`);
    await page.locator("h1").waitFor();
    const login = await page.locator("h1").textContent();
    await page.evaluate((token) => {
      localStorage.setItem("agent-company-os.apiToken", token);
      localStorage.setItem("agent-company-os.actorId", "admin");
      localStorage.setItem("agent-company-os.username", "admin");
      localStorage.setItem("agent-company-os.role", "admin");
      localStorage.setItem("agent-company-os.lastCompany", "demo-company");
    }, process.env.QA_TOKEN);

    const pages = [
      ["companies", "/companies", ".companies-page"],
      ["company", `/company?companyId=${companyId}`, ".page-header"],
      ["employees", `/employees?companyId=${companyId}`, ".employees-page"],
      ["goals", `/goals?companyId=${companyId}&goalId=demo-company-goal`, ".goals-page"],
      ["projects", `/projects?companyId=${companyId}&projectId=${projectId}`, ".page-header"],
      ["execution", `/execution?companyId=${companyId}&projectId=${projectId}&runId=${runId}`, ".page-header"],
    ];
    const visited = {};
    for (const [name, path, selector] of pages) {
      await page.goto(webBase + path, { waitUntil: "domcontentloaded" });
      await page.locator(selector).waitFor();
      visited[name] = await page.locator("main h1, main .page-header h1, main .page-header h2").first().textContent().catch(() => name);
    }

    await page.goto(`${webBase}/meetings?companyId=${companyId}&meetingId=${meetingId}`, { waitUntil: "domcontentloaded" });
    await page.locator(".meetings-page").waitFor();
    await page.locator(".meeting-list button", { hasText: "P4 전체 사용자 여정 회의" }).click();
    await page.locator(".meeting-room-header", { hasText: "P4 전체 사용자 여정 회의" }).waitFor();
    const composer = page.locator(".meeting-composer");
    if (await composer.count() && await composer.locator("button").isEnabled()) {
      await composer.locator("select").first().selectOption("decision");
      await composer.locator("textarea").fill("P4 사용자 여정 검증을 완료하고 후속 업무를 진행합니다.");
      await composer.locator('input[aria-label]').last().fill("P4 후속 Task 확인");
      await composer.locator("button").click();
      await page.locator(".meeting-message-stream article").last().waitFor();
      await api(`/api/companies/${companyId}/meetings/${meetingId}/actions/transition`, { method: "POST", body: JSON.stringify({ actorId: "admin", status: "ended" }) });
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await page.locator(".meeting-summary").waitFor();
    const confirm = page.locator(".meeting-summary button");
    if (await confirm.count()) await confirm.click();
    await page.locator(".meeting-summary a").first().waitFor();
    const createdTasks = await page.locator(".meeting-summary a").count();

    await page.goto(`${webBase}/activity?companyId=${companyId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("실시간 연결", { exact: true }).waitFor();
    intentionalDisconnect = true;
    await page.route("**/api/events**", (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("실시간 연결이 끊겼습니다", { exact: true }).waitFor({ timeout: 10000 });
    const disconnected = await page.getByText("재연결 중", { exact: true }).isVisible();
    await page.unroute("**/api/events**");
    await page.getByText("실시간 연결", { exact: true }).waitFor({ timeout: 10000 });
    intentionalDisconnect = false;
    const reconnected = await page.getByText("실시간 연결", { exact: true }).isVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${webBase}/execution?companyId=${companyId}&projectId=${projectId}&runId=${runId}`, { waitUntil: "domcontentloaded" });
    await page.locator(".page-header").waitFor();
    await page.keyboard.press("Tab");
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      focused: document.activeElement?.tagName,
      ariaLabels: document.querySelectorAll("[aria-label]").length,
    }));
    const result = { login, visited, createdTasks, disconnected, reconnected, mobile, errors };
    console.log(JSON.stringify(result));
    if (errors.length || createdTasks < 1 || !disconnected || !reconnected || mobile.overflow || !mobile.focused || mobile.ariaLabels < 3) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
