# Phase 4 완료 감사

기준: `more.md`의 회사형 경험. Phase 1~3 상태 원본을 재사용하고 별도 게임·브리핑 상태를 운영 원본으로 만들지 않는다.

| 요구사항 | 구현·검증 근거 |
|---|---|
| Company·Department·보고 관계·membership | `CompanyOperations`, 조직 순환·교차 회사 차단 및 SQLite 재개방 테스트 |
| 역할 템플릿 버전과 Project/Task 적용 | parent version, binding, 회사 필수 Review/Approval·허용 Tool 상한 강제 |
| 실제 Run 정책 연결 | 저위험 Run도 회사 필수 Reviewer 호출, Tool Gateway 진입 전 허용 Tool 검증 |
| 프로젝트 포트폴리오 | Project/Milestone/Task/Run/Artifact, 비용·blocked·stale·conflict·approval 집계와 snapshot hash |
| Review Aggregator | 원문·evidence provenance, 중복·상충 의견, unresolved risk, 결정론적 권고 |
| CEO 브리핑 | 포트폴리오 hash와 Review meeting만 입력, 수치·결정·다음 행동·provenance·생성 시각 저장 |
| Command Center·Owner Console | 조직·예산·우선순위·역할 템플릿·필수 정책 API/UI와 회사 감사 로그 |
| 에이전트 업무 추천 | Project 우선순위·템플릿·부서·의존성·lease·예산 기반, `requiresApproval=true` |
| 픽셀 오피스 최소 표현 | 실제 부서·agent·Task 상태의 읽기 전용 결정론적 좌표와 state hash |

## 검증 경계

- `company-ops.test.ts`: 재시작, 순환·교차 회사·권한 상승·정책 약화·stale evidence 차단, 중복/충돌 Review, 브리핑/픽셀 결정성.
- `company-command-center-api.test.ts`: Company→부서/멤버→기존 Project→템플릿→Review 회의→브리핑→Owner 정책 API 흐름.
- `phase4:smoke`: Phase 4 테스트와 실제 Project Git 수직 흐름 결합.
- 외부 메신저, MCP, MinIO, PostgreSQL/Docker 필수화, Phase 5, 고급 게임 엔진은 범위 밖이다.
