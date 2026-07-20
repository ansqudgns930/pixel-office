# Milestone 0 Runtime Baseline Completion Audit

> 검증일: 2026-07-16  
> 환경: Windows, Node 24.17.0, npm 11.13.0

## 판정

지원 runtime 고정과 재현 가능한 녹색 기준선을 완료했다.

## Runtime 계약

- `package.json#engines`: Node `>=24.17.0 <25`, npm `>=11.13.0 <12`
- `.node-version`: `24.17.0`
- `.npmrc`: `engine-strict=true`
- `npm run runtime:check`: 실제 executable, Node version, `DatabaseSync`, online backup capability 검증
- 이 PC portable runtime: `.tools/node-v24.17.0-win-x64`
- 공식 archive SHA-256: `f2aa33b35b75aca5f3f7b85675a6f6423201053e9381911e64961f3bda2528ab`

## 브라우저 회귀 복구

- 개인 Codex skill 경로 의존을 제거했다.
- `playwright-core@1.61.1`을 저장소 devDependency로 고정했다.
- `BROWSER_AUTOMATION_EXECUTABLE` 또는 설치된 Chrome/Edge를 결정적으로 선택한다.

## 검증 결과

```powershell
$env:PATH=(Resolve-Path '.tools\node-v24.17.0-win-x64').Path + ';' + $env:PATH
npm ci
npm run verify
```

- 결과: PASS
- runtime: Node 24.17.0, DatabaseSync=true, onlineBackup=true
- 브라우저 QA: 59.9 FPS, 30 staff, 5 active work, 500 events, 55 aria labels, mobile overflow 0
- production preflight는 Node 22.14.0과 missing SQLite backup capability를 거부한다.

## 잔여 운영 경계

특정 production 장비의 Redis·선택 Backend·실제 자격증명·backup rehearsal 증적은 각 후속 Milestone의 운영 rehearsal에서 별도로 남긴다.
