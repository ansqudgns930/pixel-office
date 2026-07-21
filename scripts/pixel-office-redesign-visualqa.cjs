const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const webBase = 'http://127.0.0.1:5173';
const companyId = 'demo-company';
const outDir = 'C:/Project/paperclip/multi-agent/agent-company-os/.runtime/visualqa/pixel-office-redesign';
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const browserPath = process.env.BROWSER_AUTOMATION_EXECUTABLE;
  const token = process.env.QA_TOKEN;
  if (!browserPath || !token) throw new Error('BROWSER_AUTOMATION_EXECUTABLE and QA_TOKEN required');
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(`pageerror:${err.message}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });
  await page.goto(`${webBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token }) => {
    localStorage.setItem('agent-company-os.apiToken', token);
    localStorage.setItem('agent-company-os.actorId', 'admin');
    localStorage.setItem('agent-company-os.username', 'admin');
    localStorage.setItem('agent-company-os.role', 'admin');
    localStorage.setItem('agent-company-os.lastCompany', 'demo-company');
  }, { token });

  const checks = [
    { name: 'company-home', url: `/company?companyId=${companyId}`, required: ['무슨 일을 AI 회사에 맡길까요?', 'AI 팀에게 계획 요청', '결정 필요'] },
    { name: 'staff-team', url: `/employees?companyId=${companyId}`, required: ['직원·AI팀', '고정 핵심팀', 'CEO', 'PM', 'Designer', 'Developer', 'QA', '외부 전문가 대기실'] },
    { name: 'delegated-work-goals', url: `/goals?companyId=${companyId}`, required: ['맡긴 일', '업무를 맡긴 뒤에는 여기서 진행 상태를 봅니다', '업무 목록', '진행 단계', '다음 액션'] },
    { name: 'decision-inbox', url: `/reviews?companyId=${companyId}`, required: ['결정 필요', '지금 결정 필요', '운영 원칙'] },
    { name: 'activity-results', url: `/activity?companyId=${companyId}&goalId=demo-company-goal`, required: ['결과·활동', '선택한 맡긴 일의 결과와 활동을 보는 중입니다', '활동 신호', '결과 보고', '근거 검색'] },
    { name: 'work-review-meetings', url: `/meetings?companyId=${companyId}&goalId=demo-company-goal`, required: ['업무 검토 회의', '선택한 맡긴 일의 검토 회의를 보는 중입니다', '진행 검토', '결정 정리', '후속 Task'] },
    { name: 'execution-workroom', url: `/projects?companyId=${companyId}&projectId=demo-first-delivery&goalId=demo-company-goal`, required: ['실행 작업실', '선택한 맡긴 일의 실행 작업실입니다', 'Task 분해', '담당 배정', '검증 설정'] },
    { name: 'advanced-execution', url: `/execution?companyId=${companyId}&projectId=demo-first-delivery&taskId=demo-first-delivery-task&goalId=demo-company-goal`, required: ['고급 실행', '선택한 Task/Run의 고급 실행·증거 확인 화면입니다', '계획·결과 승인', '검증·Diff 근거', '고급 Run 직접 생성'] },
    { name: 'operations-health', url: `/operations?companyId=${companyId}`, required: ['운영 건강도', '업무 운영에 문제가 생기면 여기서 먼저 확인합니다', '서비스 건강도', '작업 대기열', '업무 신호'] },
    { name: 'pixel-live-view', url: `/pixel-office?companyId=${companyId}`, required: ['진행 상황 Live View', '새 업무 맡기기', '결정 필요 처리', '직원·AI팀 보기'] },
    { name: 'pixel-goal-focus', url: `/pixel-office?companyId=${companyId}&goalId=demo-company-goal`, required: ['선택 목표 추적 중', '목표 상세', '결정 필요', '결과·활동', '진행 업무'] },
    { name: 'backend-settings', url: `/settings/backend?companyId=${companyId}`, required: ['설정 · AI 엔진', '회사 기본 AI 엔진', 'Planner / PM', 'Worker / Developer', 'Reviewer / QA', '저장 전 요약', 'Live Run snapshot 검증'] },
  ];
  const results = [];
  for (const item of checks) {
    await page.goto(webBase + item.url, { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor();
    await page.waitForTimeout(800);
    const text = await page.locator('body').innerText();
    const lowerText = text.toLowerCase();
    const missing = item.required.filter(term => !lowerText.includes(term.toLowerCase()));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const screenshot = path.join(outDir, `${item.name}-desktop.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ ...item, viewport: '1440x1000', missing, overflow, screenshot });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileChecks = ['company-home', 'backend-settings'];
  for (const item of checks.filter(x => mobileChecks.includes(x.name))) {
    await page.goto(webBase + item.url, { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor();
    await page.waitForTimeout(800);
    const text = await page.locator('body').innerText();
    const lowerText = text.toLowerCase();
    const missing = item.required.filter(term => !lowerText.includes(term.toLowerCase()));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const screenshot = path.join(outDir, `${item.name}-mobile.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ ...item, viewport: '390x844', missing, overflow, screenshot });
  }

  const report = { generatedAt: new Date().toISOString(), webBase, companyId, results, errors };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || results.some(r => r.missing.length || r.overflow)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exit(1); });
