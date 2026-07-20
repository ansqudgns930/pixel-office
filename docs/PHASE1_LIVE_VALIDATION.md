# Phase 1 실제 Host 반복검증

## 실행 조건

- 실행일: 2026-07-15
- Host: NVIDIA Express `http://127.0.0.1:8787`
- 생성 모델: `nvidia/nemotron-3-ultra-550b-a55b`
- 블라인드 Reviewer: `deepseek-ai/deepseek-v4-flash`
- 업무: 저위험 normalize, 중위험 clamp, 고위험 safe redirect
- 전략: `single_agent`, `manager_subagents`, `role_pipeline`
- 반복: 각 업무·전략 조합 5회, 총 45개 후보
- 격리: 후보별 독립 Git Worktree·commit·SHA-256
- 블라인드: 전략과 자동검사 결과를 제외한 UUID 기반 코드 평가

## 결과

| 전략 | 자동검사 | 통과율 | 블라인드 평균 | 토큰 |
| --- | ---: | ---: | ---: | ---: |
| single_agent | 12/15 | 80% | 4.00 | 26,358 |
| manager_subagents | 12/15 | 80% | 4.33 | 26,335 |
| role_pipeline | 12/15 | 80% | 3.93 | 26,357 |

- 저위험: 15/15 통과
- 중위험: 15/15 통과
- 고위험 redirect: 6/15 통과
- 전체: 36/45 통과
- 블라인드 결과: 45/45, UUID 중복·누락 0, `complete=true`
- 모든 조합 반복 수: 정확히 5
- commit 40자리와 SHA-256 64자리 형식: 45/45 정상

## 판정

**GO — Phase 1 진입 HOLD 해소.**

이 판정은 특정 전략이 다른 전략보다 우수하다는 의미가 아니다. 현재 설계는 전략 비교를 제품 진입 게이트로 사용하지 않는다. 실제 Host·Git Worktree·Node Validator·블라인드 평가 경로가 반복 실행됐고, 생성 실패가 성공으로 오인되지 않았으며 P3 실행계층은 실패 시 `REVISION_REQUIRED`로 Worker를 새 request ID로 재호출한다.

고위험 redirect의 원시 생성 성공률 40%는 잔여 위험이다. 따라서 critical 업무는 Validator Profile, Type Check·Security, post-validation Reviewer, 사람 결과 승인과 patch hash 일치 검사를 우회할 수 없다.

## 근거 파일

- `outputs/phase1-live-report.json`
- `outputs/phase1-blind-review.json`
- `tests/revision-loop.test.ts`
- `tests/vertical-slice.test.ts`
