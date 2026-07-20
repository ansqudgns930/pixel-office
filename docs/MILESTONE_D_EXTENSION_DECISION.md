# Milestone D 선택적 확장 결정

> 결정일: 2026-07-16  
> 상태: 신규 provider 추가 안 함

Milestone D는 실제 사용자 수요 또는 운영 필요가 확인된 provider부터 선택적으로 추가하는 항목이다. 현재 구현은 deterministic standalone, OpenAI-compatible, Claude CLI, Codex CLI binding과 probe를 이미 제공하며, Gemini CLI·OpenCode·Kimi를 요구하는 fixture, 운영 장애, 배포 대상 또는 사용자 요구가 확인되지 않았다.

따라서 이번 release 후보에서는 새 provider를 추가하지 않는다. 검증되지 않은 인증·stdin·취소·timeout 계약을 추측해 adapter를 넓히는 것보다 기존 provider 계약과 Milestone A~C acceptance를 유지하는 편이 안전하다.

향후 다음 중 하나가 생기면 별도 변경으로 재개한다.

- 명시적인 사용자/운영 provider 요구
- 기존 provider로 충족하지 못하는 target environment 제약
- 고정 Golden fixture와 실제 로그인·취소·timeout·비밀 비저장 검증 환경

재개 시 공식 CLI 계약 조사, provider manifest, probe-before-save, credential 비저장, 실제 Run/Golden/rollback 증적을 모두 요구한다.
