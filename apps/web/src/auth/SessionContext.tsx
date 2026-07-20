import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const TOKEN_KEY = "agent-company-os.apiToken";
const ACTOR_KEY = "agent-company-os.actorId";
const USERNAME_KEY = "agent-company-os.username";
const ROLE_KEY = "agent-company-os.role";

interface SessionValue {
  token: string;
  actorId: string;
  username: string;
  role: string;
  isAuthenticated: boolean;
  login: (input: { token: string; principalId: string; username: string; role: string }) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) ?? "");
  const [actorId, setActorIdState] = useState(() => window.localStorage.getItem(ACTOR_KEY) ?? "");
  const [username, setUsername] = useState(() => window.localStorage.getItem(USERNAME_KEY) ?? "");
  const [role, setRole] = useState(() => window.localStorage.getItem(ROLE_KEY) ?? "");

  const value = useMemo<SessionValue>(() => ({
    token,
    actorId,
    username,
    role,
    isAuthenticated: token.length > 0,
    login({ token: nextToken, principalId, username: nextUsername, role: nextRole }) {
      window.localStorage.setItem(TOKEN_KEY, nextToken);
      window.localStorage.setItem(ACTOR_KEY, principalId);
      window.localStorage.setItem(USERNAME_KEY, nextUsername);
      window.localStorage.setItem(ROLE_KEY, nextRole);
      setToken(nextToken);
      setActorIdState(principalId);
      setUsername(nextUsername);
      setRole(nextRole);
    },
    logout() {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken("");
    }
  }), [token, actorId, username, role]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
