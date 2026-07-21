export interface NavItem { path: string; label: string; icon: string; roles?: string[] }
export interface NavGroup { label: string; description: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "업무 흐름",
    description: "업무를 맡기고 진행·결과를 확인하는 기본 경로",
    items: [
      { path: "/companies", label: "내 회사", icon: "building" },
      { path: "/company", label: "회사 홈", icon: "grid" },
      { path: "/goals", label: "맡긴 일", icon: "board" },
      { path: "/reviews", label: "결정 필요", icon: "layers" },
      { path: "/activity", label: "결과·활동", icon: "layers" },
      { path: "/pixel-office", label: "픽셀 오피스", icon: "grid" }
    ]
  },
  {
    label: "운영·관리",
    description: "AI 회사의 팀, 실행 작업실, 회의 기록을 관리",
    items: [
      { path: "/employees", label: "직원·AI팀", icon: "building" },
      { path: "/projects", label: "실행 작업실", icon: "board" },
      { path: "/meetings", label: "업무 검토 회의", icon: "grid" }
    ]
  },
  {
    label: "고급",
    description: "관리자 설정, 고급 실행, 운영 건강도, 플랫폼 인프라",
    items: [
      { path: "/settings/backend", label: "AI 엔진 설정", icon: "gear", roles: ["admin"] },
      { path: "/execution", label: "고급 실행", icon: "play" },
      { path: "/operations", label: "운영 건강도", icon: "gear", roles: ["admin"] },
      { path: "/platform", label: "플랫폼 관리", icon: "layers" }
    ]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(group => group.items);

export function visibleNavItems(role: string): NavItem[] {
  return NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role) || role === "admin");
}

export function visibleNavGroups(role: string): NavGroup[] {
  return NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || item.roles.includes(role) || role === "admin")
  })).filter(group => group.items.length > 0);
}
