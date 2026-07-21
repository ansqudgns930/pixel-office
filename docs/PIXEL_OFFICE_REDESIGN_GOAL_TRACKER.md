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

### 2026-07-21 — OperationsPage operations health slice

- Reframed `OperationsPage` from `운영 상태 센터` to `운영 건강도`.
- Updated page description to explain that this screen checks whether the AI company can keep working normally.
- Added operations health guidance card: `업무 운영에 문제가 생기면 여기서 먼저 확인합니다`.
- Added health badges: `서비스 건강도`, `운영 데이터`, `작업 대기열`, `업무 신호`.
- Reworded stream controls from generic event stream language to `업무 신호` language.
- Reworded health tiles to connect backend health to user-facing delegated-work reliability.
- Reworded empty stream state: Run, validation, decision, and error events appear as live work signals.
- Extended visual QA smoke with `operations-health` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — PlatformPage admin platform slice

- Reframed `PlatformPage` from `운영 플랫폼` to `플랫폼 관리`.
- Updated description to clarify this is an admin-only company operating infrastructure screen.
- Added admin guidance card: `일반 업무 흐름이 아닌 관리자 설정 화면입니다`.
- Added admin badges: `Workflow 관리`, `산업 템플릿`, `조직 확장 추천`, `어댑터 상태`.
- Reworded platform query, empty state, tabs, freshness copy, metrics guidance, recommendations, Workflow, and industry template copy toward administrator-managed infrastructure.
- Fixed copy regression caused by a broad replacement that changed `일반 업무 흐름` into broken `일반 WORKFLOW 관리`; restored intended Korean copy.
- Extended visual QA smoke with `platform-admin` route.
- Ran: `npm --prefix apps/web run build`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Ran: `npm run delegated-work:browser-qa`
- Result: PASS

### 2026-07-21 — Delegated-work terminology and link sweep

- Ran a broad terminology scan across `apps/web/src`, `scripts`, and `docs` for stale user-facing terms such as `프로젝트 워룸`, `실행 워크스페이스`, `통합 검색`, `운영 플랫폼`, `회사 목표`, and `오너 결정 센터`.
- Updated active source copy:
  - Error boundary link: `실행 워크스페이스로 이동` → `고급 실행으로 이동`.
  - Run-created event label: `새 목표가 접수되었습니다` → `새 맡긴 일이 접수되었습니다`.
  - Header activity button aria label: `통합 검색과 알림` → `결과·활동과 업무 신호`.
  - Activity search aria label: `회사 통합 검색` → `결과·활동 근거 검색`.
  - GoalsPage toast/empty aria copy: `회사 목표`/`목표` remnants → `맡긴 일`/`업무`.
- Updated current redesign plan route map to the new delegated-work route semantics.
- Updated legacy QA script labels to avoid obvious failures from renamed pages.
- Left historical audit/completion docs intact where stale terms describe past phases or prior findings rather than current UI.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — UX flow review using app-flow/onboarding/psychology references

- Created `docs/PIXEL_OFFICE_UX_FLOW_REVIEW_20260721.md`.
- Re-reviewed current Pixel Office flow using three lenses requested by the user:
  - Lazyweb/PageFlows-style step-by-step app flow comparison.
  - Gummble/Bumble-style onboarding → value reveal → paywall/commit gate patterns.
  - Growth.Design-style user psychology: cognitive load, trust formation, loss aversion, reward loop.
- Main conclusion: delegated-work route/copy redesign is directionally correct, but the first 3 minutes still need stronger emotional/psychological design.
- Key findings:
  - Current flow maps well to promise → input → preview → commit → progress → result, but transition copy is weak.
  - `이 계획으로 실행` should be treated like a paywall/commit gate because it consumes user trust, time, budget, and authority.
  - Company Home should surface why the team was chosen, what happens next, where the system stops for approval, and what result the user will receive.
  - Nav is still cognitively heavy for first-time users and should separate normal flow from operations/admin/advanced areas.
  - Completion reward loop is weak; users need a clear completed-work summary and next-work CTA.
- Recommended next implementation priorities:
  - UX-H: First-run onboarding and sample delegation.
  - UX-I: Plan preview commit gate strengthening.
  - UX-J: Post-launch guidance.
  - UX-K: Completion reward loop.
  - UX-L: Navigation simplification.
- Recommended immediate next goal: Company Home first-run onboarding + plan preview commit gate strengthening.

### 2026-07-21 — UX-H/UX-I Company Home onboarding and commit gate slice

- Implemented the next UX priority from `PIXEL_OFFICE_UX_FLOW_REVIEW_20260721.md`: first-run onboarding + plan preview commit gate strengthening.
- Updated `CompanyPage` page description to emphasize that AI company handles planning, execution, validation, decisions, and result reporting.
- Added first-run onboarding card: `처음이라면 작은 업무 하나를 AI 회사에 맡겨보세요`.
- Added 30-second start flow badges: 업무 입력 → AI 계획 preview → 안전장치 확인 → 맡기기.
- Added sample work request buttons for common first delegations.
- Strengthened plan preview/commit gate:
  - `왜 이 팀인가요?` with role-specific rationale.
  - `실행하면 이렇게 진행됩니다` step sequence.
  - `예상 개입` including risk and decision expectation.
  - `안전장치` describing high-risk pause, validation failure behavior, budget stop, and result evidence.
  - `예상 결과물` describing delegated-work record, execution Task, validation evidence, decision history, and result briefing.
- Changed primary CTA from `이 계획으로 실행` to `이 계획으로 AI 회사에 맡기기`.
- Changed secondary CTA from `수정 요청` to `계획 수정`, and added `고급 설정` link.
- Extended visual QA Company Home required copy with first-run onboarding text.
- Extended delegated-work browser E2E to assert commit-gate copy and click the new CTA.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS

### 2026-07-21 — UX-J Post-launch guidance slice

- Implemented post-launch guidance after Company Home delegated-work launch.
- Company Home launch navigation now appends `launched=1` to the GoalsPage URL.
- GoalsPage captures `launched=1` into local UI state so the guidance remains visible even after URL params are normalized by data loading.
- Added post-launch card on GoalsPage:
  - `업무를 맡겼습니다`
  - `AI 팀이 계획을 실행 중입니다. 지금은 진행 단계와 다음 액션만 확인하면 됩니다.`
- Added quick links/CTAs:
  - `진행 보기`
  - `결정 필요`
  - `픽셀 오피스 Live View`
  - `결과·활동`
- Added state badges:
  - `진행 단계 확인`
  - `결정 필요 시 멈춤`
  - `결과·활동에서 브리핑`
- Added `id="delivery-process"` target to the delivery process section for the `진행 보기` link.
- Avoided duplicate launch-note display when the post-launch card is visible.
- Extended delegated-work E2E to assert post-launch guidance copy and links.
- Extended visual QA smoke with `post-launch-guidance` route.
- Fixed a JSX conditional wrapper issue during implementation.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### 2026-07-21 — UX-K Completion reward loop slice

- Added a completion/reward loop card to `GoalsPage`.
- The delegated-work detail now shows a result-loop section that switches between `완료 리포트 준비 중` and `업무 완료`.
- The card summarizes completed work, created artifacts, validation state, decision history, and next-work continuation.
- Added primary/secondary CTAs: `다음 업무 맡기기`, `근거 자세히 보기`, and `픽셀 오피스에서 보기`.
- Extended delegated-work browser QA and visual QA smoke to assert the reward-loop copy.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### 2026-07-21 — UX-L Navigation simplification slice

- Reorganized sidebar navigation around delegated-work user intent instead of a flat admin console menu.
- Added grouped navigation sections:
  - `업무 흐름`: 내 회사, 회사 홈, 맡긴 일, 결정 필요, 결과·활동, 픽셀 오피스.
  - `운영·관리`: 직원·AI팀, 실행 작업실, 업무 검토 회의.
  - `고급`: AI 엔진 설정, 고급 실행, 운영 건강도, 플랫폼 관리.
- Updated stale nav labels including `회의` → `업무 검토 회의`, `운영 상태` → `운영 건강도`, `플랫폼` → `플랫폼 관리`.
- Added sidebar group descriptions to explain whether each area is normal user flow, management, or advanced/admin.
- Extended visual QA to assert the nav groups on desktop and mobile Company Home.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### 2026-07-21 — UX-M Direct browser UX review fixes, priority 1-3

- Fixed the high-priority GoalsPage title wrapping issue found during direct browser UX review; long Korean delegated-work titles no longer wrap one character per line in the detail header.
- Cleaned Company Home plan preview internal/debug copy:
  - `fallback draft` is now shown as `기본 계획 모드`.
  - `goal-draft-model-not-configured` is translated to user-facing guidance about default planning mode before AI engine setup.
- Swept stale meeting labels in the reviewed flow:
  - Company Home quick link `회의` → `업무 검토 회의`.
  - GoalsPage toolbar `목표 회의` → `업무 검토 회의`.
- Extended delegated-work browser QA to assert the new user-facing fallback copy and reject internal copy leakage.
- Re-checked directly in browser without direct API calls: Company Home preview and GoalsPage detail title layout.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### 2026-07-21 — UX-M-2 Direct browser UX review fixes, priority 4-5

- Reduced company dropdown noise in the main delegated-work flow by hiding generated QA/test companies behind a disabled summary option such as `테스트 회사 27개 숨김`.
- Added shared company option helpers in `apps/web/src/companyOptions.ts` to keep the currently selected company visible while filtering generated QA/test companies from user-facing selectors.
- Applied the filter to Header, Company Home, and GoalsPage selectors, the most visible dropdowns in the direct browser flow.
- Added a Pixel Office live-density card: `지금 AI 팀이 하는 일`.
- The new Pixel Office card summarizes current phase, active agent, room distribution, priority signals, and operational risk before the large office canvas, reducing the empty-dashboard feeling.
- Updated Pixel Office stale toolbar label `회의` → `업무 검토 회의`.
- Re-checked directly in browser without direct API calls: Company Home dropdown and Pixel Office live-density card.
- Extended visual QA to assert hidden test-company summary and live-density copy.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### UX-P — 직원 프롬프트 자동생성 / AI 직원 채용

Status: **In Progress — UX-P6 execution provenance slice implemented; full live custom-employee smoke still requires Node24/server restart**

Plan: `docs/PIXEL_OFFICE_EMPLOYEE_PROMPT_GENERATION_PLAN_20260721.md`

Scope:
- 사용자가 자연어로 필요한 직원을 대략 설명한다.
- LLM이 직원명, 직무, 작업 방식, 권한, 금지 행동, 보고 형식, prompt profile을 구조화해 자동 생성한다.
- 생성된 직원은 바로 실행되지 않고 commit gate에서 검토 후 채용된다.
- 채용된 custom employee는 Company Home 업무 plan preview와 staffing plan에 자동 반영된다.

Acceptance criteria:
- 사용자가 raw system prompt를 직접 쓰지 않아도 직원을 만들 수 있다.
- 외부 게시, 광고비, DM, 개인정보 등 위험 행동은 기본적으로 승인 필요 또는 금지로 보강된다.
- employee profile은 기존 role prompt/security layer보다 높은 권한을 갖지 않는다.


### 2026-07-21 — UX-P1/P2 first slice

- Added web `EmployeeProfile` / `EmployeePromptProfile` types.
- Added `apps/web/src/employeeProfiles.ts` with core-team and example custom employee profile templates.
- Extended `직원·AI팀` with a `직무기술서` tab showing responsibilities, work style, deliverable format, success criteria, allowed actions, approval-required actions, forbidden actions, internal role mapping, and prompt profile preview.
- Reframed `새 직원 추가` as future natural-language employee draft generation with sample employee requests.
- Extended visual QA with an employee profile screen check.
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS


### 2026-07-21 — UX-P3 employee draft generation slice

- Added `packages/employee-drafting/src/index.ts` with `draftEmployeeProfile()`, JSON output contract, safety defaults, model path, and deterministic fallback.
- Added Control Plane action and endpoint: `POST /api/companies/:companyId/employees/draft`.
- Wired local control plane to use configured backend when available, otherwise fallback draft mode.
- Added web `EmployeeDraftResponse` types.
- Extended `직원·AI팀` new-hire flow with natural-language request textarea, sample request buttons, `직원 초안 만들기` CTA, and draft preview.
- Safety behavior: external posting, DM/comment sending, ad spend/payment, account/token access, and personal data use are forced into approval-required/forbidden fields.
- Ran: `npm run typecheck`
- Ran: `npm run build`
- Ran: fallback contract smoke against `dist/packages/employee-drafting/src/index.js`
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run delegated-work:browser-qa`
- Ran: `node scripts/pixel-office-redesign-visualqa.cjs`
- Result: PASS
- Note: currently running Control Plane process was still pre-UX-P3 and returned 404 for the new endpoint until restart.


### 2026-07-21 — UX-P4 employee activation persistence slice

- Added persisted employee profile storage in company ops: `employee_profiles_v25`.
- Added `setEmployeeProfile()`, `employeeProfile()`, and `employeeProfiles()` APIs in `packages/company-ops`.
- Added Control Plane endpoints:
  - `GET /api/companies/:companyId/employees/profiles`
  - `POST /api/companies/:companyId/employees/activate`
- Updated Employees page to fetch active saved profiles and prefer them over local templates.
- Updated new-hire flow: generated draft preview now leads to `이 직원 채용하기`, which creates/updates the company member and persists the active employee profile.
- Ran: `npm run typecheck`
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run build`
- Ran: `npm run delegated-work:browser-qa` — PASS
- Visual QA rendered required screens, but current running Control Plane was pre-UX-P4 and produced optional profile-endpoint 404 console errors.
- Attempted isolated new Control Plane on port 4311; blocked by current shell Node v22 missing `node:sqlite` `backup` export. Live endpoint smoke should run after restarting the app with the configured Node24 runtime.


### 2026-07-21 — UX-P5 custom employee staffing slice

- Extended `packages/staffing-rules` with custom employee candidate inputs and `recommendedEmployees` output.
- Staffing now scores saved employee profiles against the rough work request and recommends matching custom employees such as `SNS Marketer` for Instagram/marketing requests.
- Updated Control Plane `POST /api/companies/:companyId/staffing/plan` to include active saved employee profiles from `employee_profiles_v25`.
- Updated Company Home AI plan preview to show when a hired custom employee is being used, including employee id, role title, reason, and approval-required risk notes.
- Ran: `npm run typecheck`
- Ran: `npm --prefix apps/web run build`
- Ran: `npm run build`
- Ran: staffing rule unit smoke against `dist/packages/staffing-rules/src/index.js`
- Ran: `npm run delegated-work:browser-qa` — PASS
- Note: current live Control Plane remains pre-UX-P4/P5, so full browser smoke for saved custom employee → staffing preview should run after restarting with Node24 runtime.


### 2026-07-21 — UX-P6 employee profile execution provenance slice

- Added persisted Goal/Run employee profile snapshots in company ops: `goal_employee_profile_snapshots_v26`.
- Added `snapshotGoalEmployeeProfiles()` and `goalEmployeeProfileSnapshots()` APIs.
- Goal snapshots now include `employeeProfileSnapshots`, profile hash provenance, and a snapshot hash that accounts for the employee profiles used at launch time.
- Updated Control Plane goal launch to accept recommended employee snapshot inputs and persist active employee profiles against the created Goal/Run.
- Updated Company Home launch payload to send recommended custom employee ids/reasons from the staffing preview.
- Updated GoalsPage to show `이 업무에 사용된 직원 profile` with employee name, role, version, reason, approval-required actions, and profile hash.
- Extended `tests/goal-launch-api.test.ts` so goal launch verifies saved custom employee profile provenance.
- Ran: `npm run typecheck` — PASS
- Ran: `npm run build` — PASS
- Ran: `npm --prefix apps/web run build` — PASS
- Ran: `node --test dist/tests/goal-launch-api.test.js` — PASS
- Note: `npm test -- tests/goal-launch-api.test.ts` is not a valid targeted TypeScript test invocation in this repo; it also runs existing dist tests and still hits the known Node22 `node:sqlite backup` issue.

### 2026-07-21 — UX-P7 employee workflow API QA slice

- Added `tests/employee-workflow-api.test.ts` to cover the employee workflow without browser/runtime env dependencies.
- The test verifies: employee draft endpoint, employee activation/persistence, active profile listing, custom employee staffing recommendation, and delegated-work goal launch provenance snapshot.
- This is the first UX-P7 QA layer; full browser/visual QA still requires `QA_TOKEN`, `BROWSER_AUTOMATION_EXECUTABLE`, and a restarted Node24 Control Plane/Web stack.
- Ran: `npm run typecheck` — PASS
- Ran: `npm run build` — PASS
- Ran: `node --test dist/tests/employee-workflow-api.test.js` — PASS


### 2026-07-21 — UX-P7 employee workflow browser QA harness

- Added `scripts/verify-employee-workflow.cjs` and npm script `employee-workflow:browser-qa`.
- The browser QA scenario covers employee draft UI, activation, Company Home custom employee staffing preview, delegated-work launch, and GoalsPage employee profile provenance rendering.
- The script writes screenshots/report to `.runtime/visualqa/employee-workflow/`.
- Environment guard verified: it fails fast with `QA_TOKEN and BROWSER_AUTOMATION_EXECUTABLE are required` when live QA credentials/browser are not configured.
- Full execution remains blocked until the Node24 Control Plane/Web stack is restarted and QA env values are present.


### 2026-07-21 — UX-P7 live browser QA closed

- Restarted the live Control Plane on Node24 after confirming the old 4310 process returned 404 for employee draft/profile endpoints.
- Verified employee endpoints after restart: draft endpoint returned fallback SNS Marketer and profiles endpoint returned an empty active list for a fresh QA company.
- Ran `npm run employee-workflow:browser-qa` successfully against live API/Web stack.
  - Covered employee draft UI, hire/activation, custom employee staffing preview, delegated-work launch, and GoalsPage employee profile provenance.
  - Output: `.runtime/visualqa/employee-workflow/report.json`; errors: `[]`.
- Ran `npm run delegated-work:browser-qa` successfully against live API/Web stack; errors: `[]`.
- Ran `node scripts/pixel-office-redesign-visualqa.cjs` with QA env successfully; all required route checks had `missing: []`, `overflow: false`, `errors: []`.
- Fixed the employee workflow QA selector to avoid Playwright strict-mode collision between the draft toast and `Prompt profile preview` heading.


### 2026-07-22 — UX-P8 employee draft prompt-injection regression

- Added normalization hardening in `packages/employee-drafting/src/index.ts` so model-provided employee drafts cannot keep unsafe allowed actions or prompt override instructions.
- Unsafe model output such as direct posting without approval, token/password requests, ad-budget spend, approval bypass, or security override is stripped from `allowedActions`, `promptProfile.systemAddendum`, and `promptProfile.taskInstructions`.
- Added `tests/employee-drafting-security.test.ts` covering malicious model JSON that attempts to bypass approval/security rules.
- Validation passed: `npm run typecheck`, `npm run build`, `node --test dist/tests/employee-drafting-security.test.js dist/tests/employee-workflow-api.test.js`, tracked secret scan `[]`.
- This is post-release hardening after `v0.1.0-pixel-office-redesign`; the release tag remains on the validated release closeout commit.


### 2026-07-22 — UX-Q1/Q2 live UI polish

- UX-Q1: polished the delegated-work `GoalsPage` detail surface after direct UI review found white-card contrast, narrow Korean title wrapping, and automation/delivery stepper density issues after launch.
  - Goals detail/sidebar now inherit the dark app shell more consistently.
  - Long delegated-work titles use safer width/wrapping rules.
  - Automation and delivery stage steppers use card-like responsive items instead of cramped connector rows.
  - Desktop and narrow layouts were checked directly in the browser.
- UX-Q2: strengthened launch transition feedback on `CompanyPage`.
  - Planning request button now changes to `AI 팀이 계획을 만드는 중…`.
  - Launch button now changes to `AI 회사에 맡기는 중…`.
  - Added a visible progress status banner for planning/launch actions so the UI no longer looks stalled while work is being delegated.
- Validation: `npm run typecheck` and `npm --prefix apps/web run build` passed before commit.
