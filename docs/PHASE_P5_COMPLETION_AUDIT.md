# P5 오피스 고도화 완료 감사

## 요구사항별 증거

| 요구사항 | 구현 증거 | 검증 증거 |
| --- | --- | --- |
| 다층 오피스 | `OfficeManagement`의 5개 층과 역할별 구역 | P5 규모 스모크 |
| 채용·배치 | `/office/hire`, `/office/place`, 회사 구성원 원본 재사용 | P5 API 스모크 |
| 역할별 외형·전문 Reviewer | `characterStyle`, `specialty`, 전문층 | 30명 및 security reviewer 검사 |
| 장식·사건 | `/office/decorate`, 운영 이벤트, Incident/해결 이력 연계 | API 스모크와 기존 P2/P4 스모크 |
| 회사 레벨 6~10 | XP 임계값과 단계별 해금 | 3,000 XP 레벨 10 검사 |
| 다중 프로젝트 | 회사 포트폴리오 연결을 오피스 Snapshot에 포함 | 프로젝트 2개 동시 표시 검사 |
| 카메라·구역 필터 | 층·구역 선택, 이동·중앙 버튼, 변환 Viewport | Web TypeScript/Vite 프로덕션 빌드 |
| 장기 Replay | cursor 기반 `/office/replay`, 최대 500건 페이지 | 10,000건 무손실 순회 검사 |
| 30명 렌더링 | 직원 Snapshot과 DOM 기반 접근성 표현 | 30명 Snapshot 1초 미만 검사 |
| 접근성 | 키보드 toolbar, ARIA, 텍스트 요약, reduced-motion/high-contrast | Web 빌드 및 P5 Snapshot 검사 |

## 불변 조건

- 오피스 화면은 회사 구성원·프로젝트·운영 이벤트 원본을 읽으며 실제 Run 상태를 변경하거나 완료 상태를 합성하지 않는다.
- 채용·배치·장식은 회사 RBAC를 통과해야 하고 운영 이벤트로 남는다.
- Replay는 UI 표시 개수와 별개로 원본 이벤트를 cursor 페이지로 조회한다.

## 완료 게이트

- `npm run p5:office-scale-smoke`
- `npm run web:build`
- `npm run verify`
