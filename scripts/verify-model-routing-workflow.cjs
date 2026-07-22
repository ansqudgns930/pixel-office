const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const webBase = process.env.AGENT_COMPANY_WEB_BASE || 'http://127.0.0.1:5173';
const companyId = process.env.AGENT_COMPANY_MODEL_ROUTING_QA_COMPANY || 'model-routing-qa-workflow';
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
let authToken = process.env.QA_TOKEN || '';
const outDir = path.join(process.cwd(), '.runtime', 'visualqa', 'model-routing-workflow');
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

async function ensureQaDepartment() {
  const departmentId = `${companyId}-dept`;
  const snapshot = await api(`/api/companies/${encodeURIComponent(companyId)}?actor=${encodeURIComponent(actorId)}`).catch(() => null);
  if (snapshot?.portfolio?.departments?.some((item) => item.id === departmentId)) return;
  try {
    await api(`/api/companies/${encodeURIComponent(companyId)}/departments`, {
      method: 'POST',
      body: JSON.stringify({ actorId, id: departmentId, parentId: null, name: 'AI 실행팀', budgetLimit: 20 }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exists|duplicate/i.test(message)) throw error;
  }
}

async function ensureLiveCompany() {
  const companies = await api(`/api/companies?actor=${encodeURIComponent(actorId)}`);
  if (companies.some((item) => item.id === companyId)) { await ensureQaDepartment(); return; }
  const workspaceId = `${companyId}-workspace`;
  try {
    await api('/api/workspaces', { method: 'POST', body: JSON.stringify({ id: workspaceId, name: 'Model Routing QA Workspace' }) });
  } catch {}
  await api('/api/companies', {
    method: 'POST',
    body: JSON.stringify({
      id: companyId,
      name: 'Model Routing QA Company',
      workspaceId,
      budgetLimit: 30,
      mandatoryReviews: ['review'],
      mandatoryApprovals: ['result'],
      allowedTools: ['build', 'test', 'browser'],
      ownerId: actorId,
      mode: 'live',
    }),
  });
  await ensureQaDepartment();
}

async function textOf(page) {
  return page.locator('body').innerText();
}

async function requireText(page, expected, label = expected) {
  const body = await textOf(page);
  if (!body.includes(expected)) throw new Error(`missing ${label}: ${expected}`);
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

    const workRequest = '전략 우선순위와 보안 권한 위험이 있는 새 기능 출시 계획을 세우고 모델 라우팅 근거를 남겨줘';
    await page.goto(`${webBase}/company?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('무슨 일을 AI 회사에 맡길까요?', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByLabel('AI 회사에 맡길 업무').fill(workRequest);
    await page.getByRole('button', { name: 'AI 팀에게 계획 요청' }).click();
    await page.getByText('추천 모델 배치', { exact: true }).waitFor({ timeout: 45000 });
    await requireText(page, '고사양 reasoning');
    await requireText(page, '고사양 verification');
    await requireText(page, 'strategy');
    await requireText(page, 'security');
    await requireText(page, '현재 설정');
    await requireText(page, '저장값 없음');
    await page.screenshot({ path: path.join(outDir, '01-company-plan-routing.png'), fullPage: true });

    const settingsLink = page.getByLabel('추천 모델 배치').getByRole('link', { name: 'AI 엔진 설정' });
    const settingsHref = await settingsLink.getAttribute('href');
    if (!settingsHref || !settingsHref.includes('planner=high-reasoning') || !settingsHref.includes('reviewer=high-verification')) {
      throw new Error(`settings link missing routing params: ${settingsHref}`);
    }
    await settingsLink.click();
    await page.getByText('회사 홈 추천 모델 배치', { exact: true }).waitFor({ timeout: 15000 });
    await requireText(page, '현재 저장값');
    await requireText(page, '설정 초안');
    await requireText(page, '저장값 없음');
    await page.screenshot({ path: path.join(outDir, '02-settings-routing-preset.png'), fullPage: true });
    await page.getByRole('button', { name: '추천 적용' }).click();
    await requireText(page, '초안 일치');
    await requireText(page, '추천 모델 배치를 설정 초안에 적용했습니다');
    await requireText(page, 'Planner / PM: claude-cli / sonnet-5', 'planner summary');
    await requireText(page, 'Reviewer / QA: openai-compatible / nvidia/nemotron-3-ultra-550b-a55b', 'reviewer summary');

    await page.goto(`${webBase}/company?companyId=${encodeURIComponent(companyId)}`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('AI 회사에 맡길 업무').fill(workRequest);
    await page.getByRole('button', { name: 'AI 팀에게 계획 요청' }).click();
    await page.getByText('추천 모델 배치', { exact: true }).waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: '이 계획으로 AI 회사에 맡기기' }).click();
    try {
      await page.waitForURL(/\/goals\?/, { timeout: 90000 });
    } catch (error) {
      await page.screenshot({ path: path.join(outDir, 'launch-timeout.png'), fullPage: true });
      fs.writeFileSync(path.join(outDir, 'launch-timeout.txt'), await page.locator('body').innerText());
      throw error;
    }
    await page.getByText('MODEL ROUTING PROVENANCE').waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(outDir, '03-goals-routing-provenance.png'), fullPage: true });
    await requireText(page, 'source company-plan-preview');
    await requireText(page, 'Launch-time AI engine settings');
    await requireText(page, 'planner:missing');
    await requireText(page, 'snapshot', 'model routing provenance snapshot text');

    const url = new URL(page.url());
    const goalId = url.searchParams.get('goalId');
    if (!goalId) throw new Error(`goalId missing after launch: ${page.url()}`);
    const snapshot = await api(`/api/companies/${encodeURIComponent(companyId)}/goals/${encodeURIComponent(goalId)}?actor=${encodeURIComponent(actorId)}`);
    if (!snapshot.modelRoutingRecommendation) throw new Error('goal snapshot missing modelRoutingRecommendation');
    if (snapshot.modelRoutingRecommendation.source !== 'company-plan-preview') throw new Error(`unexpected routing source: ${snapshot.modelRoutingRecommendation.source}`);
    if (!snapshot.provenance?.some((item) => String(item).startsWith('model-routing:'))) throw new Error('goal provenance missing model-routing hash');
    if (!snapshot.modelRoutingRecommendation.recommendation.settingsStatus?.length) throw new Error('goal snapshot missing launch-time settingsStatus');
    if (!snapshot.modelRoutingRecommendation.recommendation.settingsStatus.some((item) => item.role === 'planner' && item.status === 'missing')) throw new Error('goal snapshot missing planner launch-time settings status');
    const planner = snapshot.modelRoutingRecommendation.recommendation.recommendations.find((item) => item.role === 'planner');
    const reviewer = snapshot.modelRoutingRecommendation.recommendation.recommendations.find((item) => item.role === 'reviewer');
    if (planner?.recommendedTier !== 'high-reasoning') throw new Error(`unexpected planner tier: ${planner?.recommendedTier}`);
    if (reviewer?.recommendedTier !== 'high-verification') throw new Error(`unexpected reviewer tier: ${reviewer?.recommendedTier}`);

    const report = {
      generatedAt: new Date().toISOString(),
      companyId,
      goalId,
      routingSource: snapshot.modelRoutingRecommendation.source,
      recommendationHash: snapshot.modelRoutingRecommendation.recommendationHash,
      plannerTier: planner.recommendedTier,
      reviewerTier: reviewer.recommendedTier,
      errors,
    };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
