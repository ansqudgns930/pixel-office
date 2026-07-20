import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import CompanyModeBadge from "../components/CompanyModeBadge.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
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

interface StaffingPlanResponse {
  staff: string[];
  steps: string[];
  risk: "low" | "medium" | "high" | "critical";
  decisionExpectation: string;
}

interface WorkPlanPreview extends StaffingPlanResponse {
  draft: GoalDraftResponse;
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
  const [activeTab, setActiveTab] = useState<"overview" | "organization" | "briefing">("overview");
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string;projectCount:number}>>([]);
  const [health,setHealth]=useState<{metrics:{completedRuns:number;qualityPasses:number;validationFailures:number;incidents:number}}|null>(null);
  const [bindings,setBindings]=useState<AgentBinding[]>([]),[bindingKind,setBindingKind]=useState<"company"|"role"|"member">("company"),[bindingTarget,setBindingTarget]=useState(""),[bindingBackend,setBindingBackend]=useState<AgentBackendType>("standalone"),[bindingModel,setBindingModel]=useState("phase0-model");
  const [workRequest, setWorkRequest] = useState("");
  const [planPreview, setPlanPreview] = useState<WorkPlanPreview | null>(null);

  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentBudget, setDepartmentBudget] = useState("0");

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  function load(id=companyId) {
    return guarded(async () => {
      const [next,nextBindings,nextHealth] = await Promise.all([apiGet<CompanyCommandCenterSnapshot>(`/api/companies/${encodeURIComponent(id)}?actor=${encodeURIComponent(actorId)}`),apiGet<AgentBinding[]>(`/api/companies/${encodeURIComponent(id)}/agent-bindings?actor=${encodeURIComponent(actorId)}`),apiGet<{metrics:{completedRuns:number;qualityPasses:number;validationFailures:number;incidents:number}}>(`/api/companies/${encodeURIComponent(id)}/game-progression?actor=${encodeURIComponent(actorId)}`).catch(()=>null)]);
      setCompanyId(id);setSnapshot(next);setBindings(nextBindings);setHealth(nextHealth); localStorage.setItem("agent-company-os.lastCompany", id); setParams({ companyId:id }, { replace: true });
    });
  }

  useEffect(() => { void apiGet<Array<CompanyRecord&{role:string;projectCount:number}>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items=>{const received=Array.isArray(items),valid=(received?items:[]).filter(item=>item.status==="active");setCompanies(valid);const requested=params.get("companyId")||companyId,selected=valid.some(item=>item.id===requested)?requested:received?valid[0]?.id:requested;if(selected)void load(selected);else{setCompanyId("");setSnapshot(null);}}).catch(e=>{const requested=params.get("companyId")||companyId;if(requested)void load(requested);else setError(e instanceof Error?e.message:String(e));}); }, []);

  function proposeWorkPlan() {
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
    });
  }

  function launchWorkPlan() {
    if (!planPreview || !portfolio) return;
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
      });
      toast("업무를 AI 회사에 맡겼습니다. 진행 상황은 맡긴 일에서 확인하세요.");
      await load();
      navigate(`/goals?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(result.goal.id)}`);
    });
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
      <PageHeader title="회사 홈" description="회사의 목표·직원·프로젝트·승인·품질 현황과 다음 행동을 확인합니다." />

      <div className="card">
        <div className="row">
          <label className="inline">현재 회사
            <select value={companyId} onChange={e=>{setCompanyId(e.target.value);setSnapshot(null);}}><option value="">회사를 선택하세요</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name} · {company.role} · 프로젝트 {company.projectCount}</option>)}</select>
          </label>
          <button disabled={busy || !companyId} onClick={() => void load()}>현황 새로고침</button>
          <Link className="button-link" to="/companies">회사 목록</Link>
          {companyId && <Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}`}>맡긴 일</Link>}
          {companyId && <Link className="button-link" to={`/meetings?companyId=${encodeURIComponent(companyId)}`}>회의</Link>}
          {companyId && <Link className="button-link" to={`/pixel-office?companyId=${encodeURIComponent(companyId)}`}>픽셀 오피스</Link>}
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <section className="card" aria-label="AI 회사에 업무 맡기기" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <h2>무슨 일을 AI 회사에 맡길까요?</h2>
            <p>업무를 입력하면 AI 회사가 목표, 실행 계획, 투입 직원, 결정 필요 지점을 먼저 제안합니다.</p>
          </div>
          {companyId && <Link className="button-link" to={`/pixel-office?companyId=${encodeURIComponent(companyId)}`}>픽셀오피스로 보기</Link>}
        </div>
        <textarea
          value={workRequest}
          onChange={e => { setWorkRequest(e.target.value); setPlanPreview(null); }}
          rows={4}
          placeholder="예: 랜딩페이지 첫 화면을 더 설득력 있게 개선해줘."
          aria-label="AI 회사에 맡길 업무"
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button disabled={busy || !companyId || !workRequest.trim()} onClick={proposeWorkPlan}>AI 팀에게 계획 요청</button>
          <Link className="button-link" to={companyId ? `/goals?companyId=${encodeURIComponent(companyId)}` : "/goals"}>맡긴 일 보기</Link>
          <Link className="button-link" to={companyId ? `/reviews?companyId=${encodeURIComponent(companyId)}` : "/reviews"}>결정 필요 보기</Link>
        </div>
        {planPreview && (
          <div className="recommendation" style={{ marginTop: 12, borderLeftColor: "#3fb950" }}>
            <strong>AI 계획 제안</strong>
            <div style={{ marginTop: 8 }}><strong>{planPreview.draft.title}</strong></div>
            <p>{planPreview.draft.description || workRequest.trim()}</p>
            <div className="badge-row">
              {planPreview.staff.map(member => <span key={member} className="badge">{member}</span>)}
              <span className="badge">위험도 {planPreview.risk}</span>
              {planPreview.draft.status === "fallback" && <span className="badge">fallback draft</span>}
            </div>
            <ol>
              {planPreview.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
            <div><strong>완료 조건</strong></div>
            <ul>
              {planPreview.draft.completionCriteria.map(item => <li key={item}>{item}</li>)}
            </ul>
            <p><strong>사용자 결정 필요 예상:</strong> {planPreview.decisionExpectation}</p>
            {planPreview.draft.warnings.length > 0 && <p className="error">{planPreview.draft.warnings.join(", ")}</p>}
            <div className="row" style={{ marginTop: 8 }}>
              <button disabled={busy || !portfolio} onClick={() => void launchWorkPlan()}>이 계획으로 실행</button>
              <button className="secondary" onClick={() => setPlanPreview(null)}>수정 요청</button>
              <Link className="button-link" to={companyId ? `/employees?companyId=${encodeURIComponent(companyId)}` : "/employees"}>투입 직원 보기</Link>
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
          <section className="company-next-actions" aria-label="회사 주요 행동"><Link className="button-link" to={`/pixel-office?companyId=${encodeURIComponent(companyId)}`}>픽셀오피스로 보기</Link><Link className="button-link" to={`/employees?companyId=${encodeURIComponent(companyId)}`}>직원·AI팀</Link><Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}`}>맡긴 일 전체 현황</Link><Link className="button-link" to={`/meetings?companyId=${encodeURIComponent(companyId)}`}>회의 참여</Link><Link className="button-link" to={`/projects?companyId=${encodeURIComponent(companyId)}`}>프로젝트 보기</Link><Link className="button-link" to={`/execution?companyId=${encodeURIComponent(companyId)}`}>고급 실행 확인</Link>{snapshot.meetingSessions?.some(x=>x.status==="live")&&<span className="badge"><span className="status-dot status-good"/>진행 중 회의 {snapshot.meetingSessions.filter(x=>x.status==="live").length}건</span>}{totals.approvals>0&&<span className="badge"><span className="status-dot status-warning"/>결정 필요 {totals.approvals}건</span>}{totals.blocked>0&&<span className="badge"><span className="status-dot status-critical"/>차단 {totals.blocked}건</span>}</section>
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
