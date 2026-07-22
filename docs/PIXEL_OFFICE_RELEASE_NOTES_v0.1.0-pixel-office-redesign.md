# Pixel Office v0.1.0 — Delegated-work AI Company UI Redesign

Release tag: `v0.1.0-pixel-office-redesign`  
Tag target: `e269531 test web close employee workflow live qa`

## Summary

Pixel Office has been redesigned from an agent/admin console into a delegated-work AI company operation UI.

The primary product flow is now:

1. Choose or create a company.
2. Describe the work to delegate.
3. Review the AI company's proposed plan, team, risk, safety rails, and completion criteria.
4. Commit the plan to the AI company.
5. Watch progress in Pixel Office Live View.
6. Handle only important owner decisions.
7. Review result evidence, activity, and next recommended work.

## Highlights

### Delegated-work user journey

- Reframed navigation around user intent:
  - `내 회사`
  - `회사 홈 · 업무 맡기기`
  - `맡긴 일`
  - `결정 필요`
  - `결과·활동`
  - `픽셀 오피스 · Live View`
  - `직원·AI팀`
- Added plan preview before execution, including:
  - proposed title and description
  - assigned AI team
  - execution steps
  - completion criteria
  - expected owner intervention
  - safety rails
- Strengthened the commit gate so users understand what happens when they delegate work.

### Pixel Office Live View

- Repositioned Pixel Office as a live progress view, not the workflow entry point.
- Added room/phase interpretation for planning, development, QA/review, and approval.
- Added visible progress signals for:
  - current phase
  - active work count
  - decision queue
  - current run/task
  - next signal
  - recent event strip
- Improved density and reduced empty canvas feel.

### Employee and AI hiring workflow

- Added AI employee draft generation from natural language.
- Added structured employee profile/job-description UI:
  - responsibilities
  - work style
  - deliverable format
  - success criteria
  - allowed actions
  - approval-required actions
  - forbidden actions
  - internal role mapping
  - prompt profile preview
- Added employee activation/persistence.
- Added custom employee staffing recommendations for delegated work.
- Added goal-launch employee profile snapshots/provenance so later profile edits do not alter historical evidence.
- Clarified that users do not need to hire employees before delegating work; the core team handles normal tasks first.

### Trust, safety, and security hardening

- Removed hardcoded token material from the current tree and rewrote local history before release tagging.
- Added secret scans for tracked files and git history.
- Hardened employee drafting so model output is treated as untrusted:
  - unsafe `allowedActions` are stripped
  - unsafe `promptProfile.systemAddendum` is stripped
  - unsafe `promptProfile.taskInstructions` are stripped
  - approval-required and forbidden-action framing is preserved
- Added browser-level prompt-injection QA for employee hiring UI.
- Added fallback summary sanitization so injection text does not appear in employee draft previews or persisted profiles.

## Validation

Release tag validation at `e269531` included:

- `npm run employee-workflow:browser-qa`
- `npm run delegated-work:browser-qa`
- `node scripts/pixel-office-redesign-visualqa.cjs`

Post-release hardening and polish on `main` additionally validated:

- `npm run typecheck`
- `npm run build`
- `npm --prefix apps/web run build`
- `node --test dist/tests/company-options.test.js`
- `node --test dist/tests/employee-workflow-api.test.js`
- `node --test dist/tests/employee-drafting-security.test.js`
- `npm run employee-workflow:browser-qa`
- `npm run employee-prompt-injection:browser-qa`
- tracked secret scan: `[]`
- git history secret scan: `[]`

## Notable post-tag improvements on `main`

The release tag remains fixed at `e269531`. The `main` branch has continued hardening and UX polish after the tag:

- `a7fc0a8` — employee draft prompt-injection hardening
- `39af130` — delegated-work detail and launch transition polish
- `33d00c1` — decision/activity dark theme alignment
- `c2aa045` — generated QA company hiding
- `2fb238a` — Company Home primary flow simplification
- `ff67140` — Pixel Office Live View density improvement
- `c620fb4` — employee hiring CTA/product framing
- `967dcc2` — employee prompt-injection browser QA and summary sanitization

## Known operational follow-up

Credentials that were previously exposed outside the repo should still be rotated or revoked externally, even though the repository tree and scanned history are clean:

- GitHub PAT
- NVIDIA API key
- Control Plane API token
- Discord bot token

## Suggested GitHub release body

```markdown
Pixel Office v0.1.0 redesigns Agent Company OS from an agent/admin console into a delegated-work AI company operation UI.

Highlights:
- Company Home now supports 업무 맡기기 → AI plan preview → explicit commit gate.
- 맡긴 일, 결정 필요, 결과·활동, and Pixel Office Live View are reframed around delegated work.
- Pixel Office is now a live progress view with phase, room, run, decision, and recent-signal summaries.
- 직원·AI팀 now supports natural-language AI employee drafting, activation, staffing recommendation, and profile provenance snapshots.
- Employee prompt/profile generation is hardened against unsafe model output and prompt-injection leakage.

Validated with browser QA for delegated work, employee workflow, visual QA, and employee prompt-injection flow.

Security note: repository scans are clean, but any credentials previously exposed outside the repository should still be rotated externally.
```
