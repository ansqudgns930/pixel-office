# 회사 운영 UI P4 운영 완성도 감사

> 완료일: 2026-07-16  
> 판정: 완료

## 완료 범위

- 회사 통합 검색: 목표, 프로젝트, Task, Run, 직원, 회의, 결정, 감사 이벤트와 원본 화면 링크
- 통합 알림: 차단, 승인 대기, 검증 실패, 진행 중 회의, 예산 위험, 프로젝트 알림, SSE 연결 단절
- 알림 조치: 심각도·읽지 않음 필터, 사용자별 읽음, 관련 근거 이동, 재연결 상태 표시
- 회사 안전 관리: 영향 범위, 활성 Run·회의·승인·요약 초안 차단, 보관·복구, 회사명 재입력 삭제 대기·취소, 감사 기록
- 전체 사용자 여정: 로그인 → 회사 목록/선택 → 회사 홈 → 직원 → 회의 개입 → 요약/후속 Task → 목표 → 프로젝트 → Run 근거

## 코드 근거

- API·도메인: `packages/company-ops/src/index.ts`, `apps/control-plane/src/index.ts`
- UI·내비게이션: `apps/web/src/pages/ActivityPage.tsx`, `apps/web/src/layout/Header.tsx`, `apps/web/src/layout/nav.ts`, `apps/web/src/App.tsx`
- 스타일·반응형: `apps/web/src/styles.css`
- 자동 검증: `tests/company-activity.test.ts`, `scripts/qa-activity-browser.cjs`, `scripts/qa-company-journey.cjs`

## 검증 결과

### 전체 회귀

`npm run verify` PASS

- TypeScript typecheck, backend build, web production build PASS
- 전체 API·권한·테넌트·SSE cursor 복구 테스트 PASS
- Phase/P0~P5 smoke와 전체 테스트 PASS
- 성능 smoke PASS
- Pixel Office 브라우저 QA: 60 FPS, 직원 30명, 이벤트 500개, 키보드 스크롤·reduced motion·ARIA PASS

### 통합 검색·알림 브라우저 QA

`node scripts/qa-activity-browser.cjs` PASS

- 데스크톱 1440px: 알림 3건, 검색 결과 4건, 가로 넘침 없음, 키보드 포커스 확인
- 모바일 390px: 알림 3건, 검색 결과 4건, 가로 넘침 없음
- 콘솔·페이지·HTTP 오류 없음

### 회사 전체 여정·재연결 QA

`node scripts/qa-company-journey.cjs` PASS

- 로그인, 회사 목록, 회사 홈, 직원, 목표, 프로젝트 워룸, 실행 워크스페이스 순회 PASS
- 회의 사용자 결정 개입, 종료 요약, 후속 Task 확정과 프로젝트 링크 PASS
- SSE 요청 강제 단절 시 `실시간 연결이 끊겼습니다` 통합 경고 표시 PASS
- 자동 재연결 후 `실시간 연결` 복구 PASS
- 모바일 390px 가로 넘침 없음, 키보드 포커스 `BUTTON`, ARIA label 9개

## 제외 범위

- 실제 운영 배포와 롤백
- 외부 검색엔진, 이메일·푸시 알림
- 영구 물리 삭제 자동 실행
- 화상·음성 회의

위 항목은 P4 완료 조건에 포함하지 않았다.
