# Milestone A4–A5 역할 실행·Context 구현 감사

> 검증일: 2026-07-16  
> 판정: 구현 및 자동 게이트 완료, 실제 Backend Golden은 human review 대기

## 구현 결과

- RoleTemplate v15를 최종 `RoleExecutionProfile` 필드(job family, required outputs, prohibited actions, quality checklist, escalation conditions)로 확장했다.
- 개발/QA 기본 profile을 데모 bootstrap에 idempotent하게 생성하고 Worker/Reviewer에 바인딩했다.
- Prompt v3는 역할별로 필요한 profile 필드와 profile hash를 구조화하고 JSON-only·tool simulation 금지 계약을 포함한다.
- Reviewer의 diff·validator·prior model output과 저장소 텍스트는 untrusted evidence로만 전달한다.
- 단일 순수 `json` code fence만 결정론적으로 정규화하고 `ROLE_OUTPUT_NORMALIZED`로 감사한다. 설명문이 섞이거나 다른 fence는 거부한다.
- QA production patch와 Worker 승인 경로 외 patch는 deterministic gate가 차단한다.
- model call/audit에 Prompt, profile, model, Backend binding, execution snapshot version/hash를 기록한다.
- UI에 profile version, 적용 범위, 다음 Run 적용, deterministic/prompt-only 검출 여부를 노출한다.

## RepositoryOverview

- scanner version: `repository-overview-v1`
- cache key: Project ID + Git HEAD + content-aware dirty fingerprint + scanner version
- 비 Git 저장소는 허용 root의 content fingerprint를 사용하고 이를 감사한다.
- 최대 500 files, depth 4, file 128 KiB, evidence 512 KiB/40 files로 제한한다.
- binary, symlink, nested repository, `.git`, `node_modules`, build output을 제외한다.
- commit/scanner/count/hash만 trusted metadata이며 tree, filename, README, manifest, script, source summary는 모두 untrusted evidence다.
- Planner/Worker/Reviewer 전부 동일 overview snapshot을 Context budget 안에서 사용한다.

## 자동 검증

- 집중 테스트: 22/22 PASS
- 전체 서버 test와 Phase 1–6/P0–P5 smoke: PASS
- Browser QA 재검증: 59.9 FPS, 55 aria labels, mobile overflow 0
- backup/restore rehearsal:
  - backup SHA-256 `fc2b64570d291659d93e72a286839e6bb6eb66f546d896bc757ae0cfb68fcb30`
  - schema version 1500
  - restored `PRAGMA integrity_check=ok`
  - v15 role/snapshot 및 v16 overview table 존재 확인

## 실제 Backend Golden

- Backend/model: Claude CLI / `sonnet`
- fixed fixture commit: `edd835c5150a9c092bcc6fc51f391d415af0b788`
- developer Prompt hash: `4a3671e68db88ad2a4a35fb13f41b0b008fe261e8bf9433659067d922eba0f11`
- QA Prompt hash: `afd01fa2d07409e021798a38a9c41a06e0a5235c2727c729b13002808c71f19f`
- 자동 계약 게이트: PASS. QA 출력의 단일 JSON fence는 허용된 결정론적 정규화로 기록했다.
- artifact: `runtime/golden/role-golden-edd835c5150a.json` (ignored operational evidence)
- 현재 상태: `pending-human-review`. 요구된 reviewer 결정이 기록되기 전에는 release acceptance PASS가 아니다.

## 남은 운영 경계

- project-local portable Redis와 AOF로 서버 재시작 전후 BullMQ job 1회 처리, dedupe, worker restart, Control Plane 통합 3종을 완료했다. 상세 증적은 `REDIS_QUEUE_RECOVERY_REHEARSAL_AUDIT.md`에 있다.
- 실제 Backend Golden의 human reviewer 결정을 artifact에 기록해야 Milestone A release acceptance가 닫힌다.
- 따라서 남은 Milestone A 최종 release gate는 human reviewer 결정뿐이다.
