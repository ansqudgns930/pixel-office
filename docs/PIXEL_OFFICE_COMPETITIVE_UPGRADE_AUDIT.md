# Pixel Office 경쟁 UI 개선 완료 감사

> 완료일: 2026-07-16  
> 목표: 운영 대시보드형 화면을 실제 업무가 공간과 캐릭터 변화로 보이는 운영형 픽셀 오피스로 개선

## 완료 판정

완료. Gather·WorkAdventure·SoWork·Kumospace에서 확인한 공간성, 캐릭터성, 즉시 상호작용 원칙을 참고하되 UI를 복제하지 않고 기존 Agent Company OS의 실제 Run·Task·검증·승인·Incident 데이터를 유지했다.

## 구현 결과

1. Canvas 중심 단일 오피스 맵
   - 데스크톱 540px, 모바일 560px 높이의 주 화면
   - CEO실, 개발실, QA실, 승인실을 통로로 연결
   - 체크무늬 바닥, 방 헤더, 책상·모니터·식물 배치
   - 이벤트 타임라인은 보조 열로 유지

2. 실제 상태 기반 픽셀 캐릭터
   - 원형 상태 점을 역할 색상의 픽셀 캐릭터로 교체
   - 활성 Agent는 projection phase에 따라 계획·작업·검증·승인·차단·완료 공간에 배치
   - 활성 상태 말풍선과 pulse 피드백 제공
   - 비활성 Agent도 역할별 공간에 분산 배치
   - 후속 개선에서 `workItems`를 연결해 여러 Agent의 개발·검증·승인 업무를 동시에 표시
   - 방별 활성 인원 HUD, 직원별 Task/Run 라벨과 Drawer 근거 이동 제공
   - 상태 변경 시 이전 좌표에서 새 업무 방까지 보간 이동, 좌우 방향과 3프레임 보행 제공
   - reduced-motion에서는 즉시 배치해 접근성 계약 유지

3. 상호작용
   - 방 선택 버튼과 Canvas 방 클릭 지원
   - Canvas 캐릭터와 직원 목록 모두 기존 직원 상세 Drawer에 연결
   - 기존 우선 알림과 Incident는 실제 Execution 화면 연결을 유지
   - 프로젝트 ID, 회사명, 최신 이벤트 번호를 맵 전광판에 표시

4. 반응형·접근성
   - 데스크톱과 모바일 모두 2×2 방 구성 유지
   - 방 이동 버튼을 키보드 접근 가능한 DOM 컨트롤로 상시 제공
   - reduced motion, ARIA, 가상 이벤트 목록과 기존 접근성 계약 유지

## 검증 증거

- `npm run verify`: PASS
- 전체 TypeScript 및 웹 production build: PASS
- 전체 회귀·Phase 1~6·P0~P5 smoke: PASS
- 브라우저 QA: 60 FPS, 직원 30명, 이벤트 500개, DOM 19행
- 데스크톱: Canvas 876×540, overflow 0, console error 0
- 모바일: Canvas 364×560, overflow 0, console error 0
- 캐릭터 선택 Drawer 및 Escape 닫기: PASS
- 직원별 동시 업무 3건, 모바일 overflow 0: PASS
- 개발실→QA실 보행 3프레임·방향·종료·reduced-motion 즉시 이동: PASS

직원별 동시 업무 상세 근거는 `PIXEL_OFFICE_WORKITEMS_COMPLETION_AUDIT.md`를 참조한다.

## 3순위 상태 표현·가구 기능 은유 완료 (2026-07-16)

- 실제 `workItems.phase`에서만 생성되는 상태 말풍선으로 승인 대기·차단·완료를 즉시 구분한다.
- 방별 최신 업무를 책상에 배정하고 모니터를 작업·검증·승인·차단·완료 상태별로 자동 점등한다.
- 빈 책상은 모니터가 꺼진 상태를 유지해 활동을 과장하지 않는다.
- Canvas 표현과 동일한 직원·상태 정보를 방 이동 버튼 ARIA 설명과 검증용 렌더 데이터에 제공한다.
- 상세 근거는 `PIXEL_OFFICE_AUTOSTATE_COMPLETION_AUDIT.md`를 참조한다.

## 4순위 실제 성과 피드백 완료 (2026-07-16)

- 보상 원장의 실제 지급값만 직원 위 `+N XP`로 표시한다.
- 검증 통과·실패와 업무 완료를 이벤트 근거에 따라 서로 다른 색과 문구로 표현한다.
- 최초 로드·새로고침에서는 과거 성과를 다시 연출하지 않아 실제 발생 시점과 표현 시점의 정합성을 유지한다.
- reduced-motion에서는 이동 효과를 제거하고 동일 의미의 정적 배지를 제공한다.
- 상세 근거는 `PIXEL_OFFICE_FEEDBACK_COMPLETION_AUDIT.md`를 참조한다.

## 산출물

- `apps/web/src/pages/PixelOfficePage.tsx`
- `apps/web/src/styles.css`
- `pixel-office-goal-desktop.png`
- `pixel-office-goal-mobile.png`

## 의도적 제외

- 화상회의, 공간 오디오, 채팅 플랫폼
- 자유 보행 게임과 충돌 맵
- 경쟁 제품의 에셋 또는 레이아웃 복제
- 백엔드 이벤트 계약 재설계
