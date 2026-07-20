import { useEffect, useRef, useState } from "react";
import PageHeader from "../components/PageHeader.tsx";
import { apiGet, readSse } from "../api.ts";
import { useSession } from "../auth/SessionContext.tsx";
import type { CompanyRecord } from "../types.ts";

interface HealthStatus {
  status: string;
  sqlite: string;
  integrity?: string;
  schemaVersion?: number;
  redis?: string;
  lastBackup?: unknown;
}
interface StreamEvent{sequence?:number;type?:string;occurredAt?:string;runId?:string;actor?:{type:string;id:string};payload?:Record<string,unknown>}

export default function OperationsPage() {
  const {actorId}=useSession();
  const [companyId, setCompanyId] = useState(()=>localStorage.getItem("agent-company-os.lastCompany")??"");
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string}>>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthCheckedAt,setHealthCheckedAt]=useState<Date|null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]),[streamState,setStreamState]=useState<"idle"|"connecting"|"connected"|"disconnected">("idle"),[lastEventAt,setLastEventAt]=useState<string|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const streamRef=useRef<AbortController|null>(null);

  async function guarded(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  function checkHealth() {
    return guarded(async () => { setHealth(await apiGet<HealthStatus>("/api/health"));setHealthCheckedAt(new Date()); });
  }

  function disconnect(){streamRef.current?.abort();streamRef.current=null;setStreamState("disconnected");}
  function connect(){disconnect();setEvents([]);setError(null);setStreamState("connecting");const controller=new AbortController();streamRef.current=controller;void readSse(`/api/events?companyId=${encodeURIComponent(companyId)}`,controller.signal,event=>{const data=event.data as StreamEvent;setLastEventAt(new Date().toISOString());setEvents(current=>[data,...current].slice(0,200));},()=>setStreamState("connected")).catch(e=>{if(controller.signal.aborted)return;setStreamState("disconnected");setError(e instanceof Error?e.message:String(e));});}

  useEffect(()=>{void checkHealth();void apiGet<Array<CompanyRecord&{role:string}>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items=>{const valid=Array.isArray(items)?items:[];setCompanies(valid);if(!companyId&&valid[0])setCompanyId(valid[0].id);});},[actorId]);
  useEffect(()=>()=>streamRef.current?.abort(),[]);

  return (
    <div>
      <PageHeader title="운영 상태 센터" description="서비스 상태와 회사별 실시간 업무 이벤트를 확인합니다." />

      <div className="card">
        <div className="row">
          <label className="inline">이벤트 회사
            <select value={companyId} onChange={e => {setCompanyId(e.target.value);localStorage.setItem("agent-company-os.lastCompany",e.target.value);}}><option value="">회사를 선택하세요</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <button disabled={busy} onClick={() => void checkHealth()}>{busy?"확인 중…":"상태 새로고침"}</button>
          {streamState==="connected"||streamState==="connecting"?<button className="secondary" onClick={disconnect}>연결 해제</button>:<button className="secondary" disabled={!companyId} onClick={connect}>이벤트 스트림 연결</button>}
          <span className={`stream-status stream-${streamState}`} role="status"><span className="status-dot"/>{streamState==="connected"?"실시간 연결됨":streamState==="connecting"?"연결 중":streamState==="disconnected"?"연결 해제됨":"연결 안 됨"}{lastEventAt&&` · 마지막 이벤트 ${new Date(lastEventAt).toLocaleTimeString()}`}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {health && (
        <><p className="data-freshness">마지막 상태 확인 {healthCheckedAt?.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</p><div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-tile"><div className="label">전체 서비스</div><div className="value health-value" style={{ fontSize: 15 }}><span className="status-dot status-good"/>정상</div><div className="status-row">API 요청 처리 가능</div></div>
          <div className="stat-tile"><div className="label">운영 데이터</div><div className="value health-value" style={{ fontSize: 15 }}><span className="status-dot status-good"/>{health.sqlite==="ready"?"정상":health.sqlite}</div><div className="status-row">SQLite 연결</div></div>
          <div className="stat-tile"><div className="label">작업 대기열</div><div className="value health-value" style={{ fontSize: 15 }}><span className={`status-dot ${health.redis==="ready"?"status-good":"status-warning"}`}/>{health.redis==="ready"?"정상":health.redis??"확인 필요"}</div><div className="status-row">Redis 연결</div></div>
          <div className="stat-tile"><div className="label">데이터 구조</div><div className="value" style={{fontSize:15}}>내부 버전 {health.schemaVersion ?? "-"}</div><div className="status-row">운영 호환성 정보</div></div>
        </div></>
      )}
      <section className="card event-stream-panel" style={{marginTop:12}}><header><div><h2>실시간 이벤트</h2><p>{events.length}건 수신 · 최근 200건 유지</p></div>{events.length>0&&<button className="secondary compact" onClick={()=>setEvents([])}>목록 비우기</button>}</header>{events.length?<ol>{events.map((event,index)=><li key={`${event.sequence??"event"}:${index}`}><span className="event-sequence">#{event.sequence??"-"}</span><div><strong>{event.type??"unknown"}</strong><small>{event.runId??event.actor?.id??"회사 이벤트"}</small></div><time>{event.occurredAt?new Date(event.occurredAt).toLocaleTimeString():"방금"}</time></li>)}</ol>:<div className="empty-panel"><strong>수신된 이벤트가 없습니다.</strong><span>스트림을 연결하면 새 이벤트가 여기에 실시간으로 추가됩니다.</span></div>}</section>
    </div>
  );
}
