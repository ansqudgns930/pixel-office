# Pixel Office User Process Redesign Plan

> 작성일: 2026-07-20  
> 개정일: 2026-07-20  
> 목적: Pixel Office / Agent Company OS를 기능 메뉴 중심 운영 콘솔이 아니라, 사용자가 일을 맡기면 AI 회사가 계획·실행·검증·보고하는 “업무 위임형 AI 회사 운영 시스템”으로 재설계한다.  
> 범위: 사용자 프로세스, 정보구조, 고정 직원/임시 전문가 모델, 동적 업무 배정, 화면별 역할, 구현 단계, 검증 기준.  
> 관련 기존 문서: `docs/COMPANY_OPERATING_UI_PROCESS_BLUEPRINT.md`, `docs/NEXT_IMPLEMENTATION_MASTER_PLAN.md`

---

## 1. 최종 결론

Pixel Office의 핵심 제품 경험은 “에이전트를 관리하는 도구”가 아니라 “AI 회사를 운영하는 느낌”이어야 한다.

사용자는 Agent, model, Run, pipeline, backend를 직접 다루고 싶은 것이 아니다. 사용자는 일을 맡기고, AI 회사가 알아서 계획하고, 필요한 직원만 투입하고, 위험하거나 중요한 결정만 사용자에게 물어보고, 검증된 결과를 보고하기를 원한다.

따라서 최종 기본 흐름은 다음으로 고정한다.

```text
로그인
→ 회사 홈
→ 업무나 목표 입력
→ AI가 계획 제안
→ 사용자가 계획 승인 또는 수정 요청
→ AI 회사가 자동 실행
→ 회사 홈에서 요약 상태 확인
→ 픽셀오피스에서 선택적으로 진행 관찰
→ 중요한 결정만 사용자에게 요청
→ 검증된 결과 보고
→ 다음 작업 추천
```

제품 정의:

> 사용자가 업무를 맡기면, 고정 핵심팀과 필요한 임시 전문가로 구성된 AI 회사가 계획·작업·검증·회의·승인을 진행하고, 사용자는 픽셀오피스에서 상태를 보며 중요한 순간에만 개입하는 로컬 AI 운영 시스템.

핵심 원칙:

1. **사용자는 회사에 일을 맡긴다.**  
   직원, 모델, 도구를 매번 고르지 않는다.

2. **AI가 먼저 계획을 제안한다.**  
   바로 실행하지 않고 목표, 단계, 성공 기준, 투입 직원, 위험 지점을 요약한다.

3. **직원 캐릭터는 고정, 실제 호출은 동적이다.**  
   회사다운 느낌과 비용/속도 최적화를 동시에 만족한다.

4. **픽셀오피스는 필수 절차가 아니라 live view다.**  
   작업 흐름 그 자체가 아니라 진행 상황을 보는 창이다.

5. **중요한 결정만 사용자에게 온다.**  
   권한, 위험, 불확실성, 비용 초과, 결과 승인처럼 사람 판단이 필요한 순간만 요청한다.

---

## 2. 현재 구성 방식과 재해석

현재 Web UI route와 역할은 다음과 같다.

```text
/companies     내 회사
/company       회사 홈
/pixel-office  픽셀 오피스
/employees     직원
/goals         회사 목표
/reviews       오너 결정
/meetings      회의
/activity      검색·알림
/projects      프로젝트 워룸
/execution     실행 워크스페이스
/platform      운영 플랫폼
/operations    운영 상태(admin)
```

현재 구조의 장점:

- 회사 운영에 필요한 기능 단위가 대부분 존재한다.
- Pixel Office 시각화가 차별점으로 구현되어 있다.
- 목표, 회의, 오너 결정, 실행, 운영 상태가 독립 화면으로 존재한다.
- 내부 실행 pipeline은 `planner`, `worker`, `reviewer`로 이미 단순화되어 있다.
- risk에 따라 최소 역할만 호출하는 구조가 이미 존재한다.
- Agent backend/model binding 구조가 있어 회사/역할/멤버별 모델 선택이 가능하다.
- office-management에는 specialist 개념을 확장할 수 있는 기반이 있다.

현재 구조의 문제:

- 사용자 여정보다 기능 메뉴 분류가 앞선다.
- 사용자가 목표 생성, 프로젝트, 실행, 승인, 회의 화면을 직접 찾아다니게 된다.
- `/execution`이 전면에 있으면 일반 사용자가 Run 중심 사고를 강요받는다.
- Pixel Office가 절차 중간에 필수 단계처럼 보이면 “진행 상황 보기”라는 본래 장점이 흐려진다.
- Agent/backend/model 설정이 일반 사용자 기본 흐름에 노출되면 복잡하게 느껴진다.
- 직원이 존재한다고 항상 전부 AI 호출하면 비용과 속도 문제가 생긴다.

따라서 현재 기능을 없애기보다, 사용자에게 보이는 중심을 다음으로 바꾼다.

```text
기능 메뉴 중심
→ 업무 맡기기 중심

Agent 관리
→ AI 회사 운영

Run 생성
→ AI 팀에게 맡기기

Pixel Office 필수 단계
→ 진행 상황 live view

직원 직접 선택
→ 시스템 자동 배정 + 고급 설정에서 수정
```

---

## 3. 최종 사용자 프로세스

## 3.1 일반 사용자 기본 흐름

```text
1. 로그인
2. 회사 홈 진입
3. “무슨 일을 맡길까요?” 입력창에 업무/목표 입력
4. AI가 목표, 계획, 성공 기준, 투입 직원, 위험 지점을 제안
5. 사용자가 “이 계획으로 실행” 또는 “수정 요청” 선택
6. AI 회사가 필요한 직원만 동적으로 투입해 자동 실행
7. 회사 홈에는 진행 요약이 계속 업데이트됨
8. 사용자는 원하면 픽셀오피스에서 진행 상황을 시각적으로 확인
9. 권한/위험/불확실성/승인 필요 시 Decision Inbox로 요청이 옴
10. 사용자가 중요한 결정만 처리
11. QA/검증 완료 후 결과 보고 수신
12. 시스템이 다음 추천 작업 제안
```

일반 사용자에게 숨겨야 할 내부 용어:

- Run
- Adapter
- Binding
- Pipeline
- Execution Workspace
- Backend
- Model ID
- Role template

일반 사용자에게 보여줄 표현:

```text
업무 맡기기
AI 팀이 계획했습니다
이 계획으로 실행
사람 판단 필요
검증 완료
결과 보고
다음 추천 작업
픽셀오피스로 보기
```

---

## 3.2 운영자 흐름

```text
1. 회사 홈 진입
2. 진행 중 업무/차단 업무/결정 필요 항목 확인
3. Decision Inbox에서 승인/반려/수정 요청 처리
4. 직원·AI팀 화면에서 현재 투입 상태 확인
5. 실패한 업무는 복구 또는 재시도
6. 운영 상태에서 서버/큐/DB/Outbox/백업 상태 확인
7. 필요 시 설정에서 모델/backend/policy 변경
```

운영자는 회사가 정상적으로 굴러가고 있는지 확인하고, 막힌 작업을 해결하는 사람이다.

---

## 3.3 관리자 흐름

```text
1. 회사 생성
2. 고정 핵심팀 확인 또는 생성
3. 기본 AI backend/model 설정
4. 역할별 모델 정책 설정
5. 승인/검증/비용 정책 설정
6. 테스트 업무 실행
7. 실제 운영 전환
```

관리자에게는 고급 설정이 필요하지만, 이 기능은 일반 사용자 기본 흐름과 분리한다.

---

## 4. Staff Model — 고정 핵심팀 + 임시 전문가

## 4.1 결론

Pixel Office의 직원 구성은 **고정 핵심 직원 5명 + 필요할 때 투입되는 임시 전문가** 구조가 가장 적합하다.

고정 핵심 직원은 항상 사무실에 존재해 회사다운 느낌과 캐릭터 애착을 만든다. 하지만 직원이 존재한다고 매번 모두 AI 호출하면 안 된다. 실제 모델 호출과 업무 투입은 업무 유형, 위험도, 범위에 따라 동적으로 결정한다.

```text
항상 존재하는 캐릭터
≠ 항상 호출되는 AI
```

---

## 4.2 기본 고정 직원 5명

| 직원 | 역할 | 기본 성격 |
|---|---|---|
| CEO | 목표 해석, 우선순위, 최종 보고, 중요 결정 | 방향성과 책임 |
| PM | 업무 분해, 일정·진행 관리, 담당자 배정 | 운영과 조율 |
| Designer | UI·UX, 화면 구조, 디자인, 콘텐츠 구성 | 사용자 경험 |
| Developer | 코드 작성·수정·실행, 기술 문제 해결 | 구현 |
| QA | 테스트, 오류 확인, 완료조건 검증 | 품질 보증 |

### CEO

담당:

- 목표 해석
- 우선순위 판단
- 중요한 결정
- 최종 보고
- 고위험 변경 승인

호출 조건:

- 서비스 전체 방향
- 큰 목표
- 고위험/고비용 변경
- 최종 보고
- 사람 결정이 필요한 사안

작은 문구 수정에는 기본 호출하지 않는다.

### PM

담당:

- 업무 분해
- 일정/진행 관리
- 담당자 배정
- 막힘 감지
- 계획 제안

호출 조건:

- 대부분의 중간 이상 업무
- 목표가 모호한 경우
- 여러 단계/파일/역할이 필요한 경우
- 동적 staff 배정이 필요한 경우

PM은 사용자 입력을 실행 가능한 계획으로 바꾸는 중심 역할이다.

### Designer

담당:

- UI/UX
- 화면 구조
- 정보 위계
- 버튼/문구/콘텐츠 구성
- 사용자 흐름 개선

호출 조건:

- UI 개선
- 화면/레이아웃 변경
- 온보딩/홈/픽셀오피스 개선
- 사용성·카피가 중요한 작업

현재 기본 demo staff에 Designer가 약하므로, 고정 핵심팀으로 추가하는 것이 좋다.

### Developer

담당:

- 코드 작성
- 기능 구현
- 버그 수정
- 빌드/실행
- 기술 문제 해결

호출 조건:

- 코드 변경이 필요한 대부분의 업무

현재 내부 `worker` 역할과 가장 잘 맞는다.

### QA

담당:

- 테스트
- 오류 확인
- 완료 조건 검증
- 회귀 확인
- 결과 승인 전 품질 체크

호출 조건:

- 코드 변경 후
- UI 변경 후
- 고위험 변경 후
- 완료 보고 전

현재 내부 `reviewer` 역할과 가장 잘 맞는다.

---

## 4.3 임시 전문가

전문가는 항상 상주하는 핵심팀이 아니라, 필요할 때 프로젝트에 초빙되는 캐릭터로 둔다.

추천 임시 전문가:

| 전문가 | 투입 조건 |
|---|---|
| Researcher | 자료 조사, 경쟁 분석, 요구사항 탐색 |
| Data Analyst | 지표, 로그, 데이터 분석 |
| Marketing | 포지셔닝, 캠페인, 메시지 전략 |
| Security | 인증, 권한, 보안, 비밀정보, 배포 리스크 |
| Copywriter | 문구, 온보딩, 버튼, 랜딩 카피 |
| Legal | 약관, 개인정보, 정책 리스크 |
| Extra Developer | 큰 작업의 병렬 구현 또는 전문 기술 영역 |

UX 표현:

```text
외부 전문가 대기실
→ 전문가 초빙됨
→ 프로젝트 참여 중
→ 업무 종료 후 복귀
```

전문가는 프로젝트가 끝나면 사무실 핵심 공간에서 사라지거나 specialist floor / 대기실로 돌아간다.

---

## 5. Dynamic Staffing Rules — 업무별 투입 규칙

기본 원칙:

```text
캐릭터와 역할은 고정
실제 모델과 도구는 업무별로 변경
간단한 업무는 최소 인원만 투입
복잡한 업무는 팀 단위로 운영
전문 역할은 임시 채용
직원 직접 선택은 고급 기능
```

업무 유형별 기본 배정:

| 업무 유형 | 기본 투입 | 조건부 추가 |
|---|---|---|
| 문구 수정 | Developer + QA | UX/브랜딩 중요 시 Designer 또는 Copywriter |
| 버튼/레이블/카피 개선 | Designer + Developer + QA | 마케팅 성격이면 Copywriter |
| 화면 개선 | PM + Designer + Developer + QA | 큰 방향 변경이면 CEO |
| 버그 수정 | Developer + QA | 원인 불명/범위 큼이면 PM |
| 기능 구현 | PM + Developer + QA | UI 포함 시 Designer |
| 서비스 전체 기획 | CEO + PM + Designer | 기술 검토 필요 시 Developer, 검증 기준 필요 시 QA |
| 보안/인증/권한 | PM + Developer + QA + Security | 고위험이면 CEO 승인 |
| 데이터/로그 분석 | PM + Data Analyst + QA | 구현 필요 시 Developer |
| 마케팅/랜딩 | PM + Designer + Copywriter + Marketing | 구현 필요 시 Developer |
| 법무/정책/개인정보 | CEO + PM + Legal | 구현/보안 영향 시 Developer + Security |
| 대규모 리팩터 | CEO + PM + Developer + QA | 병렬 필요 시 Extra Developer, 위험 시 Security |

중요:

- 고정 직원 5명이 항상 사무실에 보여도, 실제 모델 호출은 위 규칙에 따라 최소화한다.
- 작은 일은 CEO/PM/Designer를 호출하지 않아도 된다.
- 고위험 일은 반드시 PM/QA/필요 전문가/CEO 승인으로 올라간다.

---

## 6. User-facing Staff vs Internal Pipeline

현재 내부 pipeline은 다음 3개 역할 중심이다.

```text
planner
worker
reviewer
```

이 내부 역할을 사용자에게 그대로 노출하면 안 된다. 사용자에게는 회사 직원으로 보여주고, 내부적으로만 pipeline에 매핑한다.

권장 매핑:

```text
planner
→ PM 기본
→ 큰 목표면 CEO + PM
→ UI 작업이면 PM + Designer

worker
→ Developer 기본
→ 디자인 산출이면 Designer 보조
→ 데이터 작업이면 Data Analyst
→ 문구 작업이면 Copywriter

reviewer
→ QA 기본
→ 보안 작업이면 Security
→ 법무/정책이면 Legal
→ 최종 보고는 CEO
```

즉:

```text
사용자에게 보이는 직원
CEO / PM / Designer / Developer / QA / Specialist

내부 실행 pipeline
planner / worker / reviewer

모델 binding
company / role / member / runtime default
```

이 세 층은 분리되어야 한다.

---

## 7. 정보구조 재설계

## 7.1 추천 내비게이션

기존 route를 바로 대규모 변경하지 않고, label과 순서를 제품 언어로 바꾼다.

권장 메뉴:

```text
내 회사
회사 홈
맡긴 일
픽셀 오피스
결정 필요
회의
결과·활동
직원·AI팀
설정
고급 실행
운영 상태
플랫폼
```

route 매핑:

```text
/companies        내 회사
/company          회사 홈
/goals            맡긴 일
/pixel-office     픽셀 오피스
/reviews          결정 필요
/meetings         회의
/activity         결과·활동
/employees        직원·AI팀
/settings/backend 설정 > AI 엔진
/execution        고급 실행
/operations       운영 상태(admin)
/platform         플랫폼
```

`/projects`는 장기적으로 `/goals`의 상세 탭 또는 `맡긴 일` 내부로 흡수한다.

---

## 7.2 회사 홈 중심 구조

회사 홈은 단순 dashboard가 아니라 제품의 중심 입력 허브다.

상단 핵심 영역:

```text
무슨 일을 AI 회사에 맡길까요?
[업무/목표 입력창]
[AI 팀에게 계획 요청]
```

그 아래:

- 진행 중인 맡긴 일
- 결정 필요
- 검증 완료 결과
- 다음 추천 작업
- 픽셀오피스로 보기

회사 홈의 목적:

```text
업무 입력
+ 현재 상태 요약
+ 필요한 결정 처리
+ 결과 보고 확인
```

---

## 8. 화면별 개선 계획

## 8.1 회사 홈(`/company`)

역할: 업무 위임 입력 허브 + 오늘의 운영 브리핑.

필수 섹션:

1. 업무 맡기기 입력창
2. AI 계획 제안 CTA
3. 진행 중인 맡긴 일
4. 결정 필요 Inbox 요약
5. 검증 완료/결과 보고
6. 다음 추천 작업
7. 픽셀오피스로 보기

권장 copy:

```text
무슨 일을 AI 회사에 맡길까요?
예: 랜딩페이지의 첫 화면을 더 설득력 있게 개선해줘.

[AI 팀에게 계획 요청]
```

완료 기준:

- 사용자가 회사 홈에서 바로 일을 맡길 수 있다.
- 사용자가 목표/프로젝트/Run 메뉴를 몰라도 기본 작업을 시작할 수 있다.
- 진행 중/결정 필요/완료 결과가 회사 홈에서 요약된다.

---

## 8.2 AI 계획 제안 패널

역할: 바로 실행하지 않고, AI가 계획을 먼저 제안한다.

입력 예:

```text
랜딩페이지 개선해줘
```

계획 제안 예:

```text
목표
- 랜딩페이지 첫 화면의 설득력과 행동 유도를 개선한다.

실행 계획
1. 현재 화면 구조 확인
2. UX 문제점 정리
3. 카피/레이아웃 개선안 작성
4. 코드 수정
5. 빌드/테스트
6. 결과 보고

투입 직원
- PM: 작업 분해
- Designer: UX/카피 개선
- Developer: 구현
- QA: 검증

필요한 결정
- 큰 방향 변경이 있으면 사용자 확인 요청

[이 계획으로 실행] [수정 요청] [취소] [고급 설정]
```

완료 기준:

- 사용자에게 목표, 단계, 성공 기준, 투입 직원이 보인다.
- Agent/model은 접힌 고급 정보로만 보인다.
- 사용자는 계획을 승인하거나 수정 요청할 수 있다.

---

## 8.3 맡긴 일(`/goals`)

역할: 사용자가 맡긴 업무의 목록과 상태를 보는 곳.

label 변경:

```text
회사 목표 → 맡긴 일
```

주요 상태:

```text
계획 중
실행 중
검증 중
결정 필요
완료
차단
```

상세 화면 진행 바:

```text
업무 입력
→ 계획 제안
→ 실행 중
→ 검증 중
→ 결정 필요
→ 완료 보고
```

완료 기준:

- 사용자가 맡긴 일이 어디까지 진행됐는지 이해한다.
- 내부 Run이 여러 개여도 사용자는 하나의 맡긴 일로 본다.
- 상세에서 픽셀오피스, 결정 필요, 결과 보고로 이동할 수 있다.

---

## 8.4 픽셀 오피스(`/pixel-office`)

역할: 필수 작업 단계가 아니라 진행 상황 live view.

정의:

> 픽셀 오피스는 workflow가 아니라 workflow를 보는 창이다.

사용 방식:

- 회사 홈 또는 맡긴 일 카드에서 `픽셀오피스로 보기`
- 사용자가 진행 상황을 감각적으로 보고 싶을 때 진입
- 막힌 직원/방/알림을 클릭하면 실제 해결 화면으로 이동

필수 연결:

- 직원 클릭 → 현재 담당 업무
- 방 클릭 → 해당 단계 업무 목록
- 알림 클릭 → 결정 필요 또는 차단 원인
- 회의 상태 클릭 → 회의 참여
- 완료 상태 클릭 → 결과 보고
- specialist 클릭 → 왜 초빙되었는지 설명

고정 직원 표시:

```text
CEO
PM
Designer
Developer
QA
```

전문가 표시:

```text
외부 전문가 대기실
프로젝트룸 입장
업무 종료 후 복귀
```

완료 기준:

- 픽셀 오피스가 사용자의 필수 절차가 아니다.
- 모든 중요한 시각 상태는 실제 업무/결정/결과 화면으로 연결된다.
- 고정 직원과 임시 전문가의 존재 이유가 시각적으로 이해된다.

---

## 8.5 결정 필요(`/reviews`)

역할: 오너 결정, 승인, 회의 요청, 위험/불확실성 처리를 한곳에 모으는 Inbox.

label 변경:

```text
오너 결정 → 결정 필요
```

필수 표시:

- 무엇을 결정해야 하는가
- 왜 멈췄는가
- 승인 시 영향
- 반려 시 영향
- 관련 evidence
- AI 추천
- 관련 업무/직원

권장 버튼:

```text
승인
수정 요청
반려
회의로 전환
더 설명해줘
```

완료 기준:

- 사용자가 AI가 왜 멈췄는지 이해한다.
- 결정 후 시스템이 어떻게 이어지는지 보인다.
- 결정 기록은 결과 보고와 활동 기록에 남는다.

---

## 8.6 직원·AI팀(`/employees`)

역할: 고정 직원과 임시 전문가를 보여주는 회사 구성 화면.

label 변경:

```text
직원 → 직원·AI팀
```

필수 섹션:

1. 고정 핵심팀
   - CEO
   - PM
   - Designer
   - Developer
   - QA

2. 현재 투입 중
   - 어떤 업무에 누가 참여 중인지

3. 외부 전문가 대기실
   - Researcher
   - Data Analyst
   - Marketing
   - Security
   - Copywriter
   - Legal
   - Extra Developer

4. 고급 설정
   - 역할별 모델
   - 도구 권한
   - 검증 강도

완료 기준:

- 사용자는 회사 직원 구조를 이해한다.
- 직원 직접 선택은 기본이 아니라 고급 기능으로 제공된다.
- 실제 모델/backend는 필요할 때만 펼쳐서 본다.

---

## 8.7 설정 > AI 엔진(`/settings/backend`)

역할: 관리자용 backend/model 설정.

중요: 이 화면은 필요하지만 일반 사용자 기본 흐름의 중심이 아니다.

필수 기능:

- 회사 기본 AI 엔진 선택
- 역할별 모델 정책 설정
- NVIDIA/openai-compatible 모델 combobox
- Claude CLI 확인
- Codex CLI 확인
- 연결 테스트
- `/api/agent-backend/models` 연동
- Agent Binding 저장

권장 UI:

```text
기본 AI 엔진
[ NVIDIA Build API ] [ nvidia/nemotron-3-ultra-550b-a55b ] [연결 테스트]

역할별 기본값
Planner / PM
[ Claude CLI ] [ Sonnet 5 ]

Worker / Developer
[ Codex CLI ] [ GPT-5 ]

Reviewer / QA
[ NVIDIA Build API ] [ Nemotron ]

[저장 전 요약] [저장]
```

원칙:

- API key 원문은 UI/SQLite에 저장하지 않는다.
- 모델/도구 설정은 일반 사용자에게 기본 노출하지 않는다.
- 업무별로 모델이 바뀔 수 있으므로 직원 캐릭터와 모델을 고정 결합하지 않는다.

---

## 8.8 고급 실행(`/execution`)

역할: 디버깅, 수동 Run, 고급 운영자용 화면.

label 변경:

```text
실행 워크스페이스 → 고급 실행
```

원칙:

- 일반 사용자는 이 화면을 몰라도 일을 맡기고 결과를 받을 수 있어야 한다.
- 운영자/개발자는 상세 로그, 수동 재시도, Run 상태 점검을 위해 사용한다.

---

## 9. 구현 단계

## Phase UX-A — 문구와 정보구조 재정렬

목표: 메뉴와 용어를 제품 언어로 바꾼다.

작업:

1. nav label/order 변경
2. `회사 목표` → `맡긴 일`
3. `오너 결정` → `결정 필요`
4. `검색·알림` → `결과·활동`
5. `직원` → `직원·AI팀`
6. `실행 워크스페이스` → `고급 실행`
7. wildcard redirect를 `/execution`이 아니라 `/companies` 또는 `/company`로 변경 검토

예상 파일:

- `apps/web/src/layout/nav.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/layout/Sidebar.tsx`
- `apps/web/src/layout/AppShell.tsx`

완료 기준:

- 메뉴만 봐도 “일을 맡기고, 진행을 보고, 결정하고, 결과를 받는” 구조가 느껴진다.

---

## Phase UX-B — 회사 홈에 업무 맡기기 입력 추가

목표: 회사 홈을 제품의 기본 입력 허브로 만든다.

작업:

1. `/company` 상단에 업무 입력창 추가
2. `AI 팀에게 계획 요청` CTA 추가
3. 입력 후 계획 제안 패널/모달 표시
4. 진행 중/결정 필요/완료 결과 요약 카드 정리
5. 픽셀오피스로 보기 링크 추가

예상 파일:

- `apps/web/src/pages/CompanyPage.tsx`
- `apps/web/src/api.ts`
- `packages/goal-drafting/src/index.ts`
- 필요 시 control-plane API

완료 기준:

- 사용자는 회사 홈에서 바로 업무를 맡길 수 있다.
- 목표/Run/프로젝트를 몰라도 계획 제안까지 도달한다.

---

## Phase UX-C — AI 계획 제안 흐름 구현

목표: 실행 전 계획/투입 직원/성공 기준을 보여준다.

작업:

1. 입력 업무를 목표/계획/성공 기준으로 draft
2. 업무 유형 분류
3. Dynamic Staffing Rules 기반 투입 직원 제안
4. 사용자 승인/수정 요청/취소 처리
5. 승인 시 기존 run/goal execution으로 연결

예상 파일:

- `packages/goal-drafting/src/index.ts`
- `packages/policy/src/index.ts`
- `packages/company-ops/src/index.ts`
- `apps/control-plane/src/index.ts`
- `apps/web/src/pages/CompanyPage.tsx`

완료 기준:

- 계획 없이 바로 실행되지 않는다.
- 사용자는 실행 전 AI 회사가 무엇을 할지 이해한다.
- 직원/model 정보는 기본 요약으로 보이고 상세는 접혀 있다.

---

## Phase UX-D — Staff Model 구현/노출

목표: 고정 핵심팀 5명과 임시 전문가 구조를 제품에 반영한다.

작업:

1. 기본 회사 생성/demo bootstrap에 Designer 추가
2. 고정 핵심팀 표시
3. 임시 전문가 대기실 UI 추가
4. 업무 유형별 staff assignment projection 추가
5. 내부 pipeline role과 user-facing staff 매핑 추가

예상 파일:

- `packages/company-ops/src/index.ts`
- `packages/office-management/src/index.ts`
- `packages/office-projection/src/index.ts`
- `apps/web/src/pages/EmployeesPage.tsx`
- `apps/web/src/pages/PixelOfficePage.tsx`

완료 기준:

- CEO/PM/Designer/Developer/QA가 기본 회사 구성으로 보인다.
- 전문가가 필요할 때만 프로젝트에 등장한다.
- 직원이 보인다고 모든 AI가 호출되는 것은 아니다.

---

## Phase UX-E — Decision Inbox 통합

목표: 사용자에게 필요한 결정만 한곳에 모은다.

작업:

1. `/reviews` label과 UI를 `결정 필요` 중심으로 변경
2. 승인/반려/수정 요청/회의 전환 액션 정리
3. 회의/승인/검증 실패/위험 escalation을 한 Inbox에 요약
4. 회사 홈 상단에 결정 필요 count 표시

예상 파일:

- `apps/web/src/pages/OwnerReviewsPage.tsx`
- `apps/web/src/pages/MeetingsPage.tsx`
- `apps/web/src/pages/CompanyPage.tsx`
- `packages/intervention/src/index.ts`
- `packages/meeting-runner/src/index.ts`
- `packages/reporting/src/index.ts`

완료 기준:

- 사용자는 어떤 결정을 해야 하는지 한 화면에서 본다.
- 결정 후 업무가 어떻게 진행되는지 보인다.

---

## Phase UX-F — Pixel Office live view 강화

목표: 픽셀오피스를 필수 절차가 아닌 실시간 회사 상태 화면으로 만든다.

작업:

1. 회사 홈/맡긴 일 카드에서 `픽셀오피스로 보기` 연결
2. 직원/방/알림 클릭 액션 정리
3. 고정 직원과 임시 전문가 시각화
4. specialist floor / external lounge 개념 추가
5. 차단/결정 필요 상태에서 해결 화면으로 이동

예상 파일:

- `apps/web/src/pages/PixelOfficePage.tsx`
- `apps/web/src/components/AdvancedOfficePanel.tsx`
- `packages/office-view-model/src/index.ts`
- `packages/office-management/src/index.ts`

완료 기준:

- 픽셀오피스는 진행 상황을 보고 싶을 때 들어가는 live view가 된다.
- 모든 중요한 시각 상태는 실제 업무/결정/결과와 연결된다.

---

## Phase UX-G — 설정 > AI 엔진 구현

목표: 관리자용 backend/model 설정을 완성한다.

작업:

1. `BackendSettingsPage.tsx` 생성
2. `/settings/backend` route 추가
3. `/api/agent-backend/models` 연동
4. 회사 기본/역할별 backend/model 저장
5. 연결 테스트와 오류 복구 안내 추가

예상 파일:

- `apps/web/src/pages/BackendSettingsPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/layout/nav.ts`
- `apps/web/src/api.ts`
- `apps/control-plane/src/index.ts`
- `packages/agent-bindings/src/index.ts`

완료 기준:

- 관리자는 NVIDIA/Claude/Codex backend를 설정할 수 있다.
- 일반 사용자 기본 흐름에는 모델 설정이 노출되지 않는다.

---

## 10. 우선순위

최종 구현 우선순위:

1. **Phase UX-A — 문구와 정보구조 재정렬**
2. **Phase UX-B — 회사 홈에 업무 맡기기 입력 추가**
3. **Phase UX-C — AI 계획 제안 흐름 구현**
4. **Phase UX-D — Staff Model 구현/노출**
5. **Phase UX-E — Decision Inbox 통합**
6. **Phase UX-F — Pixel Office live view 강화**
7. **Phase UX-G — 설정 > AI 엔진 구현**

기존 계획에서는 Backend Settings가 앞쪽이었지만, 개정 후에는 우선순위를 뒤로 내린다. 이유는 명확하다.

- 제품의 중심은 모델 설정이 아니라 업무 위임이다.
- 모델/backend 설정은 관리자 기능이다.
- 먼저 회사 홈에서 일을 맡기는 경험이 완성되어야 한다.
- 그 다음 계획 제안과 동적 직원 배정이 붙어야 한다.
- Pixel Office는 이 흐름을 시각적으로 보여주는 live view로 강화한다.

---

## 11. 검증 시나리오

## 11.1 일반 사용자 업무 위임

```text
Given 사용자가 로그인해 회사 홈에 들어간다
When “랜딩페이지 개선해줘”라고 입력한다
Then AI가 목표, 실행 단계, 성공 기준, 투입 직원, 예상 결과를 제안한다
```

```text
Given 사용자가 제안된 계획을 승인한다
When 실행이 시작된다
Then 회사 홈에 진행 중 업무 카드가 생성되고 Pixel Office 보기 링크가 표시된다
```

## 11.2 동적 직원 배정

```text
Given 사용자가 문구 수정 업무를 맡긴다
When AI가 staff를 배정한다
Then Developer와 QA가 기본 투입되고 CEO/PM/Designer는 불필요하면 호출되지 않는다
```

```text
Given 사용자가 화면 개선 업무를 맡긴다
When AI가 staff를 배정한다
Then PM, Designer, Developer, QA가 투입된다
```

```text
Given 사용자가 보안/인증 업무를 맡긴다
When AI가 staff를 배정한다
Then Security specialist가 임시 투입되고 필요 시 CEO 승인 조건이 생긴다
```

## 11.3 Decision Inbox

```text
Given AI가 권한/위험/불확실성 때문에 멈춘다
When 사용자가 회사 홈을 본다
Then 결정 필요 항목과 이유가 표시된다
```

```text
Given 사용자가 결정 필요 항목을 연다
When 승인/반려/수정 요청을 선택한다
Then 관련 업무 상태와 활동 기록에 결정 결과가 반영된다
```

## 11.4 Pixel Office live view

```text
Given 업무가 실행 중이다
When 사용자가 픽셀오피스로 보기를 누른다
Then 현재 투입 직원이 각 방/상태에 맞게 표시된다
```

```text
Given 임시 전문가가 투입되었다
When 사용자가 specialist 캐릭터를 클릭한다
Then 왜 초빙되었는지와 어떤 업무를 맡았는지 표시된다
```

## 11.5 관리자 AI 엔진 설정

```text
Given 관리자가 설정 > AI 엔진에 진입한다
When NVIDIA/Claude/Codex backend와 모델을 선택한다
Then 역할별 모델 정책이 저장되고 연결 테스트 결과가 표시된다
```

---

## 12. 성공 기준

제품 수준 성공 기준:

- 사용자가 회사 홈에서 바로 업무를 맡길 수 있다.
- 사용자가 Run/Agent/model을 몰라도 기본 작업을 완료할 수 있다.
- AI가 실행 전 계획과 투입 직원을 제안한다.
- 간단한 업무는 최소 직원만 투입된다.
- 복잡한 업무는 고정팀과 전문가가 동적으로 구성된다.
- Pixel Office는 필수 절차가 아니라 진행 상황 live view로 작동한다.
- 중요한 결정은 Decision Inbox에 모인다.
- 검증된 결과 보고와 다음 작업 추천이 제공된다.
- 모델/backend 설정은 관리자 설정으로 분리된다.
- 고정 핵심팀 5명으로 회사다운 느낌과 캐릭터 애착이 생긴다.

---

## 13. 구현 메모

주의 사항:

- API key, token, secret 원문은 UI/SQLite에 저장하지 않는다.
- 직원 캐릭터와 모델/backend를 고정 결합하지 않는다.
- 직원이 사무실에 존재한다고 항상 모델 호출하지 않는다.
- 일반 사용자에게 내부 pipeline 용어를 노출하지 않는다.
- `planner/worker/reviewer`는 내부 실행 계층으로 유지한다.
- `CEO/PM/Designer/Developer/QA/Specialist`는 사용자-facing 회사 계층으로 사용한다.
- 복잡한 route 변경보다 label/order/CTA 변경부터 시작한다.
- 기존 기능을 삭제하지 말고, 사용자 기본 흐름에서 뒤로 숨긴다.

단기 시작점:

1. nav label/order 변경
2. 회사 홈 업무 입력창 추가
3. AI 계획 제안 mock/projection 추가
4. 직원·AI팀 label과 고정 핵심팀 표시 정리
5. Decision Inbox label 변경
6. Pixel Office를 `live view` 문구와 CTA 중심으로 조정

---

## 14. 한 줄 방향성

> Pixel Office는 사용자가 에이전트를 조작하는 콘솔이 아니라, AI 회사에 업무를 맡기고 필요한 결정만 하며 결과를 받는 운영 경험이어야 한다.
