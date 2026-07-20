# 회사 운영 UI P3 회의 완료 감사

## 완료 범위

- 목표·프로젝트·Run에 연결된 회사 회의 생성
- 예정, 진행 중, 결정 대기, 종료, 취소 상태와 일시중지·재개
- 참석자·안건, 실시간 발언, 결정·근거, 후속 Task의 3열 회의실
- 질문, 의견, 지시, 결정의 대상·권한·근거 검증
- 회사 감사 이벤트와 SSE 기반 실시간 갱신·미읽음 표시
- 회의 종료 시 요약 초안, 안건별 요약, 결정, 미결, 위험, 사용자 개입, 후속 업무 생성
- Owner 요약 확정 후 프로젝트 Task 생성과 담당자 배정
- 회사 홈, Pixel Office, 목표, 프로젝트, Run 컨텍스트 링크

## 주요 구현 파일

- `packages/company-ops/src/index.ts`: 회의·발언·요약 저장과 권한·상태·후속 Task 규칙
- `apps/control-plane/src/index.ts`: 회의 REST API와 기존 SSE 이벤트 연결
- `apps/web/src/pages/MeetingsPage.tsx`: 회의 목록·3열 실시간 회의실·요약 UI
- `apps/web/src/styles.css`: 회의실 반응형, 상태, 메시지·결정 시각 구분과 명도 대비
- `apps/web/src/App.tsx`, `apps/web/src/layout/nav.ts`: `/meetings` 경로와 내비게이션
- `apps/web/src/pages/CompanyPage.tsx`, `PixelOfficePage.tsx`, `GoalsPage.tsx`: 운영 흐름 연결
- `tests/company-meetings.test.ts`: 상태·권한·테넌트·발언·요약·후속 Task·이벤트 테스트
- `scripts/qa-meetings-browser.cjs`: 실제 API 데이터 기반 브라우저 QA

## 검증 근거

- `npm run verify`: PASS
- 신규 회의 테스트: 2/2 PASS
- 전체 기존 테스트, Phase 1~6, P0~P5 스모크: PASS
- 기존 Pixel Office 브라우저 성능 QA: 60 FPS
- 회의 화면 브라우저 QA:
  - 실제 회의 생성·시작·의견·질문·결정·후속 Task 제안 데이터 사용
  - 1440×1000: 3열 회의실, 메시지 3건, 작성기, 컨텍스트 링크 정상
  - 390×844: 가로 overflow 없이 모바일 순차 레이아웃 정상
  - 콘솔 오류, page error, HTTP 4xx/5xx 없음

스크린샷:

- `docs/meetings-p3-desktop.png`
- `docs/meetings-p3-mobile.png`

## 다음 우선순위

P4 운영 완성도: 통합 검색·알림, 회사 보관/복구 UX 보강, 전체 접근성·성능·감사 로그의 실제 사용자 프로세스 재검증.
