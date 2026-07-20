# Phase 5 완료 감사

## 완료 범위

기존 Phase 1~4의 SQLite 상태 원본과 실행 엔진을 유지하면서 교체 가능한 `platform-ops` 모듈로 구현했다. 공개 마켓플레이스, 외부 네트워크, 임의 코드 실행, PostgreSQL/Docker 의존은 포함하지 않는다.

## 구현 근거

- `packages/platform-ops/src/index.ts`: Workflow 버전·검증·게시·Run 바인딩, Role/Tool Plugin, Tool Gateway, tenant 격리, 산업 템플릿, 지표·추천·게임 상태, mock 외부 Adapter
- `apps/control-plane/src/index.ts`: tenant별 Platform API와 Platform Console UI
- `apps/local-control-plane/index.ts`: 기존 Run 파이프라인에 `PlatformRunGovernance` 합성

## 보안 및 상태 원본

- V5 데이터는 프로젝트 로컬 SQLite에 저장하며 Company foreign key와 조회 조건으로 격리한다.
- 게시 Workflow는 수정 API가 없고 게시 직전 content hash를 다시 검증한다.
- Plugin은 선언형 manifest만 등록하며 코드 경로·명령 실행을 받지 않는다.
- 추천과 게임 상태는 읽기 전용 파생값이고 조직·예산·권한을 자동 변경하지 않는다.
- mock Adapter는 네트워크를 사용하지 않는다.

## 자동 검증

- SQLite 재시작 후 게시 Workflow 복구와 실제 Run 바인딩
- 순환·고아·미완료 기준·정책 약화·Tool 상승 차단
- 게시 Workflow와 Company 정책의 실행 거버넌스 합성
- Plugin hash/signature/Adapter/limit/tenant/Tool Gateway 검증
- 산업 템플릿 승인 hash, metric provenance, no-auto-mutation, game 결정성
- 외부 Adapter 계약·인증·기한·멱등성·실패 격리·lineage 기록
- Platform Console API의 draft → validate → publish → Project bind 수직 흐름

```powershell
npm run phase5:smoke
npm run verify
$env:REDIS_INTEGRATION='1'; npm run test:redis
```
