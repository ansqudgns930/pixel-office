const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const webBase = process.env.AGENT_COMPANY_WEB_BASE || 'http://127.0.0.1:5173';
const companyId = process.env.AGENT_COMPANY_FLOW_QA_COMPANY || 'delegated-work-flow-qa-workflow';
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
let authToken = process.env.QA_TOKEN || '';
const outDir = 'C:/Project/paperclip/multi-agent/agent-company-os/.runtime/visualqa/delegated-work-flow';
fs.mkdirSync(outDir, { recursive: true });

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
  if (!response.ok || !body?.token) throw new Error(`login failed for browser QA: ${response.status}`);
  authToken = body.token;
  return authToken;
}

async function api(pathname, options = {}) {
  const response = await fetch(apiBase + pathname, {
    ...options,
    headers: {
      authorization: `Bearer ${authToken}`,
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
  try { await api('/api/workspaces', { method: 'POST', body: JSON.stringify({ id: workspaceId, name: 'Delegated Work Flow QA Workspace' }) }); } catch {}
  await api('/api/companies', { method: 'POST', body: JSON.stringify({ id: companyId, name: 'Delegated Work Flow QA Company', workspaceId, budgetLimit: 10, mandatoryReviews: ['result'], mandatoryApprovals: ['result'], allowedTools: ['build', 'test', 'lint'], ownerId: actorId, mode: 'live' }) });
}

async function main() {
  if (!process.env.BROWSER_AUTOMATION_EXECUTABLE) throw new Error('BROWSER_AUTOMATION_EXECUTABLE is required');
  await ensureAuthToken();
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
    }, { token: authToken, actorId, companyId });

    await page.goto(`${webBase}/company?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('무슨 일을 AI 회사에 맡길까요?', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByLabel('AI 회사에 맡길 업무').fill('대시보드 첫 화면에서 업무 맡기기 흐름을 더 명확하게 개선해줘');
    await page.getByRole('button', { name: 'AI 팀에게 계획 요청' }).click();
    await page.getByText('AI 계획 제안', { exact: true }).waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(outDir, '01-plan-preview.png'), fullPage: true });
    const previewText = await page.locator('body').innerText();
    for (const required of ['AI 계획 제안', '위험도', '완료 조건', '사용자 결정 필요 예상', '왜 이 팀인가요?', '실행하면 이렇게 진행됩니다', '예상 개입', '안전장치', '예상 결과물', '기본 계획 모드', 'AI 엔진 설정 전이라 기본 계획으로 preview를 생성했습니다.', '업무 검토 회의', '이 계획으로 AI 회사에 맡기기']) {
      if (!previewText.includes(required)) throw new Error(`plan preview missing: ${required}`);
    }
    for (const forbidden of ['fallback draft', 'goal-draft-model-not-configured']) {
      if (previewText.includes(forbidden)) throw new Error(`plan preview leaked internal copy: ${forbidden}`);
    }

    await page.getByRole('button', { name: '이 계획으로 AI 회사에 맡기기' }).click();
    try {
      await page.waitForURL(/\/goals\?/, { timeout: 90000 });
    } catch (error) {
      await page.screenshot({ path: path.join(outDir, 'launch-timeout.png'), fullPage: true });
      fs.writeFileSync(path.join(outDir, 'launch-timeout.txt'), await page.locator('body').innerText());
      throw error;
    }
    await page.getByText('업무를 맡긴 뒤에는 여기서 진행 상태를 봅니다', { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '02-goals-after-launch.png'), fullPage: true });
    const url = new URL(page.url());
    const goalId = url.searchParams.get('goalId');
    if (!goalId) throw new Error(`goalId missing after launch: ${page.url()}`);
    const goalsText = await page.locator('body').innerText();
    for (const required of ['맡긴 일', '업무를 맡긴 뒤에는 여기서 진행 상태를 봅니다', '업무를 맡겼습니다', 'AI 팀이 계획을 실행 중입니다', '진행 보기', '픽셀 오피스 Live View', '결과·활동', '진행 단계', '다음 액션', '완료 리포트 준비 중', '만든 결과물', '검증 상태', '결정 이력', '다음 업무 맡기기']) {
      if (!goalsText.includes(required)) throw new Error(`goals page missing delegated-work copy: ${required}`);
    }

    const goalSnapshot = await api(`/api/companies/${encodeURIComponent(companyId)}/goals/${encodeURIComponent(goalId)}?actor=${encodeURIComponent(actorId)}`);
    const delivery = await api(`/api/companies/${encodeURIComponent(companyId)}/goals/${encodeURIComponent(goalId)}/delivery-process?actor=${encodeURIComponent(actorId)}`);
    if (!goalSnapshot?.goal?.id && !goalSnapshot?.id) throw new Error('goal snapshot missing goal identity');
    if (!delivery?.process?.goalId && !delivery?.goalId) throw new Error('delivery process missing');

    await page.goto(`${webBase}/reviews?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('결정 필요', { exact: true }).first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '03-decision-inbox.png'), fullPage: true });

    await page.goto(`${webBase}/pixel-office?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(goalId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('선택 목표 추적 중', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText('진행 상황 LIVE VIEW').or(page.getByText('진행 상황 Live View')).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '04-pixel-office-goal-focus.png'), fullPage: true });

    await page.goto(`${webBase}/activity?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(goalId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '결과·활동' }).waitFor({ timeout: 15000 });
    await page.getByText('선택한 맡긴 일의 결과와 활동을 보는 중입니다', { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '05-activity.png'), fullPage: true });

    const report = { generatedAt: new Date().toISOString(), companyId, goalId, deliveryProcessId: delivery.process?.id ?? delivery.id ?? null, url: page.url(), errors };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
