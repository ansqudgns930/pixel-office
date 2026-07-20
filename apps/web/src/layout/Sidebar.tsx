import { NavLink } from "react-router-dom";
import { visibleNavItems } from "./nav.ts";
import { useSession } from "../auth/SessionContext.tsx";
import Icon from "../components/Icon.tsx";

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { role } = useSession();
  const items = visibleNavItems(role);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onNavigate} />}
      <nav className={`app-sidebar${open ? " open" : ""}`}>
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            onClick={onNavigate}
          >
            <span className="sidebar-icon"><Icon name={item.icon} /></span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
