export interface NavItem { path: string; label: string; icon: string; roles?: string[] }

export const NAV_ITEMS: NavItem[] = [
  { path: "/companies", label: "내 회사", icon: "building" },
  { path: "/company", label: "회사 홈", icon: "grid" },
  { path: "/goals", label: "맡긴 일", icon: "board" },
  { path: "/pixel-office", label: "픽셀 오피스", icon: "grid" },
  { path: "/reviews", label: "결정 필요", icon: "layers" },
  { path: "/meetings", label: "회의", icon: "grid" },
  { path: "/activity", label: "결과·활동", icon: "layers" },
  { path: "/employees", label: "직원·AI팀", icon: "building" },
  { path: "/projects", label: "프로젝트 워룸", icon: "board" },
  { path: "/execution", label: "고급 실행", icon: "play" },
  { path: "/operations", label: "운영 상태", icon: "gear", roles: ["admin"] },
  { path: "/platform", label: "플랫폼", icon: "layers" }
];

export function visibleNavItems(role: string): NavItem[] {
  return NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role) || role === "admin");
}
