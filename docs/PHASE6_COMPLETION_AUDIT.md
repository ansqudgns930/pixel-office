# Phase 6 완료 감사

## 운영 경계

- `LocalAuth`: bearer token hash, principal, scope, Company tenant 범위, 만료·폐기, 보안 거부 감사
- `OperationalStore`: SQLite durable Outbox, v1 tenant event stream, online backup/verified restore, health/readiness
- secured Control Plane은 요청 body/query의 사용자 ID 대신 인증 principal을 사용한다.
- 인증 없는 기존 생성자 구성은 테스트와 명시적 trusted adapter 호환 경계로만 유지한다. 실제 CLI 구성은 token을 필수로 요구한다.

## 실패 복구

- Outbox는 Host 장애 시 failed 상태, attempts, next attempt와 오류를 보존한다.
- 재시작 후 같은 idempotency key를 중복 삽입하거나 이미 전송한 항목을 재전송하지 않는다.
- backup restore는 기존 대상 덮어쓰기, manifest 누락, hash/크기 변조, SQLite 무결성 실패, schema 불일치를 차단한다.

## 검증

```powershell
npm run phase6:smoke
npm run verify
$env:REDIS_INTEGRATION='1'; npm run test:redis
```

테스트는 actor 위조, scope·tenant 거부 감사, 두 Company SSE 격리/cursor, Outbox 장애·재시작·중복 방지, backup 복구와 변조 차단을 포함한다.
