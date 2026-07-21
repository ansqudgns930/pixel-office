const { chromium } = require("playwright-core");
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript((token) => {
      localStorage.setItem("agent-company-os.apiToken", token);
      localStorage.setItem("agent-company-os.actorId", "admin");
      localStorage.setItem("agent-company-os.username", "admin");
      localStorage.setItem("agent-company-os.role", "admin");
    }, process.env.QA_TOKEN);
    const page = await context.newPage();
    page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
    page.on("pageerror", e => errors.push(`page: ${e.message}`));
    page.on("response", r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.setViewportSize({ width: 1440, height: 1100 });

    // 1) Go to Execution Workroom, create a project
    await page.goto("http://127.0.0.1:4173/projects?companyId=demo-company", { waitUntil: "load" });
    await page.waitForSelector("h1,h2", { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.locator("summary", { hasText: "새 프로젝트 만들기" }).click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="온보딩 자동화"]', "E2E 테스트 프로젝트");
    await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-01-project-form.png" });
    await page.locator('button', { hasText: "프로젝트 만들기" }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-02-project-created.png" });

    // 2) Create a task in it
    await page.locator("summary", { hasText: "새 Task 만들기" }).click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="온보딩 이메일"]', "E2E 테스트 태스크");
    await page.fill('textarea[placeholder*="한 줄에 하나씩"] >> nth=0', "완료 기준 1");
    await page.locator('button', { hasText: "Task 만들기" }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-03-task-created.png" });

    // 3) Select the new task, assign an executor
    await page.locator(".task-chip", { hasText: "E2E 테스트 태스크" }).click();
    await page.waitForTimeout(300);
    await page.fill('.task-editor input', "demo-developer");
    await page.locator('.task-editor button', { hasText: "배정" }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-04-assigned.png" });

    // 4) Start a run from the task
    await page.locator(".task-chip", { hasText: "E2E 테스트 태스크" }).click();
    await page.waitForTimeout(300);
    const runButton = page.locator('button', { hasText: "이 Task로 Run 시작" });
    const runButtonCount = await runButton.count();
    console.log("run-start button found:", runButtonCount);
    if (runButtonCount) {
      await runButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-05-execution-prefilled.png" });
      await page.locator('button', { hasText: "Run 생성" }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: process.env.QA_OUTPUT_DIR + "/e2e-06-run-created-linked.png" });
    }

    console.log("errors:", JSON.stringify(errors, null, 2));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exit(1); });
