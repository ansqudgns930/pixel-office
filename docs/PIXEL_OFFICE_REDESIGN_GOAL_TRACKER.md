# Pixel Office Redesign Goal Tracker

> Created: 2026-07-20  
> Source plan: `docs/PIXEL_OFFICE_USER_PROCESS_REDESIGN_PLAN.md`  
> Goal: 계획 우선순위대로 Pixel Office를 “업무 위임형 AI 회사 운영 시스템”으로 전환한다.

---

## Objective

사용자가 Agent/model/Run을 직접 관리하지 않아도 회사 홈에서 업무를 맡기고, AI 회사가 계획 제안·동적 직원 배정·자동 실행·결정 요청·검증 보고·다음 작업 추천까지 이어지도록 한다.

---

## Priority Roadmap

### UX-A — 문구와 정보구조 재정렬

Status: **Done — web build passed**

Scope:
- nav label/order 변경
- `회사 목표` → `맡긴 일`
- `오너 결정` → `결정 필요`
- `검색·알림` → `결과·활동`
- `직원` → `직원·AI팀`
- `실행 워크스페이스` → `고급 실행`
- wildcard route fallback을 `/execution`에서 `/companies`로 변경

Acceptance criteria:
- 메뉴만 봐도 “일을 맡기고, 진행을 보고, 결정하고, 결과를 받는” 구조가 느껴진다.
- 일반 사용자가 `/execution`을 기본 진입점으로 만나지 않는다.

### UX-B — 회사 홈에 업무 맡기기 입력 추가

Status: **Partial Done — home input and plan preview added; execution API wiring pending**

Scope:
- `/company` 상단 업무 입력창
- `AI 팀에게 계획 요청` CTA
- 진행 중/결정 필요/완료 결과 요약
- `픽셀오피스로 보기` 링크

Acceptance criteria:
- 사용자가 회사 홈에서 바로 업무를 맡길 수 있다.
- 목표/Run/프로젝트를 몰라도 계획 제안까지 도달한다.

### UX-C — AI 계획 제안 흐름 구현

Status: **Partial Done — home draft/launch API wiring added; deeper staffing backend pending**

Scope:
- 입력 업무를 목표/계획/성공 기준으로 draft
- 업무 유형 분류
- Dynamic Staffing Rules 기반 투입 직원 제안
- 승인/수정 요청/취소 처리
- 승인 시 기존 goal/run execution으로 연결

Acceptance criteria:
- 계획 없이 바로 실행되지 않는다.
- 사용자는 실행 전 AI 회사가 무엇을 할지 이해한다.

### UX-D — Staff Model 구현/노출

Status: **Partial Done — core team UI and demo Designer added; backend staffing rules pending**

Scope:
- 기본 회사 구성에 Designer 추가
- CEO/PM/Designer/Developer/QA 고정팀 표시
- 임시 전문가 대기실 UI
- internal pipeline role과 user-facing staff 매핑

Acceptance criteria:
- 고정 핵심팀이 회사 구성으로 보인다.
- 직원이 보여도 항상 모델 호출되는 것은 아니다.

### UX-E — Decision Inbox 통합

Status: **Pending**

Scope:
- `/reviews`를 `결정 필요` 중심 UX로 변경
- 승인/반려/수정 요청/회의 전환 액션 정리
- 회사 홈 상단 결정 필요 count

Acceptance criteria:
- 사용자는 어떤 결정을 해야 하는지 한 화면에서 본다.

### UX-F — Pixel Office live view 강화

Status: **Pending**

Scope:
- 회사 홈/맡긴 일 카드에서 `픽셀오피스로 보기`
- 직원/방/알림 클릭 액션
- 고정 직원 + 임시 전문가 시각화

Acceptance criteria:
- Pixel Office는 필수 절차가 아니라 진행 상황 live view가 된다.

### UX-G — 설정 > AI 엔진 구현

Status: **Pending**

Scope:
- `BackendSettingsPage.tsx`
- `/settings/backend` route
- `/api/agent-backend/models` 연동
- 회사 기본/역할별 backend/model 저장

Acceptance criteria:
- 관리자는 NVIDIA/Claude/Codex backend를 설정할 수 있다.
- 일반 사용자 기본 흐름에는 모델 설정이 노출되지 않는다.

---

## Current Progress Log

### 2026-07-20 — Start

- Goal tracker created.
- Starting UX-A implementation first.


### 2026-07-20 — UX-A code change

- Updated nav labels and order to product-language information architecture.
- Changed wildcard route fallback from /execution to /companies.
- Validation pending: web build/typecheck.

### 2026-07-20 — UX-A validation

- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — UX-B first vertical slice

- Added company-home work delegation input.
- Added `AI 팀에게 계획 요청` CTA.
- Added local plan preview that proposes staff and execution steps by request type.
- Added links to delegated work, decision inbox, staff view, and Pixel Office live view.
- `이 계획으로 실행` is intentionally disabled until it is wired to existing goal/run APIs.
- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — UX-C first vertical slice

- Wired company-home `AI 팀에게 계획 요청` to existing `/api/companies/:companyId/goals/draft` endpoint.
- Replaced local text-only preview with structured title/description/completion criteria/staff/risk plan preview.
- Enabled `이 계획으로 실행` and wired it to existing `/api/companies/:companyId/goals/launch` endpoint.
- Launch now creates a delegated goal/run flow and navigates to `/goals` for follow-up.
- Dynamic staffing is still UI-local classification; next backend work should formalize staffing rules in shared package/API.
- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — UX-D first vertical slice

- Added `demo-designer` to demo bootstrap core staff.
- Updated demo project organization roles to include designer.
- Renamed Employees page to `직원·AI팀`.
- Added fixed core team section: CEO, PM, Designer, Developer, QA.
- Added external specialist lounge: Researcher, Data Analyst, Marketing, Security, Copywriter, Legal, Extra Developer.
- Added user-facing staff labels while preserving existing internal roles.
- Ran: `npm run build`
- Ran: `npm --prefix apps/web run build`
- Result: PASS
