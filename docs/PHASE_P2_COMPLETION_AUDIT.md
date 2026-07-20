# Phase P2 완료 감사

## 판정

**GO — 이벤트 근거형 게임 진행도 완료.**

게임 표현은 실제 Run·Validation·비용·위험도 이벤트에서만 계산되며 업무 상태를 변경하지 않는다. 안전 정책 위반 Run은 완료 이벤트가 발생해도 XP·숙련도·업적을 받지 않는다.

## 구현 범위

- 이벤트별 고유 제약을 가진 Reward Ledger와 결정적 replay
- 직원별 delivery·quality·efficiency·risk 숙련도
- 위험도·검증 통과·예산 사용률·revision을 반영한 XP 산식
- 회사 레벨 1~5와 단계별 사무실 장식 해금
- first delivery·품질·효율·revision 회복 업적
- warning/critical Incident 원장
- Run 완료 CEO 브리핑과 모든 지표의 source event provenance
- Demo/Live 모드별 원장·숙련도·Incident·브리핑 완전 분리
- Pixel Office 회사 성장, 해금, 숙련도, Incident, 최신 브리핑 UI

## 완료 기준 증거

| 완료 기준 | 증거 | 판정 |
| --- | --- | --- |
| 동일 이벤트 중복 지급 차단 | Ledger unique key와 동일 event 재수신 테스트 | 통과 |
| 지표 근거 추적 가능 | metrics provenance와 briefing provenance가 source event ID 제공 | 통과 |
| 보안 위반이 보상으로 상쇄되지 않음 | `tool.scope_blocked`가 critical Incident를 만들고 완료 보상 0임을 Live 테스트 | 통과 |
| Demo와 Live 진행도 분리 | 동일 회사의 mode별 snapshot과 rebuild 테스트 | 통과 |
| 분야별 숙련도 | delivery·quality·efficiency·risk 산식 및 UI 직원 Drawer | 통과 |
| 회사 성장 체감 | 누적 500 XP에서 레벨 5와 `executive-floor` 해금 테스트 | 통과 |
| Incident·CEO 브리핑 | validation warning, safety critical, Run별 자동 브리핑 API/UI 테스트 | 통과 |
| Replay 동일 결과 | Demo·Live 모두 rebuild 전후 `stateHash` 일치 | 통과 |

## 검증 명령

```powershell
npm run p2:game-smoke
npm run p0:smoke
npm run verify
cd apps/web
npm run build
```

P3는 이 지표를 변경하지 않고 실제 Host 실행·검증·Reviewer·revision·승인 안전성을 강화한다.
