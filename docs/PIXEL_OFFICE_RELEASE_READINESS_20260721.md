# Pixel Office Release Readiness — 2026-07-21

## Status

The delegated-work Pixel Office redesign is implemented and validated. UX-P7 live QA closeout is committed locally and awaiting GitHub authentication for push.

Latest workstream highlights:

- Company Home first-run onboarding and plan preview commit gate.
- GoalsPage delegated-work status hub, post-launch guidance, and completion reward loop.
- Sidebar grouped by `업무 흐름`, `운영·관리`, and `고급`.
- Direct browser UX fixes for title wrapping, internal fallback copy, stale labels, test-company selector noise, and Pixel Office live-density.
- Git-tracked secret cleanup and history rewrite completed separately.

## Validation passed

```powershell
npm --prefix apps/web run build
npm run delegated-work:browser-qa
node scripts/pixel-office-redesign-visualqa.cjs
```

## Cleanup classification

### Archived outside repo

Release/QA generated artifacts were moved to an OpenClaw workspace archive when not locked by running processes:

- ad-hoc screenshots
- visual QA outputs
- previous runtime output directories
- temporary load script

Locked runtime files were left in place but are ignored:

- `.runtime/`
- `.qa-*.log`
- `runtime/`
- `outputs/`
- `*.png`
- `*.log`

### Preserved in repo

`tests/` and `fixtures/` are source-like validation assets, not disposable runtime artifacts. They are included for release reproducibility.

## Remaining release checklist

- Push local UX-P7 closeout commit to GitHub main once authentication is available.
- Confirm whether to create a release tag such as `v0.1.0-pixel-office-redesign`.
- Rotate any previously exposed local/provider credentials outside this repo.
