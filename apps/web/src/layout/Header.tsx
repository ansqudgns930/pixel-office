import { useEffect, useState } from "react";
import { useSession } from "../auth/SessionContext.tsx";
import Icon from "../components/Icon.tsx";
import { apiGet } from "../api.ts";
import { useLocation, useNavigate } from "react-router-dom";
import type { CompanyRecord } from "../types.ts";
import { hiddenCompanyCount, userFacingCompanyOptions } from "../companyOptions.ts";

export default function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { username, role,actorId, logout } = useSession(),navigate=useNavigate(),location=useLocation();
  const initial = username ? username.charAt(0).toUpperCase() : "?";
  const [backend,setBackend]=useState<{host:string;model:string}|null>(null);
  const [companies,setCompanies]=useState<Array<CompanyRecord&{role:string}>>([]),[hiddenCompanies,setHiddenCompanies]=useState(0),[companyId,setCompanyId]=useState(()=>localStorage.getItem("agent-company-os.lastCompany")??""),[unread,setUnread]=useState(0);
  useEffect(()=>{void apiGet<{adapters?:{active?:{host:string;model:string}}}>("/api/health").then(x=>setBackend(x.adapters?.active??null)).catch(()=>setBackend(null));},[]);
  useEffect(()=>{void apiGet<Array<CompanyRecord&{role:string}>>(`/api/companies?actor=${encodeURIComponent(actorId)}`).then(items=>{const active=Array.isArray(items)?items.filter(item=>item.status==="active"):[],current=new URLSearchParams(location.search).get("companyId")??localStorage.getItem("agent-company-os.lastCompany")??"";setCompanies(userFacingCompanyOptions(active,current));setHiddenCompanies(hiddenCompanyCount(active,current));}).catch(()=>{setCompanies([]);setHiddenCompanies(0);});},[actorId,location.key]);
  // 페이지 이동 시 현재 회사 컨텍스트(URL 파라미터 또는 최근 회사)와 셀렉트를 동기화한다.
  useEffect(()=>{const fromUrl=new URLSearchParams(location.search).get("companyId"),next=fromUrl??localStorage.getItem("agent-company-os.lastCompany")??"";setCompanyId(next);},[location]);
  useEffect(()=>{if(!companyId){setUnread(0);return;}void apiGet<Array<{readAt:string|null}>>(`/api/companies/${encodeURIComponent(companyId)}/alerts?actor=${encodeURIComponent(actorId)}`).then(items=>setUnread(items.filter(x=>!x.readAt).length)).catch(()=>setUnread(0));},[companyId,actorId,location.key]);
  function switchCompany(id:string){setCompanyId(id);if(!id)return;localStorage.setItem("agent-company-os.lastCompany",id);navigate(`/company?companyId=${encodeURIComponent(id)}`);}

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button className="icon-button sidebar-toggle" aria-label="메뉴 열기" onClick={onToggleSidebar}><Icon name="menu" size={18} /></button>
        <span className="app-title"><span className="app-title-long">Agent Company OS</span><span className="app-title-short">ACOS</span></span>
      </div>
      <div className="app-header-right">
        {companies.length>0&&<label className="inline" aria-label="현재 회사"><select value={companyId} onChange={event=>switchCompany(event.target.value)}><option value="">회사 선택</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}{hiddenCompanies>0&&<option value="" disabled>테스트 회사 {hiddenCompanies}개 숨김</option>}</select></label>}
        {backend&&<span className="badge" aria-label={`현재 Agent Backend ${backend.host}, 모델 ${backend.model}`}>{backend.host} · {backend.model}</span>}
        {companyId&&<button className="header-activity-button" aria-label={`결과·활동과 업무 신호, 읽지 않음 ${unread}개`} onClick={()=>navigate(`/activity?companyId=${encodeURIComponent(companyId)}`)}><span aria-hidden="true">⌕</span>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>}
        <div className="user-chip">
          <span className="avatar">{initial}</span>
          <span className="user-chip-text">
            <span className="user-name">{username}</span>
            <span className="user-role">{role}</span>
          </span>
        </div>
        <button className="secondary logout-button" aria-label="로그아웃" onClick={logout}><span className="logout-label">로그아웃</span><span className="logout-icon" aria-hidden="true">↪</span></button>
      </div>
    </header>
  );
}
