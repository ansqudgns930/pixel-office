# Phase P3 완료 감사

## 판정

**GO — 실제 AI 업무 수직 슬라이스 완료.**

## 완료조건 증거

| 요구사항 | 구현·검증 근거 | 판정 |
| --- | --- | --- |
| critical 포함 위험도 4단계 | Policy 추론·하향 차단·Execution UI·역할 테스트 | 통과 |
| 프로젝트별 Validator Profile | Project API·War Room UI·실행 시 profile 적용 감사 | 통과 |
| Type Check | 독립 `typecheck` ValidationKind와 실제 명령 테스트 | 통과 |
| 검증 후 Reviewer | Worker → Validator → Reviewer 순서와 validation 입력 테스트 | 통과 |
| revision 재실행 | 실패 Worktree 제거, `REVISION_REQUIRED`, 새 Worker request ID, 재검증 | 통과 |
| 승인 만료 | Plan·Result 15분 TTL, 만료 감사·BLOCKED·미소비 테스트 | 통과 |
| repository.read/search | project root·RBAC·크기 제한·symlink 탈출 차단·감사·UI | 통과 |
| 실제 저장소 수정·검증·승인 | Worktree Diff, Build/Test/Lint/Type Check, exact patch hash 승인 | 통과 |
| 실제 Host 반복검증 | 45개 후보, 조합별 5회, Blind 45/45, commit/hash 검증 | 통과 |
| Phase 1 HOLD 해소 | `PHASE1_LIVE_VALIDATION.md` GO 판정 | 통과 |

## 안전 불변조건

- 설정되지 않은 Validator 명령은 성공 처리하지 않고 실행 전 차단한다.
- Reviewer는 Validation 결과 없이 실행되지 않는다.
- 실패 revision은 기존 idempotency key를 재사용하지 않는다.
- 만료되거나 hash가 다른 승인은 Run을 완료할 수 없다.
- repository 도구는 읽기 전용이며 project root 밖 경로와 symlink를 차단한다.

## 검증

```powershell
npm run p3:execution-smoke
npm run verify
cd apps/web
npm run build
```

실제 모델의 고위험 원시 생성 성공률 40%는 알려진 위험이며 위 안전 게이트를 유지한 상태에서 P4 사용자 개입 기능으로 보완한다.
