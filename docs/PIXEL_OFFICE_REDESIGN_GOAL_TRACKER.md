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
