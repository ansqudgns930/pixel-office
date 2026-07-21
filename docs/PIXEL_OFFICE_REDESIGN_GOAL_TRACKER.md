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

Status: **Partial Done — decision inbox product framing added; cross-source unification pending**

Scope:
- `/reviews`를 `결정 필요` 중심 UX로 변경
- 승인/반려/수정 요청/회의 전환 액션 정리
- 회사 홈 상단 결정 필요 count

Acceptance criteria:
- 사용자는 어떤 결정을 해야 하는지 한 화면에서 본다.

### UX-F — Pixel Office live view 강화

Status: **Partial Done — live view framing and navigation actions added; deeper spatial interactions pending**

Scope:
- 회사 홈/맡긴 일 카드에서 `픽셀오피스로 보기`
- 직원/방/알림 클릭 액션
- 고정 직원 + 임시 전문가 시각화

Acceptance criteria:
- Pixel Office는 필수 절차가 아니라 진행 상황 live view가 된다.

### UX-G — 설정 > AI 엔진 구현

Status: **Partial Done — BackendSettings page, route, model listing, and binding saves added**

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

### 2026-07-20 — UX-E first vertical slice

- Renamed Owner Review page framing to `결정 필요`.
- Added Decision Inbox summary metrics: pending, on-hold, high-risk, total history.
- Added product guidance explaining that AI stops only for authority/risk/uncertainty/evidence gaps.
- Added direct links to company home, delegated work, and meetings.
- Updated decision-copy CTAs: approve and continue, revise and bring back, hold, resume decision.
- Updated company home labels from approval-centric wording to decision-needed wording.
- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — UX-F first vertical slice

- Reframed Pixel Office page as a live view, not the primary workflow.
- Added live-view guidance and direct CTAs to company home, delegated work, decision inbox, staff/team, and activity.
- Renamed toolbar links from system/console wording to product-language destinations.
- Added selected-room work list with direct navigation to execution/project evidence.
- Routed approval/high-priority alerts to the Decision Inbox instead of only execution details.
- Updated advanced office copy to clarify it is operator-only live-view administration.
- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — UX-G first vertical slice

- Added `BackendSettingsPage.tsx` as administrator-facing AI engine settings.
- Added route `/settings/backend`.
- Added admin nav item `설정`.
- Exposed company default, Planner/PM, Worker/Developer, Reviewer/QA backend/model cards.
- Wired model listing to existing `/api/agent-backend/models` endpoint.
- Wired saves to existing company agent-bindings endpoint for company and role targets.
- Added save summary and current binding list.
- Kept API key out of UI storage/binding config; baseUrl/cliPath only are saved when present.
- Ran: `npm --prefix apps/web run build`
- Result: PASS

### 2026-07-20 — Redesign visual QA smoke

- Added reusable Playwright smoke script: `scripts/pixel-office-redesign-visualqa.cjs`.
- Verified key redesigned screens with screenshot output:
  - Company home: `/company?companyId=demo-company`
  - Staff/team: `/employees?companyId=demo-company`
  - Decision inbox: `/reviews?companyId=demo-company`
  - Pixel Office live view: `/pixel-office?companyId=demo-company`
  - Backend settings: `/settings/backend?companyId=demo-company`
- Desktop viewport: `1440x1000`.
- Mobile smoke viewport: `390x844` for company home and backend settings.
- Result: PASS — no required copy missing, no horizontal overflow, no browser console/page errors.
- Screenshots/report written under `.runtime/visualqa/pixel-office-redesign/`.

### 2026-07-20 — Dynamic Staffing Rules shared/API slice

- Added shared package: `packages/staffing-rules/src/index.ts`.
- Moved Company Home local work classification into `deriveWorkStaffingPlan()`.
- Added API endpoint: `POST /api/companies/:companyId/staffing/plan`.
- Endpoint enforces company view permission before returning staffing/risk/decision expectation.
- Updated Company Home plan proposal to request draft goal and staffing plan through backend APIs.
- Verified API with UI+security request: returned PM, Designer, Security, Developer, QA and `risk: high`.
- Ran: `npm run build`
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-20 — Decision Inbox unified signals slice

- Extended Decision Inbox UI beyond owner-review queue.
- Added company alert loading from `/api/companies/:companyId/alerts`.
- Unified visible signals for blocked tasks, validation failures, meeting decision-pending/live states, approvals, budget risk, notifications, and unroutable reports.
- Added `추가 신호` summary metric.
- Added `Owner Review 밖의 결정·주의 신호` section with links to related screens.
- Kept owner-review approval flow unchanged.
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — Pixel Office spatial interaction rationale slice

- Added goal-focus context to Pixel Office when `goalId` is present in the URL.
- Added `선택 목표 추적 중` card with links to goal detail, Decision Inbox, and activity.
- Added room rationale copy explaining why planning/working/validating/approval rooms matter.
- Added assignment rationale copy for room work chips and the selected agent drawer.
- Added drawer fields for `왜 배정됐나`, responsibility, and focused goal.
- Extended visual QA smoke with `pixel-goal-focus` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — AI Engine binding validation + demo-mode warning

- Verified agent binding save flow through `/api/companies/:companyId/agent-bindings`.
- Saved company default plus role bindings for planner, worker, and reviewer.
- Verified saved bindings are listed correctly.
- Launched a small demo-company Run and checked `/api/runs/:runId/agent-bindings`.
- Finding: demo company Run snapshots intentionally resolve to `demo-mode` with `standalone · phase0-model`, regardless of saved bindings.
- Confirmed this is implemented in `AgentBindingStore.freezeRun()`: non-demo companies use member/role/company/runtime resolution; demo mode is forced standalone.
- Added Backend Settings warning for demo companies so administrators do not confuse saved settings with demo-mode Run execution.
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — Live company role binding end-to-end verification

- Created reusable verification script: `scripts/verify-live-binding-snapshot.ps1`.
- Script creates/reuses a live verification company, stores company/default and role bindings, launches a small goal, then checks `/api/runs/:runId/agent-bindings`.
- Verified live Run snapshot resolution:
  - planner → `claude-cli · sonnet-5 · resolution=role`
  - worker → `codex-cli · gpt-5 · resolution=role`
  - reviewer → `openai-compatible · nvidia/nemotron-3-ultra-550b-a55b · resolution=role`
- Added Backend Settings note that actual application should be verified through live Run binding snapshots.
- Added visible QA command reference in Backend Settings.
- Ran: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-live-binding-snapshot.ps1`
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — Backend Settings live snapshot verification button

- Added `Live Run snapshot 검증` action to Backend Settings.
- The action saves current company/default and role settings, launches a small live verification goal/run, then checks `/api/runs/:runId/agent-bindings`.
- Verification compares planner/worker/reviewer snapshot backend/model values against current UI settings and reports pass/fail inline.
- Disabled the action for demo companies because demo-mode intentionally resolves to `standalone · phase0-model`.
- Extended visual QA smoke to assert the new button copy on desktop and mobile Backend Settings.
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — End-to-end delegated-work browser flow verification

- Added browser E2E script: `scripts/verify-delegated-work-flow.cjs`.
- Added npm script: `delegated-work:browser-qa`.
- The script creates a fresh live QA company, logs into the Web UI, opens Company Home, fills `AI 회사에 맡길 업무`, requests an AI plan, verifies the plan preview, launches the plan, then validates downstream navigation/state.
- Verified flow:
  - Company Home work input
  - `AI 팀에게 계획 요청`
  - plan preview with staff/risk/completion criteria/decision expectation
  - `이 계획으로 실행`
  - Goals page with `goalId` in URL
  - goal snapshot API
  - delivery-process API
  - Decision Inbox route
  - Pixel Office goal-focus route
  - Activity route
- First run found reusable test-company state could fail with `Project budget exceeds department`; script now uses a fresh live QA company per run to avoid cross-test state pollution.
- Screenshots/report written under `.runtime/visualqa/delegated-work-flow/`.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — Company Home delegated-work error copy hardening

- E2E discovered raw launch failure copy: `Project budget exceeds department` when a reused company has incompatible department/project budget state.
- Added Company Home error translation for budget/delegated-work launch failures.
- User-facing copy now explains that the execution project budget exceeds selected department budget and points to the `조직·Agent` tab or smaller budget retry.
- Also added friendlier copy for missing positive goal budget and unavailable goal drafting.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — GoalsPage delegated-work framing slice

- Reframed `GoalsPage` from `회사 목표` to `맡긴 일`.
- Added delegated-work explainer card: `업무를 맡긴 뒤에는 여기서 진행 상태를 봅니다`.
- Changed portfolio/list copy to `DELEGATED WORK`, `맡긴 일`, `업무 목록`, `진행 단계`, and `다음 액션`.
- Updated toolbar wording: `결정 필요`, `회사 홈`, `픽셀 오피스 Live View`.
- Updated empty/create states from goal-centric copy to direct work delegation copy.
- Updated automation copy to `업무 위임에서 실행까지`.
- Extended delegated-work E2E to wait for GoalsPage delegated-work copy before asserting downstream state.
- Extended visual QA smoke with `delegated-work-goals` route.
- Found an E2E timing issue where route URL changed before React-rendered text was ready; fixed test to wait on delegated-work copy instead of raw body.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — ActivityPage results/activity framing slice

- Reframed `ActivityPage` from `통합 검색·알림` to `결과·활동`.
- Updated description to emphasize result reports, validation evidence, risk signals, meetings, and decisions.
- Added goal-focus context when `goalId` is present: `선택한 맡긴 일의 결과와 활동을 보는 중입니다`.
- Added quick links from goal-focused activity to delegated-work detail, Pixel Office live view, and Decision Inbox.
- Renamed tabs/copy toward user-facing concepts: `활동 신호`, `결과 보고`, `근거 검색`.
- Fixed a real URL-state bug: ActivityPage load/search/tab updates were dropping `goalId`, causing the goal-focus context to disappear after data load.
- Extended delegated-work E2E to assert Activity goal-focus copy.
- Extended visual QA smoke with `activity-results` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — MeetingsPage delegated-work review slice

- Reframed `MeetingsPage` from generic `회의` to `업무 검토 회의`.
- Updated page description to emphasize delegated-work progress review, decisions, risks, and follow-up Task confirmation.
- Added goal-focus context when `goalId` is present: `선택한 맡긴 일의 검토 회의를 보는 중입니다`.
- Added meeting focus badges: `진행 검토`, `결정 정리`, `위험·이견`, `후속 Task`.
- Updated toolbar links to delegated-work flow: `회사 홈`, `맡긴 일 상세`, `결정 필요`, `결과·활동`.
- Reworded list/create/empty/detail copy from meeting-log language to work-review language.
- Fixed URL-state continuity: meeting load now preserves goal focus through `goalId` when available.
- Extended visual QA smoke with `work-review-meetings` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — WarRoomPage execution workroom slice

- Reframed `WarRoomPage` from `프로젝트 워룸 · Project War Room` to `실행 작업실`.
- Updated page description to explain that delegated work is broken into Tasks, assignees, Runs, and validation evidence.
- Added goal-focus context when `goalId` is present: `선택한 맡긴 일의 실행 작업실입니다`.
- Added execution evidence badges: `Task 분해`, `담당 배정`, `Run 시작`, `검증 설정`.
- Added delegated-flow toolbar links to `회사 홈`, `맡긴 일 상세`, `결과·활동`, and `업무 검토 회의`.
- Reworded project/task/create/empty/validation/notification copy toward execution evidence and delegated-work language.
- Preserved `goalId` when starting a Run from a selected Task.
- Renamed nav label from `프로젝트 워룸` to `실행 작업실`.
- Extended visual QA smoke with `execution-workroom` route using the real demo fixture project id `demo-first-delivery`.
- Fixed QA script encoding after a PowerShell Set-Content attempt corrupted Korean text; rewrote the QA script as UTF-8.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — ExecutionPage advanced execution/evidence slice

- Reframed `ExecutionPage` from `실행 워크스페이스` to `고급 실행`.
- Updated description to clarify this is the operator/admin detailed view for selected Task/Run planning, execution state, validation, Diff, and audit logs.
- Added context card when any of `goalId`, `projectId`, `taskId`, or `runId` is present: `선택한 Task/Run의 고급 실행·증거 확인 화면입니다`.
- Added context badges: `맡긴 일 연결`, `프로젝트 연결`, `Task 연결`, `Run 선택`, `계획·결과 승인`, `검증·Diff 근거`.
- Added delegated-flow links from ExecutionPage to Pixel Office Live View, delegated-work detail, execution workroom, results/activity, and Decision Inbox.
- Clarified direct Run creation as `고급 Run 직접 생성`, not the normal delegated-work starting point.
- Reworded several headings: `다음 운영자 액션`, `Run 목표`, `Run Agent Backend Snapshot`, `검증 근거`, `파일별 변경 근거`, `고급 상세 데이터`.
- Extended visual QA smoke with `advanced-execution` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS
