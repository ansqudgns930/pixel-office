# UI 전용 전체 회사 운영 여정 검증

검증일: 2026-07-18  
대상 회사: `UI 전용 전체여정 검증 회사 B` (`ui-only-journey-20260718-b`)  
대상 목표: `UI 전용 회사 운영 전체완료 검증 B`

## 결과

- 제품 API와 DB를 직접 호출하지 않고 로그인, 회사 선택·생성, 목표 생성, 자동 조직 구성, 단계별 회의, 오너 승인, 배포 결정, 운영 완료를 브라우저 UI로 수행했다.
- 기획 → 실행계획 → 개발 → 배포 → 운영·완료의 팀 검토 회의와 한글 오너 요약을 확인했다.
- 배포 단계에서는 `지금은 배포하지 않고 완료 단계로 진행`을 선택했다. 실제 운영 배포는 수행하지 않았다.
- 최종 목표는 `100%`, `5/5 Task`, 차단 `0`, 승인 대기 `0`, 검증 실패 `0`이다.
- 직원 3명, 완료 프로젝트, 읽지 않은 알림 0, 운영 플랫폼 완료율 100%를 각 화면에서 확인했다.
- 최종 브라우저 보고서의 `errors`와 `httpErrors`는 모두 0건이다.

## 발견 및 수정한 제품 결함

1. 회의 화면의 비동기 로딩이 페이지 이탈 후 URL 검색 파라미터를 다시 써서 목표 화면 이동을 취소하던 경합을 차단했다.
2. 수동 Run 재시도가 같은 모델 요청 ID를 재사용하던 문제를 수정해 매 재시도에 새 요청 ID와 이력을 부여했다.
3. 모델의 역할 계약 JSON이 출력 한도에서 잘릴 때 문자열·배열·객체를 결정론적으로 닫고 기존 계약·권한 검사를 그대로 거치도록 복구했다.
4. 목표 폼에서 `docs`처럼 입력한 허용 경로를 폴더 범위로 해석하지 못하던 문제를 수정했다. `docs/...`는 허용하되 절대 경로와 `..` 경로 탈출은 차단한다.

## 검증

- `npm.cmd run build`: 통과
- `npm.cmd run web:build`: 통과
- `node --test dist/tests/runtime.test.js dist/tests/role-pipeline.test.js`: 15/15 통과
- UI 전체 여정 보고서: [report.json](../outputs/ui-only-journey-20260718-b/report.json)
- 대표 화면: [목표 100%](../outputs/ui-only-journey-20260718-b/18-goal-completed-100.png), [회사 최종 정합성](../outputs/ui-only-journey-20260718-b/19-company-final-consistency.png), [운영 플랫폼](../outputs/ui-only-journey-20260718-b/23-platform-final.png)

전체 단계별 스크린샷은 `outputs/ui-only-journey-20260718-b`에 보존했다.
