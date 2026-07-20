import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppShell from "./layout/AppShell.tsx";
import RequireAuth from "./layout/RequireAuth.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary.tsx";
const ExecutionPage=lazy(()=>import("./pages/ExecutionPage.tsx"));
const WarRoomPage=lazy(()=>import("./pages/WarRoomPage.tsx"));
const CompanyPage=lazy(()=>import("./pages/CompanyPage.tsx"));
const PixelOfficePage=lazy(()=>import("./pages/PixelOfficePage.tsx"));
const PlatformPage=lazy(()=>import("./pages/PlatformPage.tsx"));
const OperationsPage=lazy(()=>import("./pages/OperationsPage.tsx"));
const CompaniesPage=lazy(()=>import("./pages/CompaniesPage.tsx"));
const EmployeesPage=lazy(()=>import("./pages/EmployeesPage.tsx"));
const GoalsPage=lazy(()=>import("./pages/GoalsPage.tsx"));
const MeetingsPage=lazy(()=>import("./pages/MeetingsPage.tsx"));
const ActivityPage=lazy(()=>import("./pages/ActivityPage.tsx"));
const OwnerReviewsPage=lazy(()=>import("./pages/OwnerReviewsPage.tsx"));
const loading=<div className="route-loading" role="status"><span className="loading-spinner" aria-hidden="true"/><strong>화면을 준비하고 있습니다.</strong></div>;

export default function App() {
  return (
    <AppErrorBoundary><Suspense fallback={loading}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/companies" replace />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="reviews" element={<OwnerReviewsPage />} />
          <Route path="execution" element={<ExecutionPage />} />
          <Route path="projects" element={<WarRoomPage />} />
          <Route path="company" element={<CompanyPage />} />
          <Route path="pixel-office" element={<PixelOfficePage />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="*" element={<Navigate to="/execution" replace />} />
        </Route>
      </Route>
    </Routes></Suspense></AppErrorBoundary>
  );
}
