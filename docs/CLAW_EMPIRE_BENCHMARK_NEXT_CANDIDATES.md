# Claw-Empire 벤치마크 재검토와 차기 라운드 후보

> 작성일: 2026-07-17
> 상태: 제안 문서 — 확정된 Milestone이 아니다
> 선행 문서: `NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `MILESTONE_D_EXTENSION_DECISION.md`

## 0. 이 문서의 위치

`NEXT_IMPLEMENTATION_MASTER_PLAN.md` 4절 우선순위 0~9는 완료 또는 구현 완료 상태이며, 같은 문서 2.2절에 따르면 지금 실질적인 release 차단 요인은 신규 기능이 아니라 **Golden Scenario human review 미완료, golden artifact 보관 이력 정리, 소스 버전 관리(git) 부재, target 환경 배포 증적 부재** 네 가지뿐이다.

이 문서는 새 마스터플랜이 아니다. 위 네 가지가 정리된 뒤에 올 **"다음 라운드" 후보를 재우선순위화한 제안**이며, 지금 당장 착수해야 한다는 뜻이 아니다. 착수 시점이 오면 마스터플랜과 동일하게 별도 Milestone 문서·자동 회귀·Golden human review 경로를 갖춰야 한다.

Provider 확장(Gemini CLI·OpenCode·Kimi)은 이미 `MILESTONE_D_EXTENSION_DECISION.md`로 보류 결정이 났으므로 이 문서에서 다시 다루지 않는다. 재개 조건은 그 문서에 명시된 대로다.

## 1. 배경

`claw-empire-main`과 `agent-company-os`를 코드 레벨로 비교했다(자체 분석 + 별도로 제공된 9항목 로드맵 표). 로드맵 표가 인용한 claw-empire 파일(`process-inspector.ts`, `planning-archive-tools.ts`, `messaging-runtime-oauth.ts`)은 실제 코드와 대조해 인용 내용이 정확함을 확인했다.

`NEXT_IMPLEMENTATION_MASTER_PLAN.md` 15행의 원칙을 그대로 따른다: *"Claw-Empire와 Pixel Agents는 패턴 참고 자료다. 코드·Prompt·그래픽 자산을 제품 기반으로 복사하지 않으며, 유용한 패턴도 Agent Company OS의 승인·예산·감사·snapshot·Prompt hash·trusted/untrusted 체계 안에서 재구현한다."*

## 2. agent-company-os가 이미 앞선 영역 (조치 불필요)

| 영역 | 근거 |
| --- | --- |
| 정책/승인 무결성 | `packages/policy`의 위험도 강등 차단, `packages/approval`의 diff hash 고정·`timingSafeEqual` 비교·만료 처리 |
| 경로 이탈 방어 | `packages/tool-gateway`(실행 중 write 시점 검증) + `packages/worktree`(병합 후보 생성 시점 재검증) 이중 방어 — claw-empire는 단일 containment 체크만 있음 |
| 실행 격리 | `packages/execution-sandbox`(명령/인자 이중 denylist, 최소 env), `packages/docker-sandbox`(`--network none --cap-drop ALL`) — claw-empire에는 대응 개념 없음 |
| LLM 출력 품질 검증 태도 | `apps/role-golden-evaluator`, `apps/meeting-golden-evaluator` — 자동 게이트는 계약 형식만 확인하고 실질 품질 판정은 `GOLDEN_HUMAN_REVIEW_PACKET.md`로 사람에게 넘김. claw-empire에는 이런 장치가 없음 |

## 3. 로드맵 9항목의 실제 현재 상태 재검증

외부 로드맵 표는 방향은 맞지만 일부 항목의 "규모(L/M/XL)"가 agent-company-os에 이미 존재하는 뼈대를 반영하지 못했다. 코드를 직접 확인한 결과는 다음과 같다.

| 항목 | agent-company-os 현재 상태 (파일 근거) | 실제 남은 작업 | 로드맵 규모 → 재평가 |
| --- | --- | --- | --- |
| CEO Decision Inbox | `packages/company-ops/src/index.ts`에 `companyAlerts()`/`readCompanyAlert()`(kind: blocked·approval·validation·meeting·budget·notification, severity 포함)가 읽기 모델로 이미 존재. `packages/intervention/src/index.ts`의 `InterventionService`(pause·assign-human·stop-budget·set-budget·resolve-incident, requestId 멱등·audit)가 쓰기 모델로 이미 존재 | 읽기·쓰기 모델은 있고 "선택지 제시 + 회신" 접합부만 없음. claw-empire의 `DecisionInboxRouteOption[]` + `replyDecisionInbox` 형태를 참고해 alert.kind → intervention command 매핑 레이어만 추가 | M → **S~M** |
| Company Operating Pack | `packages/platform-ops/src/index.ts`의 `WorkflowRecord`가 이미 `draft→validated→published`, `steps[]`(roleTemplateId+dependsOn DAG+completionCriteria+tools), `contentHash`, `budgetLimit`, `requiredReviews/Approvals`를 갖춘 버전형 엔티티 | "version/hash/승인/rollback 유지"라는 로드맵의 우려는 `WorkflowRecord` 설계에 이미 내장됨. 새 개념이 아니라 여기에 부서 시드 + 입출력 계약 + Validator 세트 + 비용/라운드 프로필 필드만 확장 | L → **M** |
| Delivery/보고서 Center | Phase 2 산출물 데이터 모델(Artifact Version/Relation, stale 전파)이 `impact-analysis`/`merge-candidate`/`platform-ops`에 이미 존재. `apps/web/src/pages/`에는 대응 화면 없음(Activity/Companies/Employees/Execution/Goals/Meetings/Operations/PixelOffice/Platform/WarRoom뿐) | 백엔드 데이터는 있고 화면만 없음. export(PDF/PPTX)는 신규 | M → M (유지) |
| Active Agent Runtime Control | 거버넌스형 제어(`InterventionService`)는 있지만, claw-empire식 idle/heartbeat 감지(`is_idle`,`idle_seconds`, PID kill)에 해당하는 원시 프로세스 계측은 `run-worker`/`queue`/`persistence`에 없음(grep 확인) | 계측은 신규 필요. 단 "강제 종료"는 `InterventionService`를 통과시켜야 함(§5 참조) | M → M (유지) |
| Skill·Capability Registry | `RoleTemplateRecord`는 버전 관리되지만(logicalId/version/parentVersionId/hash), 실행 이력·성공률·verified 상태 필드는 없음. 역할보다 작은 재사용 단위(스킬) 자체가 없음 | 진짜 신규 도메인 | L → L (유지) |
| 용량·역량 기반 Staffing | `AssignmentRecord`(배정 결과만) 존재, 추천 스코어링 없음 | Decision Inbox·Skill Registry가 먼저 있어야 추천 결과를 보여줄 자리가 생김 | L → L (유지, 순서상 후순위) |
| 외부 채널 Gateway | 메신저/외부 알림 연동 전무(grep 확인) | 신규. 단 Decision Inbox보다 먼저 만들면 릴레이할 대상이 없는 채로 설계하게 됨 | L → L (유지, 순서 재조정) |
| Integration SDK | `packages/host-adapter-sdk`가 이미 계약 기반(`HostAdapter`, `AdapterError`, 버전 검증) 설계라 확장 토대는 있음 | 장기 과제 | XL (유지) |
| 조직 성과 분석·시뮬레이션 | `packages/game-progression`은 XP/레벨만, 실제 병목·비용 분석 없음 | 장기 과제 | XL (유지) |

## 4. 재우선순위 제안

`NEXT_IMPLEMENTATION_MASTER_PLAN.md` 3절 판단 기준 중 **원칙 2("이미 존재하는 데이터의 미배선을 신규 대형 기능보다 먼저 해결한다")** 와 **원칙 4("실제 event·ledger·snapshot이 없는 조직 상태를 연출하지 않는다")** 를 그대로 적용하면, 이미 존재하는 읽기/쓰기 모델을 접합만 하면 되는 항목이 완전 신규 도메인보다 우선이어야 한다.

```
(선행 조건: NEXT_IMPLEMENTATION_MASTER_PLAN.md 2.2절 4개 release 차단 요인 해소)

1. CEO Decision Inbox       — companyAlerts()+InterventionService 접합 (기존 데이터 미배선 해소, 원칙 2)
2. Company Operating Pack   — 기존 WorkflowRecord 확장 (신규 개념 생성 아님)
3. Delivery/보고서 Center    — 기존 Artifact 데이터에 화면만 추가
4. Active Agent Runtime Control — 계측은 신규, 제어는 기존 InterventionService 재사용
──────────────────────────────────────────────
5. Skill·Capability Registry — 진짜 신규 도메인, 위 4개 안정화 후
6. Staffing 추천              — 5번 위에 얹는 것이 자연스러움
7. 외부 채널 Gateway          — 1번(Decision Inbox)이 먼저 있어야 릴레이 대상이 생김
8. Integration SDK / 9. 조직 성과 분석·시뮬레이션 — XL, 장기 유지
```

외부 로드맵 표는 1순위 Operating Pack, 3순위 Decision Inbox 순으로 제시했으나, agent-company-os에 이미 만들어진 뼈대를 기준으로 보면 Decision Inbox가 접합 작업에 더 가까워 1순위로 앞당기는 것이 맞다.

## 5. 가져오지 않을 것 (금지 목록)

외부 로드맵 문서의 금지 목록에 동의하며 그대로 유지한다.

| Claw-Empire 요소 | 판단 |
| --- | --- |
| personality 최상위 Prompt 주입 | 도입 금지 |
| 검증되지 않은 대규모 Skill 카탈로그 | 숫자 경쟁 불필요 |
| Agent 자유 재귀 위임 | 비용·책임 통제 어려움 |
| 회의 합의 자동 실행 | 기존 승인 체계 훼손 |
| 자동 업데이트 즉시 적용 | 공급망·운영 위험 |
| XP만을 이용한 자동 인사 평가 | 실제 품질 근거 부족 |
| Provider별 개별 예외 로직 확대 | 공통 Adapter 계약 우선. `MILESTONE_D_EXTENSION_DECISION.md`와도 일치 |
| Pixel 효과를 실제 진행보다 먼저 표시 | 데이터 진실성 훼손. 마스터플랜 원칙 4와 일치 |

추가 항목:

- **claw-empire의 raw PID kill(`DELETE /api/agents/cli-processes/:pid`)을 그대로 가져오지 말 것.** §3 "Active Agent Runtime Control"을 구현할 때 프로세스를 직접 죽이는 엔드포인트를 노출하면 `InterventionService`의 감사·RBAC·멱등성 체계를 우회하게 된다. 종료도 반드시 `InterventionService`의 신규 커맨드(예: `terminate-run`)로 편입시켜야 한다.

## 6. 확인이 필요한 열린 질문

- §4의 1~4번을 실제 Milestone으로 승격할 때, `NEXT_IMPLEMENTATION_MASTER_PLAN.md`와 동일하게 별도 `MILESTONE_E_*` 문서·자동 회귀·필요 시 Golden human review 경로를 갖출 것.
- Decision Inbox의 "선택지" 스키마가 `InterventionCommand` 11종과 meeting `decision-pending`/review `needs-work` 결과를 모두 포괄할 수 있는지는 설계 시점에 별도 검증 필요.
- 외부 채널 Gateway(§3, 7번)는 Decision Inbox 완료 후 착수한다는 순서 자체가 아직 실사용 요구로 확인된 것은 아니다. `MILESTONE_D_EXTENSION_DECISION.md`와 동일하게 "명시적 수요 확인 전 재개하지 않는다" 원칙을 적용할지 여부는 별도 결정 필요.
