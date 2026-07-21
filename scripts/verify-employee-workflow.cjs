const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const webBase = process.env.AGENT_COMPANY_WEB_BASE || 'http://127.0.0.1:5173';
const companyId = process.env.AGENT_COMPANY_EMPLOYEE_QA_COMPANY || `employee-workflow-qa-${Date.now()}`;
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
const outDir = 'C:/Project/paperclip/multi-agent/agent-company-os/.runtime/visualqa/employee-workflow';
fs.mkdirSync(outDir, { recursive: true });

async function api(pathname, options = {}) {
  const response = await fetch(apiBase + pathname, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.QA_TOKEN}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${pathname}: ${JSON.stringify(body)}`);
  return body;
}

async function ensureLiveCompany() {
  const companies = await api(`/api/companies?actor=${encodeURIComponent(actorId)}`);
  if (companies.some((item) => item.id === companyId)) return;
  const workspaceId = `${companyId}-workspace`;
  try { await api('/api/workspaces', { method: 'POST', body: JSON.stringify({ id: workspaceId, name: 'Employee Workflow QA Workspace' }) }); } catch {}
  await api('/api/companies', { method: 'POST', body: JSON.stringify({ id: companyId, name: 'Employee Workflow QA Company', workspaceId, budgetLimit: 20, mandatoryReviews: ['result'], mandatoryApprovals: ['result'], allowedTools: ['build', 'test', 'browser'], ownerId: actorId, mode: 'live' }) });
}

async function main() {
  if (!process.env.QA_TOKEN || !process.env.BROWSER_AUTOMATION_EXECUTABLE) throw new Error('QA_TOKEN and BROWSER_AUTOMATION_EXECUTABLE are required');
  await ensureLiveCompany();
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
    }, { token: process.env.QA_TOKEN, actorId, companyId });

    await page.goto(`${webBase}/employees?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '직원·AI팀' }).waitFor({ timeout: 15000 });
    await page.getByText('+ 새 직원 추가 / 직원 초안 만들기').click();
    await page.getByLabel('새 직원 자연어 설명').fill('인스타그램 홍보 담당자를 채용하고 싶어. 릴스 아이디어와 캡션 초안을 만들고 실제 게시와 광고비 집행은 승인받아야 해.');
    await page.getByRole('button', { name: '직원 초안 만들기' }).click();
    await page.getByRole('heading', { name: 'Prompt profile preview' }).waitFor({ timeout: 45000 });
    await page.screenshot({ path: path.join(outDir, '01-employee-draft.png'), fullPage: true });
    const draftText = await page.locator('body').innerText();
    for (const required of ['직무기술서', '결정 필요', '금지', 'Prompt profile preview']) {
      if (!draftText.includes(required)) throw new Error(`employee draft missing: ${required}`);
    }
    const principalId = `sns-marketer-${Date.now()}`;
    await page.getByLabel('ID (필수)').fill(principalId);
    await page.getByRole('button', { name: '이 직원 채용하기' }).click();
    await page.getByText(principalId).waitFor({ timeout: 45000 });
    await page.screenshot({ path: path.join(outDir, '02-employee-activated.png'), fullPage: true });

    await page.goto(`${webBase}/company?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('AI 회사에 맡길 업무').fill('이번 주 인스타 홍보 플랜 짜줘');
    await page.getByRole('button', { name: 'AI 팀에게 계획 요청' }).click();
    await page.getByText('AI 계획 제안', { exact: true }).waitFor({ timeout: 45000 });
    await page.getByText('채용한 직원이 투입됩니다').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '03-staffing-preview.png'), fullPage: true });
    await page.getByRole('button', { name: '이 계획으로 AI 회사에 맡기기' }).click();
    await page.waitForURL(/\/goals\?/, { timeout: 90000 });
    await page.getByText('이 업무에 사용된 직원 profile').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '04-goal-provenance.png'), fullPage: true });

    const url = new URL(page.url());
    const goalId = url.searchParams.get('goalId');
    if (!goalId) throw new Error(`goalId missing after launch: ${page.url()}`);
    const snapshot = await api(`/api/companies/${encodeURIComponent(companyId)}/goals/${encodeURIComponent(goalId)}?actor=${encodeURIComponent(actorId)}`);
    if (!snapshot.employeeProfileSnapshots?.some((item) => item.principalId === principalId)) throw new Error('goal snapshot missing hired employee provenance');

    const report = { generatedAt: new Date().toISOString(), companyId, goalId, principalId, employeeProfileSnapshots: snapshot.employeeProfileSnapshots.map((item) => ({ principalId: item.principalId, profileHash: item.profileHash })), errors };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
