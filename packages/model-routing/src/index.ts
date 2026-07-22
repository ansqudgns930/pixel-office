export type ModelRoutingRole = "planner" | "worker" | "reviewer";
export type ModelRoutingTier = "high-reasoning" | "high-verification" | "coding" | "fast-general" | "cheap-draft" | "fallback";
export type ModelRoutingPriority = "critical" | "high" | "normal" | "low";
export type ModelRoutingSignal = "strategy" | "planning" | "coding" | "security" | "external-action" | "data-privacy" | "copy" | "ui-ux" | "low-complexity";
export type ModelRoutingRisk = "low" | "medium" | "high" | "critical";

export interface ModelRoutingRecommendation {
  role: ModelRoutingRole;
  priority: ModelRoutingPriority;
  recommendedTier: ModelRoutingTier;
  reason: string;
}

export interface ModelRoutingPlan {
  overallRisk: ModelRoutingRisk;
  signals: ModelRoutingSignal[];
  recommendations: ModelRoutingRecommendation[];
  summary: string;
}

export interface RecommendModelRoutingInput {
  rough: string;
  risk?: ModelRoutingRisk;
  staff?: string[];
}

function has(text: string, pattern: RegExp): boolean { return pattern.test(text); }
function unique<T>(items: T[]): T[] { return Array.from(new Set(items)); }
function priorityForCritical(flag: boolean, high: boolean): ModelRoutingPriority { return flag ? "critical" : high ? "high" : "normal"; }

export function recommendModelRouting(input: RecommendModelRoutingInput): ModelRoutingPlan {
  const text = input.rough.toLowerCase();
  const staff = (input.staff ?? []).join(" ").toLowerCase();
  const strategy = has(text, /전략|기획|방향|우선순위|로드맵|go\/?no-go|판단|구상|시장|positioning|strategy|planning/);
  const planning = strategy || has(text, /계획|분해|범위|완료 조건|요구사항|plan|scope|criteria/);
  const coding = has(text, /코드|구현|개발|버그|api|리팩터|테스트|build|test|frontend|backend|database|db/) || /developer|worker/.test(staff);
  const security = has(text, /보안|인증|권한|토큰|secret|취약|security|auth|permission|credential/);
  const external = has(text, /외부 게시|게시|댓글|dm|광고비|결제|구매|배포|deploy|posting|comment|message|ad spend|payment|purchase/);
  const dataPrivacy = has(text, /개인정보|고객 정보|privacy|personal data|pii|account|계정/);
  const copy = has(text, /문구|카피|캡션|릴스|홍보|마케팅|copy|caption|campaign|landing/) || /copywriter|marketing/.test(staff);
  const uiUx = has(text, /ui|ux|화면|디자인|레이아웃|온보딩|버튼|랜딩/) || /designer/.test(staff);
  const highRisk = input.risk === "high" || input.risk === "critical" || security || external || dataPrivacy || strategy;
  const mediumRisk = highRisk || input.risk === "medium" || planning || coding || uiUx;
  const signals = unique<ModelRoutingSignal>([
    ...(strategy ? ["strategy" as const] : []),
    ...(planning ? ["planning" as const] : []),
    ...(coding ? ["coding" as const] : []),
    ...(security ? ["security" as const] : []),
    ...(external ? ["external-action" as const] : []),
    ...(dataPrivacy ? ["data-privacy" as const] : []),
    ...(copy ? ["copy" as const] : []),
    ...(uiUx ? ["ui-ux" as const] : []),
  ]);
  if (!signals.length) signals.push("low-complexity");

  const plannerCritical = strategy || security || external || dataPrivacy || input.risk === "critical";
  const reviewerCritical = security || external || dataPrivacy || input.risk === "critical";
  const needsStrongPlanner = plannerCritical || planning || input.risk === "high";
  const needsStrongReviewer = reviewerCritical || highRisk;
  const workerTier: ModelRoutingTier = coding ? "coding" : copy && !highRisk ? "cheap-draft" : "fast-general";

  const recommendations: ModelRoutingRecommendation[] = [
    {
      role: "planner",
      priority: priorityForCritical(plannerCritical, needsStrongPlanner),
      recommendedTier: needsStrongPlanner ? "high-reasoning" : "fast-general",
      reason: needsStrongPlanner
        ? "목표 해석, 범위 결정, 실행 순서와 위험 판단이 결과 품질에 직접 영향을 줍니다."
        : "업무가 비교적 단순해 빠른 일반 모델로 계획 초안을 만들 수 있습니다.",
    },
    {
      role: "worker",
      priority: coding ? "high" : copy && !highRisk ? "low" : "normal",
      recommendedTier: workerTier,
      reason: coding
        ? "실제 구현·수정·테스트 작업이 포함되어 코드 특화 모델이 적합합니다."
        : copy && !highRisk
          ? "반복 초안 생성 중심이라 비용 효율 모델로도 충분합니다."
          : "승인된 계획을 실행하는 일반 작업자 역할입니다.",
    },
    {
      role: "reviewer",
      priority: priorityForCritical(reviewerCritical, needsStrongReviewer),
      recommendedTier: needsStrongReviewer ? "high-verification" : "fast-general",
      reason: needsStrongReviewer
        ? "완료 판단, 보안·권한·외부 행동 위험을 독립적으로 검증해야 합니다."
        : "검증 실패나 범위 변경 여부를 확인하는 기본 검토 역할입니다.",
    },
  ];

  const overallRisk: ModelRoutingRisk = input.risk ?? (security || external || dataPrivacy ? "high" : strategy || coding || uiUx ? "medium" : "low");
  const criticalRoles = recommendations.filter(item => item.priority === "critical").map(item => item.role);
  const summary = criticalRoles.length
    ? `${criticalRoles.join("/")} 역할에는 고사양 모델을 권장합니다.`
    : mediumRisk
      ? "업무 성격에 맞춰 계획/실행/검토 모델을 분리하는 것이 좋습니다."
      : "비용 효율 모델 중심으로 처리해도 되는 낮은 복잡도 업무입니다.";

  return { overallRisk, signals, recommendations, summary };
}

export function modelTierLabel(tier: ModelRoutingTier): string {
  if (tier === "high-reasoning") return "고사양 reasoning";
  if (tier === "high-verification") return "고사양 verification";
  if (tier === "coding") return "코딩 특화";
  if (tier === "fast-general") return "빠른 일반";
  if (tier === "cheap-draft") return "비용 절약 초안";
  return "runtime fallback";
}
