import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import CompanyModeBadge from "../components/CompanyModeBadge.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import { hiddenCompanyCount, userFacingCompanyOptions } from "../companyOptions.ts";
import { useToast } from "../components/ToastContext.tsx";
import type { AgentBackendType,AgentBinding,CompanyCommandCenterSnapshot,CompanyRecord } from "../types.ts";
import { uuid } from "../format.ts";
import { employeeProfileFromPreset, professionalEmployeePresets } from "../employeeProfiles.ts";

interface GoalDraftResponse {
  title: string;
  description: string;
  completionCriteria: string[];
  status: "model" | "fallback";
  warnings: string[];
}

interface ModelRoutingRecommendation {
  role: "planner" | "worker" | "reviewer";
  priority: "critical" | "high" | "normal" | "low";
  recommendedTier: "high-reasoning" | "high-verification" | "coding" | "fast-general" | "cheap-draft" | "fallback";
  reason: string;
}

interface ModelRoutingSettingsStatus {
  role: ModelRoutingRecommendation["role"];
  recommendedTier: ModelRoutingRecommendation["recommendedTier"];
  expectedBackend: AgentBackendType;
  expectedModel: string;
  savedBackend: AgentBackendType | null;
  savedModel: string | null;
  status: "match" | "missing" | "model-mismatch" | "mismatch";
  detail: string;
}

interface ModelRoutingPlan {
  overallRisk: "low" | "medium" | "high" | "critical";
  signals: string[];
  recommendations: ModelRoutingRecommendation[];
  summary: string;
  settingsStatus?: ModelRoutingSettingsStatus[];
}

interface StaffingEmployeeCandidate {
  employeeId: string;
  name: string;
  roleTitle: string;
  reason: string;
  riskNotes: string[];
}

interface StaffingPresetCandidate {
  presetKey: string;
  name: string;
  roleTitle: string;
  reason: string;
  signals: string[];
  activation: "add-to-company" | "already-available";
}

interface StaffingPlanResponse {
  staff: string[];
  recommendedEmployees?: StaffingEmployeeCandidate[];
  recommendedPresets?: StaffingPresetCandidate[];
  steps: string[];
  risk: "low" | "medium" | "high" | "critical";
  decisionExpectation: string;
  modelRouting?: ModelRoutingPlan;
}

interface WorkPlanPreview extends StaffingPlanResponse {
  draft: GoalDraftResponse;
}


const SAMPLE_WORK_REQUESTS = [
  "랜딩페이지 첫 화면을 더 설득력 있게 개선해줘.",
  "회원가입 후 첫 사용자가 헷갈리는 지점을 찾아서 온보딩을 고쳐줘.",
  "결제 전환 버튼 주변 문구와 안전장치를 개선해줘.",
  "모바일 화면에서 잘리는 UI와 접근성 문제를 점검해줘."
];
const TEAM_REASON: Record<string,string> = {
  CEO: "목표와 우선순위가 회사 방향에 맞는지 확인합니다.",
  PM: "범위, 완료 기준, 일정, 사용자 결정을 정리합니다.",
  Designer: "사용자 흐름, 화면 위계, 문구, 심리적 마찰을 점검합니다.",
  Developer: "실제 실행 Task를 만들고 구현 변경을 담당합니다.",
  QA: "완료 전에 검증 결과와 실패 복구 근거를 남깁니다.",
  Researcher: "외부 사례와 사용자 맥락을 조사해 계획 근거를 보강합니다.",
  Security: "권한, 데이터, 위험 변경 여부를 확인합니다.",
  "Data Analyst": "지표와 비교 근거로 판단을 보강합니다.",
  Marketing: "전환 문구와 가치 제안을 점검합니다.",
  Copywriter: "사용자가 이해하기 쉬운 문구로 다듬습니다.",
  Legal: "정책, 약관, 권리 이슈가 있는지 확인합니다.",
  "Extra Developer": "구현 범위가 큰 경우 병렬 실행을 돕습니다."
};
function staffReason(name:string){return TEAM_REASON[name] ?? "요청한 업무의 일부를 처리하기 위해 임시로 투입됩니다.";}
function riskLabel(level: StaffingPlanResponse["risk"]){return level==="critical"?"매우 높음":level==="high"?"높음":level==="medium"?"보통":"낮음";}
function draftModeLabel(status: GoalDraftResponse["status"]){return status==="fallback"?"기본 계획 모드":"AI 계획 모드";}
function modelTierLabel(tier: ModelRoutingRecommendation["recommendedTier"]){return tier==="high-reasoning"?"중요 판단용 고성능":tier==="high-verification"?"검증 강화형":tier==="coding"?"구현 특화":tier==="fast-general"?"빠른 일반 처리":tier==="cheap-draft"?"초안·비용 절약형":"기본 엔진 사용";}
function modelRoleLabel(role: ModelRoutingRecommendation["role"]){return role==="planner"?"Planner / PM":role==="worker"?"Worker / Developer":"Reviewer / QA";}
function modelPriorityLabel(priority: ModelRoutingRecommendation["priority"]){return priority==="critical"?"치명":priority==="high"?"높음":priority==="normal"?"보통":"낮음";}
function modelTierPreset(tier: ModelRoutingRecommendation["recommendedTier"]): { backend: AgentBackendType; model: string } {
  if (tier === "high-reasoning") return { backend: "claude-cli", model: "sonnet-5" };
  if (tier === "high-verification") return { backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b" };
  if (tier === "coding") return { backend: "codex-cli", model: "gpt-5" };
  if (tier === "cheap-draft" || tier === "fallback") return { backend: "standalone", model: "phase0-model" };
  return { backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b" };
}
function modelRoutingBindingStatus(bindings: AgentBinding[], item: ModelRoutingRecommendation): { label: string; tone: "ok" | "watch" | "risk"; detail: string } {
  const preset = modelTierPreset(item.recommendedTier), binding = bindings.find(next => next.targetKind === "role" && next.targetId === item.role);
  if (!binding) return { label: "추가 확인 필요", tone: "risk", detail: "이 담당자는 아직 전용 AI 엔진이 저장되지 않았습니다. 맡기기는 가능하지만, 실행 시 회사 기본 엔진으로 처리될 수 있습니다." };
  if (binding.backend === preset.backend && binding.modelId === preset.model) return { label: "권장 설정 준비됨", tone: "ok", detail: "현재 저장된 AI 엔진이 이 업무의 권장 배치와 맞습니다." };
  if (binding.backend === preset.backend) return { label: "비슷하지만 모델 다름", tone: "watch", detail: "같은 계열 엔진을 쓰지만 저장 모델은 " + binding.modelId + "입니다. 더 안정적으로 맡기려면 권장 preset을 검토하세요." };
  return { label: "권장과 다름", tone: "watch", detail: "현재 저장값은 " + binding.backend + " / " + binding.modelId + "입니다. 중요한 업무라면 맡기기 전에 AI 엔진 설정을 확인하세요." };
}
function modelRoutingSettingsSnapshot(bindings: AgentBinding[], routing: ModelRoutingPlan): ModelRoutingSettingsStatus[] {
  return routing.recommendations.map(item => {
    const preset = modelTierPreset(item.recommendedTier), binding = bindings.find(next => next.targetKind === "role" && next.targetId === item.role);
    if (!binding) return { role: item.role, recommendedTier: item.recommendedTier, expectedBackend: preset.backend, expectedModel: preset.model, savedBackend: null, savedModel: null, status: "missing", detail: "No saved role binding at launch preview; company default or runtime fallback may be used." };
    if (binding.backend === preset.backend && binding.modelId === preset.model) return { role: item.role, recommendedTier: item.recommendedTier, expectedBackend: preset.backend, expectedModel: preset.model, savedBackend: binding.backend, savedModel: binding.modelId, status: "match", detail: "Saved role binding matched the recommended preset at launch preview." };
    if (binding.backend === preset.backend) return { role: item.role, recommendedTier: item.recommendedTier, expectedBackend: preset.backend, expectedModel: preset.model, savedBackend: binding.backend, savedModel: binding.modelId, status: "model-mismatch", detail: "Saved backend matched the recommendation, but the saved model differed at launch preview." };
    return { role: item.role, recommendedTier: item.recommendedTier, expectedBackend: preset.backend, expectedModel: preset.model, savedBackend: binding.backend, savedModel: binding.modelId, status: "mismatch", detail: "Saved role binding differed from the recommended preset at launch preview." };
  });
}
function modelRoutingSettingsHref(companyId: string, routing: ModelRoutingPlan){
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", companyId);
  query.set("source", "company-plan-preview");
  for (const item of routing.recommendations) query.set(item.role, item.recommendedTier);
  return `/settings/backend?${query.toString()}`;
}

function modelRoutingPlanStatus(bindings: AgentBinding[], routing?: ModelRoutingPlan): { label: string; tone: "ok" | "watch" | "risk"; detail: string } {
  if (!routing?.recommendations.length) return { label: "기본 설정", tone: "watch", detail: "이 업무는 별도 AI 엔진 추천 없이 기본 설정으로 처리됩니다." };
  const statuses = routing.recommendations.map(item => modelRoutingBindingStatus(bindings, item));
  if (statuses.some(status => status.tone === "risk")) return { label: "엔진 확인 필요", tone: "risk", detail: "일부 담당자의 전용 AI 엔진이 아직 저장되지 않았습니다." };
  if (statuses.some(status => status.tone === "watch")) return { label: "권장과 일부 다름", tone: "watch", detail: "실행은 가능하지만 권장 배치와 현재 저장값이 완전히 같지는 않습니다." };
  return { label: "권장 설정 준비됨", tone: "ok", detail: "핵심 담당자의 AI 엔진 설정이 권장 배치와 맞습니다." };
}

function planExpectedOutcome(preview: WorkPlanPreview, request: string) {
  return preview.draft.completionCriteria[0] ?? preview.draft.description ?? request.trim() ?? "요청한 업무의 실행 결과와 검증 근거";
}
function draftWarningLabel(warning:string){
  if(warning==="goal-draft-model-not-configured")return "AI 엔진 설정 전이라 기본 계획으로 preview를 생성했습니다.";
  if(warning==="goal-draft-model-error")return "AI 계획 생성이 지연되어 기본 계획으로 preview를 생성했습니다.";
  return warning.replace(/[-_]/g," ");
}

function companyActionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Project budget exceeds department/i.test(message)) {
    return "실행 프로젝트 예산이 선택된 부서 예산을 초과했습니다. 회사 홈의 조직·Agent 탭에서 부서 예산을 늘리거나, 더 작은 예산으로 다시 실행하세요.";
  }
  if (/Automatic execution requires a positive goal budget/i.test(message)) {
    return "자동 실행에는 1 이상의 목표 예산이 필요합니다. 회사/목표 예산을 확인해 주세요.";
  }
  if (/Goal drafting unavailable/i.test(message)) {
    return "AI 계획 제안 기능을 사용할 수 없습니다. 잠시 후 다시 시도하거나 관리자 설정을 확인하세요.";
  }
  return message;
}

export default function CompanyPage() {
  const { actorId } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [companyId, setCompanyId] = useState(() => params.get("companyId") ?? localStorage.getItem("agent-company-os.lastCompany") ?? "");
  const [snapshot, setSnapshot] = useState<CompanyCommandCenterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workAction, setWorkAction] = useState<null | "planning" | "launching">(null);
  const [presetAction, setPresetAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "organization" | "briefing">("overview");
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string;projectCount:number}>>([]),[hiddenCompanies,setHiddenCompanies]=useState(0);
  const [health,setHealth]=useState<{metrics:{completedRuns:number;qualityPasses:number;validationFailures:number;incidents:number}}|null>(null);
  const [bindings,setBindings]=useState<AgentBinding[]>([]),[bindingKind,setBindingKind]=useState<"company"|"role"|"member">("company"),[bindingTarget,setBindingTarget]=useState(""),[bindingBackend,setBindingBackend]=useState<AgentBackendType>("standalone"),[bindingModel,setBindingModel]=useState("phase0-model");
  const [workRequest, setWorkRequest] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
  const [temporaryPresetKeys, setTemporaryPresetKeys] = useState<string[]>([]);
  const [planPreview, setPlanPreview] = useState<WorkPlanPreview | null>(null);
  const planPreviewRef = useRef<HTMLDivElement | null>(null);

  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentBudget, setDepartmentBudget] = useState("0");

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(companyActionErrorMessage(e)); } finally { setBusy(false); }
  }

  function load(id=companyId) {
    return guarded(async () => {
      const [next,nextBindings,nextHealth] = await Promise.all([apiGet<CompanyCommandCenterSnapshot>(`/api/companies/${encodeURIComponent(id)}?actor=${encodeURIComponent(actorId)}`),apiGet<AgentBinding[]>(`/api/companies/${encodeURIComponent(id)}/agent-bindings?actor=${encodeURIComponent(actorId)}`),apiGet<{metrics:{completedRuns:number;qualityPasses:number;validationFailures:number;incidents:number}}>(`/api/companies/${encodeURIComponent(id)}/game-progression?actor=${encodeURIComponent(actorId)}`).catch(()=>null)]);
      setCompanyId(id);setSnapshot(next);setBindings(nextBindings);setHealth(nextHealth); localStorage.setItem("agent-company-os.lastCompany", id); setParams({ companyId:id }, { replace: true });
    });
  }

  useEffect(() => { void apiGet<Array<CompanyRecord&{role:string;projectCount:number}>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items=>{const received=Array.isArray(items),valid=(received?items:[]).filter(item=>item.status==="active");const requested=params.get("companyId")||companyId,visible=userFacingCompanyOptions(valid,requested);setCompanies(visible);setHiddenCompanies(hiddenCompanyCount(valid,requested));const selected=visible.some(item=>item.id===requested)?requested:received?visible[0]?.id:requested;if(selected)void load(selected);else{setCompanyId("");setSnapshot(null);}}).catch(e=>{const requested=params.get("companyId")||companyId;if(requested)void load(requested);else setError(e instanceof Error?e.message:String(e));}); }, []);
  useEffect(() => { if (planPreview) planPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [planPreview]);

  function proposeWorkPlan() {
    setWorkAction("planning");
    return guarded(async () => {
      const request = workRequest.trim();
      if (!request) {
        setPlanPreview(null);
        toast("먼저 AI 회사에 맡길 업무를 입력하세요.");
        return;
      }
      const [draft, staffing] = await Promise.all([
        apiPost<GoalDraftResponse>(`/api/companies/${encodeURIComponent(companyId)}/goals/draft`, { actorId, rough: request }),
        apiPost<StaffingPlanResponse>(`/api/companies/${encodeURIComponent(companyId)}/staffing/plan`, { actorId, rough: request }),
      ]);
      const completionCriteria = draft.completionCriteria.length ? draft.completionCriteria : ["요청한 업무가 적용되어야 합니다.", "빌드 또는 관련 검증이 통과해야 합니다.", "결과 보고에 변경 내용과 검증 근거가 포함되어야 합니다."];
      setTemporaryPresetKeys([]);
      setPlanPreview({ draft: { ...draft, completionCriteria }, ...staffing });
    }).finally(() => setWorkAction(null));
  }

  function addRecommendedPreset(presetKey: string) {
    const preset = professionalEmployeePresets.find(item => item.key === presetKey);
    if (!preset || !companyId) return;
    setPresetAction(presetKey);
    return guarded(async () => {
      const already = snapshot?.pixel.agents.some(agent => agent.principal_id === presetKey);
      if (already) { toast(`${preset.name}는 이미 직원·AI팀에 있습니다.`); return; }
      const profile = employeeProfileFromPreset(companyId, presetKey, preset);
      await apiPost(`/api/companies/${encodeURIComponent(companyId)}/employees/activate`, { actorId, principalId: presetKey, role: "member", departmentId: null, kind: "agent", profile });
      toast(`${preset.name} 프리셋 직원을 회사에 추가했습니다. 계획을 다시 요청하면 투입 직원 snapshot에 포함할 수 있습니다.`);
      await load();
      setPlanPreview(current => current ? { ...current, recommendedPresets: current.recommendedPresets?.map(item => item.presetKey === presetKey ? { ...item, activation: "already-available" } : item) } : current);
    }).finally(() => setPresetAction(null));
  }

  function launchWorkPlan() {
    if (!planPreview || !portfolio) return;
    setWorkAction("launching");
    return guarded(async () => {
      const budgetLimit = Math.max(1, Math.min(10, Number(portfolio.company.budgetLimit) || 10));
      const temporarySnapshots = (planPreview.recommendedPresets ?? [])
        .filter(preset => temporaryPresetKeys.includes(preset.presetKey))
        .map(preset => {
          const source = professionalEmployeePresets.find(item => item.key === preset.presetKey);
          if (!source) return null;
          const principalId = `temporary-${preset.presetKey}`;
          const profile = employeeProfileFromPreset(companyId, principalId, source);
          return { principalId, reason: `이번 업무에만 임시 투입 · ${preset.reason}`, profile: { ...profile, id: `${companyId}:${principalId}:temporary-preset-v1`, generatedFrom: "temporary-professional-preset" } };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const result = await apiPost<{goal:{id:string};provisioning:{runId:string}}>(`/api/companies/${encodeURIComponent(companyId)}/goals/launch`, {
        actorId,
        id: uuid(),
        title: planPreview.draft.title,
        description: planPreview.draft.description || workRequest.trim(),
        ownerId: actorId,
        completionCriteria: planPreview.draft.completionCriteria,
        budgetLimit,
        requestedRisk: planPreview.risk,
        requestedPaths: ["src"],
        employeeProfileSnapshots: [...(planPreview.recommendedEmployees?.map(employee => ({ principalId: employee.employeeId, reason: employee.reason })) ?? []), ...temporarySnapshots],
        modelRoutingRecommendation: planPreview.modelRouting ? { ...planPreview.modelRouting, settingsStatus: modelRoutingSettingsSnapshot(bindings, planPreview.modelRouting) } : undefined,
      });
      toast("업무를 AI 회사에 맡겼습니다. 진행 상황은 맡긴 일에서 확인하세요.");
      navigate(`/goals?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(result.goal.id)}&launched=1`);
    }).finally(() => setWorkAction(null));
  }

  function createDepartment() {
    return guarded(async () => {
      await apiPost(`/api/companies/${encodeURIComponent(companyId)}/departments`, { actorId, id: departmentId, parentId: null, name: departmentName, budgetLimit: Number(departmentBudget) });
      toast("부서를 생성했습니다.");
      await load();
    });
  }

  function updateDepartmentBudget() {
    return guarded(async () => {
      await apiPost(`/api/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/budget`, { actorId, limit: Number(departmentBudget) });
      toast("부서 예산을 변경했습니다.");
      await load();
    });
  }

  function createBriefing() {
    return guarded(async () => { await apiPost(`/api/companies/${encodeURIComponent(companyId)}/briefings`, { actorId }); toast("CEO 브리핑을 생성했습니다."); await load(); });
  }
  function saveBinding(){return guarded(async()=>{await apiPost(`/api/companies/${encodeURIComponent(companyId)}/agent-bindings`,{actorId,targetKind:bindingKind,targetId:bindingKind==="company"?companyId:bindingTarget,backend:bindingBackend,modelId:bindingModel,config:{}});toast("Agent Backend 바인딩을 저장했습니다. 새 Run부터 적용됩니다.");await load();});}

  const portfolio = snapshot?.portfolio ?? null;
  const totals = portfolio?.totals ?? null;
  const latestBriefing = snapshot?.briefings.at(-1) ?? null;

  return (
    <div>
      <PageHeader title="회사 홈" description="업무를 입력하면 AI 회사가 계획, 실행, 검증, 결정 요청, 결과 보고까지 이어서 처리합니다." />

      <div className="company-focus-toolbar card">
        <div>
          <span className="eyebrow">CURRENT COMPANY</span>
          <label className="inline">현재 회사
            <select value={companyId} onChange={e=>{setCompanyId(e.target.value);setSnapshot(null);}}><option value="">회사를 선택하세요</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name} · {company.role} · 프로젝트 {company.projectCount}</option>)}{hiddenCompanies>0&&<option value="" disabled>테스트 회사 {hiddenCompanies}개 숨김</option>}</select>
          </label>
        </div>
        <div className="company-focus-actions">
          <button className="secondary" disabled={busy || !companyId} onClick={() => void load()}>현황 새로고침</button>
          <Link className="button-link secondary" to="/companies">회사 바꾸기</Link>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <section className="card" aria-label="처음 업무 맡기기 안내" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIRST RUN</span>
            <h2>처음이라면 작은 업무 하나를 AI 회사에 맡겨보세요</h2>
            <p>복잡한 설정부터 하지 않아도 됩니다. 업무를 한 줄로 적으면 AI 팀이 계획을 만들고, 위험하거나 권한이 필요한 순간에만 멈춰서 결정을 요청합니다.</p>
          </div>
          <span className="badge">30초 시작</span>
        </div>
        <div className="badge-row">
          <span className="badge">1. 업무 입력</span>
          <span className="badge">2. AI 계획 preview</span>
          <span className="badge">3. 안전장치 확인</span>
          <span className="badge">4. 맡기기</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {SAMPLE_WORK_REQUESTS.map(sample => <button key={sample} type="button" className={`secondary sample-work-button ${selectedSample===sample?"selected":""}`} aria-pressed={selectedSample===sample} onClick={() => { setSelectedSample(sample); setWorkRequest(sample); setPlanPreview(null); }}>{sample}</button>)}
        </div>
        {selectedSample&&<p className="sample-choice-note" role="status">샘플 업무가 입력되었습니다. 필요하면 문장을 고친 뒤 계획을 요청하세요.</p>}
      </section>

      <section className="card company-work-intake" aria-label="AI 회사에 업무 맡기기" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <h2>무슨 일을 AI 회사에 맡길까요?</h2>
            <p>업무를 입력하면 AI 회사가 실행 순서, 투입 직원, 예상 결과물, 결정 필요 지점, 안전장치를 먼저 제안합니다.</p>
          </div>
          {planPreview&&<span className="badge">계획 검토 중</span>}
        </div>
        <textarea
          value={workRequest}
          onChange={e => { setWorkRequest(e.target.value); setSelectedSample(""); setPlanPreview(null); setTemporaryPresetKeys([]); }}
          rows={4}
          placeholder="예: 랜딩페이지 첫 화면을 더 설득력 있게 개선해줘."
          aria-label="AI 회사에 맡길 업무"
        />
        <div className="primary-work-actions" style={{ marginTop: 8 }}>
          <button disabled={busy || !companyId || !workRequest.trim()} onClick={proposeWorkPlan}>{workAction==="planning"?"AI 팀이 계획을 만드는 중…":"AI 팀에게 계획 요청"}</button>
          <span>계획을 먼저 확인한 뒤 실행합니다.</span>
        </div>
        {workAction&&<div className="work-action-progress" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/><div><strong>{workAction==="planning"?"AI 팀이 계획을 만드는 중입니다":"AI 회사에 업무를 맡기는 중입니다"}</strong><p>{workAction==="planning"?"요청을 분석하고, 투입 직원과 실행 순서, 결정 필요 지점을 정리하고 있습니다.":"목표를 만들고, 실행 프로젝트와 담당 Agent, 첫 Run을 연결하고 있습니다."}</p></div></div>}
        {planPreview && (
          <div ref={planPreviewRef} className="recommendation plan-preview-card" style={{ marginTop: 12, borderLeftColor: "#3fb950" }}>
            <strong>AI 계획 제안</strong>
            <div style={{ marginTop: 8 }}><strong>{planPreview.draft.title}</strong></div>
            <p>{planPreview.draft.description || workRequest.trim()}</p>
            {(() => {
              const routingStatus = modelRoutingPlanStatus(bindings, planPreview.modelRouting);
              return <div className="plan-summary-rail" aria-label="맡기기 전 핵심 판단 요약">
                <article><span>투입 팀</span><strong>{planPreview.staff.length}명</strong><small>{planPreview.staff.slice(0, 4).join(" · ")}{planPreview.staff.length > 4 ? " 외" : ""}</small></article>
                <article className={`summary-tone-${planPreview.risk === "critical" || planPreview.risk === "high" ? "risk" : planPreview.risk === "medium" ? "watch" : "ok"}`}><span>업무 위험도</span><strong>{riskLabel(planPreview.risk)}</strong><small>{planPreview.decisionExpectation}</small></article>
                <article className={`summary-tone-${routingStatus.tone}`}><span>AI 엔진 상태</span><strong>{routingStatus.label}</strong><small>{routingStatus.detail}</small></article>
                <article><span>예상 결과</span><strong>결과·검증 근거</strong><small>{planExpectedOutcome(planPreview, workRequest)}</small></article>
              </div>;
            })()}
            <div className="badge-row compact-plan-badges">
              <span className="badge">{draftModeLabel(planPreview.draft.status)}</span>
              <span className="badge">결정 예상 · {planPreview.decisionExpectation}</span>
              {planPreview.modelRouting&&<span className="badge">모델 추천 {planPreview.modelRouting.recommendations.length}개</span>}
            </div>
            <details className="plan-preview-details" open>
              <summary>실행 순서와 완료 조건 보기</summary>
              <div className="plan-detail-grid">
                <div><strong>실행 순서</strong><ol>{planPreview.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
                <div><strong>완료 조건</strong><ul>{planPreview.draft.completionCriteria.map(item => <li key={item}>{item}</li>)}</ul></div>
              </div>
            </details>
            <div className="grid" style={{ marginTop: 12 }}>
              <section className="card" aria-label="왜 이 팀인가요">
                <h3>왜 이 팀인가요?</h3>
                <ul>
                  {planPreview.staff.map(member => {
                    const custom = planPreview.recommendedEmployees?.find(employee => employee.name === member);
                    return <li key={member}><strong>{member}</strong> · {custom?.reason ?? staffReason(member)}{custom&&<small className="field-help"> · 직원 ID {custom.employeeId}</small>}</li>;
                  })}
                </ul>
                {!!planPreview.recommendedEmployees?.length&&<div className="custom-staffing-callout"><strong>채용한 직원이 투입됩니다</strong>{planPreview.recommendedEmployees.map(employee=><p key={employee.employeeId}><span>{employee.name}</span> · {employee.roleTitle}<br/><small>결정 필요: {employee.riskNotes.join(" · ")||"업무 중 위험 신호 발생 시"}</small></p>)}</div>}
                {!!planPreview.recommendedPresets?.length&&<div className="custom-staffing-callout preset-recommendation-callout"><strong>추천 전문 직원</strong>{planPreview.recommendedPresets.map(preset=>{const temporary=temporaryPresetKeys.includes(preset.presetKey);return <p key={preset.presetKey}><span>{preset.name}</span> · {preset.roleTitle}<br/><small>{preset.reason}</small><br/>{preset.activation==="already-available"?<small>이미 회사 직원으로 준비됨 · 이 업무 launch snapshot에 포함하려면 계획을 다시 요청하세요.</small>:<><button type="button" className={temporary?"secondary active":"secondary"} disabled={busy} onClick={()=>setTemporaryPresetKeys(keys=>keys.includes(preset.presetKey)?keys.filter(key=>key!==preset.presetKey):[...keys,preset.presetKey])}>{temporary?"임시 투입 선택됨":"이번 업무에만 임시 투입"}</button><button type="button" className="secondary" disabled={busy||presetAction===preset.presetKey} onClick={()=>void addRecommendedPreset(preset.presetKey)}>{presetAction===preset.presetKey?"추가 중…":"회사 직원으로 영구 추가"}</button></>}<br/><small>{temporary?"이 전문가는 회사 직원 목록에 추가되지 않고, 이 업무의 profile snapshot/hash에만 남습니다.":"반복될 역할이면 영구 추가, 한 번만 필요하면 임시 투입을 선택하세요."}</small></p>})}</div>}
              </section>
              <section className="card" aria-label="실행하면 이렇게 진행됩니다">
                <h3>실행하면 이렇게 진행됩니다</h3>
                <ol>
                  <li>PM이 범위와 완료 기준을 정리합니다.</li>
                  <li>실행 작업실에서 Task와 담당 Agent가 구성됩니다.</li>
                  <li>Developer가 실행하고 QA가 검증 근거를 남깁니다.</li>
                  <li>위험·권한·불확실성이 있으면 결정 필요에 멈춥니다.</li>
                  <li>완료되면 결과·활동에서 브리핑을 확인합니다.</li>
                </ol>
              </section>
              <section className="card" aria-label="예상 개입">
                <h3>예상 개입</h3>
                <ul>
                  <li>위험도: {riskLabel(planPreview.risk)}</li>
                  <li>{planPreview.decisionExpectation}</li>
                  <li>검증 실패나 예산 초과가 있으면 자동 완료하지 않습니다.</li>
                </ul>
              </section>
              <section className="card" aria-label="안전장치">
                <h3>안전장치</h3>
                <ul>
                  <li>고위험 변경은 결정 필요에 멈춥니다.</li>
                  <li>검증 실패 시 재작업 또는 승인 대기로 전환합니다.</li>
                  <li>예산 초과 시 실행하지 않고 사용자 안내를 표시합니다.</li>
                  <li>결과 승인 전까지 근거를 확인할 수 있습니다.</li>
                </ul>
              </section>
            </div>
            {planPreview.modelRouting&&<section className="card model-routing-preview" aria-label="추천 모델 배치" style={{ marginTop: 12 }}>
              <div className="section-heading"><div><span className="eyebrow">MODEL ROUTING</span><h3>추천 모델 배치</h3><p>{planPreview.modelRouting.summary}</p></div><Link className="button-link" to={modelRoutingSettingsHref(companyId, planPreview.modelRouting)}>AI 엔진 설정</Link></div>
              <div className="badge-row">{planPreview.modelRouting.signals.map(signal=><span key={signal} className="badge">{signal}</span>)}</div>
              <div className="model-routing-grid">{planPreview.modelRouting.recommendations.map(item=>{ const status=modelRoutingBindingStatus(bindings,item); return <article key={item.role} className={`model-routing-card priority-${item.priority}`}><span>{modelRoleLabel(item.role)}</span><strong>{modelTierLabel(item.recommendedTier)}</strong><small>중요도 {modelPriorityLabel(item.priority)}</small><p>{item.reason}</p><div className={"routing-delta routing-delta-" + status.tone}><strong>현재 설정 · {status.label}</strong><span>{status.detail}</span></div></article>; })}</div>
              <p className="field-help">추천은 자동 변경이 아닙니다. 중요한 업무라면 AI 엔진 설정에서 권장 preset을 검토·저장하세요. 저장 후 새 실행 기록에서 실제 사용 엔진을 확인할 수 있습니다.</p>
            </section>}
            <section className="card" aria-label="예상 결과물" style={{ marginTop: 12 }}>
              <h3>예상 결과물</h3>
              <p>완료 후에는 맡긴 일 진행 기록, 실행 Task, 검증 근거, 결정 이력, 결과 브리핑을 확인할 수 있습니다.</p>
            </section>
            {planPreview.draft.warnings.length > 0 && <p className="field-help">{planPreview.draft.warnings.map(draftWarningLabel).join(" ")}</p>}
            <div className="plan-commit-bar">
              <div><strong>{planPreview.staff.length}명 팀 · 임시 전문가 {temporaryPresetKeys.length}명 · 위험도 {riskLabel(planPreview.risk)} · {modelRoutingPlanStatus(bindings, planPreview.modelRouting).label}</strong><span>이 계획으로 맡기면 첫 Run이 준비됩니다. 임시 전문가는 회사 직원 목록에 추가되지 않고 이 업무의 provenance snapshot에만 남습니다.</span></div>
              <button disabled={busy || !portfolio} onClick={() => void launchWorkPlan()}>{workAction==="launching"?"AI 회사에 맡기는 중…":"이 계획으로 AI 회사에 맡기기"}</button>
              <button className="secondary" onClick={() => setPlanPreview(null)}>계획 수정</button>
            </div>
          </div>
        )}
      </section>

      {busy&&!snapshot&&<section className="page-loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/><div><strong>회사 운영 현황을 불러오는 중입니다.</strong><p>목표, 프로젝트, 승인과 직원 상태를 정리하고 있습니다.</p></div></section>}
      {!busy&&!snapshot&&<section className="empty-company-state"><div className="company-mark large" aria-hidden="true">+</div><h2>선택된 회사가 없습니다.</h2><p>회사 목록에서 운영할 회사를 선택하거나 새 회사를 만드세요.</p><Link className="button-link" to="/companies">내 회사로 이동</Link></section>}

      {snapshot && portfolio && totals && (
        <>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            {portfolio.company.name}<CompanyModeBadge mode={portfolio.company.mode} /> · 회사 예산 {portfolio.company.budgetLimit} · 필수 리뷰 [{portfolio.company.mandatoryReviews.join(", ")}] · 필수 승인 [{portfolio.company.mandatoryApprovals.join(", ")}]
          </p>

          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat-tile"><div className="label">프로젝트</div><div className="value">{totals.projects}</div></div>
            <div className="stat-tile"><div className="label">태스크 진행</div><div className="value">{totals.done}/{totals.tasks}</div></div>
            <div className="stat-tile"><div className="label">예산 사용</div><div className="value">{totals.spent.toFixed(1)}/{totals.budget}</div></div>
            <div className={`stat-tile${totals.approvals?" warning":""}`}><div className="label">결정 필요</div><div className="value">{totals.approvals}</div></div>
            <div className="stat-tile"><div className="label">직원</div><div className="value">{snapshot.pixel.agents.length}</div></div>
            <div className="stat-tile"><div className="label">검토 회의</div><div className="value">{snapshot.meetings.length}</div></div>
            <div className={`stat-tile${health?.metrics.validationFailures?" danger":""}`}><div className="label">검증 실패</div><div className="value">{health?.metrics.validationFailures??0}</div></div>
            <div className={`stat-tile${health?.metrics.incidents?" danger":""}`}><div className="label">Incident</div><div className="value">{health?.metrics.incidents??0}</div></div>
          </div>
          <section className="company-next-actions focused" aria-label="회사 주요 행동"><Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}`}>맡긴 일 전체 현황</Link><Link className="button-link" to={`/reviews?companyId=${encodeURIComponent(companyId)}`}>결정 필요 보기</Link><Link className="button-link" to={`/pixel-office?companyId=${encodeURIComponent(companyId)}`}>픽셀오피스 Live View</Link>{totals.approvals>0&&<span className="badge"><span className="status-dot status-warning"/>결정 필요 {totals.approvals}개</span>}{totals.blocked>0&&<span className="badge"><span className="status-dot status-critical"/>차단 {totals.blocked}개</span>}</section>
          <nav className="section-tabs" aria-label="회사 상세 영역">
            <button className={activeTab === "overview" ? "active" : ""} aria-pressed={activeTab === "overview"} onClick={() => setActiveTab("overview")}>현황</button>
            <button className={activeTab === "organization" ? "active" : ""} aria-pressed={activeTab === "organization"} onClick={() => setActiveTab("organization")}>조직·Agent</button>
            <button className={activeTab === "briefing" ? "active" : ""} aria-pressed={activeTab === "briefing"} onClick={() => setActiveTab("briefing")}>CEO 브리핑</button>
          </nav>
          <section hidden={activeTab !== "overview"} className="entity-navigation" aria-label="회사 프로젝트 탐색">
            <h2>연결 프로젝트</h2>
            <div className="entity-navigation-grid">{portfolio.projects.map(item => <Link key={item.project.id} className="entity-navigation-card" to={`/projects?projectId=${encodeURIComponent(item.project.id)}&companyId=${encodeURIComponent(companyId)}`}><strong>{item.project.name}</strong><span>진행 {item.progress.done}/{item.progress.total} · 우선순위 {item.priority}</span><small>차단 {item.risks.blocked} · 승인 {item.risks.approvals}</small></Link>)}</div>
          </section>
          <section hidden={activeTab !== "organization"} className="card agent-binding-settings" aria-label="Agent Backend 바인딩 설정">
            <h2>Agent Backend 바인딩</h2><p>우선순위: 직원 → 역할 → 회사 기본. 실행 중인 Run은 시작 시점 스냅샷을 유지합니다.</p>
            <div className="row"><label className="inline">대상<select value={bindingKind} onChange={e=>setBindingKind(e.target.value as typeof bindingKind)}><option value="company">회사 기본</option><option value="role">역할</option><option value="member">직원</option></select></label>{bindingKind!=="company"&&<label className="inline">{bindingKind==="role"?"planner / worker / reviewer":"직원 ID"}<input value={bindingTarget} onChange={e=>setBindingTarget(e.target.value)}/></label>}<label className="inline">Backend<select value={bindingBackend} onChange={e=>setBindingBackend(e.target.value as AgentBackendType)}>{["standalone","openai-compatible","legacy-nvidia","claude-cli","codex-cli"].map(item=><option key={item}>{item}</option>)}</select></label><label className="inline">Model<input value={bindingModel} onChange={e=>setBindingModel(e.target.value)}/></label><button disabled={busy||!bindingModel||(bindingKind!=="company"&&!bindingTarget)} onClick={()=>void saveBinding()}>바인딩 저장</button></div>
            <div className="binding-list">{bindings.map(item=><article key={item.id}><strong>{item.targetKind}:{item.targetId}</strong><span>{item.backend} · {item.modelId}</span><small>v{item.version} · {item.changedBy}</small></article>)}</div>
          </section>
          <div hidden={activeTab !== "overview"} className="badge-row">
            {totals.blocked > 0 && <span className="badge"><span className="status-dot status-critical" /> 차단 {totals.blocked}</span>}
            {totals.stale > 0 && <span className="badge"><span className="status-dot status-warning" /> stale {totals.stale}</span>}
            {totals.conflicts > 0 && <span className="badge"><span className="status-dot status-warning" /> 충돌 {totals.conflicts}</span>}
            {totals.blocked === 0 && totals.stale === 0 && totals.conflicts === 0 && <span className="badge"><span className="status-dot status-good" /> 위험 신호 없음</span>}
          </div>
          <div hidden={activeTab !== "overview"} className="measurement-guidance"><strong>다음 운영 확인</strong><span>{totals.approvals>0?`결정 필요 ${totals.approvals}건을 처리하세요.`:totals.blocked>0?`차단 태스크 ${totals.blocked}건의 원인을 확인하세요.`:"현재 긴급 조치가 없습니다. 연결 프로젝트의 다음 태스크를 확인하세요."}</span></div>

          <div hidden={activeTab !== "organization"} className="card" style={{ marginTop: 16 }}>
            <h2>부서</h2>
            <div className="badge-row">
              {portfolio.departments.map(d => <span key={d.id} className="badge">{d.name} · 예산 {d.budgetLimit}</span>)}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="inline">Department ID
                <input value={departmentId} onChange={e => setDepartmentId(e.target.value)} />
              </label>
              <label className="inline">이름
                <input value={departmentName} onChange={e => setDepartmentName(e.target.value)} />
              </label>
              <label className="inline">예산
                <input type="number" value={departmentBudget} onChange={e => setDepartmentBudget(e.target.value)} />
              </label>
              <button disabled={busy || !departmentId} onClick={() => void createDepartment()}>부서 생성</button>
              <button className="secondary" disabled={busy || !departmentId} onClick={() => void updateDepartmentBudget()}>예산 변경</button>
            </div>
          </div>
          <section hidden={activeTab !== "organization"} className="card" style={{ marginTop: 16 }} aria-label="역할 실행 프로필">
            <h2>역할 실행 프로필</h2><p>버전 변경은 다음 Run부터 적용되며, 이미 시작된 Run의 snapshot은 바뀌지 않습니다.</p>
            <div className="binding-list">{(snapshot.roleTemplates??[]).map(template=>{const scopes=(snapshot.roleBindings??[]).filter(binding=>binding.templateId===template.id);return <article key={template.id}><strong>{template.name} · v{template.version}</strong><span>{template.jobFamily} · {template.departmentId??"회사 공통"}</span><small>적용 범위: {scopes.length?scopes.map(scope=>`${scope.targetType}:${scope.targetId}${scope.pipelineRole?`/${scope.pipelineRole}`:"/공통"}`).join(", "):"미바인딩"}</small><small>필수 산출물: {template.requiredOutputs.join(", ")||"없음"}</small>{template.prohibitedActions.map(item=><small key={`${item.enforcement}:${item.action}`}>{item.enforcement==="deterministic-check"?"자동 검출":"Prompt 지침"}: {item.action}</small>)}</article>})}{!(snapshot.roleTemplates??[]).length&&<p className="empty-state">등록된 역할 프로필이 없습니다.</p>}</div>
          </section>

          {snapshot.recommendations.length > 0 && (
            <div hidden={activeTab !== "overview"} style={{ marginTop: 16 }}>
              <h2>추천 배정 (승인 필요)</h2>
              {snapshot.recommendations.map((item, index) => (
                <div key={index} className="recommendation">
                  <div>{item.suggestedAgent} → task {item.taskId} ({item.departmentId})</div>
                  <div className="action">{item.reason}</div>
                </div>
              ))}
            </div>
          )}

          <div hidden={activeTab !== "briefing"} style={{ marginTop: 16 }}>
            <button className="secondary" disabled={busy || !companyId} onClick={() => void createBriefing()}>새 CEO 브리핑 생성</button>
            <h2>CEO 브리핑 {snapshot.briefings.length > 1 && `(최근, 총 ${snapshot.briefings.length}건)`}</h2>
            {latestBriefing ? (
              <div className="recommendation" style={{ borderLeftColor: "#2a78d6" }}>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{latestBriefing.createdAt}</div>
                <div style={{ marginTop: 4 }}><strong>결정 사항</strong></div>
                {latestBriefing.decisions.map((d, i) => <div key={i}>· {d}</div>)}
                <div style={{ marginTop: 4 }}><strong>다음 행동</strong></div>
                {latestBriefing.nextActions.map((a, i) => <div key={i}>· {a}</div>)}
              </div>
            ) : <p style={{ fontSize: 12, color: "#9ca3af" }}>브리핑 없음</p>}
          </div>
        </>
      )}
    </div>
  );
}
