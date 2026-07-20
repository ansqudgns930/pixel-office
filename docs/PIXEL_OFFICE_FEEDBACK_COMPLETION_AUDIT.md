# Pixel Office XP·검증·완료 공간 피드백 완료 감사

> 완료일: 2026-07-16  
> 판정: 4순위 목표 완료

## 목표

실제 Office Projection 이벤트와 Game Progression 보상 원장만을 근거로 검증 결과, 업무 완료, XP 지급을 직원이 있는 공간에서 즉시 이해할 수 있게 표현한다.

## 구현 결과

- `validation.completed`와 동일 이벤트의 warning/critical 경고를 결합해 검증 통과와 실패를 구분한다.
- `validation.failed`는 항상 실패 피드백으로 표시해 성공으로 오인되지 않게 했다.
- `workflow.completed`·`run.completed`는 업무 완료 피드백으로 표시한다.
- XP는 보상 원장의 `sourceEventId`, `agentId`, `amount`만 사용해 담당 직원 위에 실제 지급값을 표시한다.
- 동일 완료 이벤트의 완료·XP 피드백은 직원 위에서 두 줄로 배치해 겹침을 방지한다.
- 최초 접속이나 회사 전환 시 과거 이벤트를 재생하지 않고, 이후 새 이벤트만 한 번 표시한다.
- 같은 이벤트를 새로고침하거나 화면 크기 변경으로 다시 렌더해도 효과가 재생되지 않는다.
- 일반 모드에서는 짧은 상향 이동과 페이드, reduced-motion에서는 움직임 없는 정적 배지를 제공한다.
- ARIA live status에 직원과 피드백 내용을 동일하게 전달한다.
- 기존 상태 말풍선, 모니터 auto-state, 걷기, 동시 업무, Drawer와 Task/Run 근거 연결을 유지했다.

## 코드 근거

- `packages/office-view-model/src/index.ts`
- `apps/web/src/pages/PixelOfficePage.tsx`
- `apps/web/src/styles.css`
- `tests/office-view-model.test.ts`
- `tests/browser/p5-performance-accessibility.cjs`

## 검증 결과

- 이벤트 근거 기반 검증 통과·실패·완료·정확한 XP 매핑 단위 테스트 PASS
- 이미 본 이벤트 재생 방지 단위 테스트 PASS
- 실제 브라우저에서 검증 통과, 검증 실패, 업무 완료, `+23 XP` 확인 PASS
- 동일 이벤트 새로고침 시 활성 피드백 0 확인 PASS
- reduced-motion에서 `data-feedback-motion=static` 확인 PASS
- 직원 30명, 동시 업무 5건, 60 FPS, 이벤트 500건, 가상 목록 DOM 19개
- 모바일 390px overflow 0, ARIA label 55개
- `npm run verify`: PASS

## 시각 증거

- `pixel-office-feedback-desktop.png`
- `pixel-office-feedback-mobile.png`

## 다음 우선순위

실제 회의 상태와 참여자를 기반으로 회의 공간 집결 및 대화·요약 연결을 구현한다. 회의가 없을 때는 집결 장면을 생성하지 않는다.

외부 스프라이트, CEO 직접 조작, 레이아웃 에디터와 추가 CLI Adapter는 이번 목표에서 제외했다.
