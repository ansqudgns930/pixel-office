const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const webBase = process.env.AGENT_COMPANY_WEB_BASE || 'http://127.0.0.1:5173';
const companyId = process.env.AGENT_COMPANY_PRESET_QA_COMPANY || 'delegated-work-flow-qa-workflow';
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
const outDir = path.join(process.cwd(), '.runtime', 'visualqa', 'professional-preset-recommendations');
fs.mkdirSync(outDir, { recursive: true });
let authToken = process.env.QA_TOKEN || '';

async function ensureAuthToken() {
  if (authToken) return authToken;
  const username = process.env.AGENT_COMPANY_QA_USERNAME || 'admin';
  const password = process.env.AGENT_COMPANY_QA_PASSWORD || 'textadmin';
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) throw new Error(`login failed for preset QA: ${response.status}`);
  authToken = body.token;
  return authToken;
}

async function main() {
  await ensureAuthToken();
  const executablePath = process.env.BROWSER_AUTOMATION_EXECUTABLE;
  if (!executablePath) throw new Error('BROWSER_AUTOMATION_EXECUTABLE is required');
  const browser = await chromium.launch({ executablePath, headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
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
    }, { token: authToken, actorId, companyId });

    await page.goto(`${webBase}/company?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('무슨 일을 AI 회사에 맡길까요?', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByLabel('AI 회사에 맡길 업무').fill('릴리즈 노트와 배포 go-no-go 체크리스트를 만들고 장애 발생 시 rollback 기준도 정리해줘');
    await page.getByRole('button', { name: 'AI 팀에게 계획 요청' }).click();
    await page.getByText('AI 계획 제안', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByText('추천 전문 직원').waitFor({ timeout: 15000 });
    await page.getByText('Release Manager').waitFor({ timeout: 15000 });
    await page.getByText('Technical Writer').waitFor({ timeout: 15000 });
    await page.getByText('SRE', { exact: true }).waitFor({ timeout: 15000 });
    const body = await page.locator('body').innerText();
    for (const required of ['추천 전문 직원', '릴리즈 준비와 배포 판단 담당자', '문서화와 사용자 설명 담당자', '운영 안정성과 장애 대응 담당자']) {
      if (!body.includes(required)) throw new Error(`preset recommendation missing: ${required}`);
    }
    await page.getByRole('button', { name: '이번 업무에만 임시 투입' }).first().click();
    await page.getByText('임시 투입 선택됨').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '01-company-home-preset-recommendations.png'), fullPage: true });

    await page.getByRole('button', { name: '이 계획으로 AI 회사에 맡기기' }).click();
    await page.waitForURL(/\/goals\?/, { timeout: 90000 });
    await page.getByText('이 업무에 사용된 직원 profile').waitFor({ timeout: 15000 });
    await page.getByText('임시 전문가').waitFor({ timeout: 15000 });
    await page.getByText('temporary-').waitFor({ timeout: 15000 });
    const goalsBody = await page.locator('body').innerText();
    if (!goalsBody.includes('이번 업무에만 임시 투입')) throw new Error('temporary specialist provenance reason missing');
    await page.screenshot({ path: path.join(outDir, '02-goals-temporary-specialist-provenance.png'), fullPage: true });

    const url = new URL(page.url());
    const goalId = url.searchParams.get('goalId');
    const report = { generatedAt: new Date().toISOString(), companyId, goalId, checkedPresets: ['release-manager', 'technical-writer', 'sre'], temporarySpecialistVisible: true, errors };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
