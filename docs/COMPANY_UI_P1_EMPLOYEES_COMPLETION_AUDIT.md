# 회사 운영 UI P1 직원 완료 감사

> 완료일: 2026-07-16  
> 범위: 회사 내부 → 직원 목록 → 직원 상세 → Agent 설정

## 완료 결과

1. 직원 식별
   - 회사 멤버십에 `human | agent` 명시 필드 추가
   - 기존 Owner를 사람으로 마이그레이션
   - 회사 생성 Owner와 로그인 사용자를 사람 계정으로 저장

2. 직원 목록
   - 이름·역할·부서 검색
   - 사람·AI Agent 필터
   - 진행 중·대기·차단 상태 필터
   - 현재 phase와 연결 Task 표시

3. 직원 상세
   - 현재: 단계, 프로젝트, Task, Run, 연결 업무
   - 활동 기록: 직원 관련 운영 이벤트 시간순 조회
   - 성과·품질: XP, delivery, quality, efficiency, risk와 회사 품질 지표
   - Agent 설정: 직원별 backend/model과 회사 기본 상속 상태

4. Agent 변경 안전성
   - Owner만 수정 가능
   - 기존 Agent binding API의 backend health probe 사용
   - versioned binding 감사 기록 유지
   - 진행 중 Run은 시작 시점 binding 고정
   - 변경은 다음 Run부터 적용

5. 탐색
   - 회사 홈 → 직원
   - Pixel Office → 전체 직원 또는 선택 직원 상세
   - 직원 → 연결 프로젝트·실행
   - companyId·agentId URL 유지

## 검증

- Root/Web TypeScript: PASS
- Web production build: PASS
- 회사·Agent binding·Office 테스트 13개: PASS
- 데스크톱: 직원 6명, 상세 4개 탭, 성과 지표 5개, overflow 0, console error 0
- 모바일: 동일 기능, overflow 0, console error 0
- 전체 `npm run verify`: PASS
- P5 브라우저 QA: 57.1 FPS, 직원 30명, 이벤트 500개, 가상 목록 19행, PASS

## 다음 목표

P2 목표 전체 현황: 회사 목표 → 프로젝트 → 마일스톤 → Task → Run → 검증·승인·완료 근거를 계층·보드·타임라인으로 연결한다.
