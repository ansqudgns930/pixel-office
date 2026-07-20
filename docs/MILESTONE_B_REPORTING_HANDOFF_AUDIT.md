# Milestone B 결정론적 보고·위임·인계 완료 감사

> 검증일: 2026-07-16 (Asia/Seoul)  
> 환경: Windows 로컬 운영 검증, Node 24.17.0 portable, `node:sqlite` online backup 사용  
> 판정: **자동 구현·회귀·브라우저·backup/restore 게이트 통과**

## 납품 범위

- `ReportingProjector`가 `events_v6`를 cursor 순서로 재생해 상태·완료·차단·결정 필요·근거·다음 조치를 가진 `deterministic-report-v1` 보고를 생성한다.
- 보고선은 source 담당자의 부서부터 parent chain을 cycle-safe하게 탐색하고, 같은 단계는 `principalId` 오름차순으로 고정한다. 이후 executive, owner 순서로 fallback한다.
- dedupe key는 `sourceEventId + reportType + recipientId + contractVersion`이며 projector version 변경 시 전체 replay한다.
- 수신 불가 보고는 `unroutable`로 남고 owner의 구성 필요 알림에 노출된다. 전달·열람·확인·escalation은 회사 감사 이벤트로 남는다.
- Activity 보고함에서 미확인/결정 필요 보고, evidence IDs, 다음 조치, 읽음·확인·상위 보고를 소비한다.
- 타 부서 위임은 `delegation-handoff-v1` snapshot으로 단일 owner, 담당자, 완료 기준, 허용 scope, provenance가 있는 `untrusted-evidence`, deadline을 고정한다.
- 대상 부서 `department-manager`만 승인·거절·재할당한다. 승인, 거절, 재할당, 시작, 부분 완료, 완료, 만료, 인계 실패가 별도 상태와 전이 감사로 남는다.
- 완료는 snapshot된 모든 완료 기준과 하나 이상의 completion evidence ID가 있어야 한다. requestId 재처리는 같은 인계를 반환한다.

## 주요 코드

- `packages/reporting/src/index.ts`: report projector, routing, replay, read/ack/escalation
- `packages/delegation/src/index.ts`: delegation/handoff snapshot과 상태 머신
- `apps/control-plane/src/index.ts`: 보고·rebuild·위임 생성/검토/실행 API
- `apps/web/src/pages/ActivityPage.tsx`: 보고함과 위임·인계 소비 UI
- `packages/company-ops/src/index.ts`: unroutable owner 알림
- `tests/reporting*.test.ts`, `tests/delegation*.test.ts`: projector, API, tenant/RBAC, 상태 전이
- `tests/milestone-b-recovery.test.ts`: 파일 DB backup/restore와 replay dedupe
- `tests/browser/milestone-b-reports.cjs`: 실제 Chromium 보고 확인·인계 시작·모바일 QA

## 검증 증적

### 집중 게이트

- 보고·API·위임·API 10개 테스트: PASS
- 파일 기반 SQLite backup/manifest 검증 → 별도 경로 restore → projector 재시작: PASS
- restore 후 `source_event_id='failure'` 보고 수 1, 동일 report ID, 동일 handoff snapshot hash, 동일 requestId 재생성 수 0: PASS
- 웹 production build: PASS

### 실제 브라우저

명령: `npm run milestone-b:browser-qa`

```json
{"reports":1,"handoffs":1,"reportStatus":"acknowledged","handoffStatus":"in-progress","ariaLabels":9,"mobileOverflow":0,"errors":[]}
```

### 전체 회귀

명령: portable Node 24.17.0으로 `npm run verify`

- typecheck/build/web build: PASS
- 전체 unit/integration/smoke: PASS
- 기존 Pixel Office 브라우저 QA: 59.9 FPS, mobile overflow 0, console 오류 없음
- Milestone B 브라우저 QA는 `verify`의 필수 마지막 게이트로 추가했다.

## 복구·호환성

- 신규 table은 기존 schema를 파괴하지 않는 additive `v17` table이다. 기능 비활성 시 기존 실행·회사·Pixel Office 경로가 이 table을 소비하지 않는다.
- projector version 불일치는 해당 회사 projection만 삭제 후 원본 `events_v6`에서 재생한다. 원본 이벤트와 회사 감사 ledger는 삭제하지 않는다.
- 보고와 위임은 SQLite online backup 및 manifest SHA/size/schema 검사를 거쳐 복원된다.
- 배포 중 결함이 발견되면 API/UI 노출을 비활성화하고 additive table을 보존한 채 forward-fix한다. 이전 실행 데이터에 대한 파괴적 downgrade는 수행하지 않는다.

## 잔여 게이트와 위험

- Milestone B 자체 자동 acceptance는 완료했다.
- Redis가 이 PC에 설치되어 있지 않아 Milestone A의 실제 Redis queue recovery 리허설은 아직 별도 release gate다.
- 역할 Golden Scenario 자동 판정은 통과했지만 사람 2인 검토는 아직 pending이다.
- Agent가 해석을 추가하는 작성 보고는 계획대로 Milestone C/6순위이며, 현재 보고는 결정론적 사실만 제공한다.
