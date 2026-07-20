# 회사 운영 UI P2 목표 전체 현황 완료 감사

## 완료 범위

- 회사 목표 생성: 목표명, 설명, Owner, 완료 기준, 예산, 완료 예정일
- 회사에 연결된 프로젝트만 목표에 연결하는 테넌트 경계
- 목표 상태 전이: 초안 → 진행 → 차단/완료/취소
- 완료 전 Task 완료, 승인 대기, 검증 실패 근거 검사
- 목표별 진행률, 비용, 차단, 승인, 검증 실패, 다음 행동 집계
- 계층, 보드, 타임라인 보기와 프로젝트·Run 근거 링크
- 회사 현황, Pixel Office, 프로젝트, 실행 화면의 컨텍스트 연결

## 구현 파일

- `packages/company-ops/src/index.ts`: 목표 저장, 연결, 집계, 상태 전이
- `apps/control-plane/src/index.ts`: 목표 REST API
- `apps/web/src/pages/GoalsPage.tsx`: 목표 전체 현황 UI
- `apps/web/src/styles.css`: 목표 화면 반응형·상태 스타일
- `apps/web/src/App.tsx`, `apps/web/src/layout/nav.ts`: `/goals` 경로와 내비게이션
- `apps/web/src/pages/CompanyPage.tsx`, `apps/web/src/pages/PixelOfficePage.tsx`: 운영 흐름 연결
- `tests/company-goals.test.ts`: 권한·경계·계층·완료 근거 테스트
- `scripts/qa-goals-browser.cjs`: 데스크톱·모바일 브라우저 QA

## 검증 근거

- `npm run verify`: PASS
- 신규 회사 목표 테스트: 2/2 PASS
- 전체 기존 테스트와 Phase 1~6, P0~P5 스모크: PASS
- 기존 브라우저 성능 QA: 60 FPS, 30명, 500 이벤트
- 목표 화면 브라우저 QA:
  - 1440×1000: 가로 overflow 없음, 계층·보드·타임라인 정상
  - 390×844: 가로 overflow 없음, 반응형 목록·상세 정상
  - 콘솔 오류, page error, HTTP 4xx/5xx 없음

스크린샷:

- `docs/goals-p2-desktop.png`
- `docs/goals-p2-mobile.png`

## 다음 우선순위

P3 회의 운영 UI: 회의 목록, 실시간 발언 스트림, 사용자 대화 개입, 요약·결정·후속 Task와 목표 반영.
