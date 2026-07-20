# Agent Company OS

`more.md`를 기준으로 만든 로컬 우선·모듈식 멀티에이전트 실행 코어다. NVIDIA 플랫폼에는 `HostAdapter`로 선택 연결하며, 코어·SQLite·상태 머신은 특정 호스트에 종속되지 않는다.

## Agent backend 선택

- 기본 결정론적 Demo Stub: `AGENT_COMPANY_HOST=standalone`
- OpenAI 호환 서버: `AGENT_COMPANY_HOST=openai-compatible`, `AGENT_COMPANY_MODEL`, `AGENT_COMPANY_MODEL_BASE_URL`, 선택 `AGENT_COMPANY_MODEL_API_KEY`
- Legacy NVIDIA: `AGENT_COMPANY_HOST=legacy-nvidia`, `AGENT_COMPANY_MODEL`, `AGENT_COMPANY_MODEL_BASE_URL`
- Claude Code CLI: `AGENT_COMPANY_HOST=claude-cli`, `AGENT_COMPANY_MODEL`, 선택 `AGENT_COMPANY_CLI_PATH`
- Codex CLI: `AGENT_COMPANY_HOST=codex-cli`, `AGENT_COMPANY_MODEL`, 선택 `AGENT_COMPANY_CLI_PATH`

선택된 Host와 모델은 `/api/health` 및 웹 헤더에 표시된다. API 키는 환경변수에서만 읽으며 SQLite나 UI에 저장하지 않는다.

`npm run control-plane`은 `node --env-file-if-exists=.env`로 실행되므로, 저장소 루트에 `.env`(git 추적 제외, `.env.production.example` 참고)를 두면 별도 `export` 없이 `AGENT_COMPANY_MODEL_API_KEY`/`AGENT_COMPANY_MODEL_BASE_URL` 등을 읽는다. `AGENT_COMPANY_HOST`를 `.env`에 설정하지 않으면 실제 Run 실행은 여전히 `standalone`(결정론적 Demo Stub) 기본값을 사용하며, `AGENT_COMPANY_MODEL_API_KEY`/`BASE_URL`은 직원별 Agent 설정 화면의 "사용 가능한 모델 조회"가 baseUrl/apiKey를 다시 입력하지 않고도 동작하게 하는 기본값으로만 쓰인다.

## 현재 구현 범위

- Phase 1: 정책 기반 역할 구성, 승인, SQLite 상태 원본, Redis/BullMQ 실행 알림, Git Worktree, 제한된 로컬 프로세스 실행, 검증, 정확한 Diff hash 승인, 병합 후보 branch/commit
- Phase 2: Artifact Version/Relation, stale 전파와 재사용 차단, Context Builder v1, 변경 영향도, 실제 Git base 이동·충돌 분석, API/UI 조회
- Phase 3: Project/Milestone/Task Board, 사람·AI 할당, RBAC, 계층 예산 예약·정산, War Room, durable 알림, lease/heartbeat 복구
- Phase 4: Company/Department 조직, 역할 템플릿 버전, 포트폴리오, Review Aggregator, 근거 기반 CEO 브리핑, Command Center/Owner Console, 업무 추천, 읽기 전용 픽셀 상태
- Phase 5: Workflow/Plugin/Tool Gateway, tenant 격리, 산업 템플릿, 지표·추천·게임 상태, 외부 Agent mock Adapter, Platform Console
- Phase 6: local token 인증, durable Outbox, tenant SSE 이벤트, SQLite backup/restore, health/readiness, Operations Console
- 제외: PostgreSQL·Docker 필수화, pgvector/RAG, 원본 브랜치 자동 병합, 공개 인증·외부 서비스 전송

## 로컬 검증

지원 runtime은 Node 24.17.x이며 `.node-version`, `package.json#engines`, `.npmrc`에서 강제한다. 이 PC에서는 공식 배포본을 `.tools/node-v24.17.0-win-x64`에 두고 사용한다.

```powershell
$env:PATH=(Resolve-Path '.tools\node-v24.17.0-win-x64').Path + ';' + $env:PATH
npm ci
npm run runtime:check
npm run verify
```

`runtime:check`는 실제 Node executable, 버전, `node:sqlite` DatabaseSync와 online backup capability를 출력하고 지원 범위가 아니면 기능 테스트 전에 실패한다. 브라우저 QA는 저장소의 `playwright-core`와 설치된 Chrome/Edge를 사용하며, 필요하면 `BROWSER_AUTOMATION_EXECUTABLE`로 경로를 명시한다.

주요 명령:

- `npm run phase1:smoke`: 실제 임시 Git 저장소 기반 Phase 1 수직 흐름
- `npm run phase2:smoke`: 아티팩트·컨텍스트·영향도·충돌·API/UI·실행 자동 연결
- `npm run phase3:smoke`: 프로젝트 운영·권한·예산·복구·War Room 수직 흐름
- `npm run phase4:smoke`: 회사 조직·포트폴리오·Review 회의·CEO 브리핑·Command Center 수직 흐름
- `npm run phase6:smoke`: 인증·Outbox·SSE tenant 격리·backup/restore·운영 진단 검증
- `npm run verify`: 타입 검사, 빌드, 전체 테스트, Phase 1~6 smoke
- `npm run test:redis`: `REDIS_INTEGRATION=1`일 때 실제 Redis 통합 검증

## 상태와 실행 경계

- 업무 상태 원본은 프로젝트별 SQLite 파일이며 WAL, foreign key, `busy_timeout=5000`, 순차 migration을 사용한다.
- Redis/BullMQ는 실행 알림·재시도용이고 상태 원본이 아니다.
- Worktree는 런타임 디렉터리 아래에 격리한다.
- 등록된 build/test/lint/security 명령만 shell 없이 실행한다.
- 허용 경로 밖 Diff, symlink 탈출, 예산 초과, hash 불일치, stale 결과 재승인은 차단한다.
- 승인된 결과는 원본 브랜치를 바꾸지 않고 `agent-company/<run-id>` 후보 branch/commit으로 만든다.
- Docker와 PostgreSQL은 향후 동일한 `ExecutionSandbox`, `StateStore` 계약의 선택 Adapter로 추가한다.

## Control Plane

```powershell
$env:AGENT_COMPANY_REPO='D:\path\to\target-repo'
$env:AGENT_COMPANY_CHECK_FILE='src/main.js'
$env:AGENT_COMPANY_RUNTIME='D:\path\to\runtime'
$env:AGENT_COMPANY_API_TOKEN='32바이트 이상의 로컬 비밀값'
npm run build
npm run control-plane
```

기본 주소는 `http://127.0.0.1:4310`이다. Run과 Project War Room 외에 Company Command Center/Owner Console에서 조직·포트폴리오·역할 템플릿·Review 회의·CEO 브리핑·업무 추천·픽셀 상태를 조회하고 권한 내 정책을 관리한다.

상세 완료 근거는 `docs/PHASE1_COMPLETION_AUDIT.md`부터 `docs/PHASE5_COMPLETION_AUDIT.md`까지 확인한다.

## Phase 5 플랫폼 확장

- 버전형 WorkflowDefinition: draft → validated → published, DAG/완료 기준/회사 정책/hash 검증
- Role/Tool Plugin: 로컬 manifest, hash/signature metadata, Adapter·위험도·timeout·출력 상한 검증
- Tool Gateway: 회사·역할·게시 Workflow allowlist를 모두 통과한 capability만 허용하고 결정 감사
- tenant 경계: Workflow/Plugin/Template/Metric/API를 Company ID와 권한으로 격리
- software/public-sector/data 산업 템플릿: 설치 전 diff와 승인 hash 요구
- 실제 Task/Run 기반 성과 지표, 읽기 전용 조직 확장 추천과 결정론적 운영 게임 상태
- contract/auth/deadline/idempotency/usage/audit/circuit breaker를 갖춘 local mock 외부 Agent Adapter
- Platform Console: Workflow 작성·검증·게시·적용, 템플릿 미리보기·설치, 지표·추천·게임 상태 조회

검증 명령은 `npm run phase5:smoke`이며 전체 회귀는 `npm run verify`이다.

## Phase 6 운영과 복구

- Control Plane CLI는 `AGENT_COMPANY_API_TOKEN`이 없으면 시작하지 않는다. token 원문은 DB에 저장하지 않고 SHA-256 hash만 저장한다.
- 인증된 요청에서는 body/query의 `actorId`, `userId`, `ownerId`를 신뢰하지 않고 token principal을 사용한다.
- Host usage/event는 `outbox_v6`에 먼저 기록하며 idempotency key와 지수 backoff로 재전송한다.
- `/api/events?companyId=<id>&after=<cursor>`는 tenant scope를 검사하고 v1 SSE envelope만 반환한다.
- `/api/health`는 SQLite 무결성, schema version, Outbox backlog, backup 상태를 비밀 없이 반환한다.
- online backup은 DB와 `.manifest.json`을 함께 만든다. restore는 새 경로에만 허용하며 hash, 크기, SQLite integrity와 schema version을 먼저 검사한다.

```powershell
npm run build
npm run ops:backup -- .runtime/control-plane/data/agent-company.sqlite .runtime/backups/agent-company.bak
npm run ops:restore -- .runtime/backups/agent-company.bak .runtime/restored/agent-company.sqlite
```
