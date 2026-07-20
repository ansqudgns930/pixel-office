# Phase P0 완료 감사

## 판정

**GO — 플레이 가능한 Demo 기반 완료.**

P0는 실제 저장소를 변경하는 Live 실행이 아니라, 목표 입력부터 실패·수정·승인·완료·보상까지 회사 운영 루프를 안전한 Demo 이벤트로 체험하는 단계다.

## 구현 범위

- 멱등 Demo 회사 Bootstrap: CEO, PM, Developer, QA, 프로젝트, 마일스톤, 첫 작업
- 12단계 첫 납품 시나리오: 목표, 계획, 승인, 작업, 검증 실패, 수정, 재검증, 결과 승인, 병합 후보, 완료
- 회사별 durable 이벤트와 인증 SSE 재생
- 이벤트 기반 Office Projection, 순서·중복 차단, Replay 재구축
- PixiJS 오피스, 단계별 공간, 직원 상태, 이벤트 타임라인
- Reward Ledger, Demo/Live 격리, 직원·회사 XP, first-delivery 업적
- 마지막 회사 자동 복구와 직원 상세 Drawer

## 완료 기준 증거

| 완료 기준 | 증거 | 판정 |
| --- | --- | --- |
| 목표 입력부터 완료 보상까지 1회 루프 | `p0-playable-demo.test.ts`, `demo-scenario.test.ts` | 통과 |
| 새로고침·프로세스 재시작 후 동일 상태 | 파일 기반 SQLite 재오픈 후 Office/Game `stateHash` 비교 | 통과 |
| 이벤트 중복 보상 없음 | 동일 `requestId` 재호출 후 이벤트 12건, Ledger 1건 유지 | 통과 |
| 실패 후 수정 시나리오 포함 | `validation.failed` → `task.revision_created` → `validation.completed` | 통과 |

## 검증

```powershell
npm run p0:smoke
npm run verify
cd apps/web
npm run build
```

## 남은 범위

- 브라우저 자동화 기반 Canvas 시각 회귀와 실제 클릭 E2E
- P1 실제 Run/Task/Validation/Approval 이벤트와 Office Projection의 완전한 상태 대응
- 장기 SSE 연결과 재접속 지연 성능 실측

위 항목은 P0의 결정론적 Demo 완료를 막지 않으며 다음 단계의 검증 범위로 이관한다.
