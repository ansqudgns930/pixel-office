# Agent Company OS 차기 종합 구현계획

> 기준일: 2026-07-16, 문서 재정리: 실제 코드/감사 문서 대조 반영  
> 상태: 0~8순위 구현·자동 게이트 완료. 남은 활성 작업은 4.1절 R1~R4(Golden human review, artifact 정리, 버전 관리 도입, target 환경 배포 증적)뿐이다.  
> 적용 범위: 역할 실행·Context·보고·회의·Pixel Office·Agent Backend·운영 검증

> 진행: Milestone 0 완료 (`MILESTONE_0_RUNTIME_BASELINE_AUDIT.md`), Milestone A1~A3 완료 (`MILESTONE_A1_A3_ROLE_SNAPSHOT_AUDIT.md`), Milestone A4~A5 구현 완료·Golden human review 대기 (`MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`), Milestone B 자동 acceptance 완료 (`MILESTONE_B_REPORTING_HANDOFF_AUDIT.md`), Milestone C 자동 acceptance 완료·Golden human review 대기 (`MILESTONE_C_ROLE_MEETING_AUDIT.md`), Redis queue/AOF 재시작 rehearsal 완료 (`REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`), Milestone D 신규 provider 미추가 결정 (`MILESTONE_D_EXTENSION_DECISION.md`). 전체 release는 Golden human review 전까지 미완료다.

## 1. 목적과 적용 원칙

현재까지 완성된 통제·재현성·보안·회사 운영 UI·Pixel Office 표현 계층을 보존하면서 다음 제품 단계인 **역할이 실제 행동을 바꾸는 조직 운영 시스템**을 구현한다.

이 계획은 `prj.md`, `prj_2.md`, 역할/Backend 인수인계 문서, 완료 감사 문서, Claw-Empire 비교 분석, 실제 코드 호출 경로, 3회의 계획 평가를 통합한 최신 실행 기준이다.

Claw-Empire와 Pixel Agents는 패턴 참고 자료다. 코드·Prompt·그래픽 자산을 제품 기반으로 복사하지 않으며, 유용한 패턴도 Agent Company OS의 승인·예산·감사·snapshot·Prompt hash·trusted/untrusted 체계 안에서 재구현한다.

## 2. 현재 기준선

### 2.1 완료되어 유지할 기반

- 위험도 기반 `planner → worker → reviewer` 호출과 Run 상태 머신
- 계획·결과 승인 무결성, 만료, patch hash, Worktree 격리
- Tool Gateway 경로·도구 통제와 결정론적 Validator
- Context Builder의 trust·hash·중복·stale·예산 처리
- JSON Role Prompt, `DATA_ONLY_NEVER_INSTRUCTIONS`, 버전·SHA-256 감사
- 회사·부서·구성원·프로젝트·RoleTemplate·권한·예산·정책
- 직원/역할/회사별 Agent Backend binding과 `PLANNING` 진입 시 원자적 execution snapshot(`executionSnapshotId`)
- 목표·프로젝트·Task·Run·회의·요약 확정·후속 Task·검색·알림
- 실제 이벤트 기반 Pixel Office 동시 업무·걷기·말풍선·모니터·성과 피드백
- 인증, SSE, outbox, backup/restore, production preflight, 전체 회귀 게이트
- 지원 Node/npm/SQLite runtime 고정과 재현 가능한 녹색 기준선(Milestone 0)
- Task/Run 단위 역할별 RoleTemplate 해석·binding·원자적 snapshot, tenant/부서 경계, primary assignment 모호성 fail-closed(Milestone A1~A3)
- `RoleExecutionProfile`(jobFamily/requiredOutputs/prohibitedActions/qualityChecklist/escalationConditions) 기반 역할별 Prompt 배선과 결정론적 gate, Git 기반 `RepositoryOverview`의 trusted/untrusted 경계와 Planner/Worker/Reviewer 공통 소비(Milestone A4~A5)
- 이벤트 기반 결정론적 보고 projector(부서장 체인→executive→owner fallback, cycle-safe, `unroutable` 처리)와 부서 간 위임·인계 상태 머신(Milestone B)
- `MeetingAgentRunner`의 lease/idempotency/`execution-uncertain`/예산 예약-정산, 제한 라운드 Agent 회의, Agent 해석 보고(4B), 회의 의미 요약, 실제 회의 참석자 Pixel 집결(Milestone C)
- project-local portable Redis/AOF 기반 queue 재시작·복구 rehearsal(`REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`)

### 2.2 코드로 확인된 잔여 gap (2026-07-16 재분석)

1~8순위(RoleTemplate 해석, RoleExecutionProfile Prompt, RepositoryOverview, 결정론적 보고·위임, MeetingAgentRunner, 제한 라운드 회의·Agent 보고, 회의 의미 요약, Pixel 회의 집결)는 구현·자동 회귀·browser QA 게이트를 모두 통과했다. 과거 버전의 2.2절이 지적한 미배선은 해소됐다. 남은 gap은 구현이 아니라 release 판정·운영·엔지니어링 위생 항목이다.

| 영역 | 확인된 현재 상태 | 영향 |
| --- | --- | --- |
| Golden Scenario human review | 역할·회의 Golden 모두 자동 게이트는 PASS이나 `acceptanceStatus: pending-human-review`이며 `GOLDEN_HUMAN_REVIEW_PACKET.md`의 reviewer 2인·release owner 판정란이 비어 있다. | Milestone A/B/C 어느 것도 공식 release acceptance가 아니다. 유일한 release-blocking gate다. |
| Golden artifact 보관 이력 | `outputs/role-golden-*.json`(2026-07-16 12:36, tool 가시성 실패·혼란스러운 reviewer 출력 포함)과 `runtime/golden/role-golden-*.json`(2026-07-16 14:07, 정상 출력)이 동일 commit에 대해 공존한다. A4~A5 감사는 전자를 "ignored operational evidence"로 표시하지만 왜 폐기됐는지 사유가 기록되어 있지 않다. | human reviewer가 어느 artifact가 판정 대상인지, 첫 시도가 왜 버려졌는지 알 수 없다. |
| 소스 버전 관리 | `agent-company-os`(및 상위 `paperclip`) 디렉터리에 `.git`이 없다. | 정교한 schema 롤백·호환성 window 계약과 달리 소스 코드 자체는 diff 이력·branch·revert 수단이 없다. 잘못된 편집을 되돌릴 방법이 문서상 audit trail뿐이다. |
| Backend 범위 | standalone, legacy NVIDIA, OpenAI-compatible, Claude CLI, Codex CLI를 지원하며 Gemini/OpenCode/Kimi는 `MILESTONE_D_EXTENSION_DECISION.md`로 명시적 보류됐다. | 의도된 상태이며 추가 조치 불필요. 실사용 요구가 생기면 재개. |
| 운영 증적 범위 | Redis queue/AOF 재시작 rehearsal은 이 PC 환경에서 완료했다. Milestone B/C의 backup/restore rehearsal도 완료했다. release 후보용 production preflight, PID/log, graceful stop, 별도 경로 restore, rollback 증적은 별도 target 환경에서 아직 남긴 적이 없다. | 이 PC 로컬 운영 검증은 끝났지만 실제 배포 대상 환경 기준 "production 완료"는 아직 선언할 수 없다. |

### 2.3 기준선 상태 (해소됨)

Milestone 0에서 지원 runtime을 `package.json#engines`(Node `>=24.17.0 <25`, npm `>=11.13.0 <12`), `.node-version`, `.npmrc(engine-strict=true)`로 고정했고, production preflight가 비지원 Node/누락된 `node:sqlite` backup capability를 명시적으로 거부한다. 이 PC의 portable runtime(`.tools/node-v24.17.0-win-x64`)에서 `npm ci && npm run verify`가 PASS함을 확인했다(`MILESTONE_0_RUNTIME_BASELINE_AUDIT.md`). 이 절의 blocker는 더 이상 유효하지 않으며 신규 착수 항목은 없다.

## 3. 판단 기준

1. UI 장식보다 Prompt·Context·권한·실행 경로가 실제 행동을 바꾸는지 우선한다.
2. 이미 존재하는 데이터의 미배선을 신규 대형 기능보다 먼저 해결한다.
3. 한 Run/Task/산출물/결정에는 단일 owner를 둔다.
4. 실제 event·ledger·snapshot이 없는 조직 상태를 연출하지 않는다.
5. 저장소·파일 경로·Transcript·이전 출력·자유 텍스트는 instruction이 아니라 evidence다.
6. 자동 회귀 통과와 실제 모델 행동 품질을 별도 게이트로 검증한다.
7. 스키마 추가만으로 완료 판정하지 않고 생성 주체와 소비 경로를 함께 닫는다.
8. 각 Milestone은 독립적으로 배포·복구 검증이 가능해야 한다.

## 4. 최종 우선순위

| 순위 | 목표 | 규모 | 상태 |
| ---: | --- | --- | --- |
| 0 | 지원 runtime 고정·기준선 회귀 복구 | S | **완료** — `MILESTONE_0_RUNTIME_BASELINE_AUDIT.md` |
| 1 | 역할별 RoleTemplate 해석·binding·snapshot | M | **완료** — `MILESTONE_A1_A3_ROLE_SNAPSHOT_AUDIT.md` |
| 2 | RoleExecutionProfile → 역할별 Prompt 배선·직무 프로필 | M | **구현 완료** — `MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`, Golden human review 대기 |
| 3 | RepositoryOverview 생성기와 역할별 Context | M | **구현 완료** — 위와 동일 문서 |
| 4 | 결정론적 보고·위임·인계 라우팅 | M | **자동 acceptance 완료** — `MILESTONE_B_REPORTING_HANDOFF_AUDIT.md` |
| 5 | MeetingAgentRunner·turn·예산·Backend snapshot | L | **구현 완료** — `MILESTONE_C_ROLE_MEETING_AUDIT.md`, Golden human review 대기 |
| 6 | 제한 라운드 Agent 회의·Agent 작성 보고 | L | **구현 완료** — 위와 동일 문서 |
| 7 | 회의 의미 요약·결정 검증 | M | **구현 완료** — 위와 동일 문서 |
| 8 | 실제 회의 참석자 Pixel 집결 | M | **구현 완료** — 위와 동일 문서 |
| 9 | Milestone별 실제 운영 배포 증적 | M | **부분 완료** — 이 PC 로컬 Redis rehearsal·backup/restore 완료, 별도 target 환경 release 증적 미착수 |
| 10 | 추가 Backend와 설정 마법사 | L | **보류 결정** — `MILESTONE_D_EXTENSION_DECISION.md`, 실수요 확인 전 재개 안 함 |
| 11 | 장기 조직 시뮬레이션·편집 기능 | XL | 보류 유지 |

### 4.1 실제 남은 활성 작업

구현 우선순위 1~8은 모두 코드·자동 게이트를 통과했다. 지금 시점에 실행 가능한 유일한 release-blocking 작업은 코딩이 아니라 판정이다.

| 순위 | 목표 | 규모 | 선행 관계 |
| ---: | --- | --- | --- |
| R1 | Golden Scenario 2인 human review + release owner 판정 완료 | S | 1~8 완료(선행 충족) |
| R2 | Golden artifact 보관 정책 정리(`outputs/` 초기 실패 실행 폐기 사유 기록 또는 삭제) | S | 없음, R1과 독립 |
| R3 | 소스 저장소 `git init` 및 초기 커밋으로 버전 관리 도입 | S | 없음, R1과 독립 |
| R4 | Milestone A/B/C 종료 target 환경 production 배포 증적(9순위 잔여분) | M | R1 |

R2~R4는 이번 세션에서 코드를 만들지 않았지만, R1과 별개로 계획서에 반영한다.

## 5. 상세 실행계획

### 0순위 — 지원 runtime 고정·기준선 회귀 복구 (완료)

Node `>=24.17.0 <25` / npm `>=11.13.0 <12`를 `package.json#engines`, `.node-version`, `.npmrc(engine-strict=true)`로 고정했다. `npm run runtime:check`와 production preflight가 실제 executable, `node:sqlite`의 `DatabaseSync`/online backup capability를 검사하고 비지원 조합을 model/backend 호출 전에 차단한다. 이 PC portable runtime(`.tools/node-v24.17.0-win-x64`)에서 `npm ci && npm run verify` PASS를 확인했다.

완료 근거: `MILESTONE_0_RUNTIME_BASELINE_AUDIT.md`. 신규 작업 없음.

### 1순위 — 역할별 RoleTemplate 해석·binding·snapshot (완료)

binding 저장·해석 축을 `target(project/task/company) + pipelineRole`로 정규화하고(`role_template_bindings_v15`, `pipeline_role TEXT NOT NULL DEFAULT ''`), Task+role → Project+role → Task 공통 → Project 공통 → Company+role → Company 공통 순으로 해석한다. 복수 executor/reviewer가 모호하면 `assignment-ambiguous`로 fail-closed하고, Run이 최초로 `PLANNING`에 진입하는 단일 SQLite transaction에서 planner/worker/reviewer 전체 역할 profile과 Backend binding을 하나의 `executionSnapshotId`로 원자적으로 고정한다. 기존 `role_template_bindings_v4`는 compatibility window 동안 보존하고 `role_binding_migration_checks_v15`로 backfill 정합성을 감사한다.

완료 근거: `MILESTONE_A1_A3_ROLE_SNAPSHOT_AUDIT.md`(집중 테스트 32/32 PASS). 신규 작업 없음.

### 2순위 — RoleExecutionProfile → 역할별 Prompt 배선·직무 프로필 (완료)

`RoleTemplate`을 `jobFamily`, `responsibility`, `completionCriteria`, `requiredOutputs`, `prohibitedActions`(`deterministic-check`/`prompt-only` 구분), `qualityChecklist`, `escalationConditions`, `allowedTools`, `requiredReviews`, `requiredApprovals`, `profileHash`로 확장했다(`role_templates_v15`). `composeRolePrompt()`가 역할별로 필요한 필드만 선택해 프롬프트 envelope에 구조화하고, QA production patch·승인 경로 밖 patch는 deterministic gate가 차단한다. 개발/QA 기본 profile을 데모 bootstrap에 idempotent하게 생성해 Worker/Reviewer에 바인딩한다.

완료 근거: `MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`(집중 테스트 22/22 PASS). 실제 Backend Golden Scenario는 자동 게이트 PASS, human review는 R1로 이관.

### 3순위 — RepositoryOverview 생성기와 역할별 Context (완료)

Git HEAD + dirty-state fingerprint + Project ID + scanner version 기반 결정론적 cache를 구현했다(`repository_overviews_v16`). commit hash·scanner version·file 수·크기·생성 시각·overview hash만 trusted metadata이며 파일 트리·README·manifest·소스 내용은 모두 untrusted evidence로 분리한다. `RepositoryRoleContext`는 역할에 무관하게 동작해 Planner/Worker/Reviewer 모두 동일 overview snapshot을 Context 예산 안에서 받는다(최대 500 files, depth 4, file 128 KiB, evidence 512 KiB/40 files, binary/symlink/nested-repo 제외).

완료 근거: `MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`. 신규 작업 없음.

### 4순위 — 결정론적 보고·위임·인계 라우팅 (완료)

`ReportingProjector`가 `events_v6`를 cursor 순으로 재생해 `deterministic-report-v1`을 생성한다(`deterministic_reports_v17`). 보고선은 source 담당자 부서부터 `departments.parentId`를 cycle-safe하게 탐색하고, 동일 단계 복수 후보는 `principalId` 오름차순으로 결정론적으로 고르며, 부서장이 없으면 executive, 없으면 owner로 승격한다. 수신자가 전혀 없으면 `unroutable`로 표시하고 owner 알림을 만든다. dedupe key는 `sourceEventId + reportType + recipientId + contractVersion`이며 projector version 변경 시 전체 replay한다. 타 부서 위임은 대상 부서 `department-manager` 승인을 거치는 `delegation-handoff-v1` snapshot(단일 owner, 완료 기준, 허용 scope, deadline, provenance)으로 관리하며 승인·거절·재할당·부분완료·만료·인계실패를 상태 전이로 감사한다.

완료 근거: `MILESTONE_B_REPORTING_HANDOFF_AUDIT.md`(보고·위임 API 10개 테스트, backup/restore/replay dedupe, 실제 Chromium QA 모두 PASS). 신규 작업 없음.

### 5순위 — MeetingAgentRunner·turn·예산·Backend snapshot (완료)

`MeetingAgentRunner`가 `meeting_agent_turns_v18`에서 다음 실행 가능한 turn을 lease하고 호출한다. 멱등 키는 `meetingId+round+participantId+objectiveVersion`이며 상태는 `pending → running → completed | failed | cancelled | execution-uncertain`이다. 비멱등 Provider의 전송 후 crash는 `execution-uncertain`으로 격리해 운영자 확인 전에는 재호출하지 않고, 결과 저장 후 message projection만 실패하면 동일 turn/message ID로 투영만 재시도한다. lease 획득 직전과 model 호출 직전에 회의 status·paused·deadline을 재확인해 pause/end와 경합하면 호출 전 취소한다. 토큰/비용/round/output byte 상한을 reservation→settlement로 강제한다.

완료 근거: `MILESTONE_C_ROLE_MEETING_AUDIT.md`. 신규 작업 없음.

### 6순위 — 제한 라운드 Agent 회의·Agent 작성 보고 (완료)

3라운드(사실수집→대안/위험검토→수렴) 상한의 회의 프로토콜을 구현했다. Agent 발언은 `opinion|question`, 1~3문장, 입력 evidence ID 부분집합만 허용하고 instruction/decision 권한은 없다. 라운드 상한 도달 시 회의는 `decision-pending`으로 전환한다. Agent 작성 보고(4B)는 `AgentReportInterpreter`가 4A `DeterministicReport`의 사실을 입력으로 받아 역할 관점 해석·위험·제안만 추가하며 evidenceId는 원본 보고의 부분집합만 허용하고, 모델 실패 시 결정론적 보고 그대로 fallback한다.

완료 근거: `MILESTONE_C_ROLE_MEETING_AUDIT.md`. 신규 작업 없음.

### 7순위 — 회의 의미 요약·결정 검증 (완료)

`SemanticMeetingSummary`가 종료된 회의의 canonical 결정론적 요약을 입력으로 받아 안건별 요약·입장·결정 후보·위험·미해결 질문·후속 Task 후보를 생성한다. 모든 항목은 message evidence ID로 검증하고, evidence가 없거나 canonical decision과 문구가 일치하지 않는 결정 후보는 제외 또는 경고 처리한다. 모델 실패 시 canonical-fallback으로 복구하며 결정 후보에는 `authority:"candidate-only"`를 부여해 자동 승격을 막는다.

완료 근거: `MILESTONE_C_ROLE_MEETING_AUDIT.md`. 신규 작업 없음.

### 8순위 — 실제 회의 참석자 Pixel 집결 (완료)

`live`/`decision-pending` 회의의 실제 Agent 참석자만 회의 테이블에 집결하고 Human 참석자는 제외한다. pause/decision 상태와 최근 발언 요약을 표시하고 클릭 시 `meetingId`/`participantId` context로 `/meetings`에 연결하며, 종료 시 기존 work item 상태로 복귀한다.

완료 근거: `MILESTONE_C_ROLE_MEETING_AUDIT.md`(browser QA: mobile overflow 0, console/page/HTTP error 0). 신규 작업 없음.

### R1순위 — Golden Scenario human review 완료 (release-blocking, 신규)

#### 목표

1~8순위 구현이 실제로 의도한 역할 관점 품질을 내는지 사람이 최종 판정해 Milestone A/B/C release acceptance를 닫는다.

#### 현재 상태

- 역할 Golden(`runtime/golden/role-golden-edd835c5150a.json`)과 회의 Golden(`runtime/golden/meeting-golden-edd835c5150a.json`) 모두 자동 계약 게이트 PASS, `acceptanceStatus: pending-human-review`.
- `GOLDEN_HUMAN_REVIEW_PACKET.md`에 두 artifact의 rubric과 기록 양식이 이미 준비되어 있다. Reviewer 1/2/release owner 란이 비어 있다.

#### 완료 기준

- 2인 reviewer가 각 rubric 항목(책임 준수, 금지 행동 없음, evidence 사용, 역할 관점 차별성, 불확실성/escalation)을 0~2점으로 기록한다.
- 두 reviewer 판정이 다르면 평균으로 통과시키지 않고 release owner가 원문을 재검토해 최종 PASS/FAIL/WAIVER와 근거를 기록한다.
- WAIVER 사용 시 영향 범위·만료일·후속 조치를 명시한다.
- 판정 완료 후 `MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`와 `MILESTONE_C_ROLE_MEETING_AUDIT.md`의 "잔여 release gate" 절을 판정 결과로 갱신한다.

### R2순위 — Golden artifact 보관 정책 정리 (신규, 소규모)

`outputs/role-golden-edd835c5150a.json`(2026-07-16 12:36 실행, tool 출력 가시성 실패로 worker/reviewer 출력이 혼란스러움)과 `runtime/golden/role-golden-edd835c5150a.json`(2026-07-16 14:07 실행, 정상 출력)이 동일 commit에 대해 공존한다. 어느 쪽이 공식 판정 대상인지, 첫 실행이 왜 폐기됐는지 문서화되어 있지 않다. `outputs/`의 실행을 실패 사유와 함께 보관하거나 삭제하고, golden evaluator가 "공식" artifact 저장 위치(`runtime/golden/`)만 사용하도록 스크립트/문서에 명시한다.

### R3순위 — 소스 저장소 버전 관리 도입 (신규, 소규모)

`agent-company-os`는 현재 `.git`이 없다. schema migration은 expand→backfill→cutover→compatibility window→제거의 정교한 rollback 계약을 갖췄지만, 소스 코드 자체는 diff 이력이나 revert 수단이 없어 문서 기반 audit trail에만 의존한다. `git init` 후 현재 상태를 초기 커밋하고, 이후 변경은 Milestone 단위로 커밋해 코드 변경 이력과 완료 감사 문서를 대응시킨다.

### R4순위 — Milestone A/B/C 종료 target 환경 production 배포 증적 (9순위 잔여분)

이 PC 로컬 환경의 Redis queue/AOF 재시작 rehearsal(`REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`)과 Milestone B/C의 file-DB backup/restore rehearsal은 완료했다. 9순위가 요구하는 release 후보용 production preflight, PID/log, graceful stop, 별도 경로 restore, rollback 증적은 아직 실제 배포 target 환경에서 수행한 적이 없다. target 환경(로컬 상시 운영 PC인지 별도 서버인지)을 확정한 뒤 환경 ID·OS·Node/runtime·DB/Redis 위치·선택 Backend·release version·비밀값 제외 환경변수·시작/검증/복구 시각과 담당자를 기록한다.

### 9순위 — Milestone별 실제 운영 배포 증적 (부분 완료)

Milestone A 종료 증적(선택 Backend 최소 Run, Redis queue 복구)과 Milestone B/C 종료 증적(보고 projector 재시작·중복 방지·backup/restore, Meeting Runner lease·예산·중단·복구 rehearsal)은 이 PC 로컬 환경에서 완료했다(`REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`, `MILESTONE_B_REPORTING_HANDOFF_AUDIT.md`, `MILESTONE_C_ROLE_MEETING_AUDIT.md`). release 후보 단계의 production preflight, PID/log, graceful stop, 별도 경로 restore, rollback 증적은 아직 남기지 않았다 — 남은 작업은 R4순위로 이관했다.

`npm run verify`는 코드 게이트이며 특정 환경의 운영 완료 증거를 대체하지 않는다는 원칙은 유지한다.

### 10순위 — 추가 Backend와 설정 마법사 (보류 결정 완료)

`MILESTONE_D_EXTENSION_DECISION.md`에서 Gemini CLI/OpenCode/Kimi 추가를 보류하기로 결정했다. 현재 standalone/OpenAI-compatible/Claude CLI/Codex CLI binding과 probe로 충분하며, 검증되지 않은 인증·stdin·취소·timeout 계약을 추측해 adapter를 넓히는 것보다 기존 provider 계약과 Milestone A~C acceptance를 유지하는 편이 안전하다고 판단했다. 아래 조건 중 하나가 생기면 재개한다.

- 명시적인 사용자/운영 provider 요구
- 기존 provider로 충족하지 못하는 target environment 제약
- 고정 Golden fixture와 실제 로그인·취소·timeout·비밀 비저장 검증 환경

재개 시에는 공식 CLI 계약 조사, provider manifest, probe-before-save, credential 비저장, 실제 Run/Golden/rollback 증적을 모두 요구한다.

### 11순위 — 장기 후보

- 레이아웃 에디터와 공간 커스터마이징
- CEO 아바타 직접 조작·근접 상호작용
- 직급별 행동 차이와 성장
- 조직 시뮬레이션과 인력/예산 최적화
- 장기 기억·지식 그래프와 외부 협업 도구

직급은 Claw-Empire에서도 라벨보다 실질 행동 차이가 약하므로, 실제 책임·품질 차이를 검증할 사용 사례가 생기기 전 구현하지 않는다.

## 6. Milestone 납품 구조

### Milestone 0 — 재현 가능한 녹색 기준선

- 지원 Node/npm/SQLite capability 고정.
- 깨끗한 설치와 전체 `npm run verify` 통과.
- 비지원 runtime의 명시적 preflight 실패와 runtime 증적 기록.

### Milestone A — 역할이 실제 행동을 바꾸는 수직 슬라이스 (구현·자동 게이트 완료, release는 R1 대기)

A1~A5(schema expand, 순수 resolver, 원자적 execution snapshot, Prompt/Context 배선, RepositoryOverview 통합) 모두 완료했다. `MILESTONE_A1_A3_ROLE_SNAPSHOT_AUDIT.md`와 `MILESTONE_A4_A5_ROLE_CONTEXT_AUDIT.md`에 PR 단위 증적이 있다. 자동 회귀와 실제 Backend Golden Scenario 자동 게이트는 PASS했고, 남은 것은 R1(human review)뿐이다.

### Milestone B — 보고 가능한 조직 (자동 acceptance 완료)

4A 결정론적 보고·위임·인계, 단일 owner, fallback 보고선, 미확인 결정, provenance, projector 재시작·중복 방지·backup/restore 검증까지 모두 완료했다(`MILESTONE_B_REPORTING_HANDOFF_AUDIT.md`). Redis rehearsal 의존은 해소됐다.

### Milestone C — 역할 기반 회의 (구현·자동 게이트 완료, release는 R1 대기)

5순위 MeetingAgentRunner, 6순위 제한 라운드 회의와 Agent 작성 보고, 7순위 의미 요약, 8순위 Pixel 집결까지 모두 완료했다(`MILESTONE_C_ROLE_MEETING_AUDIT.md`). 비용·중단·복구·browser QA는 PASS했고, Golden Scenario human review만 남았다.

### Milestone D — 선택적 확장 (보류 결정 완료)

실사용 요구가 확인되지 않아 신규 Backend를 추가하지 않기로 결정했다(`MILESTONE_D_EXTENSION_DECISION.md`). 재개 조건은 10순위에 기록되어 있다.

### Milestone Release — 남은 유일한 게이트

Milestone A/B/C 코드는 모두 완료했지만 전체 release는 R1(Golden Scenario human review)이 끝나기 전까지 미완료다. R2(artifact 보관 정책)와 R3(버전 관리 도입)는 release를 막지는 않지만 다음 회차 전에 정리하는 것을 권장하며, R4(target 환경 배포 증적)는 실제 배포 시점에 필요하다.

## 7. 공통 완료 계약

1. API·DB·event·projection·UI의 생성자와 소비자가 모두 연결된다.
2. schema migration, 기존 데이터 backfill, 재시작, rollback 경로가 있다.
3. Prompt에는 version/hash/profile/model/backend가 감사된다.
4. 저장소 경로·tree·내용·Transcript·이전 출력은 trusted instruction으로 승격되지 않는다.
5. 동일 event/requestId/turnId 재처리가 중복 발언·보고·보상·Task를 만들지 않는다. 외부 model call은 Provider 멱등 capability가 있을 때만 자동 재시도하고, 그렇지 않은 전송 후 crash는 `execution-uncertain`으로 격리한다.
6. 회사·부서·프로젝트·Run·회의 tenant 경계를 테스트한다.
7. 비용·token·deadline·round·retry·출력 크기 상한을 강제한다.
8. 모델·Backend·worker 실패와 재시작 복구 경로를 검증한다.
9. UI는 loading·empty·error·권한 없음·연결 끊김·모바일·reduced-motion을 검증한다.
10. 지원 runtime의 집중 테스트 후 `npm run verify`를 통과하고 Node/npm/SQLite capability를 기록한다.
11. 실제 모델 품질 주장은 고정 Golden Scenario와 rubric 근거가 있어야 한다.
12. 완료 감사 문서에 코드·명령·실브라우저/실운영 증적·잔여 위험을 기록한다.

## 8. Golden Scenario 운영 계약

- Golden Scenario는 비결정적 일반 단위 테스트가 아니라 release acceptance다.
- fixture: 저장소 commit, goal, requested paths, company policy, profiles, Backend/model version.
- 결과물: 원본 Prompt/envelope hash, output, validation, rubric, reviewer, 판정 시각.
- 자동 검증: 계약·금지 행동·evidence·scope·audit.
- 사람 검토: 역할 관점 차이, 실용성, 불확실성, escalation 적절성.
- 최소 시나리오는 정상 구현, scope 밖 요청, 불충분 evidence, QA가 결함을 찾아야 하는 사례, escalation 필요 사례를 각각 1개 이상 포함한다.
- 각 rubric 항목은 0~2점으로 평가하고 금지 행동·tenant/scope 위반은 총점과 무관한 즉시 FAIL로 처리한다. 그 외에는 사전 합의된 총점 기준과 필수 항목 최저점을 fixture version에 기록한다.
- 2인 reviewer 판정이 다르면 평균으로 통과시키지 않고 지정된 release owner가 원본 근거를 검토해 최종 판정과 이유를 기록한다.
- 모델/version 변경 시 다시 수행한다.
- 실패한 Golden Scenario를 성공으로 평균 처리하지 않고 blocker 또는 명시적 waiver로 기록한다.
- waiver는 회사 owner만 승인하며 실패 시나리오, 근거, 영향 범위, 만료일, 승인자, 후속 조치를 기록한다.
- waiver는 해당 model/backend/profile version과 `scenarioFixtureHash`, `promptComposerHash`, `contextBuilderHash`, `validatorContractVersion`에만 적용된다. 만료, 이 값의 변경 또는 영향 모듈 manifest 변경 시 자동 무효화되어 재검증해야 한다.

## 9. 금지 또는 보류할 구현

- personality나 사용자 자유 텍스트를 Highest Priority 지시로 승격
- 파일명·tree·README·Transcript·이전 산출물을 trusted 문자열로 결합
- Agent 간 무제한 자유 대화와 재귀 위임
- 회의 합의를 실제 승인·merge·정책 변경으로 자동 승격
- 생성/소비 경로 없이 RoleTemplate·보고·회의 schema만 추가
- UI에 가짜 보고선·회의 참석·진행률을 먼저 표시
- RoleTemplate과 pipeline role을 하나의 자유 문자열로 합쳐 책임을 흐림
- provider CLI 권한으로 Tool Gateway 우회
- 실제 환경 증적 없이 production 완료 선언

## 10. 즉시 착수 목표

0~8순위 구현은 모두 완료했다. **즉시 착수 목표는 R1 — Golden Scenario human review 완료다.** `GOLDEN_HUMAN_REVIEW_PACKET.md`의 두 artifact(`runtime/golden/role-golden-edd835c5150a.json`, `runtime/golden/meeting-golden-edd835c5150a.json`)에 2인 reviewer와 release owner 판정을 기록하는 것이 Milestone A/B/C release acceptance를 닫는 유일한 남은 단계다.

R1과 병렬로 처리 가능한 소규모 위생 작업:

- R2: `outputs/`의 초기 실패 golden 실행을 사유와 함께 정리.
- R3: `git init`으로 소스 버전 관리를 도입해 이후 변경을 Milestone 단위로 커밋.

R1 완료 후에는 R4(target 환경 production 배포 증적)로 넘어가며, 신규 기능 우선순위(옛 9~11순위 범위를 넘는 항목)는 실사용 요구가 확인되기 전까지 착수하지 않는다.

## 11. 주요 코드 근거

- `packages/company-ops/src/index.ts`: RoleTemplate binding/governance, 회의 CRUD·메시지, briefing
- `packages/role-prompts/src/index.ts`: planner/worker/reviewer JSON 봉투, `RoleExecutionProfile` 구조 필드, version/hash
- `packages/role-pipeline/src/index.ts`: role 무관 `roleContext()`, 역할 호출·감사, deterministic gate
- `packages/context-builder/src/index.ts`: trust·예산·hash·stale·injection signal
- `packages/repository-context/src/index.ts`: role 무관 `RepositoryOverview`/`RepositoryRoleContext`, trusted/untrusted 경계
- `packages/agent-bindings/src/index.ts`: Run/Meeting 겸용 Backend resolver·snapshot(`resolveMeeting`, `freezeMeeting`)
- `packages/reporting/src/index.ts`: 4A 결정론적 보고 projector·라우팅
- `packages/delegation/src/index.ts`: 부서 간 위임·인계 상태 머신
- `packages/meeting-runner/src/index.ts`: `MeetingAgentRunner` lease/idempotency/예산
- `packages/meeting-semantics/src/index.ts`: 회의 의미 요약과 canonical fallback
- `packages/agent-reporting/src/index.ts`: Agent 작성 보고(4B) 해석
- `packages/backend-config/src/index.ts`, `packages/cli-agent-adapter/src/index.ts`: 현재 Backend
- `apps/web/src/pages/MeetingsPage.tsx`, `apps/web/src/pages/ActivityPage.tsx`: 회의·보고함 UI
- `apps/web/src/pages/PixelOfficePage.tsx`: 실제 이벤트 기반 공간 표현, 회의 참석자 집결
- `apps/role-golden-evaluator/index.ts`, `apps/meeting-golden-evaluator/index.ts`: Golden Scenario 실행기
- `tests/company-ops.test.ts`, `tests/role-prompts.test.ts`, `tests/company-meetings.test.ts`, `tests/reporting*.test.ts`, `tests/delegation*.test.ts`, `tests/meeting-runner*.test.ts`, `tests/meeting-semantics-reporting.test.ts`: 회귀 기준
