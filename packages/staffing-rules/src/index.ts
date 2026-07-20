export type StaffingRisk = "low" | "medium" | "high" | "critical";

export interface WorkStaffingPlan {
  staff: string[];
  steps: string[];
  risk: StaffingRisk;
  decisionExpectation: string;
  signals: {
    ui: boolean;
    security: boolean;
    copy: boolean;
    large: boolean;
  };
}

export function deriveWorkStaffingPlan(request: string): WorkStaffingPlan {
  const lower = request.toLowerCase();
  const ui = /ui|ux|화면|디자인|레이아웃|버튼|랜딩|온보딩/.test(lower);
  const security = /auth|인증|권한|보안|security|token|secret|비밀/.test(lower);
  const copy = /문구|카피|copy|랜딩|버튼/.test(lower);
  const large = /전체|서비스|기획|전략|대규모|리팩터|architecture|구조/.test(lower);
  const staff = new Set<string>();

  if (large) { staff.add("CEO"); staff.add("PM"); }
  if (ui) { staff.add("PM"); staff.add("Designer"); }
  if (copy) staff.add("Copywriter");
  if (security) { staff.add("PM"); staff.add("Security"); }
  if (!staff.size) staff.add("Developer");
  staff.add("Developer");
  staff.add("QA");

  const steps = [
    "업무 목표와 완료 조건 정리",
    ui ? "현재 화면/사용자 흐름 점검" : "관련 코드와 현재 상태 확인",
    security ? "권한·보안 위험 지점 확인" : "실행 범위와 변경 계획 작성",
    "필요한 변경 수행",
    "빌드·테스트·검증",
    "검증된 결과 보고와 다음 작업 추천",
  ];

  const risk: StaffingRisk = security || large ? "high" : ui || copy ? "medium" : "low";
  const decisionExpectation = security || large
    ? "있음 — 위험/범위 변경 시 확인 요청"
    : "낮음 — 검증 실패 또는 범위 변경 시에만 요청";

  return { staff: Array.from(staff), steps, risk, decisionExpectation, signals: { ui, security, copy, large } };
}
