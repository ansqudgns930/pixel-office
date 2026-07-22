const apiBase = process.env.AGENT_COMPANY_API_BASE || 'http://127.0.0.1:4310';
const actorId = process.env.AGENT_COMPANY_QA_ACTOR || 'admin';
const username = process.env.AGENT_COMPANY_QA_USERNAME || 'admin';
const password = process.env.AGENT_COMPANY_QA_PASSWORD || 'textadmin';
const protectedStableCompanyIds = new Set([
  process.env.AGENT_COMPANY_MODEL_ROUTING_QA_COMPANY || 'model-routing-qa-workflow',
  process.env.AGENT_COMPANY_EMPLOYEE_QA_COMPANY || 'employee-workflow-qa-workflow',
  process.env.AGENT_COMPANY_FLOW_QA_COMPANY || 'delegated-work-flow-qa-workflow',
]);

const args = new Set(process.argv.slice(2));
const archive = args.has('--archive');
const includeStable = args.has('--include-stable');
const jsonOnly = args.has('--json');
let authToken = process.env.QA_TOKEN || '';

function isGeneratedQaCompany(company) {
  const id = String(company.id || '').toLowerCase();
  const name = String(company.name || '').toLowerCase();
  const text = `${id} ${name}`;
  return (
    text.includes('model-routing-qa') ||
    text.includes('model routing qa') ||
    text.includes('employee-workflow-qa') ||
    text.includes('employee workflow qa') ||
    text.includes('delegated-work-flow-qa') ||
    text.includes('employee-api-probe') ||
    text.includes('probe company') ||
    text.includes('ui-ux-review-company') ||
    text.includes('ui ux review company')
  );
}

function isProtectedStableCompany(company) {
  return protectedStableCompanyIds.has(String(company.id || ''));
}

async function ensureAuthToken() {
  if (authToken) return authToken;
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) throw new Error(`login failed for QA cleanup: ${response.status}`);
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

async function main() {
  await ensureAuthToken();
  const companies = await api(`/api/companies?actor=${encodeURIComponent(actorId)}`);
  const candidates = companies
    .filter((company) => isGeneratedQaCompany(company))
    .filter((company) => includeStable || !isProtectedStableCompany(company));

  const results = [];
  for (const company of candidates) {
    const impactResponse = await api(`/api/companies/${encodeURIComponent(company.id)}/deletion-request?actor=${encodeURIComponent(actorId)}`);
    const impact = impactResponse.impact || {};
    const blocked = Array.isArray(impact.blockers) && impact.blockers.length > 0;
    const entry = {
      id: company.id,
      name: company.name,
      status: company.status,
      projectCount: company.projectCount,
      impact,
      action: 'dry-run',
      skipped: false,
      error: null,
    };
    if (company.status === 'archived') {
      entry.action = 'already-archived';
      entry.skipped = true;
    } else if (blocked) {
      entry.action = 'blocked';
      entry.skipped = true;
    } else if (archive) {
      try {
        await api(`/api/companies/${encodeURIComponent(company.id)}/actions/archive`, {
          method: 'POST',
          body: JSON.stringify({ actorId }),
        });
        entry.action = 'archived';
      } catch (error) {
        entry.action = 'archive-failed';
        entry.skipped = true;
        entry.error = error instanceof Error ? error.message : String(error);
      }
    }
    results.push(entry);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: archive ? 'archive' : 'dry-run',
    actorId,
    protectedStableCompanyIds: includeStable ? [] : Array.from(protectedStableCompanyIds),
    scanned: companies.length,
    candidates: candidates.length,
    archived: results.filter((item) => item.action === 'archived').length,
    blocked: results.filter((item) => item.action === 'blocked').length,
    alreadyArchived: results.filter((item) => item.action === 'already-archived').length,
    results,
  };
  if (!jsonOnly && !archive) {
    console.error('Dry run only. Re-run with --archive to archive unblocked generated QA companies. Stable generated QA companies are protected unless --include-stable is set.');
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { isGeneratedQaCompany, isProtectedStableCompany };
