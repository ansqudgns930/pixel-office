# §52 잔여 우선순위 완료 감사

> 감사일: 2026-07-15  
> 기준: `prj_2.md` §52와 통합 목표의 6개 잔여 항목

## 판정

코드 및 로컬 검증 범위는 완료다. 실제 운영 서버 변경과 외부 자격증명 생성은 범위 밖이며 운영자 증적으로 분리한다.

## 요구사항별 증거

1. Persistent SSE
   - 서버 연결 유지, 15초 heartbeat, 250ms 신규 이벤트 전달
   - query cursor와 `Last-Event-ID` 중 큰 값을 기준으로 재개
   - 중복·누락·tenant 격리 테스트: `auth-control-plane.test.ts`, `p0-playable-demo.test.ts`

2. Execution → Pixel Office
   - Execution 화면에 복귀 링크 제공
   - company, project, agent, run 컨텍스트와 local last-company/selected-agent 상태 유지
   - `navigation.test.ts`, 웹 typecheck 및 production build 통과

3. Agent Backend Binding
   - `HANDOFF_AGENT_BACKEND_BINDING.md`의 완료 표 참조
   - Claude와 Codex 실제 로그인 probe 및 최소 응답 확인
   - 추정 사용량 DB migration과 회귀 테스트 포함

4. 파일별 Diff/승인 UI
   - unified diff를 파일별로 분리
   - 추가·삭제 수, patch hash, 결과 승인 상태, validator 결과 동시 표시
   - `diff-view.test.ts` 및 웹 production build 통과

5. Multi-company
   - 멤버십으로 제한된 회사 목록 API
   - 전역 Header 회사 전환, Company Command Center 선택기와 포트폴리오 이동
   - `multi-company-api.test.ts`에서 타 회사 비노출 검증

6. 운영 검증 분리
   - 저장소 검증: `npm run verify` PASS (2026-07-15)
   - 운영자 증적: Redis, 실제 선택 backend, 환경값, health, backup/restore
   - `PRODUCTION_READINESS_AUDIT.md`, `PRODUCTION_RUNBOOK.md` 참조

## 브라우저 QA

- 60 FPS
- 직원 30명
- 이벤트 500개, 가상 목록 19행
- 키보드 스크롤, reduced motion, ARIA 통과

## 외부 환경 의존 항목

- 특정 운영 장비의 자격증명과 CLI 세션
- 운영 Redis와 네트워크
- 실제 배포·롤백 수행 기록

위 항목은 코드 미완료가 아니라 배포 대상별 운영 증적이다.

## 회사 운영 UI 후속 우선순위 진행 상태 (2026-07-16)

- P0 로그인·회사 목록·회사 선택·회사 홈: 완료
- P1 Pixel Office·직원 현재 상태·활동 기록·Agent 설정: 완료
- P2 회사 목표·프로젝트·마일스톤·Task·Run·완료 근거: 완료
- P3 회의 목록·실시간 발언·사용자 개입·요약·후속 Task: 완료
- P4 통합 검색·알림·접근성·성능·운영 복구의 사용자 프로세스 최종 점검: 완료

P3 상세 근거는 `COMPANY_UI_P3_MEETINGS_COMPLETION_AUDIT.md`, P4 상세 근거는 `COMPANY_UI_P4_OPERATIONAL_COMPLETION_AUDIT.md`를 참조한다.

## Pixel Office 경쟁력 개선 후속 우선순위 (2026-07-16)

- 1순위 `workItems` 기반 직원별 동시 업무·방 배치·상태·Task/Run 근거: 완료
- 2순위 상태 전환 이동 보간·방향·걷기 3프레임: 완료
- 3순위 상태 말풍선 확장·책상/모니터 auto-state: 완료
- 4순위 XP·검증·완료 공간 피드백: 완료
- 5순위 실제 회의 참석자 공간 집결: 다음 목표
- 6순위 Gemini·OpenCode·Kimi Adapter와 Backend 설정 마법사: 대기

1순위 상세 근거는 `PIXEL_OFFICE_WORKITEMS_COMPLETION_AUDIT.md`, 2순위 상세 근거는 `PIXEL_OFFICE_WALKING_COMPLETION_AUDIT.md`, 3순위 상세 근거는 `PIXEL_OFFICE_AUTOSTATE_COMPLETION_AUDIT.md`, 4순위 상세 근거는 `PIXEL_OFFICE_FEEDBACK_COMPLETION_AUDIT.md`를 참조한다.

## 종합 차기 구현계획 적용 (2026-07-16)

Claw-Empire 역할·회의·보고 비교와 현재 코드 호출 경로를 재분석한 결과는 `NEXT_IMPLEMENTATION_MASTER_PLAN.md`에 정리했다.

기존 5순위 회의 참석자 공간 집결과 6순위 Backend 확장은 폐기하지 않는다. 다만 실제 역할 행동과 Agent 회의 프로세스가 선행되어야 하므로 신규 종합계획의 6순위와 8순위로 재배치한다. 즉시 착수 대상은 `역할별 RoleTemplate 해석·binding·snapshot`이며, 이를 완료한 뒤 역할별 Prompt 배선으로 진행한다.
