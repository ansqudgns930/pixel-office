import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import { useToast } from "../components/ToastContext.tsx";
import type { CompanyRecord, IndustryName, PlatformSnapshot } from "../types.ts";
import { useSearchParams } from "react-router-dom";
import ConfirmButton from "../components/ConfirmButton.tsx";
import type { ExpansionRecommendation } from "../types.ts";

const RECOMMENDATION_KIND_LABEL: Record<string, string> = { role: "역할 보강", department: "조직 개편" };
const BADGE_LABEL: Record<string, string> = { "quality-gate": "품질 게이트 통과", "fresh-artifacts": "최신 산출물 유지" };
const MILESTONE_LABEL: Record<string, string> = { "work-started": "작업 시작됨", "portfolio-complete": "포트폴리오 완료" };
const RECOMMENDATION_ACTION_LABEL: Record<string, string> = { "review-capacity": "인력 검토 필요", "review-organization": "조직 구조 검토 필요" };
function recommendationReason(item: ExpansionRecommendation): string {
  const evidence = (item.evidence && typeof item.evidence === "object" ? item.evidence : {}) as Record<string, unknown>;
  if (item.reason === "low portfolio completion" && typeof evidence.completionRate === "number") return `포트폴리오 완료율이 ${Math.round(evidence.completionRate * 100)}%로 낮습니다 (표본 ${evidence.sampleCount ?? 0}건)`;
  if (typeof evidence.blocked === "number") return `차단된 Task가 ${evidence.blocked}건 있습니다`;
  return item.reason;
}

function rateStatus(rate: number, sampleCount: number): { className: string; label: string } {
  if (sampleCount < 3) return { className: "status-muted", label: `측정 대기 · 표본 ${sampleCount}/3` };
  if (rate >= 0.8) return { className: "status-good", label: "양호" };
  if (rate >= 0.5) return { className: "status-warning", label: "주의" };
  return { className: "status-critical", label: "위험" };
}

function staleStatus(count: number): { className: string; label: string } {
  if (count === 0) return { className: "status-good", label: "양호" };
  if (count <= 3) return { className: "status-warning", label: "주의" };
  return { className: "status-critical", label: "위험" };
}

export default function PlatformPage() {
  const { actorId } = useSession();
  const toast = useToast();
  const [params,setParams]=useSearchParams();
  const [companyId, setCompanyId] = useState(()=>params.get("companyId")??localStorage.getItem("agent-company-os.lastCompany")??"");
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string}>>([]);
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview"|"workflow"|"industry">("overview");
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);

  const [workflowId, setWorkflowId] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [roleTemplateId, setRoleTemplateId] = useState("");
  const [workflowBudget, setWorkflowBudget] = useState("1");

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  function load() {
    return guarded(async () => { setSnapshot(await apiGet<PlatformSnapshot>(`/api/companies/${encodeURIComponent(companyId)}/platform?actor=${encodeURIComponent(actorId)}`));setLastUpdated(new Date());localStorage.setItem("agent-company-os.lastCompany",companyId);setParams({companyId},{replace:true}); });
  }

  useEffect(()=>{void apiGet<Array<CompanyRecord&{role:string}>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items=>{const valid=Array.isArray(items)?items:[];setCompanies(valid);const selected=companyId||valid[0]?.id;if(selected){setCompanyId(selected);void apiGet<PlatformSnapshot>(`/api/companies/${encodeURIComponent(selected)}/platform?actor=${encodeURIComponent(actorId)}`).then(value=>{setSnapshot(value);setLastUpdated(new Date());}).catch(error=>setError(error instanceof Error?error.message:String(error)));}});},[actorId]);

  function createWorkflow() {
    return guarded(async () => {
      await apiPost(`/api/companies/${encodeURIComponent(companyId)}/workflows`, {
        actorId,
        logicalId: workflowId,
        name: workflowName,
        steps: [{ id: "work", roleTemplateId, dependsOn: [], completionCriteria: ["done"], tools: [] }],
        requiredReviews: [],
        requiredApprovals: [],
        budgetLimit: Number(workflowBudget),
        provenance: { source: "apps/web" }
      });
      toast("Workflow 초안을 생성했습니다.");
      await load();
    });
  }

  function workflowAction(id: string, action: "validate" | "publish") {
    return guarded(async () => { await apiPost(`/api/companies/${encodeURIComponent(companyId)}/workflows/${encodeURIComponent(id)}/${action}`, { actorId }); toast(action === "validate" ? "Workflow 검증을 통과했습니다." : "Workflow를 게시했습니다."); await load(); });
  }

  function installIndustry(name: IndustryName, hash: string) {
    return guarded(async () => { await apiPost(`/api/companies/${encodeURIComponent(companyId)}/industries/${name}/install`, { actorId, expectedHash: hash }); toast(`${name} 산업 템플릿을 설치했습니다.`); await load(); });
  }

  const metrics = snapshot?.metrics ?? null;
  const game = snapshot?.game ?? null;
  const recommendations = snapshot?.recommendations.items ?? [];

  return (
    <div>
      <PageHeader title="플랫폼 관리" description="관리자용 회사 운영 인프라 화면입니다. Workflow, 산업 템플릿, 확장 추천, 어댑터 상태를 변경 전에 검토합니다." />

      <div className="card">
        <div className="row">
          <label className="inline">회사
            <select value={companyId} onChange={e => {setCompanyId(e.target.value);setSnapshot(null);}}><option value="">회사를 선택하세요</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <button disabled={busy || !companyId} onClick={() => void load()}>{busy?"불러오는 중…":"관리 상태 조회"}</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {companyId&&<section className="card" aria-label="플랫폼 관리 안내">
        <div className="section-heading"><div><span className="eyebrow">ADMIN PLATFORM</span><h2>일반 업무 흐름이 아닌 관리자 설정 화면입니다</h2><p>사용자는 회사 홈에서 일을 맡기고, 이 화면에서는 운영자가 Workflow 게시, 산업 템플릿 설치, 조직 확장 추천, 어댑터 상태를 검토합니다.</p></div><span className="badge">admin</span></div>
        <div className="badge-row"><span className="badge">Workflow 관리</span><span className="badge">산업 템플릿</span><span className="badge">조직 확장 추천</span><span className="badge">어댑터 상태</span></div>
      </section>}

      {!snapshot&&!error&&<div className="empty-panel"><strong>회사를 선택해 플랫폼 관리 상태를 확인하세요.</strong><span>Workflow, 산업 템플릿, 확장 추천, 어댑터 상태가 이 관리자 화면에 표시됩니다.</span></div>}

      {snapshot && metrics && (
        <>
          <nav className="section-tabs" aria-label="플랫폼 관리 영역">
            <button className={activeTab==="overview"?"active":""} aria-pressed={activeTab==="overview"} onClick={()=>setActiveTab("overview")}>관리 현황</button>
            <button className={activeTab==="workflow"?"active":""} aria-pressed={activeTab==="workflow"} onClick={()=>setActiveTab("workflow")}>업무 흐름</button>
            <button className={activeTab==="industry"?"active":""} aria-pressed={activeTab==="industry"} onClick={()=>setActiveTab("industry")}>산업 템플릿</button>
          </nav>
          {activeTab==="overview"&&<p className="data-freshness">관리 상태 마지막 갱신 {lastUpdated?.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})??"-"} · 완료된 표본 3건부터 플랫폼 지표 상태를 판정합니다.</p>}
          {activeTab==="overview"&&metrics.sampleCount<3&&<div className="measurement-guidance"><strong>관리 지표 판정까지 완료 표본 {3-metrics.sampleCount}건이 더 필요합니다.</strong><span>표본이 쌓이기 전에는 0%를 운영 실패로 판단하지 않습니다.</span></div>}
          <div hidden={activeTab!=="overview"} className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat-tile">
              <div className="label">완료율</div>
              <div className="value">{Math.round(metrics.completionRate * 100)}%</div>
              {(() => { const s = rateStatus(metrics.completionRate, metrics.sampleCount); return <div className="status-row"><span className={`status-dot ${s.className}`} />{s.label}</div>; })()}
            </div>
            <div className="stat-tile">
              <div className="label">검증 통과율</div>
              <div className="value">{Math.round(metrics.validationRate * 100)}%</div>
              {(() => { const s = rateStatus(metrics.validationRate, metrics.sampleCount); return <div className="status-row"><span className={`status-dot ${s.className}`} />{s.label}</div>; })()}
            </div>
            <div className="stat-tile">
              <div className="label">오래된 결과물</div>
              <div className="value">{metrics.staleCount}</div>
              {(() => { const s = staleStatus(metrics.staleCount); return <div className="status-row"><span className={`status-dot ${s.className}`} />{s.label}</div>; })()}
            </div>
            <div className="stat-tile">
              <div className="label">누적 비용</div>
              <div className="value">{metrics.cost.toFixed(2)}</div>
              <div className="status-row">표본 {metrics.sampleCount}개 태스크</div>
            </div>
          </div>

          {game && (
            <div hidden={activeTab!=="overview"} style={{ marginTop: 16 }}>
              <div className="label" style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>포트폴리오 진행률</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.round(game.progress.completed * 100)}%` }} />
              </div>
              {game.badges.length > 0 && (
                <div className="badge-row">
                  {game.badges.map(badge => <span key={badge} className="badge">배지 · {BADGE_LABEL[badge] ?? badge}</span>)}
                </div>
              )}
              {game.milestones.length > 0 && (
                <div className="badge-row">
                  {game.milestones.map(milestone => <span key={milestone} className="badge"><span className="status-dot status-good" /> {MILESTONE_LABEL[milestone] ?? milestone}</span>)}
                </div>
              )}
            </div>
          )}

          {recommendations.length > 0 && (
            <div hidden={activeTab!=="overview"} style={{ marginTop: 16 }}>
              <div className="label" style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>조직 확장 추천 · 관리자 검토 필요</div>
              {recommendations.map((item, index) => (
                <div key={index} className="recommendation">
                  <div>{recommendationReason(item)}</div>
                  <div className="action">{RECOMMENDATION_KIND_LABEL[item.kind] ?? item.kind} · {RECOMMENDATION_ACTION_LABEL[item.action] ?? item.action}</div>
                </div>
              ))}
            </div>
          )}

          {snapshot.adapters.length > 0 && (
            <div hidden={activeTab!=="overview"} className="badge-row" style={{ marginTop: 16 }}>
              {snapshot.adapters.map(a => <span key={a.id} className="badge">{a.id}: {a.status}{a.failures > 0 ? ` (실패 ${a.failures})` : ""}</span>)}
            </div>
          )}

          <div hidden={activeTab!=="workflow"} className="card" style={{ marginTop: 16 }}>
            <h2>Workflow 관리</h2><p className="section-description">초안을 검증한 뒤 게시하면 이후 맡긴 일부터 적용됩니다. 이미 실행 중인 업무에는 소급 적용하지 않습니다.</p>
            {snapshot.workflows.map(wf => (
              <div key={wf.id} className="recommendation" style={{ borderLeftColor: wf.status === "published" ? "#0ca30c" : wf.status === "validated" ? "#fab219" : "#4b5563" }}>
                <div>{wf.name} <span className="action">v{wf.version} · {wf.status}</span></div>
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="secondary" disabled={busy || wf.status !== "draft"} onClick={() => void workflowAction(wf.id, "validate")}>검증</button>
                  <ConfirmButton label="게시" confirmLabel="새 업무에 적용 — 다시 눌러 확정" disabled={busy || wf.status !== "validated"} onConfirm={() => void workflowAction(wf.id, "publish")} />
                </div>
              </div>
            ))}
            <div className="row" style={{ marginTop: 8 }}>
              <label className="inline">Workflow ID
                <input value={workflowId} onChange={e => setWorkflowId(e.target.value)} />
              </label>
              <label className="inline">이름
                <input value={workflowName} onChange={e => setWorkflowName(e.target.value)} />
              </label>
              <label className="inline">Role Template ID
                <input value={roleTemplateId} onChange={e => setRoleTemplateId(e.target.value)} />
              </label>
              <label className="inline">예산
                <input type="number" value={workflowBudget} onChange={e => setWorkflowBudget(e.target.value)} />
              </label>
              <button disabled={busy || !workflowId || !workflowName} onClick={() => void createWorkflow()}>관리 Workflow 초안 생성</button>
            </div>
          </div>

          <div hidden={activeTab!=="industry"} className="card" style={{ marginTop: 16 }}>
            <h2>산업 템플릿</h2>
            <p className="section-description">부서·역할·Workflow 변경 내용을 확인한 뒤 설치하세요. 회사 운영 구조를 바꾸는 관리자 작업입니다.</p>
            {snapshot.industries.map(preview => (
              <div key={preview.industry} className="recommendation">
                <div>{preview.industry} <span className="action">v{preview.bundle.version} · 부서 [{preview.bundle.departments.join(", ")}]</span></div>
                <div className="action">변경: {preview.diff.length ? preview.diff.join(", ") : "설치됨/변경 없음"}</div>
                <div style={{marginTop:6}}><ConfirmButton label="설치 검토" confirmLabel="조직 변경 설치 — 다시 눌러 확정" disabled={busy || preview.diff.length === 0} onConfirm={() => void installIndustry(preview.industry, preview.hash)} /></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
