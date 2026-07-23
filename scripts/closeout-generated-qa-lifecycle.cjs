const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
const username = process.env.AGENT_COMPANY_QA_USERNAME || 'admin';
const password = process.env.AGENT_COMPANY_QA_PASSWORD || 'textadmin';
const outDir = path.join(process.cwd(), '.runtime', 'qa-company-hygiene');
const cleanupScript = path.join(process.cwd(), 'scripts', 'cleanup-generated-qa-companies.cjs');
const { familyOf } = require('./report-generated-qa-blockers.cjs');

const protectedStableCompanyIds = new Set([
  process.env.AGENT_COMPANY_MODEL_ROUTING_QA_COMPANY || 'model-routing-qa-workflow',
  process.env.AGENT_COMPANY_EMPLOYEE_QA_COMPANY || 'employee-workflow-qa-workflow',
  process.env.AGENT_COMPANY_FLOW_QA_COMPANY || 'delegated-work-flow-qa-workflow',
]);
const terminalRunStatuses = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const expectedBlockerPatterns = [/active Run\(s\)/i, /pending approval\(s\)/i, /draft meeting summary\(s\)/i];

function parseArgs(argv = process.argv.slice(2)) {
  const args = { execute: false, archiveAfter: false, includeStable: false, confirm: '', families: new Set(), companyIds: new Set(), help: false };
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--archive-after') args.archiveAfter = true;
    else if (arg === '--include-stable') args.includeStable = true;
    else if (arg.startsWith('--confirm=')) args.confirm = arg.slice('--confirm='.length);
    else if (arg.startsWith('--family=')) args.families.add(arg.slice('--family='.length));
    else if (arg.startsWith('--company-id=')) args.companyIds.add(arg.slice('--company-id='.length));
    else if (arg === '--help') args.help = true;
    else throw new Error('Unknown argument: ' + arg);
  }
  return args;
}

function helpText() {
  return [
    'Usage: node scripts/closeout-generated-qa-lifecycle.cjs [--family=name|--company-id=id] [--execute --confirm=generated-qa-lifecycle-closeout] [--archive-after]',
    '',
    'Default is dry-run only. Execute requires --execute, --confirm=generated-qa-lifecycle-closeout, and at least one --family or --company-id allowlist.',
    'Stable QA companies are excluded unless --include-stable is set and their ids are explicitly allowlisted.',
  ].join('\n');
}

function parseCleanupDryRun() {
  const result = spawnSync(process.execPath, [cleanupScript, '--json'], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'cleanup dry-run failed with status ' + result.status);
  const start = result.stdout.indexOf('{');
  if (start < 0) throw new Error('cleanup dry-run did not emit JSON');
  return JSON.parse(result.stdout.slice(start));
}

function unexpectedBlockers(blockers = []) {
  return blockers.filter((blocker) => !expectedBlockerPatterns.some((pattern) => pattern.test(String(blocker))));
}

function selectCandidates(cleanup, args) {
  return cleanup.results
    .filter((item) => item.action === 'blocked')
    .filter((item) => {
      const id = String(item.id || '');
      const family = familyOf(id);
      if (!args.includeStable && protectedStableCompanyIds.has(id)) return false;
      if (args.companyIds.size > 0 && args.companyIds.has(id)) return true;
      if (args.families.size > 0 && args.families.has(family)) return true;
      return args.companyIds.size === 0 && args.families.size === 0;
    })
    .map((item) => ({ ...item, family: familyOf(String(item.id || '')), unexpectedBlockers: unexpectedBlockers(item.impact?.blockers || []) }));
}

function assertExecuteAllowed(args, candidates) {
  if (!args.execute) return;
  if (args.confirm !== 'generated-qa-lifecycle-closeout') throw new Error('execute requires --confirm=generated-qa-lifecycle-closeout');
  if (args.companyIds.size === 0 && args.families.size === 0) throw new Error('execute requires at least one --family or --company-id allowlist');
  for (const candidate of candidates) {
    if (candidate.unexpectedBlockers.length) throw new Error('unexpected blocker for ' + candidate.id + ': ' + candidate.unexpectedBlockers.join('; '));
    if (protectedStableCompanyIds.has(String(candidate.id)) && (!args.includeStable || !args.companyIds.has(String(candidate.id)))) {
      throw new Error('stable QA company requires --include-stable and explicit --company-id: ' + candidate.id);
    }
  }
}

let authToken = process.env.QA_TOKEN || '';
async function ensureAuthToken() {
  if (authToken) return authToken;
  const response = await fetch(apiBase + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) throw new Error('login failed for QA lifecycle closeout: ' + response.status);
  authToken = body.token;
  return authToken;
}

async function api(pathname, options = {}) {
  await ensureAuthToken();
  const response = await fetch(apiBase + pathname, { ...options, headers: { authorization: 'Bearer ' + authToken, 'content-type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(response.status + ' ' + pathname + ': ' + JSON.stringify(body));
  return body;
}

function unique(values) { return [...new Set(values.filter(Boolean).map(String))]; }

async function planCompany(candidate) {
  const companyId = String(candidate.id);
  const snapshot = await api('/api/companies/' + encodeURIComponent(companyId) + '?actor=' + encodeURIComponent(actorId));
  const meetingSessions = Array.isArray(snapshot.meetingSessions) ? snapshot.meetingSessions : [];
  const runIds = unique(meetingSessions.map((meeting) => meeting.runId));
  const meetingIds = unique(meetingSessions.map((meeting) => meeting.id));
  const runs = [];
  for (const runId of runIds) {
    const detail = await api('/api/runs/' + encodeURIComponent(runId) + '?actor=' + encodeURIComponent(actorId));
    runs.push({ id: runId, status: detail.run?.status || 'missing', approvals: (detail.approvals || []).map((approval) => ({ id: approval.id, kind: approval.kind, status: approval.status })) });
  }
  return {
    id: companyId,
    name: candidate.name,
    family: candidate.family,
    blockers: candidate.impact?.blockers || [],
    runActions: runs.filter((run) => !terminalRunStatuses.has(run.status)).map((run) => ({ runId: run.id, action: 'cancel-run', currentStatus: run.status, pendingApprovals: run.approvals.filter((approval) => approval.status === 'PENDING').length })),
    meetingActions: meetingIds.map((meetingId) => ({ meetingId, action: 'confirm-draft-summary-if-present' })),
  };
}

async function executeCompany(plan, args) {
  const actions = [];
  for (const run of plan.runActions) {
    await api('/api/runs/' + encodeURIComponent(run.runId) + '/actions/cancel', { method: 'POST', body: JSON.stringify({ userId: actorId }) });
    actions.push({ ...run, executed: true });
  }
  for (const meeting of plan.meetingActions) {
    try {
      await api('/api/companies/' + encodeURIComponent(plan.id) + '/meetings/' + encodeURIComponent(meeting.meetingId) + '/summary/confirm', { method: 'POST', body: JSON.stringify({ actorId }) });
      actions.push({ ...meeting, executed: true });
    } catch (error) {
      actions.push({ ...meeting, executed: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const afterImpact = await api('/api/companies/' + encodeURIComponent(plan.id) + '/deletion-request?actor=' + encodeURIComponent(actorId));
  let archived = false;
  if (args.archiveAfter && Array.isArray(afterImpact.impact?.blockers) && afterImpact.impact.blockers.length === 0) {
    await api('/api/companies/' + encodeURIComponent(plan.id) + '/actions/archive', { method: 'POST', body: JSON.stringify({ actorId }) });
    archived = true;
  }
  return { companyId: plan.id, actions, afterBlockers: afterImpact.impact?.blockers || [], archived };
}

async function buildRun(args) {
  fs.mkdirSync(outDir, { recursive: true });
  const cleanupBefore = parseCleanupDryRun();
  const candidates = selectCandidates(cleanupBefore, args);
  assertExecuteAllowed(args, candidates);
  const plans = [];
  for (const candidate of candidates) plans.push(await planCompany(candidate));
  const run = {
    generatedAt: new Date().toISOString(),
    mode: args.execute ? 'execute' : 'dry-run',
    archiveAfter: args.archiveAfter,
    actorId,
    allowlist: { families: [...args.families], companyIds: [...args.companyIds] },
    protectedStableCompanyIds: args.includeStable ? [] : [...protectedStableCompanyIds],
    selectedCompanies: plans.length,
    plans,
    executed: [],
  };
  const beforePath = path.join(outDir, 'generated-qa-lifecycle-closeout-before.json');
  fs.writeFileSync(beforePath, JSON.stringify(run, null, 2));
  if (args.execute) {
    for (const plan of plans) run.executed.push(await executeCompany(plan, args));
    run.completedAt = new Date().toISOString();
    run.cleanupAfter = parseCleanupDryRun();
  }
  const outPath = path.join(outDir, args.execute ? 'generated-qa-lifecycle-closeout-executed.json' : 'generated-qa-lifecycle-closeout-dry-run.json');
  fs.writeFileSync(outPath, JSON.stringify(run, null, 2));
  return { outPath, beforePath, selectedCompanies: run.selectedCompanies, mode: run.mode, archiveAfter: run.archiveAfter, executedCompanies: run.executed.length };
}

async function main() {
  const args = parseArgs();
  if (args.help) { console.log(helpText()); return; }
  const result = await buildRun(args);
  if (!args.execute) console.error('Dry run only. Add --execute --confirm=generated-qa-lifecycle-closeout plus --family or --company-id to execute lifecycle closeout. Add --archive-after only when archive is explicitly approved.');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
module.exports = { parseArgs, selectCandidates, unexpectedBlockers, assertExecuteAllowed, helpText };
