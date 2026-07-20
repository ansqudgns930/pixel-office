# Milestone C 역할 기반 회의 완료 감사

> 감사일: 2026-07-16 (Asia/Seoul)  
> 구현 상태: 자동 acceptance 완료, 실제 모델 human review 대기  
> 스키마: additive migration `1800`

## 1. 구현 결과

- 실제 회의의 현재 Agent 참석자만 `meeting_agent_turns_v18` turn을 받는다. Human 참석자는 자동 turn 대상에서 제외된다.
- 참석자별 조직 RoleTemplate profile과 Backend/model resolution을 회의 시작 시 고정 snapshot으로 저장한다.
- Runner는 3라운드 상한, deadline, token/cost reservation과 settlement, per-turn 사용량, retry, lease, output byte 제한을 강제한다.
- lease 획득 후와 모델 호출 직전에 회의 pause/end/deadline을 재검사한다.
- 비멱등 provider의 전송 후 crash는 `execution-uncertain`으로 격리하며 운영자 해소 전에는 재호출하지 않는다.
- 결과 저장 후 message projection crash는 모델을 다시 호출하지 않고 동일 turn/message ID로 투영만 재시도한다.
- Agent 출력은 `opinion|question`, 1~3문장, 입력 evidence ID 부분집합만 허용하며 instruction/decision 권한을 갖지 않는다.
- 추가 설명 없는 단일 JSON code fence만 결정론적으로 정규화하고, 주변 prose 또는 발명한 evidence는 거절한다.
- Agent message provenance에 turn/round/profile/backend/prompt/evidence를 기록한다.
- 선택적 의미 요약은 canonical 사실을 보존하고, 출처 없는 결정 후보를 권위 있는 결정으로 승격하지 않는다. 실패 시 canonical summary로 복구한다.
- Agent 보고 해석은 4A 결정론적 보고의 사실을 바꾸지 않고 역할 관점의 해석·위험·제안만 추가한다.
- Pixel Office는 live/decision-pending 회의의 실제 Agent 참석자만 회의 테이블에 배치하고 pause/decision 상태, 실제 최근 발언, `meetingId`/`participantId` 링크를 표시한다. 종료 시 기존 work item 상태로 복귀한다.

## 2. 주요 코드와 소비 경로

- Runner·lease·budget·recovery: `packages/meeting-runner/src/index.ts`
- 회의 Backend snapshot: `packages/agent-bindings/src/index.ts`
- 내부 Agent message/provenance: `packages/company-ops/src/index.ts`
- 의미 요약: `packages/meeting-semantics/src/index.ts`
- Agent 보고 해석: `packages/agent-reporting/src/index.ts`
- Pixel 회의 projection: `packages/office-view-model/src/index.ts`, `apps/web/src/pages/PixelOfficePage.tsx`
- API/UI: `apps/control-plane/src/index.ts`, `apps/local-control-plane/index.ts`, `apps/web/src/pages/MeetingsPage.tsx`, `apps/web/src/pages/ActivityPage.tsx`
- Golden evaluator: `apps/meeting-golden-evaluator/index.ts`, `fixtures/meeting-golden-scenario.json`

## 3. 자동 검증 증적

- `npm run build`: 통과.
- Meeting 집중 회귀: runner/API/semantic/report/Pixel/recovery 모두 통과.
- `milestone-c-recovery.test`: file-backed SQLite backup/restore 후 완료 turn 무재호출, binding/profile/budget/message provenance 보존, schema 1800 확인.
- `npm run milestone-c:browser-qa`: 통과.
  - turn status `completed`, message 2건
  - 회의 참석자 `agent-a,agent-b`; Human 제외
  - meeting ID `meeting-1`, 상태 `live`
  - 모바일 overflow `0`, console/page/HTTP error `0`
- 기존 B 브라우저 QA는 Agent 해석 카드 추가 후 selector를 보고 feed 내부로 한정했으며 재검증 통과: report 1, handoff 1, 모바일 overflow 0, error 0.
- 최종 `npm run verify`: 103.1초, exit 0. runtime/typecheck/build/web build, 전체 test, Phase 1~6, P0~P5, performance, P5/B/C Chromium QA가 모두 통과했다.

## 4. 실제 Backend Golden Scenario

- 고정 repository commit: `edd835c5150a9c092bcc6fc51f391d415af0b788`
- fixture hash: `c39e47c71780c5ca5c3c57d3cadd10d7b259a994b99adb7c627f07150b34767c`
- Backend/model: `claude-cli` / `sonnet`
- 자동 판정: `pending-human-review`, automatic findings 0.
- 개발 관점은 최소 안전 기술 조치와 runtime 미검증을, QA 관점은 복구 검증 부재와 release risk를 각각 다른 profile로 표현했다.
- 두 출력 모두 evidence IDs를 인용하고 불확실성과 escalation을 구조화했으며, 승인·실행 완료를 주장하지 않았다.
- 검토 artifact: `runtime/golden/meeting-golden-edd835c5150a.json`
- Codex CLI도 설치·로그인 상태였으나 계정 사용량 한도로 실제 요청이 거절됐다. 이는 Claude 통과 결과에 평균 처리하지 않고 별도 환경 제한으로 기록한다.

## 5. 운영·롤백

- backup/restore rehearsal은 별도 경로 복원과 무중복 재시작까지 자동 검증했다.
- migration은 새 v18 테이블과 migration marker만 추가한다. forward-fix는 runner/API 소비를 비활성화하고 기존 deterministic meeting 경로를 유지할 수 있다.
- 최초 환경에는 Docker, `redis-server`, `redis-cli`가 없었다. 해시를 검증한 project-local portable Redis를 사용해 AOF 서버 재시작과 Redis 통합 3종을 완료했으며 상세 증적은 `REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`에 남겼다.

## 6. 잔여 release gate

- 2인 reviewer가 Golden 원문을 rubric으로 평가하고 release owner가 최종 판정해야 한다.
- 위 human review 전에는 전체 목표나 production 완료를 선언하지 않는다.
