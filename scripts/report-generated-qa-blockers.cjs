const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(process.cwd(), '.runtime', 'qa-company-hygiene');
const cleanupScript = path.join(process.cwd(), 'scripts', 'cleanup-generated-qa-companies.cjs');
fs.mkdirSync(outDir, { recursive: true });

function parseCleanupDryRun() {
  const result = spawnSync(process.execPath, [cleanupScript, '--json'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `cleanup dry-run failed with status ${result.status}`);
  }
  const text = result.stdout.trim();
  const start = text.indexOf('{');
  if (start < 0) throw new Error('cleanup dry-run did not emit JSON');
  return JSON.parse(text.slice(start));
}

function familyOf(id = '') {
  if (id.startsWith('model-routing-qa-')) return 'model-routing';
  if (id.startsWith('employee-workflow-qa-')) return 'employee-workflow';
  if (id.startsWith('delegated-work-flow-qa-')) return 'delegated-work-flow';
  if (id.startsWith('employee-api-probe-')) return 'employee-api-probe';
  if (id.includes('ui-ux-review')) return 'ui-ux-review';
  return 'other-generated-qa';
}

function blockerKind(blocker = '') {
  if (/active Run/i.test(blocker)) return 'active-runs';
  if (/pending approval/i.test(blocker)) return 'pending-approvals';
  if (/draft meeting summary/i.test(blocker)) return 'draft-meeting-summaries';
  if (/active meeting/i.test(blocker)) return 'active-meetings';
  return 'other';
}

function summarize(cleanup) {
  const blocked = cleanup.results.filter((item) => item.action === 'blocked');
  const alreadyArchived = cleanup.results.filter((item) => item.action === 'already-archived');
  const families = new Map();
  const blockerKinds = new Map();
  for (const item of blocked) {
    const family = familyOf(String(item.id));
    const existing = families.get(family) || { family, companies: 0, blockers: {}, examples: [] };
    existing.companies += 1;
    if (existing.examples.length < 5) existing.examples.push({ id: item.id, blockers: item.impact?.blockers || [] });
    for (const blocker of item.impact?.blockers || []) {
      const kind = blockerKind(blocker);
      existing.blockers[kind] = (existing.blockers[kind] || 0) + 1;
      blockerKinds.set(kind, (blockerKinds.get(kind) || 0) + 1);
    }
    families.set(family, existing);
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: cleanup.generatedAt,
    protectedStableCompanyIds: cleanup.protectedStableCompanyIds,
    scanned: cleanup.scanned,
    candidates: cleanup.candidates,
    blocked: blocked.length,
    alreadyArchived: alreadyArchived.length,
    blockerKinds: Object.fromEntries([...blockerKinds.entries()].sort()),
    families: [...families.values()].sort((a, b) => b.companies - a.companies || a.family.localeCompare(b.family)),
    recommendedPolicy: [
      'Do not force-archive blocked generated QA companies automatically.',
      'Resolve or cancel active Runs only through normal Run lifecycle controls.',
      'Resolve pending approvals through the review/approval surfaces or an explicit QA-only lifecycle command.',
      'Confirm or supersede draft meeting summaries before archive.',
      'After blockers are resolved, rerun qa-companies:archive to archive newly unblocked generated QA companies.',
    ],
  };
}

function markdown(report) {
  const lines = [];
  lines.push('# Generated QA Company Blocker Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Scanned companies: ${report.scanned}`);
  lines.push(`- Generated QA candidates: ${report.candidates}`);
  lines.push(`- Blocked companies: ${report.blocked}`);
  lines.push(`- Already archived: ${report.alreadyArchived}`);
  lines.push(`- Protected stable companies: ${report.protectedStableCompanyIds.join(', ')}`);
  lines.push('');
  lines.push('## Blocker kinds');
  for (const [kind, count] of Object.entries(report.blockerKinds)) lines.push(`- ${kind}: ${count}`);
  lines.push('');
  lines.push('## Families');
  for (const family of report.families) {
    lines.push(`- ${family.family}: ${family.companies} blocked compan${family.companies === 1 ? 'y' : 'ies'}`);
    const blockers = Object.entries(family.blockers).map(([kind, count]) => `${kind}=${count}`).join(', ');
    if (blockers) lines.push(`  - blockers: ${blockers}`);
    for (const example of family.examples) lines.push(`  - example: ${example.id} (${example.blockers.join('; ')})`);
  }
  lines.push('');
  lines.push('## Recommended policy');
  for (const item of report.recommendedPolicy) lines.push(`- ${item}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const cleanup = parseCleanupDryRun();
  const report = summarize(cleanup);
  const jsonPath = path.join(outDir, 'blocked-generated-qa-companies.json');
  const mdPath = path.join(outDir, 'blocked-generated-qa-companies.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown(report));
  console.log(JSON.stringify({ jsonPath, mdPath, blocked: report.blocked, alreadyArchived: report.alreadyArchived, blockerKinds: report.blockerKinds }, null, 2));
}

if (require.main === module) main();
module.exports = { familyOf, blockerKind, summarize, markdown };
