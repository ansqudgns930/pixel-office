# Milestone A1–A3 역할 해석·스냅샷 완료 감사

> 검증일: 2026-07-16  
> 런타임: Windows, Node 24.17.0, npm 11.13.0

## 판정

Milestone A의 A1 schema expand, A2 결정적 역할 resolver, A3 원자적 execution snapshot set을 완료했다. Run이 처음 `PLANNING`으로 전환되는 동일 SQLite 트랜잭션에서 planner/worker/reviewer 역할 프로필과 Backend binding 전체를 하나의 `executionSnapshotId`로 고정한다.

## 구현 계약

- RoleTemplate 버전 계보는 `(company_id, logical_id, version)`으로 tenant별 격리한다.
- binding key는 `(company_id, target_type, target_id, pipeline_role)`이며 공통 역할은 저장 시 `''`, API에서는 `null`이다.
- 해석 순서는 Task+role → Project+role → Task 공통 → Project 공통 → Company+role → Company 공통이다.
- planner/worker/reviewer는 owner/executor/reviewer assignment에 대응한다. 복수 assignment는 명시적 primary가 없으면 fail-closed 한다.
- 부서 전용 template은 실제 배정 Agent의 회사와 부서가 일치할 때만 허용한다.
- 역할 snapshot은 template FK, profile hash, 책임·완료 기준·도구·review·approval 및 binding provenance를 보존한다.
- 실행 시 허용 도구는 `snapshot ∩ 현재 정책`, 필수 review/approval은 `snapshot ∪ 현재 정책`으로 계산한다.
- 완성되지 않은 snapshot set은 조회되지 않으며 한 역할이나 Backend가 실패하면 Run 상태를 포함한 전체 transaction을 rollback한다.

## 호환 마이그레이션

- 구 `role_templates_v4`와 `role_template_bindings_v4`는 compatibility window 동안 보존한다.
- v4 binding은 v15 공통 binding으로 transaction backfill한다.
- `role_binding_migration_checks_v15`에 구/신 template ID와 일치 여부를 기록한다. `matched=0`은 배포 차단 조건이다.
- 신규 role별 binding은 v4로 무손실 표현할 수 없다. compatibility window 동안 rollback은 배포 전 backup 또는 보존된 v4 resolver로 제한하며, v15 전용 데이터가 기록된 환경의 binary downgrade는 금지한다.
- forward-fix는 v15 binding을 교정한 뒤 migration check를 재실행하고, 새 Run에서 snapshot을 생성해 검증한다. 이미 완성된 Run snapshot은 변경하지 않는다.

## 검증 증거

집중 검증 명령:

```powershell
npm run typecheck
npm run build
node --test dist/tests/role-template-resolution.test.js dist/tests/agent-bindings.test.js dist/tests/agent-binding-api.test.js dist/tests/company-ops.test.js dist/tests/platform-ops.test.js dist/tests/operations.test.js
```

결과: 32 tests, 32 pass, 0 fail.

검증한 실패·복구 경계:

- tenant별 동일 logical ID/version 독립성
- SQLite NULL 우회 없는 공통 binding 유일성
- 실제 v4 fixture backfill, shadow 비교, 구 row 보존
- Worker=Engineering, Reviewer=QA의 서로 다른 부서 template
- assignment ambiguity와 department mismatch 시 부분 snapshot 및 상태 전환 부재
- Backend/profile 3역할 동일 execution snapshot ID
- snapshot template FK와 변경 불변성
- 프로세스 재시작 전후 byte-equivalent resolver 결과
- 정책 강화 즉시 적용 및 완화 시 기존 권한 비확장
- 역할 snapshot API의 tenant 권한 경계

## 다음 경계

A4–A5에서 `RoleExecutionProfile`, 역할별 Context/Prompt, `RepositoryOverview`, 기본 개발·QA profile과 Golden Scenario를 이 snapshot 계약 위에 연결한다. A1–A3 schema를 우회하는 lazy snapshot이나 자유 문자열 역할 해석은 추가하지 않는다.
