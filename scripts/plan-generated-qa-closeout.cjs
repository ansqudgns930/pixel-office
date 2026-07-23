const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(process.cwd(), '.runtime', 'qa-company-hygiene');
const blockersReportScript = path.join(process.cwd(), 'scripts', 'report-generated-qa-blockers.cjs');
fs.mkdirSync(outDir, { recursive: true });

function readBlockerReport() {
  const result = spawnSync(process.execPath, [blockersReportScript], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `blocker report failed with status ${result.status}`);
  const reportPath = path.join(outDir, 'blocked-generated-qa-companies.json');
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function riskLevel(family) {
  if (family.family === 'ui-ux-review') return 'manual-review-required';
  if (family.companies >= 20) return 'batch-qa-closeout-candidate';
  return 'small-batch-qa-closeout-candidate';
}

function actionPlanForFamily(family) {
  return {
    family: family.family,
    blockedCompanies: family.companies,
    riskLevel: riskLevel(family),
    blockers: family.blockers,
    sampleCompanies: family.examples.map((item) => item.id),
    planOnly: true,
    requiredCloseoutOrder: [
      'Verify company id matches generated QA/test naming and is not one of the protected stable QA companies.',
      'Cancel or otherwise terminally resolve the active QA Run through normal Run lifecycle controls.',
      'Resolve pending approval records through approval/review lifecycle or a future explicit QA-only closeout command.',
      'Confirm, supersede, or otherwise terminally resolve draft meeting summaries through meeting lifecycle.',
      'Run qa-companies:cleanup to confirm blockers are gone.',
      'Run qa-companies:archive to archive newly unblocked generated QA companies.',
    ],
  };
}

function buildPlan(report) {
  const families = report.families.map(actionPlanForFamily);
  return {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: report.generatedAt,
    objective: 'Close out blocked generated QA companies without force-archiving active lifecycle state.',
    mode: 'plan-only',
    destructiveActionsExecuted: false,
    protectedStableCompanyIds: report.protectedStableCompanyIds,
    summary: {
      scanned: report.scanned,
      generatedQaCandidates: report.candidates,
      blocked: report.blocked,
      alreadyArchived: report.alreadyArchived,
      blockerKinds: report.blockerKinds,
    },
    families,
    recommendedNextImplementation: {
      name: 'qa-only lifecycle closeout command',
      guardrails: [
        'Default dry-run; require --execute plus a generated QA family or explicit company id allowlist.',
        'Never include protected stable QA companies unless --include-stable and explicit ids are both provided.',
        'Only operate on companies whose ids/names match generated QA detection.',
        'Stop if any company has non-QA-looking name, human-owned production naming, or unexpected blocker type.',
        'Write before/after cleanup snapshots to .runtime/qa-company-hygiene/.',
      ],
      requiredRuntimeCapability: [
        'Run cancellation or terminal closeout API for QA runs',
        'Approval terminal-resolution API for QA-only pending approvals',
        'Meeting summary confirm/supersede API for QA-only draft summaries',
      ],
    },
  };
}

function markdown(plan) {
  const lines = [];
  lines.push('# Generated QA Lifecycle Closeout Plan');
  lines.push('');
  lines.push(`- Generated at: ${plan.generatedAt}`);
  lines.push(`- Mode: ${plan.mode}`);
  lines.push(`- Destructive actions executed: ${plan.destructiveActionsExecuted}`);
  lines.push(`- Objective: ${plan.objective}`);
  lines.push(`- Protected stable companies: ${plan.protectedStableCompanyIds.join(', ')}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Scanned: ${plan.summary.scanned}`);
  lines.push(`- Generated QA candidates: ${plan.summary.generatedQaCandidates}`);
  lines.push(`- Blocked: ${plan.summary.blocked}`);
  lines.push(`- Already archived: ${plan.summary.alreadyArchived}`);
  for (const [kind, count] of Object.entries(plan.summary.blockerKinds)) lines.push(`- ${kind}: ${count}`);
  lines.push('');
  lines.push('## Family plans');
  for (const family of plan.families) {
    lines.push(`### ${family.family}`);
    lines.push(`- Blocked companies: ${family.blockedCompanies}`);
    lines.push(`- Risk level: ${family.riskLevel}`);
    lines.push(`- Sample companies: ${family.sampleCompanies.join(', ')}`);
    lines.push('- Required closeout order:');
    for (const step of family.requiredCloseoutOrder) lines.push(`  - ${step}`);
    lines.push('');
  }
  lines.push('## Recommended next implementation');
  lines.push(`- ${plan.recommendedNextImplementation.name}`);
  lines.push('- Guardrails:');
  for (const item of plan.recommendedNextImplementation.guardrails) lines.push(`  - ${item}`);
  lines.push('- Required runtime capability:');
  for (const item of plan.recommendedNextImplementation.requiredRuntimeCapability) lines.push(`  - ${item}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const report = readBlockerReport();
  const plan = buildPlan(report);
  const jsonPath = path.join(outDir, 'generated-qa-lifecycle-closeout-plan.json');
  const mdPath = path.join(outDir, 'generated-qa-lifecycle-closeout-plan.md');
  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2));
  fs.writeFileSync(mdPath, markdown(plan));
  console.log(JSON.stringify({ jsonPath, mdPath, mode: plan.mode, blocked: plan.summary.blocked, destructiveActionsExecuted: plan.destructiveActionsExecuted }, null, 2));
}

if (require.main === module) main();
module.exports = { buildPlan, markdown, riskLevel, actionPlanForFamily };
