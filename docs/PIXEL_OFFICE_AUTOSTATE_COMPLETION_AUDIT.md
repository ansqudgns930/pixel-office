# Pixel Office 상태 말풍선·모니터 Auto-state 완료 감사

> 완료일: 2026-07-16  
> 판정: 3순위 목표 완료

## 목표

실제 `workItems.phase`를 단일 진실 원천으로 사용해 직원의 상태 말풍선, 방 배치, 책상 배정, 모니터 점등과 접근성 설명이 서로 일치하게 만든다.

## 구현 결과

- `idle`, `planning`, `working`, `validating`, `reviewing`, `approval`, `blocked`, `completed`를 공통 표현 규칙으로 정의했다.
- 직원 말풍선은 각각 대기, 계획 중, 작업 중, 검증 중, 검토 중, 승인 대기, 차단, 완료를 실제 단계에서만 표시한다.
- 방별 최신 업무를 `lastSequence` 우선으로 책상 3개에 결정적으로 배정한다.
- 빈 책상 모니터는 꺼지고 계획·작업·검증·승인·차단·완료는 서로 다른 색으로 점등된다.
- 차단 모니터는 붉은색 굵은 테두리, 완료는 청록색, 승인 대기는 보라색으로 즉시 구분된다.
- 방 이동 버튼의 ARIA 설명에 활성 직원 수와 직원별 상태를 포함했다.
- Canvas host의 `data-monitor-states`, `data-status-bubbles`를 실제 렌더 상태 검증 근거로 제공한다.
- 기존 직원별 동시 업무, 걷기 보간, reduced-motion, 직원 Drawer와 Task/Run 근거 연결을 유지했다.

## 코드 근거

- `packages/office-view-model/src/index.ts`
- `apps/web/src/pages/PixelOfficePage.tsx`
- `tests/office-view-model.test.ts`
- `tests/browser/p5-performance-accessibility.cjs`

## 검증 결과

- TypeScript, backend build, web production build PASS
- 8개 phase의 말풍선·모니터 의미 매핑 단위 테스트 PASS
- 최신 업무 우선 책상 배정과 빈 모니터 off 단위 테스트 PASS
- 실제 브라우저에서 작업·검증·승인·차단·완료 5개 동시 상태 확인 PASS
- 기존 3프레임 걷기, 왕복 이동, reduced-motion 즉시 이동 PASS
- 직원 30명, 동시 업무 5건, 60 FPS, 이벤트 500건, 가상 목록 DOM 19개
- 모바일 390px overflow 0, ARIA label 54개
- `npm run verify`: PASS

## 시각 증거

- `pixel-office-autostate-desktop.png`
- `pixel-office-autostate-mobile.png`

## 다음 우선순위

완료: 실제 보상 원장과 검증·완료 이벤트에 연결된 공간 피드백을 구현했다. 상세 근거는 `PIXEL_OFFICE_FEEDBACK_COMPLETION_AUDIT.md`를 참조한다.

외부 스프라이트 자산, 회의 공간 집결, CEO 조작, 레이아웃 에디터와 추가 CLI Adapter는 이번 목표에서 제외했다.
