# Pixel Office 직원별 동시 업무 완료 감사

> 완료일: 2026-07-16  
> 판정: 1순위 목표 완료

## 목표

서버 `OfficeProjection.workItems`를 실제 Pixel Office에 연결해 여러 직원이 각자 수행 중인 Task·Run·단계를 동시에 표시한다.

## 구현 결과

- 직원별 최신 work item을 `lastSequence`와 key로 결정론적으로 선택한다.
- 동일 직원의 과거 업무는 현재 업무를 덮어쓰지 않으며 agent가 없는 항목은 Canvas 활성 상태로 사용하지 않는다.
- 기존 데이터에 `workItems`가 없으면 `activeAgentId`를 호환 fallback으로 사용한다.
- 각 직원을 실제 단계에 따라 계획·개발·검토·승인실에 배치한다.
- 방 헤더·방 이동 버튼·회사 요약에 활성 인원과 동시 업무 수를 표시한다.
- 캐릭터 라벨·말풍선·직원 목록·ARIA label에 단계와 Task/Run 근거를 표시한다.
- 직원 상세 Drawer가 동일한 work item에서 상태·Task·Run을 읽고 실행 근거로 이동한다.

## 코드 근거

- `packages/office-view-model/src/index.ts`
- `apps/web/src/pages/PixelOfficePage.tsx`
- `tests/office-view-model.test.ts`
- `tests/browser/p5-performance-accessibility.cjs`

## 검증 결과

`npm run verify` PASS

- TypeScript, backend build, web production build PASS
- 전체 테스트와 Phase/P0~P5 smoke PASS
- 독립 Run 두 개의 `workItems` 투영·재생·일관성 PASS
- 직원별 최신 업무 선택·legacy fallback 단위 테스트 PASS
- 실제 브라우저: 개발·검증·승인 업무 3건 동시 표시 PASS
- 직원 30명, 이벤트 500개, 60 FPS
- 모바일 390px 가로 overflow 0
- reduced motion `1e-05s`, ARIA label 50개
- 콘솔·페이지 오류 없음

## 시각 증거

- `pixel-office-workitems-desktop.png`
- `pixel-office-workitems-mobile.png`

## 다음 우선순위

완료. 직원별 이전 좌표와 새 업무 방의 책상 좌표를 연결하는 이동 보간과 방향·걷기 3프레임을 구현했다. 상세 근거는 `PIXEL_OFFICE_WALKING_COMPLETION_AUDIT.md`를 참조한다.

스프라이트 외부 자산 복제, XP 파티클, 회의 집결, CEO 조작, 레이아웃 에디터는 이번 목표에서 제외했다.
