const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const webBase = process.env.AGENT_COMPANY_WEB_BASE || 'http://127.0.0.1:5173';
const companyId = process.env.AGENT_COMPANY_EXECUTION_QA_COMPANY;
const goalId = process.env.AGENT_COMPANY_EXECUTION_QA_GOAL;
const runId = process.env.AGENT_COMPANY_EXECUTION_QA_RUN;
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
const outDir = path.join(process.cwd(), '.runtime', 'visualqa', 'execution-model-routing');
fs.mkdirSync(outDir, { recursive: true });

async function login() {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: process.env.AGENT_COMPANY_QA_USERNAME || 'admin', password: process.env.AGENT_COMPANY_QA_PASSWORD || 'textadmin' }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) throw new Error(`login failed: ${response.status}`);
  return body.token;
}

async function main() {
  if (!process.env.BROWSER_AUTOMATION_EXECUTABLE) throw new Error('BROWSER_AUTOMATION_EXECUTABLE is required');
  if (!companyId || !goalId || !runId) throw new Error('AGENT_COMPANY_EXECUTION_QA_COMPANY/GOAL/RUN are required');
  const token = await login();
  const apiDetail = await fetch(`${apiBase}/api/runs/${encodeURIComponent(runId)}`, { headers: { authorization: `Bearer ${token}` } });
  const detail = await apiDetail.json();
  if (!apiDetail.ok) throw new Error(`run detail failed: ${apiDetail.status} ${JSON.stringify(detail)}`);
  if (!detail.modelRoutingRecommendation?.recommendationHash) throw new Error('run detail missing modelRoutingRecommendation');

  const browser = await chromium.launch({ executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`page:${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
    await page.goto(`${webBase}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token, actorId, companyId }) => {
      localStorage.setItem('agent-company-os.apiToken', token);
      localStorage.setItem('agent-company-os.actorId', actorId);
      localStorage.setItem('agent-company-os.username', actorId);
      localStorage.setItem('agent-company-os.role', 'admin');
      localStorage.setItem('agent-company-os.lastCompany', companyId);
    }, { token, actorId, companyId });
    await page.goto(`${webBase}/execution?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(goalId)}&runId=${encodeURIComponent(runId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('MODEL ROUTING EXECUTION', { exact: true }).waitFor({ timeout: 20000 });
    const body = await page.locator('body').innerText();
    for (const expected of ['추천 모델 배치와 실제 실행 모델', '고사양 reasoning', '고사양 verification', '실제 사용', '차이 해석', 'member override → role binding → company default → runtime fallback', 'source company-plan-preview']) {
      if (!body.includes(expected)) throw new Error(`missing UI text: ${expected}`);
    }
    await page.screenshot({ path: path.join(outDir, 'execution-model-routing.png'), fullPage: true });
    const report = { generatedAt: new Date().toISOString(), companyId, goalId, runId, recommendationHash: detail.modelRoutingRecommendation.recommendationHash, source: detail.modelRoutingRecommendation.source, errors };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
