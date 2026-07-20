# Role Prompt Layer Completion Audit

> 감사일: 2026-07-15

## 판정

`prj.md`의 역할 프롬프트 책임과 `prj_2.md` §44.2~44.4, §52 우선순위 15·17의 코드 범위를 완료했다.

## 요구사항별 증거

1. 역할별 지시문
   - `packages/role-prompts/src/index.ts`
   - planner, worker, reviewer 템플릿과 `role-prompts-v1`
   - deterministic SHA-256 prompt hash

2. 신뢰 경계
   - 승인된 목표·계획·정책은 trusted context
   - repository 파일, tool 결과, prior 모델 출력은 untrusted evidence
   - `DATA_ONLY_NEVER_INSTRUCTIONS` 정책과 injection signal 유지

3. Worker 전 Context
   - `packages/repository-context/src/index.ts`
   - Run에 연결된 Project와 권한 있는 principal을 확인한 후 `repositoryRead`
   - Context Bundle을 Worker 모델 호출 전에 저장하고 프롬프트에 주입

4. Reviewer 순서
   - Worktree 적용 → Git Diff → 범위 검사 → Validator → Reviewer
   - Reviewer 입력에 patch, patch hash, files, validation, requirements 포함

5. Revision
   - 실패한 Validator 결과를 `prior-failure` evidence로 저장
   - revision별 Context Bundle을 별도로 영속화

6. CLI 장문 전달
   - 7,000자 이하: 기존 argument 전달
   - 7,000자 초과: Claude stdin, Codex `-` stdin
   - shell false, timeout, maxBuffer, AbortSignal 유지

7. 결정론 게이트 유지
   - 승인 무결성, Tool Gateway, path scope, Validator, 예산 로직 유지
   - standalone stub의 가상 비용은 프롬프트 길이가 데모 예산을 왜곡하지 않도록 호출당 0.25 상한

## 검증 명령

```text
npm run verify
```

운영 서버 변경이나 외부 자격증명 생성은 이 구현 범위에 포함하지 않는다.
