import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../auth/SessionContext.tsx";
import { apiPost } from "../api.ts";

interface LoginResult { token: string; principalId: string; role: string }

export default function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.isAuthenticated) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/companies";
    return <Navigate to={redirectTo} replace />;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<LoginResult>("/api/auth/login", { username, password });
      session.login({ token: result.token, principalId: result.principalId, username, role: result.role });
      const lastCompany=localStorage.getItem("agent-company-os.lastCompany");
      navigate(lastCompany?`/company?companyId=${encodeURIComponent(lastCompany)}`:"/companies", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div className="login-mark">ACO</div>
        <h1>Agent Company OS</h1>
        <p className="login-subtitle">계정으로 로그인하세요</p>

        <label className="field">
          아이디
          <input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoComplete="username" />
        </label>
        <label className="field">
          비밀번호
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy || !username || !password}>{busy ? "확인 중..." : "로그인"}</button>
      </form>
    </div>
  );
}
