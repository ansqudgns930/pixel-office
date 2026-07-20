import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";
import Footer from "./Footer.tsx";
import { ToastProvider } from "../components/ToastContext.tsx";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Header onToggleSidebar={() => setSidebarOpen(v => !v)} />
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main className="app-main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
