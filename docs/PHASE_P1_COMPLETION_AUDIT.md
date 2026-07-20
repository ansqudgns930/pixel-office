# Phase P1 완료 감사

## 판정

**GO — 실제 이벤트 연결 단계 완료.**

실제 Project·Run·Task·Validation·Approval 이벤트가 회사별 durable event stream을 거쳐 Office Projection과 픽셀 화면에 반영된다. Run/Task별 상태를 독립적으로 유지하며 실제 DB 상태와 비교하는 일관성 API에서 불일치 0건을 검증했다.

## 구현 범위

- 감사 이벤트를 `AgentCompanyEventV2`로 변환하는 Event Mapper와 식별자 복구
- 회사 연결 전 이벤트 backfill, 시작 시 누락 이벤트 복구, 회사별 sequence replay
- Run/Task별 `OfficeWorkItem` Projection 및 캐릭터 assignment 연결
- 승인·실패·차단 우선 알림
- Pixel Office 알림·업무 Drawer에서 Execution Workspace의 해당 Run으로 이동
- 실제 DB와 Projection을 비교하는 `GET /api/companies/:id/office-consistency`
- Projection 재구축 API와 결정적 `stateHash`

## 완료 기준 증거

| 완료 기준 | 증거 | 판정 |
| --- | --- | --- |
| 실제 상태 변화와 픽셀 상태 불일치 0건 | 단일·다중 Run 테스트와 `office-consistency` API가 `mismatches: []` 확인 | 통과 |
| 연결 끊김 후 누락 이벤트 복구 | 프로젝트 연결 전 감사 이벤트 backfill 및 OperationalStore 시작 시 backfill 테스트 | 통과 |
| Replay로 동일 Projection 재구축 | 단일·다중 Run 모두 rebuild 전후 `stateHash` 일치 | 통과 |
| 실제 Project·Run·Task와 캐릭터 연결 | assignment 기반 `office-links`, phase별 executor/reviewer/owner 해석 | 통과 |
| 승인·실패·차단 우선 알림 | high/warning/critical alert Projection 및 Pixel UI | 통과 |
| Pixel Office ↔ Execution Workspace 이동 | alert·drawer의 `runId` 링크와 Execution의 query 자동 로드 | 통과 |

## 검증 명령

```powershell
npm run build
npm run p1:office-smoke
npm run verify
cd apps/web
npm run build
```

P2부터는 이 Projection과 durable event ID를 보상·숙련도·회사 성장의 근거로 사용한다.
