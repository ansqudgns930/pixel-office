import { NavLink } from "react-router-dom";
import { visibleNavGroups } from "./nav.ts";
import { useSession } from "../auth/SessionContext.tsx";
import Icon from "../components/Icon.tsx";

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { role } = useSession();
  const groups = visibleNavGroups(role);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onNavigate} />}
      <nav className={`app-sidebar${open ? " open" : ""}`} aria-label="Pixel Office navigation">
        {groups.map(group => (
          <section className="sidebar-group" key={group.label} aria-label={group.label}>
            <div className="sidebar-group-heading">
              <span>{group.label}</span>
              <small>{group.description}</small>
            </div>
            {group.items.map(item => (
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
          </section>
        ))}
      </nav>
    </>
  );
}
