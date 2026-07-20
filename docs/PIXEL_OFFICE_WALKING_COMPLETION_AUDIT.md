# Pixel Office 상태 전환 보행 완료 감사

> 완료일: 2026-07-16  
> 판정: 2순위 목표 완료

## 목표

직원의 실제 `workItems` 단계가 변경될 때 이전 좌표에서 새 업무 방의 책상 좌표까지 이동하는 결정론적 픽셀 보행을 제공한다.

## 구현 결과

- 직원별 마지막 Canvas 좌표를 유지하고 새 방 좌표가 달라질 때만 이동한다.
- 이동 거리에 따라 360~900ms 범위의 결정론적 duration을 계산한다.
- ease-in-out 보간으로 이전 좌표에서 목적지까지 이동한다.
- 이동 방향에 따라 캐릭터를 좌우 반전한다.
- 좌우 다리를 독립 Graphics로 분리하고 0·1·2의 3프레임 보행을 적용한다.
- 도착하면 다리 위치를 기본 상태로 복귀하고 최종 좌표를 저장한다.
- 상태 변경 중에도 캐릭터 클릭, 직원 Drawer, Task/Run 근거를 유지한다.
- `prefers-reduced-motion: reduce`에서는 보행 없이 목적지로 즉시 이동한다.

## 코드 근거

- `packages/office-view-model/src/index.ts`
- `apps/web/src/pages/PixelOfficePage.tsx`
- `tests/office-view-model.test.ts`
- `tests/browser/p5-performance-accessibility.cjs`

## 검증 결과

`npm run verify` PASS

- TypeScript, backend build, web production build PASS
- 전체 테스트와 Phase/P0~P5 smoke PASS
- 시작·중간·종료 좌표, 좌우 방향, 3프레임, reduced-motion 단위 테스트 PASS
- 브라우저에서 개발실 → QA실 이동 중 `movingAgents > 0` 확인
- 브라우저에서 walking frame `0, 1, 2` 모두 확인
- 이동 종료 후 `movingAgents = 0`, 반대 방향 복귀 PASS
- reduced-motion 상태 변경 시 `movingAgents = 0` 즉시 전환 PASS
- 직원 30명·동시 업무 3건·60 FPS
- 모바일 390px overflow 0, ARIA label 50개

## 시각 증거

- `pixel-office-walking-desktop.png`: 개발 직원이 QA실로 이동 중인 중간 프레임
- `pixel-office-workitems-mobile.png`: 모바일 최종 배치

## 다음 우선순위

완료: 승인 대기·완료·차단을 포함한 상태 말풍선과 책상·모니터 auto-state를 실제 업무 단계에 연결했다. 상세 근거는 `PIXEL_OFFICE_AUTOSTATE_COMPLETION_AUDIT.md`를 참조한다.

외부 스프라이트 자산, BFS 장애물 탐색, 자유 배회, XP 파티클, 회의 집결, CEO 조작, 레이아웃 에디터는 이번 목표에서 제외했다.
