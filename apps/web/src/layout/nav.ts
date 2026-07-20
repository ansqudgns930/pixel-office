export interface NavItem { path: string; label: string; icon: string; roles?: string[] }

export const NAV_ITEMS: NavItem[] = [
  { path: "/companies", label: "내 회사", icon: "building" },
  { path: "/company", label: "회사 홈", icon: "grid" },
  { path: "/pixel-office", label: "픽셀 오피스", icon: "grid" },
  { path: "/employees", label: "직원", icon: "building" },
  { path: "/goals", label: "회사 목표", icon: "board" },
  { path: "/reviews", label: "오너 결정", icon: "layers" },
  { path: "/meetings", label: "회의", icon: "grid" },
  { path: "/activity", label: "검색·알림", icon: "layers" },
  { path: "/projects", label: "프로젝트 워룸", icon: "board" },
  { path: "/execution", label: "실행 워크스페이스", icon: "play" },
  { path: "/platform", label: "운영 플랫폼", icon: "layers" },
  { path: "/operations", label: "운영 상태", icon: "gear", roles: ["admin"] }
];

export function visibleNavItems(role: string): NavItem[] {
  return NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role) || role === "admin");
}
