# P5 시각 완성 감사

## 완료 범위

- 실제 Office Projection의 active agent와 phase를 사용하는 planning/working/validating/reviewing/approval/blocked 애니메이션
- `prefers-reduced-motion`에서 애니메이션 제거
- classic/night/forest/high-contrast 테마의 회사별 영속 선택과 운영 이벤트
- 장식 생성·선택·이동·삭제 API/UI와 감사 가능한 운영 이벤트
- 실제 Game Incident 조회, Run 현재 상태 확인, `resolve-incident` Intervention 실행과 해결 결과 표시

## 원본 상태 불변성

- 애니메이션은 Office Projection을 읽기만 하며 Run 상태를 합성하지 않는다.
- Incident 해결은 기존 Intervention RBAC·멱등·상태 충돌 검사를 통과한다.
- 테마와 장식은 별도 Office 테이블에 저장하며 Project/Run/Approval 원본을 변경하지 않는다.

## 검증

- `npm run p5:office-scale-smoke`: 5/5 통과
- `npm run p2:game-smoke`: 4/4 통과
- `npm run web:build`: 통과
- `npm run verify`: 통과
