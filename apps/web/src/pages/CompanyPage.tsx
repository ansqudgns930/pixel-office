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

interface ModelRoutingPlan {
  overallRisk: "low" | "medium" | "high" | "critical";
  signals: string[];
  recommendations: ModelRoutingRecommendation[];
  summary: string;
}

interface StaffingEmployeeCandidate {
  employeeId: string;
  name: string;
  roleTitle: string;
  reason: string;
  riskNotes: string[];
}

interface StaffingPlanResponse {
  staff: string[];
  recommendedEmployees?: StaffingEmployeeCandidate[];
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
function modelTierLabel(tier: ModelRoutingRecommendation["recommendedTier"]){return tier==="high-reasoning"?"고사양 reasoning":tier==="high-verification"?"고사양 verification":tier==="coding"?"코딩 특화":tier==="fast-general"?"빠른 일반":tier==="cheap-draft"?"비용 절약 초안":"runtime fallback";}
function modelRoleLabel(role: ModelRoutingRecommendation["role"]){return role==="planner"?"Planner / PM":role==="worker"?"Worker / Developer":"Reviewer / QA";}
function modelPriorityLabel(priority: ModelRoutingRecommendation["priority"]){return priority==="critical"?"치명":priority==="high"?"높음":priority==="normal"?"보통":"낮음";}
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
  const [activeTab, setActiveTab] = useState<"overview" | "organization" | "briefing">("overview");
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string;projectCount:number}>>([]),[hiddenCompanies,setHiddenCompanies]=useState(0);
  const [health,setHealth]=useState<{metrics:{completedRuns:number;qualityPasses:number;validationFailures:number;incidents:number}}|null>(null);
  const [bindings,setBindings]=useState<AgentBinding[]>([]),[bindingKind,setBindingKind]=useState<"company"|"role"|"member">("company"),[bindingTarget,setBindingTarget]=useState(""),[bindingBackend,setBindingBackend]=useState<AgentBackendType>("standalone"),[bindingModel,setBindingModel]=useState("phase0-model");
  const [workRequest, setWorkRequest] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
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
      setPlanPreview({ draft: { ...draft, completionCriteria }, ...staffing });
    }).finally(() => setWorkAction(null));
  }

  function launchWorkPlan() {
    if (!planPreview || !portfolio) return;
    setWorkAction("launching");
    return guarded(async () => {
      const budgetLimit = Math.max(1, Math.min(10, Number(portfolio.company.budgetLimit) || 10));
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
        employeeProfileSnapshots: planPreview.recommendedEmployees?.map(employee => ({ principalId: employee.employeeId, reason: employee.reason })) ?? [],
      });
      toast("업무를 AI 회사에 맡겼습니다. 진행 상황은 맡긴 일에서 확인하세요.");
      await load();
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
          onChange={e => { setWorkRequest(e.target.value); setSelectedSample(""); setPlanPreview(null); }}
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
            <div className="badge-row">
              {planPreview.staff.map(member => <span key={member} className="badge">{member}</span>)}
              <span className="badge">위험도 {planPreview.risk}</span>
              <span className="badge">{draftModeLabel(planPreview.draft.status)}</span>
            </div>
            <ol>
              {planPreview.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
            <div><strong>완료 조건</strong></div>
            <ul>
              {planPreview.draft.completionCriteria.map(item => <li key={item}>{item}</li>)}
            </ul>
            <p><strong>사용자 결정 필요 예상:</strong> {planPreview.decisionExpectation}</p>
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
              <div className="section-heading"><div><span className="eyebrow">MODEL ROUTING</span><h3>추천 모델 배치</h3><p>{planPreview.modelRouting.summary}</p></div><Link className="button-link" to={companyId ? `/settings/backend?companyId=${encodeURIComponent(companyId)}` : "/settings/backend"}>AI 엔진 설정</Link></div>
              <div className="badge-row">{planPreview.modelRouting.signals.map(signal=><span key={signal} className="badge">{signal}</span>)}</div>
              <div className="model-routing-grid">{planPreview.modelRouting.recommendations.map(item=><article key={item.role} className={`model-routing-card priority-${item.priority}`}><span>{modelRoleLabel(item.role)}</span><strong>{modelTierLabel(item.recommendedTier)}</strong><small>중요도 {modelPriorityLabel(item.priority)}</small><p>{item.reason}</p></article>)}</div>
              <p className="field-help">추천은 강제 적용이 아닙니다. 실제 backend/model 변경은 AI 엔진 설정에서 저장하며, 저장된 설정은 다음 Run snapshot부터 고정됩니다.</p>
            </section>}
            <section className="card" aria-label="예상 결과물" style={{ marginTop: 12 }}>
              <h3>예상 결과물</h3>
              <p>완료 후에는 맡긴 일 진행 기록, 실행 Task, 검증 근거, 결정 이력, 결과 브리핑을 확인할 수 있습니다.</p>
            </section>
            {planPreview.draft.warnings.length > 0 && <p className="field-help">{planPreview.draft.warnings.map(draftWarningLabel).join(" ")}</p>}
            <div className="plan-commit-bar">
              <div><strong>이 계획으로 맡기면 바로 실행 프로젝트와 첫 Run이 준비됩니다.</strong><span>결정이 필요한 지점에서만 멈추고, 결과는 맡긴 일에서 추적합니다.</span></div>
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
