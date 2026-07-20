# P4 운영 개입 완료 감사

## 완료 범위

- Run 상태 기반 운영 개입 API와 캐릭터 상세 개입 UI
- 실행 중지, 경로 제한, 추가 테스트 및 재수정, 리뷰어/인간 검토 배정
- 실패 설명, 체크포인트 재시작, 예산 조정/중단
- 대기 작업 우선순위 변경, 사고 대응 선택 영속화
- `requestId` 멱등성, 프로젝트 RBAC, `expectedStatus` 충돌 시 HTTP 409
- 모든 성공 개입의 `RUN_INTERVENTION_APPLIED` 감사 이벤트와 조회 이력
- 제한 경로는 Worker 변경 적용 전에 차단하고, 요청 검증은 Validator Profile에 병합
- 강제 Reviewer는 post-validation 단계에 추가되고 지정 인간 검토자는 결과 승인 주체로 강제
- 개입 이벤트와 결과 Run 상태가 Pixel Office 타임라인에 반영되며 Projection 불일치 0건 유지

## API 계약

`POST /api/runs/:runId/interventions/:command`

공통 필드: `requestId`, `actorId`, `reason`, `expectedStatus`. 명령별로 `paths`, `tests`, `principalId`, `limit`, `priority`, `incidentId`, `resolution`을 사용한다.

## 검증

- `npm run p4:intervention-smoke`
- `npm run verify`

## 잔여 위험

- UI는 현재 Run 상태를 기준으로 명령을 제한하지만, 제출 직전 상태가 바뀌면 서버가 409로 거절하므로 재조회가 필요하다.
- 사고 해결 기록은 운영 판단 이력이며 이미 발생한 안전 사고의 보상 차단 사실을 소급 변경하지 않는다.
