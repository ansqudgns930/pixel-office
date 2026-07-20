import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import { useToast } from "../components/ToastContext.tsx";
import { safeUserText } from "../format.ts";

type Stage =
  | "discovery"
  | "delivery-planning"
  | "build"
  | "release"
  | "operate";
type Mode = "decision" | "technical" | "evidence";
interface Evidence {
  id: string;
  kind: string;
  label: string;
  status: "available" | "stale";
  url: string | null;
}
type ReadinessStatus = "passed" | "failed" | "needs-evidence" | "not-applicable";
interface BuildEvidence {
  ready: boolean;
  snapshotHash: string;
  missing: string[];
  backend: {
    ready: boolean;
    items: Array<{
      key: string;
      label: string;
      applicability: "required" | "not-detected";
      status: ReadinessStatus;
      summary: string;
      evidenceIds: string[];
    }>;
  };
  frontend: {
    applicability: "web" | "non-web";
    status: "captured" | "failed" | "exempted";
    previewUrl: string | null;
    expectedVersion: string;
    observedVersion: string | null;
    scenario: string;
    manual: string[];
    missingStates: string[];
    failure: string | null;
    exemptionReason: string | null;
    captures: Array<{
      state: string;
      viewport: "desktop" | "mobile";
      url: string;
      status: "captured" | "failed" | "exempted";
      dataUrl: string | null;
      width: number;
      height: number;
      capturedAt: string | null;
      failure: string | null;
    }>;
  };
}
interface Packet {
  version: 2;
  stage: Stage;
  stageLabel: string;
  goal: {
    id: string;
    title: string;
    description: string;
    completionCriteria: string[];
  };
  summary: string;
  sections: Array<{ id: string; title: string; items: string[] }>;
  deterministicFacts: Array<{ label: string; value: string; source: string }>;
  teamInterpretation: {
    decisions: string[];
    risks: string[];
    openItems: string[];
  };
  evidence: Evidence[];
  buildEvidence: BuildEvidence | null;
  completeness: {
    required: string[];
    present: string[];
    missing: string[];
    staleEvidenceIds: string[];
    ready: boolean;
  };
  snapshotHash: string;
  createdAt: string;
}
interface QueueItem {
  goalTitle: string;
  stage: Stage;
  stageLabel: string;
  urgency: "high" | "normal";
  requestedAt: string;
  review: {
    id: string;
    goalId: string;
    meetingId: string;
    runId: string | null;
    status: "pending" | "on-hold" | "approved" | "revision-requested";
    snapshotHash: string;
    packet: Packet;
  };
}
interface Company {
  id: string;
  name: string;
  role: string;
  status: string;
}
interface CompanyAlert {
  key: string;
  kind: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  url: string;
  createdAt: string;
  readAt: string | null;
}

const readinessLabel: Record<ReadinessStatus, string> = {
  passed: "통과",
  failed: "실패",
  "needs-evidence": "근거 필요",
  "not-applicable": "해당 없음",
};
const stateLabel: Record<string, string> = {
  primary: "핵심 화면",
  loading: "로딩",
  empty: "빈 상태",
  error: "오류",
  permission: "권한 제한",
};

function BuildDecisionSummary({ evidence }: { evidence: BuildEvidence | null }) {
  if (!evidence)
    return (
      <section className="build-decision-summary blocked">
        <div>
          <span>개발 검증</span>
          <h3>자동 검증 패킷이 아직 생성되지 않았습니다.</h3>
          <p>백엔드 준비상태와 실제 화면 증거가 생성되어야 승인할 수 있습니다.</p>
        </div>
      </section>
    );
  const passed = evidence.backend.items.filter((item) => item.status === "passed").length,
    required = evidence.backend.items.filter((item) => item.applicability === "required").length,
    primary = evidence.frontend.captures.find(
      (capture) => capture.state === "primary" && capture.viewport === "desktop" && capture.dataUrl,
    );
  return (
    <section className={`build-decision-summary ${evidence.ready ? "ready" : "blocked"}`}>
      <div>
        <span>개발 검증 요약</span>
        <h3>{evidence.ready ? "백엔드와 화면 증거가 승인 기준을 충족했습니다." : "승인 전에 보완할 개발 근거가 있습니다."}</h3>
        <dl>
          <div><dt>백엔드</dt><dd>{passed}/{required} 통과</dd></div>
          <div><dt>화면</dt><dd>{evidence.frontend.status === "captured" ? `${evidence.frontend.captures.filter((item) => item.status === "captured").length}장 확인` : evidence.frontend.status === "exempted" ? "면제됨" : "캡처 실패"}</dd></div>
          <div><dt>미충족</dt><dd>{evidence.missing.length}건</dd></div>
        </dl>
        {evidence.frontend.previewUrl && <a href={evidence.frontend.previewUrl} target="_blank" rel="noreferrer">검증한 프리뷰 열기 →</a>}
      </div>
      {primary?.dataUrl && <img src={primary.dataUrl} alt="검증된 핵심 화면 미리보기" />}
    </section>
  );
}

function BackendReadiness({ evidence }: { evidence: BuildEvidence | null }) {
  return (
    <section className="backend-readiness">
      <header><div><span>DETERMINISTIC CHECK</span><h3>백엔드 준비상태</h3></div><b className={evidence?.backend.ready ? "ready" : "blocked"}>{evidence?.backend.ready ? "통과" : "보완 필요"}</b></header>
      {!evidence ? <p className="evidence-warning">수집된 백엔드 검증 결과가 없습니다.</p> : <div className="readiness-table-wrap"><table><thead><tr><th scope="col">항목</th><th scope="col">판정</th><th scope="col">적용</th><th scope="col">판정 근거</th></tr></thead><tbody>{evidence.backend.items.map((item) => <tr key={item.key}><th scope="row">{item.label}</th><td><span className={`readiness-status status-${item.status}`}>{readinessLabel[item.status]}</span></td><td>{item.applicability === "required" ? "필수" : "변경 감지 없음"}</td><td>{safeUserText(item.summary)}{item.evidenceIds.length > 0 && <small>{item.evidenceIds.join(" · ")}</small>}</td></tr>)}</tbody></table></div>}
    </section>
  );
}

function FrontendEvidence({ evidence }: { evidence: BuildEvidence | null }) {
  const frontend = evidence?.frontend;
  return (
    <section className="frontend-evidence">
      <header><div><span>VISUAL PROOF</span><h3>실제 화면과 확인 매뉴얼</h3></div><b className={frontend?.status === "captured" || frontend?.status === "exempted" ? "ready" : "blocked"}>{frontend?.status === "captured" ? "캡처 완료" : frontend?.status === "exempted" ? "명시적 면제" : "캡처 필요"}</b></header>
      {!frontend ? <p className="evidence-warning">화면 검증 manifest가 없습니다.</p> : <>
        <div className="frontend-proof-meta"><div><span>검토 시나리오</span><strong>{safeUserText(frontend.scenario)}</strong></div><div><span>빌드 버전</span><strong className={frontend.observedVersion === frontend.expectedVersion ? "matched" : "mismatched"}>{frontend.observedVersion === frontend.expectedVersion ? "일치" : "불일치 또는 미확인"}</strong><small>expected {frontend.expectedVersion}<br />observed {frontend.observedVersion ?? "없음"}</small></div>{frontend.previewUrl && <a href={frontend.previewUrl} target="_blank" rel="noreferrer">프리뷰 열기 →</a>}</div>
        {frontend.failure && <p className="evidence-warning" role="status">{safeUserText(frontend.failure)}</p>}
        {frontend.exemptionReason && <p className="evidence-exemption">면제 사유: {safeUserText(frontend.exemptionReason)}</p>}
        <div className="frontend-manual"><h4>오너 확인 순서</h4><ol>{frontend.manual.map((step, index) => <li key={`${index}-${step}`}>{safeUserText(step)}</li>)}</ol></div>
        {frontend.captures.length > 0 && <div className="capture-gallery">{frontend.captures.map((capture, index) => <figure key={`${capture.state}-${capture.viewport}-${index}`} className={capture.status !== "captured" ? "failed" : ""}>{capture.dataUrl ? <a href={capture.dataUrl} target="_blank" rel="noreferrer"><img src={capture.dataUrl} alt={`${stateLabel[capture.state] ?? capture.state} ${capture.viewport === "desktop" ? "데스크톱" : "모바일"} 화면`} /></a> : <div className="capture-missing">캡처 실패</div>}<figcaption><strong>{stateLabel[capture.state] ?? capture.state}</strong><span>{capture.viewport === "desktop" ? "데스크톱" : "모바일"} · {capture.width}×{capture.height}</span>{capture.failure && <small>{safeUserText(capture.failure)}</small>}</figcaption></figure>)}</div>}
        {frontend.missingStates.length > 0 && <p className="evidence-warning">누락 상태: {frontend.missingStates.map((state) => stateLabel[state] ?? state).join(", ")}</p>}
      </>}
    </section>
  );
}

export default function OwnerReviewsPage() {
  const { actorId } = useSession(),
    toast = useToast(),
    [params, setParams] = useSearchParams(),
    [companies, setCompanies] = useState<Company[]>([]),
    [companyId, setCompanyId] = useState(
      () =>
        params.get("companyId") ??
        localStorage.getItem("agent-company-os.lastCompany") ??
        "",
    ),
    [items, setItems] = useState<QueueItem[]>([]),
    [alerts, setAlerts] = useState<CompanyAlert[]>([]),
    [selectedId, setSelectedId] = useState(() => params.get("reviewId") ?? ""),
    [mode, setMode] = useState<Mode>("decision"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [deployment, setDeployment] = useState<
      "" | "skip" | "preview" | "production"
    >(""),
    [firebaseProject, setFirebaseProject] = useState(""),
    [firebaseChannel, setFirebaseChannel] = useState("goal-preview"),
    [confirmation, setConfirmation] = useState("");
  const selected = useMemo(
    () => items.find((x) => x.review.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );
  async function load(id = companyId, reviewId = selectedId) {
    setBusy(true);
    setError(null);
    try {
      const [queue, nextAlerts] = await Promise.all([
        apiGet<QueueItem[]>(`/api/companies/${encodeURIComponent(id)}/owner-reviews?actor=${encodeURIComponent(actorId)}&includeResolved=true`),
        apiGet<CompanyAlert[]>(`/api/companies/${encodeURIComponent(id)}/alerts?actor=${encodeURIComponent(actorId)}`).catch(() => []),
      ]);
      setItems(queue);
      setAlerts(nextAlerts);
      const next = queue.some((x) => x.review.id === reviewId)
        ? reviewId
        : (queue[0]?.review.id ?? "");
      setSelectedId(next);
      setCompanyId(id);
      localStorage.setItem("agent-company-os.lastCompany", id);
      setParams(next ? { companyId: id, reviewId: next } : { companyId: id }, {
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void apiGet<Company[]>(
      `/api/companies?actor=${encodeURIComponent(actorId)}`,
    )
      .then((list) => {
        const active = list.filter((x) => x.status === "active");
        setCompanies(active);
        const id = active.some((x) => x.id === companyId)
          ? companyId
          : (active[0]?.id ?? "");
        if (id) void load(id, params.get("reviewId") ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  function select(id: string) {
    setSelectedId(id);
    setReason("");
    setDeployment("");
    setParams({ companyId, reviewId: id }, { replace: true });
  }
  async function decide(
    decision: "approved" | "revision-requested" | "on-hold" | "resume",
  ) {
    if (!selected) return;
    if (!["approved", "resume"].includes(decision) && !reason.trim()) {
      setError("수정 또는 보류 사유를 입력해 주세요.");
      return;
    }
    let release: unknown;
    if (decision === "approved" && selected.stage === "release") {
      if (!deployment) {
        setError("배포 여부를 선택해 주세요.");
        return;
      }
      if (deployment !== "skip" && !firebaseProject.trim()) {
        setError("Firebase 프로젝트 ID를 입력해 주세요.");
        return;
      }
      if (
        deployment === "production" &&
        confirmation !== `DEPLOY ${firebaseProject.trim()}`
      ) {
        setError("운영 배포 확인 문구가 일치하지 않습니다.");
        return;
      }
      release = {
        action: deployment === "skip" ? "skip" : "deploy",
        environment: deployment === "production" ? "production" : "preview",
        targetProjectId: deployment === "skip" ? null : firebaseProject.trim(),
        targetChannel: deployment === "preview" ? firebaseChannel.trim() : null,
        expectedSnapshotHash: selected.review.snapshotHash,
        confirmation: deployment === "production" ? confirmation : undefined,
      };
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        `/api/companies/${encodeURIComponent(companyId)}/goals/${encodeURIComponent(selected.review.goalId)}/delivery-process/owner-review`,
        {
          actorId,
          decision,
          reason: reason.trim() || undefined,
          deployment: release,
        },
      );
      toast(
        decision === "approved"
          ? "검토 항목을 승인하고 다음 단계를 시작했습니다."
          : decision === "resume"
            ? "검토를 다시 시작했습니다."
            : decision === "on-hold"
              ? "검토를 보류했습니다."
              : "관련 단계에 수정 요청을 전달했습니다.",
      );
      setReason("");
      await load(companyId, "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const packet = selected?.review.packet;
  const activeAlerts = alerts.filter((alert) => !alert.readAt);
  const criticalSignals = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const decisionSignals = activeAlerts.filter((alert) => ["blocked", "validation", "meeting", "approval"].includes(alert.kind));
  return (
    <div className="owner-center-page">
      <PageHeader
        title="결정 필요"
        description="AI 회사가 멈춘 이유, 필요한 판단, 승인·수정 요청·보류 액션을 한곳에서 처리합니다."
      />
      <section className="owner-center-toolbar card">
        <label>
          회사
          <select
            value={companyId}
            onChange={(e) => void load(e.target.value, "")}
          >
            {companies.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.role}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={busy || !companyId}
          onClick={() => void load()}
        >
          새로고침
        </button>
        <Link
          className="button-link"
          to={`/goals?companyId=${encodeURIComponent(companyId)}${selected ? `&goalId=${encodeURIComponent(selected.review.goalId)}` : ""}`}
        >
          맡긴 일
        </Link>
        <Link className="button-link" to={`/company?companyId=${encodeURIComponent(companyId)}`}>회사 홈</Link>
        <Link className="button-link" to={`/meetings?companyId=${encodeURIComponent(companyId)}`}>회의</Link>
      </section>
      <section className="card" aria-label="결정 필요 요약">
        <div className="stat-grid">
          <div className="stat-tile warning"><div className="label">지금 결정 필요</div><div className="value">{items.filter(x => x.review.status === "pending").length}</div></div>
          <div className="stat-tile"><div className="label">보류 중</div><div className="value">{items.filter(x => x.review.status === "on-hold").length}</div></div>
          <div className="stat-tile danger"><div className="label">고위험</div><div className="value">{items.filter(x => (x.review.status === "pending" || x.review.status === "on-hold") && x.urgency === "high").length + criticalSignals}</div></div>
          <div className="stat-tile"><div className="label">추가 신호</div><div className="value">{activeAlerts.length}</div></div>
        </div>
        <div className="measurement-guidance" style={{ marginTop: 12 }}><strong>운영 원칙</strong><span>AI 회사는 권한·위험·불확실성·검증 부족이 있을 때만 멈춥니다. 여기서는 필요한 판단만 처리하고, 나머지는 자동 진행되게 둡니다.</span></div>
      </section>
      {activeAlerts.length > 0 && (
        <section className="card" aria-label="결정 필요 통합 신호">
          <div className="section-heading"><div><span className="eyebrow">UNIFIED SIGNALS</span><h2>Owner Review 밖의 결정·주의 신호</h2><p>회의 결정 대기, 검증 실패, blocked task, 승인 대기, 예산 위험도 이곳에서 함께 확인합니다.</p></div><span className="badge">{decisionSignals.length} actionable</span></div>
          <div className="activity-list">
            {activeAlerts.slice(0, 8).map((alert) => (
              <article key={alert.key} className={`activity-card severity-${alert.severity}`}>
                <div><strong>{safeUserText(alert.title)}</strong><p>{safeUserText(alert.description)}</p><small>{alert.kind} · {alert.severity} · {new Date(alert.createdAt).toLocaleString()}</small></div>
                <Link className="button-link" to={alert.url}>관련 화면 열기</Link>
              </article>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="owner-center-layout">
        <aside
          className="owner-review-queue"
          aria-label="결정 대기와 검토 이력"
        >
          <header>
            <div>
              <span className="eyebrow">DECISION INBOX</span>
              <h2>
                지금 결정할 일{" "}
                {
                  items.filter(
                    (x) =>
                      x.review.status === "pending" ||
                      x.review.status === "on-hold",
                  ).length
                }
              </h2>
              <small>전체 이력 {items.length}</small>
            </div>
            {items.some(
              (x) =>
                (x.review.status === "pending" ||
                  x.review.status === "on-hold") &&
                x.urgency === "high",
            ) && <span className="review-risk-count">주의</span>}
          </header>
          {items.map((item) => (
            <button
              key={item.review.id}
              className={
                selected?.review.id === item.review.id ? "selected" : ""
              }
              onClick={() => select(item.review.id)}
            >
              <span className={`review-stage review-${item.stage}`}>
                {item.stageLabel}
              </span>
              <strong>{safeUserText(item.goalTitle)}</strong>
              <small>
                {item.review.status === "on-hold"
                  ? "보류됨"
                  : item.review.status === "pending"
                    ? "결정 필요"
                    : item.review.status === "approved"
                      ? "승인 완료"
                      : "수정 요청됨"}{" "}
                · {new Date(item.requestedAt).toLocaleString("ko-KR")}
              </small>
              {(item.review.status === "pending" ||
                item.review.status === "on-hold") &&
                item.urgency === "high" && <b>위험·미해결 항목 있음</b>}
            </button>
          ))}
          {!items.length && (
            <div className="owner-center-empty">
              <strong>지금 결정할 일이 없습니다.</strong>
              <span>AI 회사가 자동으로 진행 중입니다. 사람 판단이 필요한 순간에만 여기에 표시됩니다.</span>
            </div>
          )}
        </aside>
        <main className="owner-review-detail">
          {!selected || !packet ? (
            <div className="owner-center-empty large">
              <strong>결정할 항목을 선택하세요.</strong>
              <span>AI 회사가 멈춘 이유와 필요한 사용자 판단을 확인할 수 있습니다.</span>
            </div>
          ) : (
            <>
              <header className="owner-packet-header">
                <div>
                  <span className="eyebrow">
                    REVIEW PACKET V{packet.version} · {packet.stageLabel}
                  </span>
                  <h2>{safeUserText(packet.goal.title)}</h2>
                  <p>{safeUserText(packet.summary)}</p>
                </div>
                <span
                  className={`packet-readiness ${packet.completeness.ready ? "ready" : "blocked"}`}
                >
                  {packet.completeness.ready
                    ? "승인 준비 완료"
                    : "근거 보완 필요"}
                </span>
              </header>
              <nav
                className="section-tabs owner-review-modes"
                aria-label="검토 정보 수준"
              >
                {(["decision", "technical", "evidence"] as Mode[]).map((x) => (
                  <button
                    key={x}
                    className={mode === x ? "active" : ""}
                    aria-pressed={mode === x}
                    onClick={() => setMode(x)}
                  >
                    {x === "decision"
                      ? "결정 중심"
                      : x === "technical"
                        ? "기술 검토"
                        : "전체 근거"}
                  </button>
                ))}
              </nav>
              {mode === "decision" && (
                <div className="owner-packet-content">
                  <section className="owner-summary-block">
                    <span>사용자 판단 요청</span>
                    <h3>
                      {packet.stageLabel} 결과를 승인하고 AI 회사가 다음 단계로
                      계속 진행하게 할까요?
                    </h3>
                    <p>
                      {safeUserText(
                        packet.goal.description || "목표 설명이 없습니다.",
                      )}
                    </p>
                  </section>
                  {packet.stage === "build" && (
                    <BuildDecisionSummary evidence={packet.buildEvidence} />
                  )}
                  {packet.sections.map((section) => (
                    <section className="packet-section" key={section.id}>
                      <h3>{section.title}</h3>
                      {section.items.length ? (
                        <ul>
                          {section.items.map((x, i) => (
                            <li key={`${i}-${x}`}>{safeUserText(x)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">기록된 항목이 없습니다.</p>
                      )}
                    </section>
                  ))}
                </div>
              )}
              {mode === "technical" && (
                <div className="owner-packet-content">
                  {packet.stage === "build" && (
                    <BackendReadiness evidence={packet.buildEvidence} />
                  )}
                  <section className="packet-facts">
                    <h3>확인된 사실</h3>
                    <dl>
                      {packet.deterministicFacts.map((x) => (
                        <div key={x.label}>
                          <dt>{x.label}</dt>
                          <dd>
                            {safeUserText(x.value)}
                            <small>{x.source}</small>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="packet-section">
                    <h3>팀의 위험 해석</h3>
                    {packet.teamInterpretation.risks.length ? (
                      <ul>
                        {packet.teamInterpretation.risks.map((x) => (
                          <li key={x}>{safeUserText(x)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="packet-positive">보고된 위험이 없습니다.</p>
                    )}
                    <h3>미해결 질문</h3>
                    {packet.teamInterpretation.openItems.length ? (
                      <ul>
                        {packet.teamInterpretation.openItems.map((x) => (
                          <li key={x}>{safeUserText(x)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="packet-positive">미해결 질문이 없습니다.</p>
                    )}
                  </section>
                </div>
              )}
              {mode === "evidence" && (
                <div className="owner-packet-content">
                  {packet.stage === "build" && (
                    <FrontendEvidence evidence={packet.buildEvidence} />
                  )}
                  <section className="packet-completeness">
                    <h3>패킷 완전성</h3>
                    <div>
                      <span>필수 {packet.completeness.required.length}</span>
                      <span>확인 {packet.completeness.present.length}</span>
                      <span>누락 {packet.completeness.missing.length}</span>
                      <span>
                        오래된 근거{" "}
                        {packet.completeness.staleEvidenceIds.length}
                      </span>
                    </div>
                    {!packet.completeness.ready && (
                      <p>
                        누락: {packet.completeness.missing.join(", ") || "없음"}{" "}
                        · stale:{" "}
                        {packet.completeness.staleEvidenceIds.join(", ") ||
                          "없음"}
                      </p>
                    )}
                  </section>
                  <section className="packet-evidence-list">
                    <h3>근거 원문</h3>
                    {packet.evidence.map((x) => (
                      <article
                        key={x.id}
                        className={x.status === "stale" ? "stale" : ""}
                      >
                        <div>
                          <strong>{safeUserText(x.label)}</strong>
                          <small>
                            {x.kind} · {x.id}
                          </small>
                        </div>
                        <span>
                          {x.status === "stale" ? "재검증 필요" : "확인 가능"}
                        </span>
                        {x.url && <Link to={x.url}>열기 →</Link>}
                      </article>
                    ))}
                  </section>
                  <small className="packet-hash">
                    snapshot {packet.snapshotHash}
                  </small>
                </div>
              )}
              {selected.stage === "release" && (
                <fieldset className="owner-release-choice">
                  <legend>배포 결정</legend>
                  <label>
                    <input
                      type="radio"
                      checked={deployment === "skip"}
                      onChange={() => setDeployment("skip")}
                    />
                    배포하지 않고 완료 단계로 진행
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={deployment === "preview"}
                      onChange={() => setDeployment("preview")}
                    />
                    Firebase Preview 배포
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={deployment === "production"}
                      onChange={() => setDeployment("production")}
                    />
                    Firebase Production 배포
                  </label>
                  {deployment !== "" && deployment !== "skip" && (
                    <>
                      <label>
                        Firebase 프로젝트 ID
                        <input
                          value={firebaseProject}
                          onChange={(e) => setFirebaseProject(e.target.value)}
                        />
                      </label>
                      {deployment === "preview" && (
                        <label>
                          Preview 채널
                          <input
                            value={firebaseChannel}
                            onChange={(e) => setFirebaseChannel(e.target.value)}
                          />
                        </label>
                      )}
                      {deployment === "production" && (
                        <label>
                          확인 문구{" "}
                          <small>
                            DEPLOY {firebaseProject || "프로젝트-ID"}
                          </small>
                          <input
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                          />
                        </label>
                      )}
                    </>
                  )}
                </fieldset>
              )}
              {selected.review.status === "pending" ||
              selected.review.status === "on-hold" ? (
                <section
                  className={`owner-decision-panel ${mode === "decision" ? "" : "reviewing-evidence"}`}
                >
                  <label>
수정 요청 또는 보류 사유
                    <textarea
                      rows={4}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="무엇을 바꿔야 하는지, 어떤 조건이 충족되어야 다시 진행할 수 있는지 적어 주세요."
                    />
                  </label>
                  <div>
                    <button
                      className="secondary"
                      disabled={busy || !reason.trim()}
                      onClick={() => void decide("on-hold")}
                    >
                      잠시 보류
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !reason.trim()}
                      onClick={() => void decide("revision-requested")}
                    >
                      수정해서 다시 가져오기
                    </button>
                    {selected.review.status === "on-hold" ? (
                      <button
                        disabled={busy}
                        onClick={() => void decide("resume")}
                      >
                        다시 결정하기
                      </button>
                    ) : (
                      <button
                        disabled={
                          busy ||
                          !packet.completeness.ready ||
                          (selected.stage === "release" && !deployment)
                        }
                        title={
                          !packet.completeness.ready
                            ? "필수 근거를 먼저 보완해야 합니다."
                            : undefined
                        }
                        onClick={() => void decide("approved")}
                      >
                        {selected.stage === "release"
                          ? "배포까지 승인"
                          : "승인하고 계속 진행"}
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="owner-review-history-note">
                  <strong>
                    {selected.review.status === "approved"
                      ? "승인 완료된 검토 snapshot"
                      : "수정 요청으로 종료된 검토 snapshot"}
                  </strong>
                  <span>
                    당시 판단 근거는 변경되지 않으며 전체 근거에서 다시 확인할
                    수 있습니다.
                  </span>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
