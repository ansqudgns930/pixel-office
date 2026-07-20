# Office Event Mapping

Office Projection은 이벤트를 삭제하거나 성공으로 재해석하지 않는다. 아래 상태 변경 이벤트만 Office 단계를 전환하고, 나머지는 현재 단계를 유지하면서 타임라인과 sequence를 갱신한다.

| 이벤트 | Office 단계 | 비고 |
| --- | --- | --- |
| `run.created`, `plan.created`, `plan.approved` | `planning` | 계획실 |
| `run.transitioned` → `READY`, `RUNNING` | `working` | 개발실 |
| `task.claimed`, `task.transitioned` → `in-progress` | `working` | 실제 담당자 우선 |
| `run.transitioned` → `VALIDATING`, `validation.completed` | `validating` | QA실, `passed` 원본 유지 |
| `task.transitioned` → `review` | `reviewing` | QA·Reviewer 표시 |
| `run.transitioned` → `RESULT_APPROVAL_WAITING`, `approval.*`, `result.approved` | `approval` | 승인실 |
| `*.failed`, `*.blocked`, `*.denied`, conflict | `blocked` | 실패를 성공으로 표현하지 않음 |
| `run.transitioned` → `COMPLETED`, `workflow.completed` | `completed` | 완료·기록실 |
| `PAUSED`, `CANCELLING`, `CANCELLED` | `idle` | 실행 중 표현 제거 |

## 식별자 복구

- `aggregate_type=run`: payload에 `runId`가 없어도 `aggregate_id`를 Run ID로 사용한다.
- `aggregate_type=project`: payload에 `projectId`가 없어도 `aggregate_id`를 Project ID로 사용한다.
- 프로젝트가 회사에 연결되기 전 생성된 Project/Run 감사 이벤트는 연결 시점 또는 `OperationalStore` 시작 시 `INSERT OR IGNORE`로 backfill한다.
- backfill event ID는 기존 trigger와 동일한 `project:{seq}`, `run:{seq}`를 사용하므로 재실행해도 중복되지 않는다.
