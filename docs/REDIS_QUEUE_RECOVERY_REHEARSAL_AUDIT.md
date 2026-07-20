# Redis Queue Recovery Rehearsal 감사

> 실행일: 2026-07-16 (Asia/Seoul)  
> 목적: Milestone A release queue 복구 증적

## 환경

- Windows, portable Node 24.17.0, npm 11.13.0
- Redis Windows portable MSYS2 build 8.8.0
- archive SHA-256: `8AF6FD6C4AAC3E13DED36F249DA8114B3BE32DF60AB589DA7C3513AA8B1A86CD`
- 설치 범위: 프로젝트 `.tools` 내부, Windows service/전역 설치 없음
- bind: `127.0.0.1:6379`
- persistence: AOF enabled

Redis 공식 Windows 안내가 공식 파트너 Memurai를 제시하는 점을 확인했다. 이번 증적은 production 배포 선택이 아니라 로컬 queue recovery rehearsal이므로, 설치 없는 `redis-windows` portable 릴리스와 게시된 해시를 사용했다.

## 서버 재시작 시나리오

1. Redis를 AOF로 시작했다.
2. BullMQ에 고정 runId job을 enqueue하고 `waiting`을 확인했다.
3. Redis를 정상 종료했다.
4. 동일 AOF 디렉터리로 Redis를 재시작했다.
5. worker를 시작해 복원된 job을 처리했다.
6. 최초 requestId가 보존되고 delivery가 정확히 1회이며 최종 상태가 `completed`임을 확인했다.

최종 실행 결과:

```json
{"phase":"recover","state":"completed","deliveries":1}
```

## 통합 회귀

`REDIS_INTEGRATION=1 npm run test:redis`를 `--test-concurrency=1`로 실행했다. 동일 queue를 쓰는 독립 fixture 간 worker 경쟁을 막기 위한 격리다.

- BullMQ runId dedupe: 통과
- RunWorker durable pipeline restart: 통과
- 실제 local Control Plane의 plan/result 승인과 merge candidate 흐름: 통과
- 총 3/3 통과

RunWorker 테스트는 worker 단계가 `VALIDATING`으로 끝나는 계약에 맞춰 planner+worker 무중복을 확인한다. Reviewer는 별도 post-validation `review()` 단계에서 생성되므로 worker restart 테스트가 미리 Reviewer row를 요구하지 않는다.

## 재실행

```powershell
$env:AGENT_COMPANY_REDIS_SERVER = '<absolute redis-server.exe>'
$env:AGENT_COMPANY_REDIS_CLI = '<absolute redis-cli.exe>'
npm run rehearse:redis
```

스크립트는 `scripts/rehearse-redis-recovery.ps1`과 `scripts/rehearse-redis-queue.cjs`이며 성공·실패 모두 서버를 종료한다.
