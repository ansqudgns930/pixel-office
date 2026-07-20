# Owner Decision Center · Review Packet v2

기준일: 2026-07-18  
상태: 첫 마일스톤 구현·자동 회귀·화면 검증 완료

## 완료 범위

- 회사별 `/reviews` 오너 결정 센터와 사이드바/목표 화면 진입점
- 결정 대기 우선 큐와 승인·수정 요청 이력 재열람
- `Review Packet v2`: 단계 핵심, 실제 결정·위험·미해결, 결정론적 사실, 팀 해석, 근거 링크, 완전성·stale 상태
- `결정 중심 / 기술 검토 / 전체 근거` 점진적 공개
- 필수 근거 누락 또는 stale 시 승인 차단
- 승인·수정 요청·보류 시 패킷 전체와 해시를 불변 결정 snapshot으로 저장
- 기존 승인·수정·보류·재개 및 다음 단계 자동 시작 계약 유지

## 저장 계약

- `goal_delivery_review_packets_v23`: 생성 시점 패킷과 hash
- `goal_delivery_review_decisions_v23`: 결정, 사유, 결정자, 시각, 패킷 원문, packet/decision hash
- 기존 `goal_delivery_owner_reviews_v20`은 호환 유지하며 과거 기록은 읽을 때 Review Packet v2 보기 모델로 변환한다.

## 검증

- `npm run build`: PASS
- `node --test dist/tests/goal-delivery-process.test.js`: 13/13 PASS
- `npm run phase4:smoke`: 7/7 PASS
- `npm run web:build`: PASS
- UI 로그인 후 `/reviews` 실제 화면 확인: 데스크톱 1440×1000, 모바일 390×844
- 실제 회사의 승인 이력 5건에서 세 보기 모드 확인
- 패킷 완전성: 필수 3, 확인 5, 누락 0, stale 0
- 문서 및 `.app-main` 가로 overflow 0, 브라우저 console/page/HTTP 오류 0

화면 증적과 기계 판독 결과는 `outputs/owner-decision-center/`에 있다.

## 남은 위험과 후속 우선순위

1. 실제 추가 요구사항을 UI로 제출해 개발 재진입까지 확인했으나 NVIDIA 모델 실행이 실패해 새 pending 패킷 생성·화면 승인까지는 도달하지 못했다. 실패 상태와 재시도 UI는 정상 표시됐다.
2. Run 실패 화면은 “감사 로그에 기록됨”만 안내하고 직접적인 실패 원인을 첫 화면에 노출하지 않는다. 다음 UX 목표에서 실패 원인 요약·실패 단계·재시도 가능성·관련 로그를 같은 화면에 표시해야 한다.
3. 다음 P0는 개발 단계용 backend readiness matrix와 frontend preview/desktop·mobile 자동 캡처 수집기다.
4. 이후 P1은 버전 비교, 섹션/스크린샷 위치 기반 수정 댓글, 회의 합의·반대 의견 inline 표시다.
