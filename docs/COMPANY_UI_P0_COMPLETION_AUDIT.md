# 회사 운영 UI P0 완료 감사

> 완료일: 2026-07-16  
> 범위: 로그인 → 회사 목록 → 회사 선택 → 회사 홈 → 회사 컨텍스트 유지

## 완료 결과

1. 로그인 진입
   - 기본 진입을 `/execution`에서 `/companies`로 변경
   - 유효한 마지막 회사가 있으면 회사 홈으로 복귀

2. 회사 목록
   - 운영 중·보관 탭, 검색, 빈 상태
   - 회사·Workspace 생성
   - Owner 회사명·예산·운영 모드 수정
   - 2단계 확인 보관과 보관 회사 복구

3. 안전 수명주기
   - 회사 상태 `active | archived` 마이그레이션
   - 진행 중 Run이 존재하면 보관 차단
   - 수정·보관·복구 감사 이벤트
   - 물리 삭제는 의도적으로 제외

4. 회사 홈
   - 프로젝트, Task 진행, 예산, 승인, 직원, 검토 회의, 검증 실패, Incident
   - 회사 내부, 목표·프로젝트, 실행·승인으로 이어지는 주요 행동
   - 회사 미선택·로딩·오류 상태

5. 전역 탐색
   - `내 회사 → 회사 홈 → 픽셀 오피스 → 프로젝트 → 실행` 순서
   - Header 회사 선택은 운영 중 회사만 표시
   - URL과 localStorage의 companyId 유지

## 검증

- TypeScript root/web typecheck: PASS
- Web production build: PASS
- 회사 lifecycle·API·Command Center 테스트 7개: PASS
- 데스크톱: 로그인→회사 목록→회사 홈, 지표 8개, 행동 3개, overflow 0, console error 0
- 모바일: 동일 흐름, overflow 0, console error 0
- 전체 `npm run verify`: 모든 코드·API·Phase smoke 통과 후 변경된 회사 홈 제목에 맞춰 브라우저 계약을 갱신
- 최종 P5 브라우저 QA 재실행: 56.8 FPS, 직원 30명, 이벤트 500개, 가상 목록 19행, PASS

## 다음 목표

P1 회사 내부와 직원: 직원 현재 작업, 이전 활동, 성과, Agent backend/model 편집을 하나의 직원 상세 흐름으로 통합한다.
