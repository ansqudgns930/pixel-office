import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost } from "../api.ts";
import { useToast } from "../components/ToastContext.tsx";
import { hiddenCompanyCount, userFacingCompanyOptions } from "../companyOptions.ts";
import type { AgentBackendType, AgentBinding, CompanyRecord, ResolvedAgentBinding } from "../types.ts";

type BindingTarget = "company" | "planner" | "worker" | "reviewer";
type RoutingRole = "planner" | "worker" | "reviewer";
type ModelRoutingTier = "high-reasoning" | "high-verification" | "coding" | "fast-general" | "cheap-draft" | "fallback";

interface EngineConfig {
  target: BindingTarget;
  label: string;
  description: string;
  backend: AgentBackendType;
  model: string;
  baseUrl: string;
  cliPath: string;
  modelOptions: string[];
  loadingModels: boolean;
}

interface VerificationResult {
  status: "pass" | "fail";
  goalId: string;
  runId: string;
  snapshots: ResolvedAgentBinding[];
  failures: string[];
}

const BACKENDS: AgentBackendType[] = ["openai-compatible", "claude-cli", "codex-cli", "standalone", "legacy-nvidia"];

const DEFAULT_CONFIGS: EngineConfig[] = [
  { target: "company", label: "회사 기본 AI 엔진", description: "역할별 설정이 없을 때 쓰는 기본값입니다.", backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b", baseUrl: "https://integrate.api.nvidia.com/v1", cliPath: "", modelOptions: [], loadingModels: false },
  { target: "planner", label: "Planner / PM", description: "업무 해석, 계획 제안, 진행 조율에 사용합니다.", backend: "claude-cli", model: "sonnet-5", baseUrl: "", cliPath: "", modelOptions: [], loadingModels: false },
  { target: "worker", label: "Worker / Developer", description: "코드 작성, 수정, 실행 등 실제 작업에 사용합니다.", backend: "codex-cli", model: "gpt-5", baseUrl: "", cliPath: "", modelOptions: [], loadingModels: false },
  { target: "reviewer", label: "Reviewer / QA", description: "검증, 위험 확인, 완료 조건 검토에 사용합니다.", backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b", baseUrl: "https://integrate.api.nvidia.com/v1", cliPath: "", modelOptions: [], loadingModels: false },
];

function targetLabel(target: BindingTarget): string {
  return target === "company" ? "company" : `role:${target}`;
}

function needsBaseUrl(backend: AgentBackendType): boolean {
  return backend === "openai-compatible" || backend === "legacy-nvidia";
}

function needsCliPath(backend: AgentBackendType): boolean {
  return backend === "claude-cli" || backend === "codex-cli";
}

function modelPlaceholder(backend: AgentBackendType): string {
  if (backend === "openai-compatible") return "nvidia/nemotron-3-ultra-550b-a55b";
  if (backend === "claude-cli") return "sonnet-5";
  if (backend === "codex-cli") return "gpt-5";
  return "phase0-model";
}

function isModelRoutingTier(value: string | null): value is ModelRoutingTier {
  return value === "high-reasoning" || value === "high-verification" || value === "coding" || value === "fast-general" || value === "cheap-draft" || value === "fallback";
}

function tierLabel(tier: ModelRoutingTier): string {
  if (tier === "high-reasoning") return "고사양 reasoning";
  if (tier === "high-verification") return "고사양 verification";
  if (tier === "coding") return "코딩 특화";
  if (tier === "fast-general") return "빠른 일반";
  if (tier === "cheap-draft") return "비용 절약 초안";
  return "runtime fallback";
}

function roleLabel(role: RoutingRole): string {
  return role === "planner" ? "Planner / PM" : role === "worker" ? "Worker / Developer" : "Reviewer / QA";
}

function tierPreset(tier: ModelRoutingTier): Pick<EngineConfig, "backend" | "model" | "baseUrl" | "cliPath"> {
  if (tier === "high-reasoning") return { backend: "claude-cli", model: "sonnet-5", baseUrl: "", cliPath: "" };
  if (tier === "high-verification") return { backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b", baseUrl: "https://integrate.api.nvidia.com/v1", cliPath: "" };
  if (tier === "coding") return { backend: "codex-cli", model: "gpt-5", baseUrl: "", cliPath: "" };
  if (tier === "cheap-draft") return { backend: "standalone", model: "phase0-model", baseUrl: "", cliPath: "" };
  if (tier === "fallback") return { backend: "standalone", model: "phase0-model", baseUrl: "", cliPath: "" };
  return { backend: "openai-compatible", model: "nvidia/nemotron-3-ultra-550b-a55b", baseUrl: "https://integrate.api.nvidia.com/v1", cliPath: "" };
}

function bindingForRole(bindings: AgentBinding[], role: RoutingRole): AgentBinding | undefined {
  return bindings.find(item => item.targetKind === "role" && item.targetId === role);
}

function routingPresetStatus(actual: { backend: AgentBackendType; modelId: string } | undefined, preset: Pick<EngineConfig, "backend" | "model">): { label: string; tone: "ok" | "watch" | "risk"; detail: string } {
  if (!actual) return { label: "저장값 없음", tone: "risk", detail: "이 역할은 아직 저장된 role binding이 없어 Run에서는 회사 기본값이나 runtime fallback을 사용할 수 있습니다." };
  if (actual.backend === preset.backend && actual.modelId === preset.model) return { label: "추천과 일치", tone: "ok", detail: "현재 저장된 role binding이 추천 preset과 일치합니다." };
  if (actual.backend === preset.backend) return { label: "모델만 다름", tone: "watch", detail: "backend는 같지만 저장 모델은 " + actual.modelId + "입니다." };
  return { label: "추천과 다름", tone: "watch", detail: "저장값은 " + actual.backend + " / " + actual.modelId + "입니다." };
}

function routingDraftStatus(config: EngineConfig | undefined, preset: Pick<EngineConfig, "backend" | "model">): { label: string; tone: "ok" | "watch"; detail: string } {
  if (!config) return { label: "초안 없음", tone: "watch", detail: "이 역할의 설정 초안을 찾지 못했습니다." };
  if (config.backend === preset.backend && config.model.trim() === preset.model) return { label: "초안 일치", tone: "ok", detail: "현재 입력값은 추천 preset과 일치합니다. 저장하면 다음 Run부터 반영됩니다." };
  return { label: "초안 미적용", tone: "watch", detail: "추천 적용 버튼을 누르면 입력값만 바뀌며, 별도 저장이 필요합니다." };
}

export default function BackendSettingsPage() {
  const { actorId, role } = useSession();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [companyId, setCompanyId] = useState(() => params.get("companyId") ?? localStorage.getItem("agent-company-os.lastCompany") ?? "");
  const [companies, setCompanies] = useState<Array<CompanyRecord & { role: string }>>([]);
  const [configs, setConfigs] = useState<EngineConfig[]>(DEFAULT_CONFIGS);
  const [bindings, setBindings] = useState<AgentBinding[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userFacingCompanies = useMemo(() => userFacingCompanyOptions(companies, companyId), [companies, companyId]);
  const hiddenGeneratedCompanies = useMemo(() => hiddenCompanyCount(companies, companyId), [companies, companyId]);
  const selectedCompany = companies.find(item => item.id === companyId);
  const isAdmin = role === "admin" || selectedCompany?.role === "owner";
  const isDemoCompany = selectedCompany?.mode === "demo";
  const routingRecommendation = useMemo(() => {
    const roles: RoutingRole[] = ["planner", "worker", "reviewer"];
    return roles.flatMap(roleName => {
      const tier = params.get(roleName);
      return isModelRoutingTier(tier) ? [{ role: roleName, tier }] : [];
    });
  }, [params]);
  const changedSummary = useMemo(() => configs.map(config => `${config.label}: ${config.backend} / ${config.model || "모델 미선택"}`), [configs]);

  function updateConfig(target: BindingTarget, patch: Partial<EngineConfig>) {
    setConfigs(items => items.map(item => item.target === target ? { ...item, ...patch } : item));
  }

  function applyRoutingRecommendation() {
    if (!routingRecommendation.length) return;
    setConfigs(items => items.map(item => {
      const recommendation = routingRecommendation.find(next => next.role === item.target);
      if (!recommendation) return item;
      const preset = tierPreset(recommendation.tier);
      return { ...item, ...preset, modelOptions: [], loadingModels: false };
    }));
    toast("추천 모델 배치를 설정 초안에 적용했습니다. 저장해야 다음 Run부터 반영됩니다.");
  }

  function applyExistingBindings(nextBindings: AgentBinding[]) {
    setConfigs(DEFAULT_CONFIGS.map(config => {
      const binding = config.target === "company"
        ? nextBindings.find(item => item.targetKind === "company")
        : nextBindings.find(item => item.targetKind === "role" && item.targetId === config.target);
      if (!binding) return config;
      const bindingConfig = binding.config as { baseUrl?: string; cliPath?: string };
      return { ...config, backend: binding.backend, model: binding.modelId, baseUrl: bindingConfig.baseUrl ?? config.baseUrl, cliPath: bindingConfig.cliPath ?? "" };
    }));
  }

  async function load(id = companyId) {
    if (!id) return;
    setBusy(true); setError(null);
    try {
      const nextBindings = await apiGet<AgentBinding[]>(`/api/companies/${encodeURIComponent(id)}/agent-bindings?actor=${encodeURIComponent(actorId)}`);
      setBindings(nextBindings);
      applyExistingBindings(nextBindings);
      setCompanyId(id);
      localStorage.setItem("agent-company-os.lastCompany", id);
      setParams(previous => { const next = new URLSearchParams(previous); next.set("companyId", id); return next; }, { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    void apiGet<Array<CompanyRecord & { role: string }>>(`/api/companies?actor=${encodeURIComponent(actorId)}`)
      .then(items => {
        const active = items.filter(item => item.status === "active");
        setCompanies(active);
        const visible = userFacingCompanyOptions(active, companyId);
        const selected = visible.some(item => item.id === companyId) ? companyId : visible[0]?.id ?? "";
        if (selected) void load(selected);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [actorId]);

  async function loadModels(target: BindingTarget) {
    const config = configs.find(item => item.target === target);
    if (!config) return;
    updateConfig(target, { loadingModels: true });
    setError(null);
    try {
      const result = await apiPost<Record<string, string[]>>("/api/agent-backend/models", {
        backend: config.backend,
        ...(config.baseUrl.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
        ...(config.cliPath.trim() ? { cliPath: config.cliPath.trim() } : {}),
      });
      const list = Object.values(result).flat();
      updateConfig(target, { modelOptions: list, model: list.length && !list[0]!.startsWith("error:") ? list[0]! : config.model });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { updateConfig(target, { loadingModels: false }); }
  }

  async function saveConfig(config: EngineConfig) {
    if (!companyId || !config.model.trim()) return;
    setBusy(true); setError(null);
    try {
      await apiPost(`/api/companies/${encodeURIComponent(companyId)}/agent-bindings`, {
        actorId,
        targetKind: config.target === "company" ? "company" : "role",
        targetId: config.target === "company" ? companyId : config.target,
        backend: config.backend,
        modelId: config.model.trim(),
        config: {
          ...(needsBaseUrl(config.backend) && config.baseUrl.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
          ...(needsCliPath(config.backend) && config.cliPath.trim() ? { cliPath: config.cliPath.trim() } : {}),
        },
      });
      toast(`${config.label} 설정을 저장했습니다. 다음 Run부터 적용됩니다.`);
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function saveAll() {
    for (const config of configs) await saveConfig(config);
  }

  async function verifyLiveRunSnapshot() {
    if (!companyId || isDemoCompany) return;
    setBusy(true); setError(null); setVerification(null);
    try {
      for (const config of configs) {
        if (!config.model.trim()) continue;
        await apiPost(`/api/companies/${encodeURIComponent(companyId)}/agent-bindings`, {
          actorId,
          targetKind: config.target === "company" ? "company" : "role",
          targetId: config.target === "company" ? companyId : config.target,
          backend: config.backend,
          modelId: config.model.trim(),
          config: {
            ...(needsBaseUrl(config.backend) && config.baseUrl.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
            ...(needsCliPath(config.backend) && config.cliPath.trim() ? { cliPath: config.cliPath.trim() } : {}),
          },
        });
      }
      const goalId = crypto.randomUUID();
      const launch = await apiPost<{ goal: { id: string }; provisioning: { runId: string } }>(`/api/companies/${encodeURIComponent(companyId)}/goals/launch`, {
        actorId,
        id: goalId,
        title: "AI Engine live snapshot verification",
        description: "Verify selected role backend/model settings are frozen into a live Run snapshot.",
        ownerId: actorId,
        completionCriteria: ["planner, worker, and reviewer bindings are captured in Run snapshot"],
        budgetLimit: 1,
        requestedRisk: "low",
        requestedPaths: ["src"],
      });
      const snapshots = await apiGet<ResolvedAgentBinding[]>(`/api/runs/${encodeURIComponent(launch.provisioning.runId)}/agent-bindings?actor=${encodeURIComponent(actorId)}`);
      const failures: string[] = [];
      for (const roleTarget of ["planner", "worker", "reviewer"] as const) {
        const expected = configs.find(item => item.target === roleTarget);
        const actual = snapshots.find(item => item.role === roleTarget);
        if (!expected) continue;
        if (!actual) { failures.push(`${roleTarget}: snapshot 없음`); continue; }
        if (actual.backend !== expected.backend) failures.push(`${roleTarget}: backend expected ${expected.backend}, actual ${actual.backend}`);
        if (actual.modelId !== expected.model.trim()) failures.push(`${roleTarget}: model expected ${expected.model.trim()}, actual ${actual.modelId}`);
        if (actual.resolution === "demo-mode") failures.push(`${roleTarget}: demo-mode로 resolve됨`);
      }
      const result = { status: failures.length ? "fail" : "pass", goalId: launch.goal.id, runId: launch.provisioning.runId, snapshots, failures } as VerificationResult;
      setVerification(result);
      toast(failures.length ? "Live Run snapshot 검증에서 불일치가 발견되었습니다." : "Live Run snapshot 검증이 통과했습니다.");
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return <div>
    <PageHeader title="설정 · AI 엔진" description="일반 사용자의 업무 위임 흐름과 분리된 관리자용 backend/model 설정입니다." />

    <section className="card">
      <div className="row">
        <label className="inline">회사
          <select value={companyId} onChange={e => void load(e.target.value)}>
            <option value="">회사를 선택하세요</option>
            {userFacingCompanies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.role}</option>)}
            {hiddenGeneratedCompanies > 0 && <option value="" disabled>테스트 회사 {hiddenGeneratedCompanies}개 숨김</option>}
          </select>
        </label>
        <button disabled={busy || !companyId} onClick={() => void load()}>{busy ? "불러오는 중…" : "설정 새로고침"}</button>
        <Link className="button-link" to={companyId ? `/company?companyId=${encodeURIComponent(companyId)}` : "/company"}>회사 홈</Link>
        <Link className="button-link" to={companyId ? `/employees?companyId=${encodeURIComponent(companyId)}` : "/employees"}>직원·AI팀</Link>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!isAdmin && <p className="error">관리자 또는 회사 Owner만 AI 엔진 설정을 변경할 수 있습니다.</p>}
      {isDemoCompany && <div className="measurement-guidance" style={{ marginTop: 12 }}><strong>Demo 회사 주의</strong><span>이 회사는 Run snapshot에서 demo-mode가 우선되어 저장된 backend/model 대신 standalone · phase0-model로 실행됩니다. 실제 role binding 검증은 live 회사에서 진행하세요.</span></div>}
    </section>

    {routingRecommendation.length > 0 && <section className="card model-routing-preview" aria-label="회사 홈 추천 모델 배치">
      <div className="section-heading"><div><span className="eyebrow">RECOMMENDED PRESET</span><h2>회사 홈 추천 모델 배치</h2><p>직전에 검토한 업무의 중요도와 위험 신호를 바탕으로 역할별 backend/model 초안을 제안하고, 현재 저장값과의 차이를 먼저 보여줍니다.</p></div><button disabled={!isAdmin || busy} onClick={() => applyRoutingRecommendation()}>추천 적용</button></div>
      <div className="model-routing-grid">{routingRecommendation.map(item => { const preset = tierPreset(item.tier), saved = routingPresetStatus(bindingForRole(bindings, item.role), preset), draft = routingDraftStatus(configs.find(config => config.target === item.role), preset); return <article key={item.role} className="model-routing-card"><span>{roleLabel(item.role)}</span><strong>{tierLabel(item.tier)}</strong><small>추천 preset · {preset.backend} · {preset.model}</small><p>적용하면 이 역할의 설정 입력값만 바뀝니다. 실제 저장은 아래 저장 버튼을 눌러야 합니다.</p><div className={"routing-delta routing-delta-" + saved.tone}><strong>현재 저장값 · {saved.label}</strong><span>{saved.detail}</span></div><div className={"routing-delta routing-delta-" + draft.tone}><strong>설정 초안 · {draft.label}</strong><span>{draft.detail}</span></div></article>; })}</div>
      <p className="field-help">추천은 강제 라우팅이 아닙니다. 추천 적용은 입력값만 바꾸고, 저장 또는 전체 저장 이후 새 Run snapshot에서 실제 적용 여부가 확정됩니다.</p>
    </section>}

    <section className="card" aria-label="AI 엔진 운영 원칙">
      <h2>운영 원칙</h2>
      <div className="measurement-guidance"><strong>모델 설정은 일반 사용자의 기본 흐름이 아닙니다.</strong><span>사용자는 회사 홈에서 업무를 맡기고, 이 화면은 관리자가 회사 기본값과 역할별 AI 엔진을 조정할 때만 사용합니다.</span></div>
      <div className="badge-row">
        <span className="badge">회사 기본 → fallback</span>
        <span className="badge">Planner/PM → 계획</span>
        <span className="badge">Worker/Developer → 구현</span>
        <span className="badge">Reviewer/QA → 검증</span>
        <span className="badge">API key 원문 저장 금지</span>
        <span className="badge">Live Run snapshot에서 최종 적용 확인</span>
      </div>
    </section>

    <div className="stat-grid" style={{ marginTop: 16 }}>
      {configs.map(config => {
        const choices = Array.from(new Set([...config.modelOptions, ...(config.model.trim() ? [config.model.trim()] : [])]));
        return <article key={config.target} className="card">
          <div className="section-heading"><div><h2>{config.label}</h2><p>{config.description}</p></div><span className="badge">{targetLabel(config.target)}</span></div>
          <label>Backend
            <select value={config.backend} disabled={!isAdmin || busy} onChange={e => updateConfig(config.target, { backend: e.target.value as AgentBackendType, model: modelPlaceholder(e.target.value as AgentBackendType), modelOptions: [] })}>
              {BACKENDS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {needsBaseUrl(config.backend) && <label>Base URL
            <input value={config.baseUrl} disabled={!isAdmin || busy} placeholder="서버 .env 기본값을 쓰려면 비워두세요" onChange={e => updateConfig(config.target, { baseUrl: e.target.value })} />
          </label>}
          {needsCliPath(config.backend) && <label>CLI 경로
            <input value={config.cliPath} disabled={!isAdmin || busy} placeholder="PATH에서 찾으려면 비워두세요" onChange={e => updateConfig(config.target, { cliPath: e.target.value })} />
          </label>}
          <label>Model
            {choices.length > 1 ? <select value={config.model} disabled={!isAdmin || busy} onChange={e => updateConfig(config.target, { model: e.target.value })}>{choices.map(item => <option key={item} value={item}>{item}</option>)}</select> : <input value={config.model} disabled={!isAdmin || busy} onChange={e => updateConfig(config.target, { model: e.target.value })} />}
          </label>
          {config.modelOptions.some(item => item.startsWith("error:")) && <p className="error">{config.modelOptions.find(item => item.startsWith("error:"))}</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="secondary" disabled={!isAdmin || config.loadingModels} onClick={() => void loadModels(config.target)}>{config.loadingModels ? "모델 조회 중…" : "모델 목록 조회"}</button>
            <button disabled={!isAdmin || busy || !config.model.trim()} onClick={() => void saveConfig(config)}>저장</button>
          </div>
        </article>;
      })}
    </div>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-heading"><div><h2>저장 전 요약</h2><p>저장된 설정은 다음 Run부터 적용됩니다. 이미 시작된 Run의 snapshot은 바뀌지 않습니다. 실제 적용 여부는 live 회사 Run의 agent binding snapshot으로 확인하세요.</p></div><div className="row"><button disabled={!isAdmin || busy || !companyId} onClick={() => void saveAll()}>전체 저장</button><button className="secondary" disabled={!isAdmin || busy || !companyId || isDemoCompany} onClick={() => void verifyLiveRunSnapshot()}>Live Run snapshot 검증</button></div></div>
      <ul>{changedSummary.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>현재 저장된 binding</h3>
      <p className="empty-state">운영 검증 명령: <code>powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-live-binding-snapshot.ps1</code></p>
      {verification && <section className={`measurement-guidance ${verification.status === "pass" ? "ready" : "blocked"}`}><strong>{verification.status === "pass" ? "Live Run snapshot 검증 통과" : "Live Run snapshot 검증 실패"}</strong><span>Run {verification.runId} · Goal {verification.goalId} · {verification.snapshots.map(item => `${item.role}: ${item.backend}/${item.modelId}/${item.resolution}`).join(" · ")}</span>{verification.failures.length > 0 && <ul>{verification.failures.map(item => <li key={item}>{item}</li>)}</ul>}</section>}
      <div className="binding-list">{bindings.map(binding => <article key={binding.id}><strong>{binding.targetKind}:{binding.targetId}</strong><span>{binding.backend} · {binding.modelId}</span><small>v{binding.version} · {binding.changedBy}</small></article>)}{!bindings.length && <p className="empty-state">저장된 AI 엔진 설정이 없습니다.</p>}</div>
    </section>
  </div>;
}
