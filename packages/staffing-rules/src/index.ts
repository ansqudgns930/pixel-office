export type StaffingRisk = "low" | "medium" | "high" | "critical";

export interface StaffingEmployeeCandidate {
  employeeId: string;
  name: string;
  roleTitle: string;
  reason: string;
  riskNotes: string[];
}

export interface StaffingPresetCandidate {
  presetKey: string;
  name: string;
  roleTitle: string;
  reason: string;
  signals: string[];
  activation: "add-to-company" | "already-available";
}

export interface StaffingProfileInput {
  principalId: string;
  name: string;
  roleTitle: string;
  summary: string;
  specialties: string[];
  responsibilities: string[];
  approvalRequiredActions: string[];
}

export interface WorkStaffingPlan {
  staff: string[];
  recommendedEmployees: StaffingEmployeeCandidate[];
  recommendedPresets: StaffingPresetCandidate[];
  steps: string[];
  risk: StaffingRisk;
  decisionExpectation: string;
  signals: {
    ui: boolean;
    security: boolean;
    copy: boolean;
    large: boolean;
    ops: boolean;
    release: boolean;
    docs: boolean;
    cost: boolean;
    legal: boolean;
    data: boolean;
    research: boolean;
    support: boolean;
  };
}

const PRESET_RECOMMENDATION_RULES: Array<{
  presetKey: string;
  name: string;
  roleTitle: string;
  reason: string;
  signal: keyof WorkStaffingPlan["signals"];
}> = [
  { presetKey: "sre", name: "SRE", roleTitle: "운영 안정성과 장애 대응 담당자", signal: "ops", reason: "운영, 로그, 장애, 복구 흐름이 포함되어 SRE가 영향 범위와 안전한 복구 순서를 점검하는 편이 좋습니다." },
  { presetKey: "release-manager", name: "Release Manager", roleTitle: "릴리즈 준비와 배포 판단 담당자", signal: "release", reason: "배포/릴리즈 판단이 포함되어 검증 증거, 보류 조건, rollback 기준을 분리할 필요가 있습니다." },
  { presetKey: "technical-writer", name: "Technical Writer", roleTitle: "문서화와 사용자 설명 담당자", signal: "docs", reason: "문서, 릴리즈 노트, 사용자 안내가 포함되어 기술 내용을 사용자 행동 순서로 정리할 담당자가 필요합니다." },
  { presetKey: "finops-manager", name: "FinOps Manager", roleTitle: "비용과 사용량 관리 담당자", signal: "cost", reason: "비용, 모델 사용량, 예산 영향이 포함되어 품질과 비용 trade-off를 함께 검토해야 합니다." },
  { presetKey: "legal-policy-manager", name: "Legal/Policy Manager", roleTitle: "법무·정책 리스크 검토 담당자", signal: "legal", reason: "약관, 개인정보, 정책 리스크가 포함되어 외부 공개나 데이터 처리 전 확인이 필요합니다." },
  { presetKey: "data-analyst", name: "Data Analyst", roleTitle: "데이터와 지표 분석 담당자", signal: "data", reason: "KPI, 로그, 실험, 지표 판단이 포함되어 데이터 출처와 결론의 한계를 분리할 필요가 있습니다." },
  { presetKey: "research-analyst", name: "Research Analyst", roleTitle: "시장·사용자·경쟁 조사 담당자", signal: "research", reason: "시장, 경쟁, 사용자 요구 조사가 포함되어 출처와 해석을 분리한 리서치가 필요합니다." },
  { presetKey: "cs-manager", name: "CS Manager", roleTitle: "고객 문의 분류와 응대 초안 담당자", signal: "support", reason: "고객 문의나 응대가 포함되어 답변 초안과 승인 필요 행동을 분리할 담당자가 필요합니다." },
  { presetKey: "marketing-manager", name: "Marketing Manager", roleTitle: "마케팅 전략과 캠페인 담당자", signal: "copy", reason: "마케팅/캠페인/전환 문구가 포함되어 타겟, 메시지, 승인 필요 외부 행동을 분리할 담당자가 필요합니다." },
  { presetKey: "program-manager", name: "Program Manager", roleTitle: "여러 업무 흐름과 의존성 조율 담당자", signal: "large", reason: "범위가 큰 업무라 여러 목표와 의존성을 조율할 프로그램 관리 관점이 필요합니다." },
];

function recommendPresetCandidates(signals: WorkStaffingPlan["signals"], customEmployees: StaffingProfileInput[]): StaffingPresetCandidate[] {
  const available = new Set(customEmployees.map(profile => profile.principalId));
  return PRESET_RECOMMENDATION_RULES
    .filter(rule => signals[rule.signal])
    .map(rule => ({
      presetKey: rule.presetKey,
      name: rule.name,
      roleTitle: rule.roleTitle,
      reason: rule.reason,
      signals: [rule.signal],
      activation: available.has(rule.presetKey) ? "already-available" as const : "add-to-company" as const,
    }))
    .slice(0, 3);
}

function scoreEmployee(request:string,profile:StaffingProfileInput): number {
  const source = `${profile.name} ${profile.roleTitle} ${profile.summary} ${profile.specialties.join(" ")} ${profile.responsibilities.join(" ")}`.toLowerCase();
  const words = Array.from(new Set(request.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(word=>word.length>=2)));
  let score = 0;
  for (const word of words) if (source.includes(word)) score += word.length > 3 ? 2 : 1;
  if (/인스타|instagram|sns|홍보|마케팅|캠페인|릴스|캡션/.test(request.toLowerCase()) && /instagram|sns|홍보|마케팅|캠페인/.test(source)) score += 8;
  if (/보안|security|인증|권한|토큰/.test(request.toLowerCase()) && /보안|security|인증|권한|토큰/.test(source)) score += 8;
  if (/cs|고객|문의|응대|support/.test(request.toLowerCase()) && /cs|고객|문의|응대|support/.test(source)) score += 8;
  if (/ui|ux|화면|디자인|온보딩/.test(request.toLowerCase()) && /ui|ux|화면|디자인|온보딩/.test(source)) score += 5;
  return score;
}

export function deriveWorkStaffingPlan(request: string, customEmployees: StaffingProfileInput[] = []): WorkStaffingPlan {
  const lower = request.toLowerCase();
  const ui = /ui|ux|화면|디자인|레이아웃|버튼|랜딩|온보딩/.test(lower);
  const security = /auth|인증|권한|보안|security|token|secret|비밀|개인정보|privacy|pii|prompt injection|프롬프트 인젝션/.test(lower);
  const copy = /문구|카피|copy|랜딩|버튼|홍보|마케팅|캠페인|campaign|marketing/.test(lower);
  const large = /전체|서비스|기획|전략|대규모|리팩터|architecture|구조|여러|프로그램|roadmap|로드맵/.test(lower);
  const ops = /운영|장애|로그|모니터링|복구|sre|incident|rollback|롤백/.test(lower);
  const release = /릴리즈|release|배포|deploy|출시|go-no-go|공개/.test(lower);
  const docs = /문서|docs|documentation|릴리즈 노트|release note|가이드|매뉴얼/.test(lower);
  const cost = /비용|예산|사용량|finops|토큰|token usage|모델 사용량|cost/.test(lower);
  const legal = /법무|정책|약관|개인정보|privacy|policy|compliance|규정/.test(lower);
  const data = /데이터|지표|kpi|로그 분석|analytics|dashboard|대시보드|실험/.test(lower);
  const research = /리서치|조사|시장|경쟁|사용자 요구|research|competitor/.test(lower);
  const support = /cs|고객|문의|응대|support|faq/.test(lower);
  const staff = new Set<string>();

  if (large) { staff.add("CEO"); staff.add("PM"); }
  if (ui) { staff.add("PM"); staff.add("Designer"); }
  if (copy) staff.add("Copywriter");
  if (security) { staff.add("PM"); staff.add("Security"); }
  if (!staff.size) staff.add("Developer");
  const signals = { ui, security, copy, large, ops, release, docs, cost, legal, data, research, support };
  const recommendedPresets = recommendPresetCandidates(signals, customEmployees);
  const recommendedEmployees = customEmployees
    .map(profile => ({ profile, score: scoreEmployee(request, profile) }))
    .filter(item => item.score >= 4)
    .sort((a,b)=>b.score-a.score || a.profile.name.localeCompare(b.profile.name))
    .slice(0,3)
    .map(item => ({
      employeeId: item.profile.principalId,
      name: item.profile.name,
      roleTitle: item.profile.roleTitle,
      reason: `${item.profile.roleTitle}로서 ${item.profile.specialties.slice(0,3).join(" · ")} 업무에 적합합니다.`,
      riskNotes: item.profile.approvalRequiredActions.slice(0,4),
    }));
  for (const employee of recommendedEmployees) staff.add(employee.name);

  staff.add("Developer");
  staff.add("QA");

  const steps = [
    "업무 목표와 완료 조건 정리",
    ui ? "현재 화면/사용자 흐름 점검" : "관련 코드와 현재 상태 확인",
    security ? "보안 엔지니어가 인증·권한·토큰·prompt injection 위험 확인" : "실행 범위와 변경 계획 작성",
    "필요한 변경 수행",
    "빌드·테스트·검증",
    "검증된 결과 보고와 다음 작업 추천",
  ];

  const risk: StaffingRisk = security || large || legal || release ? "high" : ui || copy || ops || cost || data ? "medium" : "low";
  const decisionExpectation = security || large || legal || release
    ? "있음 — 위험/범위 변경 시 확인 요청"
    : "낮음 — 검증 실패 또는 범위 변경 시에만 요청";

  return { staff: Array.from(staff), recommendedEmployees, recommendedPresets, steps, risk, decisionExpectation, signals };
}
