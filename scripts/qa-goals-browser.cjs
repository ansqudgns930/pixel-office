const { chromium } = require("playwright-core");
const path = require("node:path");

async function inspect(page, viewport, output) {
  await page.setViewportSize(viewport);
  await page.goto("http://127.0.0.1:4173/goals?companyId=demo-company&goalId=demo-company-goal", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "회사 목표", exact: true }).waitFor();
  const result = await page.evaluate(() => ({
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    headings: [...document.querySelectorAll("h1,h2")].map(x => x.textContent?.trim()).filter(Boolean),
    tabs: [...document.querySelectorAll(".goal-view-tabs button")].map(x => x.textContent?.trim()),
    selectedGoal: document.querySelector(".goal-list-item.selected strong")?.textContent?.trim(),
    kpis: [...document.querySelectorAll(".goal-kpis article")].map(x => x.textContent?.trim()),
  }));
  await page.screenshot({ path: output, fullPage: true });
  return result;
}

async function main() {
  if (!process.env.QA_TOKEN) throw new Error("QA_TOKEN required");
  const outputDir = process.env.QA_OUTPUT_DIR || process.cwd();
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(token => {
      localStorage.setItem("agent-company-os.apiToken", token);
      localStorage.setItem("agent-company-os.actorId", "admin");
      localStorage.setItem("agent-company-os.username", "admin");
      localStorage.setItem("agent-company-os.role", "admin");
    }, process.env.QA_TOKEN);
    const page = await context.newPage();
    page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    page.on("pageerror", error => errors.push(`page: ${error.message}`));
    page.on("response", response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
    const desktop = await inspect(page, { width: 1440, height: 1000 }, path.join(outputDir, "goals-p2-desktop.png"));
    await page.getByRole("button", { name: "보드", exact: true }).click();
    if (await page.locator(".goal-board-column").count() !== 6) errors.push("board columns missing");
    await page.getByRole("button", { name: "타임라인", exact: true }).click();
    if (await page.locator(".goal-timeline article").count() < 1) errors.push("timeline empty");
    const mobile = await inspect(page, { width: 390, height: 844 }, path.join(outputDir, "goals-p2-mobile.png"));
    console.log(JSON.stringify({ desktop, mobile, errors }));
    if (errors.length || desktop.scrollWidth > desktop.clientWidth || mobile.scrollWidth > mobile.clientWidth) process.exitCode = 1;
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exit(1); });
