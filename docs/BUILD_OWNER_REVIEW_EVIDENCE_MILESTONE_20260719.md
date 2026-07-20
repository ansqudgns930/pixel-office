# 개발 단계 오너 검토 증거 자동화 완료 기록

## 결론

개발 단계는 이제 실행 결과만 나열하지 않는다. 오너 검토 패킷에 백엔드 준비상태 표, 실제 프리뷰 버전, 데스크톱·모바일 화면, 로딩·빈 상태·오류·권한 제한 화면, 확인 매뉴얼이 함께 저장된다. 필수 근거가 없거나 오래됐거나 프리뷰 버전이 Run 결과와 다르면 승인 버튼이 비활성화되고 서버 승인도 거부한다.

## 자동 처리 흐름

1. 개발 Run이 검증을 통과하고 결과 승인 대기 상태가 된다.
2. 변경 파일과 결정론적 validator 결과로 API, DB, 인증·권한, 입력 검증, 단위·통합·E2E, 보안, 관측성, 환경 구성을 판정한다.
3. 구성된 프리뷰를 실제 Chromium으로 열어 핵심 화면 데스크톱·모바일과 로딩·빈 상태·오류·권한 제한 데스크톱 화면을 캡처한다.
4. `meta[name="agent-company-build-version"]`가 Run `patchHash`와 같은지 확인한다.
5. 전체 manifest를 hash로 묶어 개발 단계 attempt에 불변 저장한다.
6. 직원 검토 회의와 오너 검토 패킷에 같은 snapshot을 연결한다.
7. 누락, 캡처 실패, 버전 불일치, stale 근거가 있으면 오너 승인을 차단하고 수정 요청만 허용한다.

비-프론트엔드 변경도 자동 면제하지 않는다. 명시적 면제 사유가 있어야 화면 증거를 `exempted`로 처리한다. 프리뷰나 브라우저가 구성되지 않은 웹 변경은 실패 근거로 남아 오너에게 보이지만 승인되지는 않는다.

## 오너 화면

- 결정 중심: 개발 검증 요약, 백엔드 통과 수, 화면 수, 미충족 수, 핵심 화면 미리보기
- 기술 검토: 10개 백엔드 항목의 적용 여부, 판정, 근거, 근거 ID
- 전체 근거: 검토 시나리오, expected/observed 빌드 버전, 오너 확인 순서, 상태별 화면 갤러리, 누락·실패 사유
- 기술·근거 탭에서는 하단 결정 패널이 내용을 가리지 않고 문서 아래에 배치된다.
- 모바일에서는 준비도 표를 카드형 행으로 바꾸고 화면 갤러리를 한 열로 표시한다.

## 설정

- `BROWSER_AUTOMATION_EXECUTABLE`: 실제 Chromium/Chrome 실행 파일
- `AGENT_COMPANY_REVIEW_PREVIEW_URL`: 선택적 기본 프리뷰 주소
- 각 Run의 `checkpoint.reviewEvidence`에서 `previewUrl`, `routes`, `scenario`, `manual`, `frontendExemption`을 고정할 수 있다.
- 프리뷰 빌드는 `VITE_BUILD_VERSION=<Run patchHash>`로 빌드해 버전 meta를 노출해야 한다.

## 검증 결과

- TypeScript build 통과
- Web production build 통과
- 새 증거·목표 프로세스 자동화 20/20 통과
- Phase 4 smoke 7/7 통과
- 프로젝트 고정 Node 24.17 전체 회귀 243 통과, 0 실패, 3 환경 의존 테스트 skip
- 실제 Chromium UI 검증 통과
  - 준비 완료 승인 활성
  - 근거 부족 승인 비활성
  - 백엔드 10개 행 표시
  - 상태별 데스크톱 5장과 모바일 핵심 화면 1장 표시
  - 이미지 decode 성공
  - 모바일 가로 넘침 0, 사이드바 닫힘, 본문 좌측 위치 0
  - console/page error 0

검증 화면과 report는 `outputs/build-review-evidence/`에 있다. 현재 내부망 서버는 Web `0.0.0.0:5173`, Control Plane `0.0.0.0:4310`에서 재기동했다.
