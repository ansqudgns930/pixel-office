# Phase 0 검증 기록

## 구현 결과

* 독립 TypeScript 코어와 버전 `1.0` Host Adapter 계약 구현
* Standalone 및 Legacy NVIDIA Adapter 구현
* single_agent, manager_subagents, role_pipeline 비교 러너 구현
* 저위험·중위험·고위험 업무를 전략별 5회, 총 45회 실행
* 승인 우회, 경로 이탈, 비용 초과 차단 구현
* 체크포인트 재개, 중복 실행·과금 방지 구현
* 모든 산출물에 입력 계보, 경로, SHA-256, 검증 상태 기록
* Legacy NVIDIA HTTP composition root와 실제 endpoint 형태의 통합 테스트 구현

## 자동 검증

```text
npm run typecheck: PASS
npm run build: PASS
node --test: PASS (21 tests)
npm run smoke: PASS
```

계약 테스트는 두 Host에 동일하게 적용하며 인증, 모델 목록, 모델 호출 멱등성, 스트리밍 중단, 사용량 기록, 이벤트 멱등성, 계약 버전 거부, 장애 감지와 복구를 검사한다.

정책 테스트는 고위험 승인, 파일 범위, 비용 상한, 실행 중복 제거, 체크포인트 보존과 일시 장애 후 재개를 검사한다.

## 현재 한계

* Legacy NVIDIA Adapter는 실제 `/health`, `/chat-models`, `/agent` 형태의 HTTP 통합 계약까지 검증했다. 현재 NVIDIA 프로세스에 대한 실모델 호출은 비용 발생을 막기 위해 수행하지 않았다.
* 모델 응답이 결정론적 stub이므로 품질·결함 탐지율 비교 결과로 사용할 수 없다.
* 블라인드 사람 평가는 아직 수행하지 않았다.
* Git Worktree, Docker Sandbox, 실제 저장소 빌드·테스트·보안 도구 실행은 다음 구현 대상이다.
* 사용량 Outbox의 영속 저장과 프로세스 재시작 복구는 아직 없다.

## Phase 1 판단

**보류(HOLD)**.

구조와 계약의 기술적 타당성은 확인했지만 `more.md`의 Phase 1 진입 조건을 아직 충족하지 않았다. 실제 NVIDIA 연결, 실제 Git 작업 3종, 블라인드 평가, 비용·시간·결함 탐지 비교가 완료된 뒤 GO 여부를 다시 판정한다.

## 다음 검증 순서

1. NVIDIA HTTP composition root와 실제 연결 smoke test
2. Git Worktree·도구 실행 Adapter
3. 고정 테스트 저장소 3종과 deterministic validator
4. 세 전략 반복 실행 및 원시 지표 집계
5. 블라인드 평가와 Phase 1 GO/HOLD 결정 갱신
