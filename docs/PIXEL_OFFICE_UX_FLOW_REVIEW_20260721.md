# Pixel Office UX Flow Review — 2026-07-21

## 결론

현재 Pixel Office redesign은 기능명 정리와 delegated-work 중심 흐름 전환은 많이 좋아졌다.  
하지만 최신 소비자 앱의 onboarding/paywall 흐름과 Growth.Design식 심리 관점으로 보면, 아직 **첫 3분의 감정 설계**가 약하다.

현재 제품은 사용자가 일을 맡길 수 있게 되었지만, 사용자가 처음 들어왔을 때 다음 세 가지를 즉시 느끼게 해야 한다.

1. **내가 뭘 맡기면 되는지 알겠다.**
2. **AI 회사가 알아서 계획하고 일하는 것처럼 보인다.**
3. **내가 개입해야 하는 순간만 명확히 알려준다.**

따라서 다음 UX 우선순위는 새 기능 추가보다 **온보딩/첫 업무 위임/전환 게이트/결과 기대감**을 강화하는 것이다.

---

## 1. Lazyweb/PageFlows식 단계 비교 관점

여러 앱의 사용자 흐름을 단계별로 비교할 때 핵심은 화면 이름이 아니라 사용자가 지나가는 심리적 단계다.

일반적인 고전환 앱 흐름은 다음과 같다.

```text
1. Promise
2. Personalization
3. First input
4. Preview / plan
5. Commitment gate
6. Progress feedback
7. Result / reward
8. Habit loop
```

현재 Pixel Office 흐름을 여기에 대응하면 다음과 같다.

| 단계 | 좋은 앱의 역할 | 현재 Pixel Office | 평가 |
|---|---|---|---|
| Promise | “이 앱이 내 문제를 해결한다” | 회사 홈에서 업무 입력 가능 | 방향은 맞음, 첫 화면 value promise는 더 강해야 함 |
| Personalization | 사용자 상황을 묻고 맞춤화 | 업무 요청 텍스트 기반 staffing/risk 추론 | 좋음. 다만 사용자는 왜 이 팀이 배정됐는지 더 빨리 봐야 함 |
| First input | 가장 쉬운 첫 행동 | `무슨 일을 AI 회사에 맡길까요?` | 좋음. 예시 prompt/템플릿 보강 필요 |
| Preview / plan | 결과를 예고해 신뢰 형성 | 계획 preview, staff, risk, completion criteria | 좋음. “예상 결과물”과 “내가 결정할 순간”이 더 보여야 함 |
| Commitment gate | 비용/시간/권한을 확인하고 실행 | `이 계획으로 실행` | 기능상 있음. UX상 paywall/checkout처럼 설득 구조는 약함 |
| Progress feedback | 내가 기다릴 이유 제공 | Pixel Office Live View, Goals, Activity | 구현됨. 첫 실행 후 어디를 봐야 하는지 자동 안내가 더 필요 |
| Result / reward | 성공 감각 제공 | 결과·활동, 검증 근거 | 있음. reward/achievement/완료 브리핑이 약함 |
| Habit loop | 다음 작업 추천 | 일부 다음 액션 존재 | 다음 위임 추천/반복 루프 강화 필요 |

### 핵심 진단

현재는 1→5단계까지 기능적으로 연결됐지만, **각 단계 사이의 감정 전환 문구**가 부족하다.

특히 사용자는 plan preview에서 다음 질문을 한다.

- 이 팀이 왜 필요한가?
- 얼마나 걸릴 것 같은가?
- 내가 중간에 뭘 해야 하나?
- 실패하면 어떻게 복구되나?
- 실행하면 어떤 결과물을 받나?

현재 일부 답은 존재하지만 한 화면에서 충분히 압축되어 보이지 않는다.

---

## 2. Gummble/Bumble류 최신 앱 onboarding + paywall 관점

최신 소비자 앱의 onboarding/paywall은 “돈 내세요”가 아니라 **이미 내 문제를 이해했고, 지금 계속하면 결과가 나온다**는 흐름을 만든다.

Pixel Office에서 paywall에 해당하는 것은 실제 결제가 아니라 다음 commit gate다.

```text
이 계획으로 실행
```

이 버튼은 사실상 사용자의 시간/비용/권한을 쓰는 지점이다. 따라서 paywall처럼 설계해야 한다.

### 현재 commit gate 문제

현재 `이 계획으로 실행`은 기능적으로는 맞지만, 심리적으로는 아직 단순 실행 버튼이다.

좋은 commit gate가 되려면 버튼 주변에 다음 정보가 있어야 한다.

```text
이 버튼을 누르면
- 어떤 팀이 움직이고
- 어떤 순서로 일하고
- 어디서 멈춰서 내 결정을 기다리고
- 어떤 결과물을 줄지
```

### 권장 commit gate 구조

Company Home plan preview 하단을 다음 구조로 바꾸는 것이 좋다.

```text
실행하면 이렇게 진행됩니다
1. PM이 작업 범위를 정리합니다
2. Developer가 실행 Task를 만듭니다
3. QA가 검증합니다
4. 위험/권한/불확실성이 있으면 결정 필요에 멈춥니다
5. 완료되면 결과·활동에서 브리핑을 받습니다

예상 개입
- 예산 초과 시 승인 필요
- 검증 실패 시 재작업 승인 필요
- 고위험 변경 시 결과 승인 필요

CTA
[이 계획으로 AI 회사에 맡기기]
보조: [계획 수정] [고급 설정]
```

### Paywall식 UX에서 배울 점

- 실행 전에는 기능 설명보다 **결과 기대감**이 먼저 와야 한다.
- CTA 직전에는 “내가 얻는 것”과 “내가 잃을 수 있는 것”을 동시에 명확히 해야 한다.
- 실행 후에는 결제 완료 화면처럼 “이제 어디를 보면 되는지”를 즉시 안내해야 한다.

Pixel Office의 실행 후 redirect는 현재 `/goals`로 가지만, 그 화면 상단에 다음 메시지가 있으면 더 좋다.

```text
업무를 맡겼습니다. AI 팀이 계획을 실행 중입니다.
지금은 진행 단계와 다음 액션만 확인하면 됩니다.
```

---

## 3. Growth.Design 사용자 심리 관점

Growth.Design식으로 보면 현재 핵심 심리 문제는 다음 네 가지다.

## 3.1 Cognitive load — 선택지가 많다

현재 nav는 정리됐지만 여전히 항목이 많다.

```text
내 회사 / 회사 홈 / 맡긴 일 / 픽셀 오피스 / 결정 필요 / 회의 / 결과·활동 / 직원·AI팀 / 실행 작업실 / 설정 / 고급 실행 / 운영 건강도 / 플랫폼 관리
```

전문가에게는 좋지만 첫 사용자에게는 “뭘 눌러야 하지?”가 생긴다.

### 개선

nav를 사용자 모드와 관리자 모드로 시각적으로 분리해야 한다.

```text
일반 사용 흐름
- 회사 홈
- 맡긴 일
- 결정 필요
- 결과·활동
- 픽셀 오피스

운영/관리
- 직원·AI팀
- 실행 작업실
- 업무 검토 회의
- 설정
- 고급 실행
- 운영 건강도
- 플랫폼 관리
```

또는 기본 접기:

```text
일반 사용 흐름은 항상 펼침
운영/관리 항목은 “고급” 아래 접기
```

---

## 3.2 Trust formation — AI가 뭘 하는지 보이지만, 왜 하는지는 부족하다

지금은 staff/risk/process가 표시된다.  
하지만 사용자 신뢰는 “상태 표시”보다 “이유 설명”에서 생긴다.

이미 Pixel Office에는 assignment rationale이 들어갔지만, Company Home plan preview에서 더 일찍 보여야 한다.

### 개선

계획 preview에 다음 카드 추가.

```text
왜 이 팀인가요?
- PM: 범위와 완료 기준 정리 필요
- Developer: 실제 실행 Task 필요
- QA: 완료 전 검증 필요
- Security: 요청에 보안/권한 위험 포함
```

---

## 3.3 Loss aversion — 사용자는 “내가 통제권을 잃나?”를 걱정한다

AI 회사가 자동 실행한다는 컨셉은 좋지만, 동시에 무섭다.

사용자는 다음을 알고 싶다.

- 자동으로 뭘 바꾸나?
- 비용을 얼마나 쓰나?
- 내 승인 없이 위험한 일을 하나?
- 멈출 수 있나?

### 개선

실행 전 commit gate에 “안전장치”를 명시한다.

```text
안전장치
- 고위험 변경은 결정 필요에 멈춥니다
- 검증 실패 시 자동 완료하지 않습니다
- 예산 초과 시 실행하지 않습니다
- 결과 승인 전까지 최종 반영하지 않습니다
```

이건 conversion을 떨어뜨리는 정보가 아니라, 오히려 신뢰를 올리는 정보다.

---

## 3.4 Reward loop — 완료 후 성취감이 약하다

현재 결과·활동과 검증 근거는 좋다.  
하지만 사용자 입장에서는 “일이 끝났다”는 감각이 더 명확해야 한다.

### 개선

완료 시 `/activity` 또는 `/goals`에 다음 요약 카드를 표시한다.

```text
업무 완료
- 완료한 일: ...
- 만든 결과물: ...
- 검증: 통과 / 실패 후 수정 / 보류
- 다음 추천: ...
```

그리고 다음 CTA는 하나여야 한다.

```text
[다음 업무 맡기기]
```

보조 CTA:

```text
[근거 자세히 보기] [픽셀 오피스에서 보기]
```

---

# 현재 흐름에 대한 최종 판단

## 잘 된 점

- 제품 방향은 맞다. “agent/admin console”에서 “AI 회사에 업무 맡기기”로 성공적으로 이동했다.
- route 이름과 화면 설명은 대부분 새 컨셉에 맞게 정리됐다.
- Company Home → Goals → Pixel Office → Decision Inbox → Activity 흐름은 검증됐다.
- 고급 화면들도 일반 흐름과 분리되기 시작했다.
- visual QA와 browser E2E가 제품 언어를 검증하고 있다.

## 아직 약한 점

- 첫 사용자 onboarding이 없다.
- plan preview가 paywall/commit gate처럼 충분히 설득하지 못한다.
- 실행 후 “이제 어디를 보면 되는지”가 더 강해야 한다.
- nav가 아직 전문가용 운영 콘솔처럼 많다.
- 완료 후 reward loop와 다음 업무 추천이 약하다.

---

# 다음 구현 우선순위

## UX-H — First-run onboarding and sample delegation

목표: 첫 방문자가 30초 안에 “업무를 맡기는 앱”임을 이해하게 한다.

구현:
- Company Home 상단에 onboarding strip 추가
- 예시 업무 prompt 3~5개 제공
- “처음이라면 이렇게 맡겨보세요” CTA
- core team이 어떻게 움직이는지 3단계 설명

## UX-I — Plan preview commit gate 강화

목표: `이 계획으로 실행` 버튼을 단순 버튼이 아니라 신뢰 기반 commit gate로 만든다.

구현:
- 실행 전 `진행 순서`, `예상 개입`, `안전장치`, `예상 결과물` 카드 추가
- CTA copy 변경: `이 계획으로 AI 회사에 맡기기`
- secondary actions: `계획 수정`, `고급 설정`

## UX-J — Post-launch guidance

목표: 실행 직후 사용자가 다음에 어디를 보면 되는지 명확히 한다.

구현:
- launch 후 GoalsPage 상단에 “업무를 맡겼습니다” 상태 카드
- `진행 보기`, `결정 필요`, `픽셀 오피스 Live View`, `결과·활동` 링크를 한 줄로 제공

## UX-K — Completion reward loop

목표: 완료 후 성취감과 반복 사용 동기를 만든다.

구현:
- 완료 업무 summary card
- 결과물/검증/결정/다음 추천 요약
- primary CTA: `다음 업무 맡기기`

## UX-L — Navigation simplification

목표: 첫 사용자에게 일반 흐름만 먼저 보이고 고급 기능은 접는다.

구현:
- nav group: `업무 흐름`, `운영/관리`, `고급`
- 또는 advanced/admin 항목 접기
- 일반 사용자가 처음 볼 항목은 5개 이하로 제한

---

# 권장 순서

가장 먼저 할 것은 UX-H + UX-I다.

이유:
- 현재는 기능 흐름은 갖췄지만 첫 실행 conversion이 약하다.
- onboarding과 commit gate가 좋아지면 이후 화면들의 의미가 자연스럽게 이어진다.
- Lazyweb/PageFlows식 비교, Gummble/Bumble식 onboarding-paywall, Growth.Design식 심리 분석 모두 같은 결론을 가리킨다.

```text
다음 목표:
Company Home에 first-run onboarding + plan preview commit gate 강화
```
