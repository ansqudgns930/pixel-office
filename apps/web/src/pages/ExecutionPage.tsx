import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import ConfirmButton from "../components/ConfirmButton.tsx";
import { useToast } from "../components/ToastContext.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import type { CompanyCommandCenterSnapshot, RiskLevel, RunAction, RunDetail, RunStatus, RunSummary } from "../types.ts";
import { splitUnifiedDiff } from "../diff.ts";
import { pixelOfficeReturnUrl } from "../navigation.ts";
import { safeUserText, shortId, uuid } from "../format.ts";

const MAIN_STEPS: Array<{ status: RunStatus; label: string }> = [
  { status: "CREATED", label: "접수" },
  { status: "PLANNING", label: "계획" },
  { status: "PLAN_APPROVAL_WAITING", label: "계획 승인" },
  { status: "READY", label: "준비" },
  { status: "RUNNING", label: "실행" },
  { status: "VALIDATING", label: "검증" },
  { status: "RESULT_APPROVAL_WAITING", label: "결과 승인" },
  { status: "COMPLETED", label: "완료" }
];

const EXCEPTION_INFO: Partial<Record<RunStatus, { anchor: RunStatus; label: string; tone: "warning" | "critical" | "muted"; hint: string }>> = {
  PAUSED: { anchor: "RUNNING", label: "일시정지", tone: "warning", hint: "재시도를 누르면 준비 상태부터 이어서 실행합니다." },
  RETRY_WAITING: { anchor: "READY", label: "재시도 대기", tone: "warning", hint: "잠시 후 자동으로 재시도되거나, 재시도 버튼으로 즉시 재개할 수 있습니다." },
  REVISION_REQUIRED: { anchor: "VALIDATING", label: "재작업 필요", tone: "warning", hint: "검증 실패 원인이 다음 Worker 호출 컨텍스트에 포함됩니다. 재시도로 수정 작업을 시작하세요." },
  BLOCKED: { anchor: "RUNNING", label: "차단됨", tone: "critical", hint: "예산·권한·승인 만료 등의 차단 사유를 감사 로그에서 확인한 뒤 재시도하세요." },
  FAILED: { anchor: "RUNNING", label: "실패", tone: "critical", hint: "실패 원인은 감사 로그에 기록됩니다. 재시도 또는 취소를 선택하세요." },
  CANCELLING: { anchor: "RUNNING", label: "취소 중", tone: "muted", hint: "실행 중인 작업을 정리하고 있습니다." },
  CANCELLED: { anchor: "RUNNING", label: "취소됨", tone: "muted", hint: "이 Run은 종료되었습니다. 새 Run을 생성해 다시 시작하세요." }
};

const RISK_LABEL: Record<string, string> = { low: "낮음", medium: "보통", high: "높음", critical: "매우 높음" };
const STATUS_LABEL: Record<RunStatus, string> = {
  CREATED: "접수", PLANNING: "계획 작성", PLAN_APPROVAL_WAITING: "계획 승인 대기", READY: "실행 준비", RUNNING: "실행 중",
  VALIDATING: "검증 중", RESULT_APPROVAL_WAITING: "결과 승인 대기", COMPLETED: "완료", PAUSED: "일시정지",
  BLOCKED: "차단", RETRY_WAITING: "재시도 대기", REVISION_REQUIRED: "재작업 필요", CANCELLING: "취소 중", CANCELLED: "취소됨", FAILED: "실패"
};

const ACTION_ALLOWED: Record<RunAction, RunStatus[]> = {
  "approve-plan": ["PLAN_APPROVAL_WAITING"],
  "approve-result": ["RESULT_APPROVAL_WAITING"],
  pause: ["PLANNING", "READY", "RUNNING", "VALIDATING"],
  retry: ["FAILED", "BLOCKED", "PAUSED", "REVISION_REQUIRED", "RETRY_WAITING"],
  cancel: ["CREATED", "PLANNING", "PLAN_APPROVAL_WAITING", "READY", "RUNNING", "VALIDATING", "RESULT_APPROVAL_WAITING", "PAUSED", "BLOCKED", "RETRY_WAITING", "REVISION_REQUIRED", "FAILED"]
};

interface ValidationItem { kind?: string; passed?: boolean; output?: string }

function preferredRun(runs: RunSummary[]): RunSummary | undefined {
  const rank = (status: RunStatus) => status === "COMPLETED" ? 1 : status === "FAILED" || status === "BLOCKED" ? 2 : status === "CANCELLED" ? 3 : 0;
  return [...runs].sort((a, b) => rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

function DiffLines({ patch }: { patch: string }) {
  return (
    <pre className="diff-view">
      {patch.split(/\r?\n/).map((line, index) => {
        const kind = line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")
          ? "meta" : line.startsWith("@@") ? "hunk" : line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx";
        return <span key={index} className={`diff-line diff-${kind}`}>{line || " "}</span>;
      })}
    </pre>
  );
}

export default function ExecutionPage() {
  const { actorId } = useSession();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState(() => searchParams.get("runId") ?? "");
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [goal, setGoal] = useState(() => searchParams.get("suggestedGoal") ?? "");
  const [pathsCsv, setPathsCsv] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("low");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkTaskId, setLinkTaskId] = useState(() => searchParams.get("taskId") ?? "");
  const linkProjectId = searchParams.get("projectId") ?? "";
  const companyId = searchParams.get("companyId") ?? localStorage.getItem("agent-company-os.lastCompany") ?? "";
  const focusedGoalId = searchParams.get("goalId") ?? "";

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function refreshRuns(): Promise<RunSummary[]> {
    const list = await apiGet<RunSummary[]>("/api/runs?limit=50");
    setRuns(list);
    return list;
  }

  function loadRun(id: string) {
    return guarded(async () => { setRunId(id); setDetail(await apiGet<RunDetail>(`/api/runs/${encodeURIComponent(id)}`)); });
  }

  useEffect(() => {
    void guarded(async () => {
      const list = await refreshRuns();
      const fromUrl = searchParams.get("runId");
      const companyId = searchParams.get("companyId");
      let candidates = list;
      if(!fromUrl&&companyId){
        const center=await apiGet<CompanyCommandCenterSnapshot>(`/api/companies/${encodeURIComponent(companyId)}?actor=${encodeURIComponent(actorId)}`);
        const runIds=new Set((center.portfolio.projects as Array<{tasks?:Array<{runId:string|null}>}>).flatMap(project=>project.tasks??[]).flatMap(task=>task.runId?[task.runId]:[]));
        const scoped=list.filter(run=>runIds.has(run.id));
        if(scoped.length)candidates=scoped;
      }
      const target = fromUrl ?? preferredRun(candidates)?.id;
      if (target) { setRunId(target); setDetail(await apiGet<RunDetail>(`/api/runs/${encodeURIComponent(target)}`)); }
    });
  }, [searchParams]);

  function createRun() {
    return guarded(async () => {
      const id = uuid();
      await apiPost("/api/runs", {
        id,
        requestId: uuid(),
        goal: goal.normalize("NFC").trim(),
        requestedPaths: pathsCsv.normalize("NFC").split(",").map(x => x.trim()).filter(Boolean),
        requestedRisk: risk,
        budgetLimit: 10
      });
      if (linkTaskId && linkProjectId) {
        try {
          await apiPost(`/api/projects/${encodeURIComponent(linkProjectId)}/tasks/${encodeURIComponent(linkTaskId)}/actions/link-run`, { actorId, runId: id });
          toast("새 Run을 만들고 Task에 연결했습니다.");
        } catch (e) { toast(`Run은 생성되었지만 Task 연결에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`); }
        setLinkTaskId("");
      } else {
        toast("새 Run이 생성되었습니다.");
      }
      setGoal(""); setPathsCsv("");
      await refreshRuns();
      setRunId(id); setDetail(await apiGet<RunDetail>(`/api/runs/${encodeURIComponent(id)}`));
    });
  }

  const ACTION_TOAST: Record<RunAction, string> = {
    "approve-plan": "계획을 승인했습니다.", "approve-result": "결과를 승인하고 병합 후보를 생성했습니다.",
    pause: "실행을 일시정지했습니다.", retry: "재시도를 요청했습니다.", cancel: "Run을 취소했습니다."
  };

  function runAction(name: RunAction) {
    return guarded(async () => {
      await apiPost(`/api/runs/${encodeURIComponent(runId)}/actions/${name}`, { userId: actorId });
      toast(ACTION_TOAST[name]);
      await refreshRuns();
      setDetail(await apiGet<RunDetail>(`/api/runs/${encodeURIComponent(runId)}`));
    });
  }

  const run = detail?.run ?? null;
  const status = run?.status ?? null;
  const exception = status ? EXCEPTION_INFO[status] : undefined;
  const anchorStatus = exception ? exception.anchor : status;
  const anchorIndex = anchorStatus ? MAIN_STEPS.findIndex(step => step.status === anchorStatus) : -1;
  const allowed = (name: RunAction) => !!status && ACTION_ALLOWED[name].includes(status);
  const fileDiffs = splitUnifiedDiff(detail?.result?.patch ?? "");
  const validations = (detail?.result?.validation ?? []) as ValidationItem[];
  const resultApproval = detail?.approvals.find(item => item.kind === "result");
  const budgetRatio = run ? Math.min(1, run.budgetLimit > 0 ? run.spent / run.budgetLimit : 0) : 0;
  const nextAction = status === "PLAN_APPROVAL_WAITING" ? "계획을 검토하고 승인하세요." : status === "RESULT_APPROVAL_WAITING" ? "검증 결과와 Diff를 확인한 뒤 결과를 승인하세요." : status === "FAILED" || status === "BLOCKED" || status === "REVISION_REQUIRED" ? "원인을 확인한 뒤 재시도를 결정하세요." : status === "COMPLETED" ? "실행이 완료되었습니다. 결과와 감사 로그를 확인할 수 있습니다." : "현재 단계가 끝나면 다음 작업이 자동으로 활성화됩니다.";
  const unavailableReason = "현재 Run 상태에서는 사용할 수 없습니다.";
  const officeUrl = pixelOfficeReturnUrl(searchParams, runId, { companyId: localStorage.getItem("agent-company-os.lastCompany"), projectId: localStorage.getItem("agent-company-os.lastProject"), agentId: localStorage.getItem("agent-company-os.selectedAgent") });

  return (
    <div>
      <PageHeader title="고급 실행" description="선택한 Task/Run의 계획, 실행 상태, 검증 결과, Diff, 감사 로그를 고급 모드에서 확인합니다." />

      <div className="card">
        <div className="row">
          <label className="inline">Run 선택
            <select value={runId} onChange={e => { if (e.target.value) void loadRun(e.target.value); }}>
              <option value="">최근 Run을 선택하세요</option>
              {runs.map(item => <option key={item.id} value={item.id}>[{STATUS_LABEL[item.status] ?? item.status}] {safeUserText(item.goal,"목표 인코딩 확인 필요").slice(0, 40) || "목표 없음"} · {shortId(item.id, 8)} · {new Date(item.updatedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</option>)}
            </select>
          </label>
          <button className="secondary" disabled={busy} onClick={() => void guarded(async () => { await refreshRuns(); if (runId) setDetail(await apiGet<RunDetail>(`/api/runs/${encodeURIComponent(runId)}`)); })}>새로고침</button>
          <Link className="button-link" to={officeUrl}>픽셀 오피스 Live View</Link>
          {companyId && <Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}${focusedGoalId?`&goalId=${encodeURIComponent(focusedGoalId)}`:""}`}>맡긴 일 상세</Link>}
          {companyId && linkProjectId && <Link className="button-link" to={`/projects?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(linkProjectId)}${focusedGoalId?`&goalId=${encodeURIComponent(focusedGoalId)}`:""}`}>실행 작업실</Link>}
          {companyId && <Link className="button-link" to={`/activity?companyId=${encodeURIComponent(companyId)}${focusedGoalId?`&goalId=${encodeURIComponent(focusedGoalId)}`:""}`}>결과·활동</Link>}
          {companyId && <Link className="button-link" to={`/reviews?companyId=${encodeURIComponent(companyId)}`}>결정 필요</Link>}
        </div>
        <details className="new-run" open={linkTaskId ? true : undefined}>
          <summary>고급 Run 직접 생성</summary>
          {linkTaskId && <p className="field-help">실행 작업실에서 넘어온 Task용 Run입니다. 생성하면 자동으로 그 Task에 연결됩니다.</p>}
          {!linkTaskId && <p className="field-help">일반 업무 위임은 회사 홈에서 시작하세요. 이 영역은 Task/Run을 직접 만들거나 재실행하는 고급 실행 도구입니다.</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <label className="inline">목표
              <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="예: 설정 화면에 상태 배지 추가" />
            </label>
            <label className="inline">변경 경로 (쉼표 구분)
              <input value={pathsCsv} onChange={e => setPathsCsv(e.target.value)} placeholder="src/file.ts" />
            </label>
            <label className="inline">위험도
              <select value={risk} onChange={e => setRisk(e.target.value as RiskLevel)}>
                {(["low", "medium", "high", "critical"] as RiskLevel[]).map(level => <option key={level} value={level}>{level} · {RISK_LABEL[level]}</option>)}
              </select>
            </label>
            <button disabled={busy || !goal.trim()} onClick={() => void createRun()}>{busy ? "생성 중…" : "Run 생성"}</button>
          </div>
        </details>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      {(focusedGoalId || linkTaskId || linkProjectId || runId) && <section className="card" aria-label="선택 실행 컨텍스트">
        <div className="section-heading"><div><span className="eyebrow">ADVANCED EXECUTION</span><h2>선택한 Task/Run의 고급 실행·증거 확인 화면입니다</h2><p>이 화면은 일반 업무 흐름의 시작점이 아니라, 실행 작업실에서 넘어온 Task와 Run의 계획 승인, 결과 승인, 검증 출력, Diff, 감사 로그를 확인하는 운영자용 상세 화면입니다.</p></div><span className="badge">{runId?shortId(runId,8):linkTaskId?shortId(linkTaskId,8):focusedGoalId?focusedGoalId.slice(0,8):"context"}</span></div>
        <div className="badge-row">{focusedGoalId&&<span className="badge">맡긴 일 연결</span>}{linkProjectId&&<span className="badge">프로젝트 연결</span>}{linkTaskId&&<span className="badge">Task 연결</span>}{runId&&<span className="badge">Run 선택</span>}<span className="badge">계획·결과 승인</span><span className="badge">검증·Diff 근거</span></div>
      </section>}

      {!run && !error && <div className="empty-panel"><strong>고급 확인할 Run을 선택하거나 Task용 Run을 만드세요.</strong><span>선택하면 진행 단계, 승인 상태, 검증 결과, 파일별 Diff, 감사 로그가 표시됩니다.</span></div>}

      {run && status && (
        <>
          <section className="card" aria-label="진행 단계">
            <ol className="stepper">
              {MAIN_STEPS.map((step, index) => {
                const state = anchorIndex < 0 ? "pending" : index < anchorIndex ? "done" : index === anchorIndex ? (exception ? `exception-${exception.tone}` : "active") : "pending";
                return (
                  <li key={step.status} className={`step step-${state}`} aria-current={index === anchorIndex ? "step" : undefined}>
                    <span className="step-dot" aria-hidden="true" />
                    <span className="step-label">{step.label}</span>
                  </li>
                );
              })}
            </ol>
            {exception && (
              <div className={`run-banner banner-${exception.tone}`} role="status">
                <strong>{exception.label}</strong>
                <span>{exception.hint}</span>
              </div>
            )}
            <p className="next-action" role="status"><strong>다음 운영자 액션</strong><span>{nextAction}</span></p>
            <div className="row" style={{ marginTop: 12 }}>
              <button title={!allowed("approve-plan")?unavailableReason:undefined} className={allowed("approve-plan") ? "" : "secondary"} disabled={busy || !allowed("approve-plan")} onClick={() => void runAction("approve-plan")}>계획 승인</button>
              <ConfirmButton label="결과 승인" confirmLabel="병합 후보 생성 — 한 번 더 눌러 확정" tone="accent" emphasis={allowed("approve-result")} disabled={busy || !allowed("approve-result")} onConfirm={() => void runAction("approve-result")} />
              <button title={!allowed("pause")?unavailableReason:undefined} className="secondary" disabled={busy || !allowed("pause")} onClick={() => void runAction("pause")}>일시정지</button>
              <button title={!allowed("retry")?unavailableReason:undefined} className={allowed("retry") ? "" : "secondary"} disabled={busy || !allowed("retry")} onClick={() => void runAction("retry")}>재시도</button>
              <ConfirmButton label="취소" confirmLabel="Run 종료 — 한 번 더 눌러 확정" disabled={busy || !allowed("cancel")} onConfirm={() => void runAction("cancel")} />
            </div>
          </section>

          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat-tile"><div className="label">상태</div><div className="value" style={{ fontSize: 16 }}>{STATUS_LABEL[status]}</div></div>
            <div className="stat-tile"><div className="label">위험도</div><div className="value" style={{ fontSize: 16 }}>{RISK_LABEL[run.risk] ?? run.risk}</div>
              <div className="status-row"><span className={`status-dot ${run.risk === "low" ? "status-good" : run.risk === "medium" ? "status-warning" : "status-critical"}`} />{RISK_LABEL[run.risk]??run.risk}</div>
            </div>
            <div className="stat-tile"><div className="label">예산</div><div className="value" style={{ fontSize: 16 }}>{run.spent.toFixed(2)} / {run.budgetLimit}</div>
              <div className="progress-track" style={{ marginTop: 6 }}><div className={`progress-fill${budgetRatio >= 0.8 ? " progress-warn" : ""}`} style={{ width: `${Math.round(budgetRatio * 100)}%` }} /></div>
            </div>
            <div className="stat-tile"><div className="label">결과 승인</div><div className="value" style={{ fontSize: 16 }}>{resultApproval ? (resultApproval.status === "APPROVED" ? "승인됨" : resultApproval.status === "REJECTED" ? "반려됨" : "대기 중") : "요청 전"}</div>
              {detail?.candidate && <div className="status-row" title={detail.candidate.branch}>브랜치 {detail.candidate.branch.length > 26 ? `${detail.candidate.branch.slice(0, 26)}…` : detail.candidate.branch}</div>}
            </div>
          </div>

          <p className={`run-goal${safeUserText(run.goal)!==run.goal.trim()?" text-warning":""}`}><strong>Run 목표</strong> {safeUserText(run.goal)}</p>

          {(detail?.agentBindings?.length ?? 0) > 0 && (
            <section className="card" aria-label="Run Agent Backend">
              <h2>Run Agent Backend Snapshot</h2>
              <div className="badge-row">
                {detail!.agentBindings.map(binding => <span className="badge" key={binding.role}><strong>{binding.role}</strong> · {binding.backend} · {binding.modelId} · {binding.resolution}</span>)}
              </div>
            </section>
          )}

          <div className="grid">
            <section className="card" aria-label="검증 결과">
              <h2>검증 근거</h2>
              {validations.length ? (
                <ul className="validation-list">
                  {validations.map((item, index) => (
                    <li key={index}>
                      <span className={`status-dot ${item.passed ? "status-good" : "status-critical"}`} aria-hidden="true" />
                      <strong>{item.kind ?? `검사 ${index + 1}`}</strong>
                      <span>{item.passed ? "통과" : "실패"}</span>
                      {item.output && <details><summary>출력 보기</summary><pre>{item.output}</pre></details>}
                    </li>
                  ))}
                </ul>
              ) : <p className="empty-state">아직 검증이 실행되지 않았습니다.</p>}
            </section>

            <section className="card" aria-label="파일별 변경 검토">
              <h2>파일별 변경 근거</h2>
              {detail?.result && <p className="diff-meta">Patch <code>{detail.result.patchHash.slice(0, 12)}…</code> · 파일 {fileDiffs.length}개</p>}
              {fileDiffs.length
                ? fileDiffs.map(file => (
                  <details key={file.path} open={fileDiffs.length <= 3}>
                    <summary><strong>{file.path}</strong> <span className="diff-count"><span className="diff-plus">+{file.additions}</span> <span className="diff-minus">-{file.deletions}</span></span></summary>
                    <DiffLines patch={file.patch} />
                  </details>
                ))
                : <p className="empty-state">검토할 변경이 없습니다.</p>}
            </section>
          </div>

          <section className="card" aria-label="상세 데이터">
            <h2>고급 상세 데이터</h2>
            <details><summary>아티팩트·영향·컨텍스트·병합 (아티팩트 {detail?.phase2.artifacts.length ?? 0} · 관계 {detail?.phase2.relations.length ?? 0} · stale {detail?.phase2.stale.length ?? 0})</summary><pre>{JSON.stringify(detail?.phase2, null, 2)}</pre></details>
            <details><summary>감사 로그 ({detail?.audit.length ?? 0}건)</summary><pre>{JSON.stringify(detail?.audit, null, 2)}</pre></details>
          </section>
        </>
      )}
    </div>
  );
}
