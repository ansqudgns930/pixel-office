import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import { useToast } from "../components/ToastContext.tsx";
import ConfirmButton from "../components/ConfirmButton.tsx";
import { BOARD_STATUSES } from "../types.ts";
import type { AssigneeKind, BoardStatus, CompanyCommandCenterSnapshot, CompanyRecord, DepartmentRecord, ProjectResponsibility, ProjectSnapshot, TaskSnapshot } from "../types.ts";
import { uuid } from "../format.ts";
const VALIDATOR_CHECKS=["build","typecheck","test","lint","security"] as const;
const BOARD_LABEL: Record<BoardStatus, string> = { backlog:"대기", ready:"준비", "in-progress":"진행 중", review:"검토", blocked:"차단", done:"완료" };
const CHECK_LABEL: Record<string, string> = { build:"빌드", typecheck:"타입 검사", test:"테스트", lint:"코드 규칙", security:"보안 검사" };
const NOTIFICATION_LABEL: Record<string, string> = { "task-blocked": "Task 차단", "budget-blocked": "예산 부족", "approval-waiting": "승인 대기", "run-problem": "Run 문제 발생", "merge-conflict": "병합 충돌" };
function notificationLabel(type: string): string { return NOTIFICATION_LABEL[type] ?? "업데이트"; }

export default function WarRoomPage() {
  const { actorId } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [projectId, setProjectId] = useState(() => params.get("projectId") ?? localStorage.getItem("agent-company-os.lastProject") ?? "");
  const [companyId, setCompanyId] = useState(() => params.get("companyId") ?? localStorage.getItem("agent-company-os.lastCompany") ?? "");
  const [companies, setCompanies] = useState<Array<CompanyRecord & { role: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [principalId, setPrincipalId] = useState("");
  const [kind, setKind] = useState<AssigneeKind>("agent");
  const [responsibility, setResponsibility] = useState<ProjectResponsibility>("executor");
  const [nextStatus, setNextStatus] = useState<BoardStatus>("in-progress");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [validatorChecks,setValidatorChecks]=useState<string[]>(["build","typecheck","test","lint","security"]);
  const [repositoryInput,setRepositoryInput]=useState("src"),[repositoryOutput,setRepositoryOutput]=useState("");
  const [newProjectName,setNewProjectName]=useState(""),[newProjectRepoPath,setNewProjectRepoPath]=useState("."),[newProjectBudget,setNewProjectBudget]=useState("20"),[newProjectDepartmentId,setNewProjectDepartmentId]=useState(""),[projectAddBusy,setProjectAddBusy]=useState(false);
  const [newTaskTitle,setNewTaskTitle]=useState(""),[newTaskCriteria,setNewTaskCriteria]=useState(""),[newTaskBudget,setNewTaskBudget]=useState("5"),[taskAddBusy,setTaskAddBusy]=useState(false);

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  function load(id=projectId) {
    return guarded(async () => {
      setProjectId(id);setSnapshot(await apiGet<ProjectSnapshot>(`/api/projects/${encodeURIComponent(id)}?actor=${encodeURIComponent(actorId)}`));
      localStorage.setItem("agent-company-os.lastProject", id); const next = new URLSearchParams(params); next.set("projectId", id); setParams(next, { replace: true });
    });
  }

  async function selectCompany(id: string) {
    setCompanyId(id);
    setSnapshot(null);
    setProjectId("");
    setProjectOptions([]);
    setDepartments([]);
    if (!id) return;
    localStorage.setItem("agent-company-os.lastCompany", id);
    try {
      const company = await apiGet<CompanyCommandCenterSnapshot>(`/api/companies/${encodeURIComponent(id)}?actor=${encodeURIComponent(actorId)}`);
      const options = company.portfolio.projects.map(item => ({ id: item.project.id, name: item.project.name }));
      setProjectOptions(options);
      setDepartments(company.portfolio.departments);
      setNewProjectDepartmentId(company.portfolio.departments[0]?.id ?? "");
      const onlyProject = options[0];
      if (options.length === 1 && onlyProject) void load(onlyProject.id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  function createNewProject() {
    if (!companyId || !newProjectName.trim() || !newProjectDepartmentId) return;
    setProjectAddBusy(true); setError(null);
    return (async () => {
      try {
        const company = companies.find(c => c.id === companyId);
        if (!company) throw new Error("회사를 다시 선택하세요.");
        const id = uuid();
        await apiPost("/api/projects", { id, workspaceId: company.workspaceId, name: newProjectName.trim(), repoPath: newProjectRepoPath.trim() || ".", defaultBranch: "main", runtimePath: ".", organizationProfile: {}, budgetLimit: Number(newProjectBudget), ownerId: actorId });
        await apiPost(`/api/companies/${encodeURIComponent(companyId)}/projects`, { actorId, departmentId: newProjectDepartmentId, projectId: id, priority: 50 });
        toast(`${newProjectName.trim()} 프로젝트를 만들었습니다.`);
        setNewProjectName(""); setNewProjectRepoPath(".");
        await selectCompany(companyId);
        await load(id);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setProjectAddBusy(false); }
    })();
  }

  function createNewTask() {
    if (!projectId || !newTaskTitle.trim() || !newTaskCriteria.trim()) return;
    setTaskAddBusy(true); setError(null);
    return (async () => {
      try {
        const completionCriteria = newTaskCriteria.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        await apiPost(`/api/projects/${encodeURIComponent(projectId)}/tasks`, { actorId, id: uuid(), milestoneId: null, title: newTaskTitle.trim(), status: "backlog", priority: 50, completionCriteria, budgetLimit: Number(newTaskBudget) });
        toast(`${newTaskTitle.trim()} Task를 만들었습니다.`);
        setNewTaskTitle(""); setNewTaskCriteria("");
        await load();
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setTaskAddBusy(false); }
    })();
  }

  function startRunForTask() {
    if (!selectedTask) return;
    const next = new URLSearchParams();
    next.set("taskId", selectedTask.id);
    next.set("projectId", projectId);
    next.set("companyId", companyId);
    next.set("suggestedGoal", selectedTask.title);
    navigate(`/execution?${next.toString()}`);
  }

  useEffect(() => {
    void apiGet<Array<CompanyRecord & { role: string }>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items => {
      const valid = Array.isArray(items) ? items : [];
      setCompanies(valid);
      const selectedCompany = params.get("companyId") || companyId || valid[0]?.id || "";
      if (selectedCompany) void selectCompany(selectedCompany);
      const selectedProject = params.get("projectId") || projectId;
      if (selectedProject) void load(selectedProject);
    }).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  function recover() {
    return guarded(async () => { await apiPost(`/api/projects/${encodeURIComponent(projectId)}/actions/recover`, { actorId }); await load(); });
  }

  function assignSelected() {
    if (!selectedTaskId) return Promise.resolve();
    return guarded(async () => {
      await apiPost(`/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(selectedTaskId)}/actions/assign`, { actorId, principalId, kind, responsibility });
      toast("담당자를 배정했습니다.");
      await load();
    });
  }

  function transitionSelected() {
    if (!selectedTaskId) return Promise.resolve();
    return guarded(async () => {
      await apiPost(`/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(selectedTaskId)}/actions/transition`, { actorId, status: nextStatus });
      toast(`태스크 상태를 ${nextStatus}로 변경했습니다.`);
      await load();
    });
  }

  function readNotification(id: string) {
    return guarded(async () => { await apiPost(`/api/projects/${encodeURIComponent(projectId)}/notifications/${encodeURIComponent(id)}/read`, { actorId }); await load(); });
  }
  function saveValidatorProfile(){return guarded(async()=>{await apiPost(`/api/projects/${encodeURIComponent(projectId)}/validator-profile`,{actorId,checks:validatorChecks});toast("검증 프로필을 저장했습니다.");await load();});}
  function repositoryRead(){return guarded(async()=>{const result=await apiPost<{path:string;content:string}>(`/api/projects/${encodeURIComponent(projectId)}/repository/read`,{actorId,path:repositoryInput});setRepositoryOutput(`${result.path}\n\n${result.content}`);});}
  function repositorySearch(){return guarded(async()=>{const result=await apiPost<Array<{path:string;line:number;text:string}>>(`/api/projects/${encodeURIComponent(projectId)}/repository/search`,{actorId,query:repositoryInput});setRepositoryOutput(result.map(x=>`${x.path}:${x.line} ${x.text}`).join("\n")||"검색 결과 없음");});}

  const tasksByStatus = new Map<BoardStatus, TaskSnapshot[]>(BOARD_STATUSES.map(status => [status, []]));
  for (const task of snapshot?.tasks ?? []) tasksByStatus.get(task.status)?.push(task);
  const selectedTask = snapshot?.tasks.find(t => t.id === selectedTaskId) ?? null;

  return (
    <div>
      <PageHeader title="프로젝트 워룸 · Project War Room" description="프로젝트·마일스톤·태스크 보드를 조회하고 담당을 배정합니다." />

      <div className="card">
        <div className="row">
          <label className="inline">회사
            <select value={companyId} onChange={e => void selectCompany(e.target.value)}>
              <option value="">회사를 선택하세요</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="inline">프로젝트
            <select aria-label="Project ID" value={projectId} disabled={!companyId || projectOptions.length === 0} onChange={e => { setProjectId(e.target.value); if (e.target.value) void load(e.target.value); }}>
              <option value="">프로젝트를 선택하세요</option>
              {projectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <button disabled={busy || !projectId} onClick={() => void load()}>새로고침</button>
          <ConfirmButton label="만료 작업 복구" confirmLabel="복구 실행 — 다시 눌러 확정" disabled={busy || !projectId} onConfirm={() => void recover()} />
          {params.get("companyId") && <Link className="button-link" to={`/company?companyId=${encodeURIComponent(params.get("companyId")!)}`}>회사로 돌아가기</Link>}
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {companyId && <details className="goal-create"><summary>+ 새 프로젝트 만들기</summary><div className="goal-form">
        <label>프로젝트명 (필수)<input value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="예: 온보딩 자동화"/></label>
        <label>저장소 경로<input value={newProjectRepoPath} onChange={e=>setNewProjectRepoPath(e.target.value)} placeholder="."/></label>
        <div className="goal-form-row">
          <label>예산<input type="number" min="0" value={newProjectBudget} onChange={e=>setNewProjectBudget(e.target.value)}/></label>
          <label>부서 (필수)<select value={newProjectDepartmentId} onChange={e=>setNewProjectDepartmentId(e.target.value)} disabled={!departments.length}>{departments.length?departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>):<option value="">부서를 먼저 만드세요</option>}</select></label>
        </div>
        <button disabled={projectAddBusy||!newProjectName.trim()||!newProjectDepartmentId} onClick={()=>void createNewProject()}>{projectAddBusy?"만드는 중…":"프로젝트 만들기"}</button>
        {!projectAddBusy&&(!newProjectName.trim()||!newProjectDepartmentId)&&<p className="field-help">{!newProjectName.trim()?"프로젝트명을 입력하세요.":"연결할 부서가 없습니다. 회사 홈에서 부서를 먼저 만드세요."}</p>}
      </div></details>}

      {!snapshot&&!error&&<div className="empty-panel"><strong>회사와 프로젝트를 선택하세요.</strong><span>접근 가능한 프로젝트만 표시되며, 프로젝트가 하나면 자동으로 열립니다.</span></div>}

      {snapshot && (
        <>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            {snapshot.project.name} · {snapshot.progress.total>0&&snapshot.progress.done===snapshot.progress.total?"업무 완료 · 운영 중":snapshot.project.status==="active"?"진행 중":"보관됨"} · 예산 {snapshot.project.spent.toFixed(2)}/{snapshot.project.budgetLimit} · 진행 {snapshot.progress.done}/{snapshot.progress.total}
          </p>
          {snapshot.milestones.length > 0 && (
            <div className="badge-row">
              {snapshot.milestones.map(m => <span key={m.id} className="badge">{m.title}: {m.progress.done}/{m.progress.total} ({m.status})</span>)}
            </div>
          )}

          <details className="goal-create"><summary>+ 새 Task 만들기</summary><div className="goal-form">
            <label>제목 (필수)<input value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} placeholder="예: 온보딩 이메일 자동 발송 구현"/></label>
            <label>완료 기준 (필수, 한 줄에 하나씩)<textarea value={newTaskCriteria} onChange={e=>setNewTaskCriteria(e.target.value)} rows={3} placeholder="한 줄에 하나씩 입력"/></label>
            <label>예산<input type="number" min="0" value={newTaskBudget} onChange={e=>setNewTaskBudget(e.target.value)}/></label>
            <button disabled={taskAddBusy||!newTaskTitle.trim()||!newTaskCriteria.trim()} onClick={()=>void createNewTask()}>{taskAddBusy?"만드는 중…":"Task 만들기"}</button>
            {!taskAddBusy&&(!newTaskTitle.trim()||!newTaskCriteria.trim())&&<p className="field-help">{!newTaskTitle.trim()?"제목을 입력하세요.":"완료 기준을 한 줄 이상 입력하세요."}</p>}
          </div></details>

          <section className="project-board-section">
          <div className="section-heading"><div><h2>업무 보드</h2><p>태스크를 선택하면 아래에서 담당자와 상태를 변경할 수 있습니다.</p></div><span className="mobile-scroll-cue">좌우로 밀어 상태 보기 →</span></div>
          <div className="board">
            {BOARD_STATUSES.map(status => (
              <div key={status} className="board-column">
                <h3>{BOARD_LABEL[status]} <span>{tasksByStatus.get(status)?.length ?? 0}</span></h3>
                {(tasksByStatus.get(status) ?? []).map(task => (
                  <button type="button"
                    key={task.id}
                    className={`task-chip${task.id === selectedTaskId ? " selected" : ""}`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    {task.title}
                    <div className="meta">
                      우선순위 {task.priority}{task.leaseOwner ? ` · lease: ${task.leaseOwner}` : ""}
                      {task.assignments.length > 0 ? ` · ${task.assignments.map(a => a.principalId).join(", ")}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
          </section>

          {selectedTask ? <div className="card task-editor" style={{ marginTop: 12 }}>
            <h2>실행 담당 배정 · 상태 변경 — {selectedTask.title}</h2>
            <div className="row">
              <label className="inline">담당자 ID
                <input value={principalId} onChange={e => setPrincipalId(e.target.value)} />
              </label>
              <label className="inline">유형
                <select value={kind} onChange={e => setKind(e.target.value as AssigneeKind)}>
                  <option value="agent">에이전트</option>
                  <option value="human">사람</option>
                </select>
              </label>
              <label className="inline">역할
                <select value={responsibility} onChange={e => setResponsibility(e.target.value as ProjectResponsibility)}>
                  <option value="owner">책임자</option>
                  <option value="executor">실행 담당</option>
                  <option value="reviewer">검토 담당</option>
                </select>
              </label>
              <button disabled={busy || !selectedTaskId} onClick={() => void assignSelected()}>배정</button>
            </div>
            <div className="row">
              <label className="inline">다음 상태
                <select value={nextStatus} onChange={e => setNextStatus(e.target.value as BoardStatus)}>
                  {BOARD_STATUSES.map(status => <option key={status} value={status}>{BOARD_LABEL[status]}</option>)}
                </select>
              </label>
              <button disabled={busy || !selectedTaskId} onClick={() => void transitionSelected()}>상태 변경</button>
            </div>
            <div className="row">
              {selectedTask.runId
                ? <Link className="button-link" to={`/execution?runId=${encodeURIComponent(selectedTask.runId)}`}>연결된 Run 보기 →</Link>
                : selectedTask.assignments.length > 0
                  ? <button onClick={startRunForTask}>이 Task로 Run 시작 →</button>
                  : <p className="field-help">Run을 시작하려면 먼저 담당자를 배정하세요.</p>}
            </div>
          </div> : <div className="task-selection-prompt"><strong>편집할 태스크를 선택하세요.</strong><span>업무 보드의 태스크를 선택하면 담당자 배정과 상태 변경 도구가 열립니다.</span></div>}

          <details className="project-advanced card">
            <summary>프로젝트 도구·검증 설정</summary>
            <div className="advanced-section"><h2>검증 항목</h2><p>Run 완료 전에 자동으로 확인할 항목입니다.</p><div className="validator-options">{VALIDATOR_CHECKS.map(check=><label className="validator-option" key={check}><input type="checkbox" checked={validatorChecks.includes(check)} onChange={event=>setValidatorChecks(current=>event.target.checked?[...current,check]:current.filter(x=>x!==check))}/><span>{CHECK_LABEL[check]}</span></label>)}</div><button disabled={busy||!validatorChecks.length} onClick={()=>void saveValidatorProfile()}>검증 항목 저장</button></div>
            <div className="advanced-section"><h2>저장소 읽기·검색</h2><div className="row"><label className="inline">경로 또는 검색어<input value={repositoryInput} onChange={event=>setRepositoryInput(event.target.value)}/></label><button disabled={busy||!repositoryInput} onClick={()=>void repositoryRead()}>파일 읽기</button><button className="secondary" disabled={busy||!repositoryInput} onClick={()=>void repositorySearch()}>내용 검색</button></div>{repositoryOutput&&<pre style={{maxHeight:280,overflow:"auto",whiteSpace:"pre-wrap"}}>{repositoryOutput}</pre>}</div>
          </details>

          {snapshot.notifications.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h2>알림</h2>
              {snapshot.notifications.map(n => (
                <div key={n.id} className={`notification-row${n.readAt ? "" : " unread"}`}>
                  <span>{notificationLabel(n.type)} · {new Date(n.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  {!n.readAt && <button className="secondary" onClick={() => void readNotification(n.id)}>읽음</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
