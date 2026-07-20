# Phase 3 완료 감사

기준: `more.md`의 Phase 3 프로젝트 운영. SQLite·로컬 실행 기본값과 HostAdapter 경계를 유지한다.

| 요구사항 | 구현·검증 근거 |
|---|---|
| Workspace/Project와 저장소·브랜치·런타임·Organization Profile | `ProjectOperations`, `project-ops.test.ts` 재개방 검증 |
| Milestone 상태·완료 조건·진행률 | Milestone 전이와 미완료 Task 완료 차단, War Room snapshot |
| Task Board·의존성·우선순위·완료 조건 | 서버 상태 전이표, 의존성 선행 완료 강제 |
| 사람·AI 공동 할당과 책임 구분 | human/agent 및 owner/executor/reviewer assignment |
| RBAC와 교차 프로젝트 차단 | owner/manager/reviewer/worker/viewer permission, API 및 서비스 테스트 |
| 프로젝트·Milestone·Task 계층 예산 | 모델 호출 전 원자적 reservation, 실제 비용 settlement, rollback 테스트 |
| War Room API/UI | 프로젝트·진행률·Board·Run·Artifact·stale·approval·merge·비용·알림 조회 |
| durable 알림 | 승인 대기, blocked/failed, 예산, merge conflict dedupe·읽음 처리 |
| 장기 실행 복구 | lease/heartbeat, 만료 작업 ready 복귀, 실행 가능한 연결 Run만 재큐잉 |
| Project→Milestone→Task→Run→Artifact 계보 | SQLite 재개방 후 연결 Run과 Artifact 조회 테스트 |

## 보안·운영 경계

- 프로젝트 연결 Run의 계획 승인·결과 승인·중지·재시도·취소는 프로젝트 역할 권한을 서버에서 확인한다.
- 모든 주요 허용·거부와 예산 예약·정산·복구는 프로젝트 감사 로그에 남는다.
- Redis는 실행 전달용이며 Project 상태 원본은 SQLite다.
- 외부 메일·메신저, MCP, MinIO, PostgreSQL·Docker 필수화, Phase 4·5는 범위 밖이다.
