# 실제 회사 사용 여정 UI/UX 완료 감사

> 감사일: 2026-07-15  
> 대상: 로그인, Execution, Project War Room, Company Command Center, Pixel Office, Platform, Operations

## 판정

실제 회사 운영 순서의 데스크톱·모바일 브라우저 여정을 재현했고, 발견된 치명 런타임 오류와 주요 탐색·반응형 문제를 수정했다.

## 발견 및 수정

- Company Command Center가 DB의 JSON 문자열을 배열로 오인해 빈 화면이 되던 문제를 API 역직렬화 계층에서 수정
- PixiJS가 React Strict Mode 초기화 전에 파괴되던 Pixel Office 빈 화면 수정
- Pixel Office 진입 시 직원 Drawer가 자동으로 전체 화면을 가리던 동작 제거
- Drawer backdrop hover가 파란 버튼 배경으로 바뀌던 스타일 충돌 수정
- Demo Run에 불필요한 Agent Binding API를 호출하던 400 응답 제거
- Demo 회사 구성원에게 연결 프로젝트 권한이 없어 War Room 이동이 실패하던 문제 수정
- 390px 모바일에서 83px 가로 overflow가 발생하던 앱 셸·폼 최소 너비 수정
- 모바일 Header의 제목·회사 선택·사용자·로그아웃 겹침을 축약형 UI로 정리
- Platform과 Operations의 Company ID 직접 입력을 회사 선택과 최근 회사 복구로 변경
- Platform 자동 조회, Operations 진입 시 자동 health 확인, 빈 상태 다음 행동 안내 추가
- Company와 Project 페이지가 저장된 최근 컨텍스트를 자동 복구하도록 변경
- 라우트별 lazy loading으로 초기 번들을 약 500KB에서 약 177KB로 축소하고 PixiJS를 Pixel Office 전용 청크로 분리
- 예외 발생 시 전체 빈 화면 대신 오류·재시도·안전 이동을 제공하는 Error Boundary 추가

## 브라우저 검증

- Desktop: 1366×900
- Mobile: 390×844
- 전 페이지 console error 0
- 전 페이지 page error 0
- HTTP 4xx/5xx 0
- 가로 overflow 0
- Pixel Office canvas 렌더링 1
- Demo 실행 → 직원 Drawer → Company → 연결 Project → Platform → Operations 성공
- 모바일 메뉴 → Operations 이동 성공

## 회귀 게이트

## 2026-07-16 권장 순위 개선 완료

- Operations 이벤트 스트림을 응답 종료 대기 방식에서 즉시 연결·점진 표시·명시 해제 방식으로 변경
- Pixel Office SSE의 실제 응답 개시 시점을 연결 상태에 반영하고 Pixi scene 준비 후 Projection을 다시 그리도록 보정
- Project War Room의 ID 직접 입력을 접근 가능한 회사·프로젝트 선택 흐름으로 교체
- 390px Execution 8단계를 2열 세로 진행선으로 재배치하고 Run 이름에 짧은 ID·수정 시각을 추가
- Pixel Incident와 우선 알림을 원인·Run·유형별로 묶어 중복 밀도를 줄이고 알림을 반응형 그리드로 변경
- Platform 표본 3건 미만의 0%를 위험으로 단정하지 않고 측정 대기로 표시
- Company 상세을 현황, 조직·Agent, CEO 브리핑 탭으로 분리
- 핵심 보조 텍스트의 최소 크기를 12px로 높임

추가 실브라우저 검증 결과:

- Operations SSE `실시간 연결됨` 확인 및 수동 해제 성공
- Pixel SSE `SSE 연결됨`, Canvas 1012×330 렌더링 확인
- Project 선택: 회사 옵션 2개, 프로젝트 옵션 2개 확인
- Company 탭 3개 및 조직·Agent 전환 확인
- Mobile Execution: document overflow 0, stepper overflow 0
- console/page/HTTP 오류 0

## 2026-07-16 실제 회사 여정 2차 개선

- Project 업무 보드를 먼저 배치하고 Validator·Repository를 접힌 프로젝트 도구 영역으로 분리
- 모바일 칸반에 한글 상태·건수·좌우 이동 안내·스크롤 스냅을 추가하고 검증 체크박스 정렬 수정
- Pixel Canvas·직원·타임라인을 성장·Incident보다 먼저 배치하고 모바일 방 이동 버튼 제공
- Pixel 모바일 알림은 2건 우선 표시, 동일 Incident는 묶음, 고급 오피스·Replay는 기본 접힘 처리
- Platform을 운영 현황·업무 흐름·산업 템플릿 탭으로 분리하고 표본 기준·마지막 갱신 시각 표시
- Workflow 게시, 산업 템플릿 설치, 만료 작업 복구에 2단계 재확인 적용
- Execution에 상태별 다음 행동과 비활성 사유를 추가
- Operations를 정상 의미·연결 대상·마지막 확인 시각 중심의 운영 상태 센터로 변경
- CEO 브리핑 생성은 Company 브리핑 탭 내부로 이동

2차 실브라우저 검증:

- Desktop Pixel: Canvas 상단 298px, 성장 영역 848px로 핵심 공간 우선 배치
- Mobile Project: 문서 overflow 0, Validator 라벨 정렬 오차 0px, 고급 설정 기본 접힘
- Mobile Pixel: 방 이동 동작, 알림 2건 축약, 고급 오피스 기본 접힘 확인
- Platform 탭 3개 단독 노출, Execution 다음 행동, Operations 정상 카드·확인 시각 확인
- Console error, page error, HTTP 4xx/5xx 0

## 2026-07-16 UI/UX 3차 완성도 개선

- 사용자 입력은 Unicode NFC로 정규화하고 반복 물음표·대체문자 형태의 손상 목표는 인코딩 확인 경고로 대체
- Pixel Pixi 렌더러를 ResizeObserver 기반으로 변경해 Canvas를 실제 컨테이너 크기로 재렌더링
- 모바일 Pixel 방을 2×2로 배치하고 방 명칭을 CEO실·개발실·QA실·승인실로 사용자화
- 데모 목표·실행을 실제 연결 도구에서 분리해 접힌 `데모·개발 도구`로 이동
- Project 태스크를 키보드 접근 가능한 버튼으로 변경하고 선택 전에는 배정·상태 편집 폼을 숨김
- Project 역할·상태 선택을 한글 사용자 명칭으로 변경
- 내비게이션을 프로젝트 워룸·회사 운영 센터·운영 상태로 통일
- 모바일 Header, 방 이동, 고급 카메라 컨트롤을 최소 44px 터치 영역으로 보강
- 단계·검증·타임라인·Drawer 등 주요 보조 텍스트를 최소 12px로 상향
- Company에는 다음 운영 확인, Platform에는 비율 판정까지 필요한 표본 수를 표시

3차 실브라우저 검증:

- 손상 Run 목표: `텍스트 인코딩 확인 필요` 표시와 경고 스타일 확인
- Project: 선택 전 Prompt 노출, 편집기 0개, 태스크 선택 후 편집기 노출 확인
- Desktop Pixel Canvas 762px = Container 762px
- Mobile Pixel Canvas 364px = Container 364px, 높이 500px, 2×2 레이아웃
- 모바일 핵심 터치 대상 6개 모두 44px
- 데모·고급 오피스 기본 접힘, 문서 overflow 0
- Console error, page error, HTTP 4xx/5xx 0

```text
npm run web:build
npm run verify
```

특정 운영 장비의 외부 Backend 자격증명과 인터넷 공개 배포는 이번 UI/UX 코드 감사 범위가 아니다.
