/** 표준 dot-notation 이벤트 타입을 사용자 언어(prj_2.md §42.3)로 변환한다. 미등록 타입은 접두어 규칙으로, 그것도 없으면 원문을 유지한다. */
const EXACT: Record<string, string> = {
  "run.created": "새 맡긴 일이 접수되었습니다",
  "run.transitioned": "진행 단계가 바뀌었습니다",
  "run.policy_denied": "정책이 실행을 거부했습니다",
  "risk.assessed": "위험도 판정이 완료되었습니다",
  "plan.approved": "계획이 승인되었습니다",
  "result.approved": "결과가 승인되었습니다",
  "approval.result_hash_bound": "승인 대상 변경본이 확정되었습니다",
  "approval.stale_blocked": "오래된 산출물이라 승인이 차단되었습니다",
  "approval.patch_hash_blocked": "승인한 변경본과 달라 적용이 차단되었습니다",
  "role.skipped": "정책에 따라 역할 호출이 생략되었습니다",
  "role.completed": "역할 작업이 완료되었습니다",
  "budget.exceeded": "예산 한도에 도달했습니다",
  "validation.completed": "모든 검증을 통과했습니다",
  "validation.failed": "검증에 실패했습니다",
  "context.built": "작업 컨텍스트를 구성했습니다",
  "worktree.created": "격리 작업 공간을 만들었습니다",
  "worktree.removed": "작업 공간을 정리했습니다",
  "artifact.diff_created": "코드 변경본이 생성되었습니다",
  "worktree.diff_scope_validated": "변경 범위 검사를 통과했습니다",
  "tool.scope_blocked": "허용 범위 밖 접근이 차단되었습니다",
  "merge.candidate_created": "병합 후보가 생성되었습니다",
  "merge.assessed": "병합 충돌 여부를 확인했습니다",
  "artifact.graph_captured": "산출물 계보를 기록했습니다",
  "tool.call_started": "도구 사용을 시작했습니다",
  "tool.call_completed": "도구 사용을 마쳤습니다",
  "tool.call_failed": "도구 사용에 실패했습니다",
  "tool.call_blocked": "도구 사용이 차단되었습니다",
  "task.created": "새 업무가 만들어졌습니다",
  "task.assigned": "업무 담당자가 배정되었습니다",
  "task.transitioned": "업무 상태가 바뀌었습니다",
  "task.claimed": "업무를 맡았습니다",
  "task.worker_failed": "작업 실행이 실패했습니다",
  "review.added": "검토 의견이 추가되었습니다",
  "review.aggregated": "검토 의견이 취합되었습니다",
  "briefing.created": "CEO 브리핑이 작성되었습니다",
  "security.authentication_denied": "인증이 거부되었습니다",
  "security.login_succeeded": "로그인했습니다",
  "project.run_linked": "업무와 실행이 연결되었습니다",
  "project.budget_reserved": "프로젝트 예산이 예약되었습니다",
  "project.budget_settled": "프로젝트 예산이 정산되었습니다",
  "project.budget_blocked": "프로젝트 예산이 부족합니다",
  "game.xp_granted": "경험치를 획득했습니다",
  "game.achievement_unlocked": "업적을 달성했습니다",
  "office.incident_created": "사무실에 문제가 발생했습니다",
  "office.incident_resolved": "문제가 해결되었습니다"
};

const PREFIX: Array<[string, string]> = [
  ["plan.", "계획 단계 진행"],
  ["task.", "업무 진행"],
  ["validation.", "검증 진행"],
  ["approval.", "승인 진행"],
  ["tool.", "도구 사용"],
  ["merge.", "병합 진행"],
  ["artifact.", "산출물 갱신"],
  ["workflow.", "워크플로 진행"],
  ["company.", "회사 설정 변경"],
  ["project.", "프로젝트 진행"],
  ["review.", "검토 진행"],
  ["sandbox.", "격리 실행"],
  ["model.", "모델 호출"],
  ["game.", "성장 반영"],
  ["office.", "사무실 상태 변경"],
  ["adapter.", "외부 연동"],
  ["security.", "보안 이벤트"],
  ["legacy.", "시스템 이벤트"]
];

export function eventLabel(type: string): string {
  const exact = EXACT[type];
  if (exact) return exact;
  const prefix = PREFIX.find(([head]) => type.startsWith(head));
  return prefix ? `${prefix[1]} (${type})` : type;
}

const short = (value: string) => (value.length > 18 ? `${value.slice(0, 18)}…` : value);

/** 서버(game-progression)가 원장에 기록하는 영어 Incident 사유를 사용자 언어로 변환한다. 미등록 패턴은 원문 유지. */
export function incidentLabel(reason: string): string {
  if (reason === "Validation failed and requires revision") return "검증 실패 — 재작업이 필요합니다";
  const safety = reason.match(/^(.+) blocked by safety policy$/);
  if (safety) return `보안 정책 차단 — ${eventLabel(safety[1]!)}`;
  return reason;
}

/** 서버가 기록하는 영어 Run 브리핑 요약을 사용자 언어로 변환한다. 미등록 패턴은 원문 유지. */
export function briefingLabel(summary: string): string {
  const completed = summary.match(/^Run (.+) completed with (\d+) XP; (\d+) validation\(s\) passed and (\d+) revision signal\(s\) recorded\.$/);
  if (completed) return `Run ${short(completed[1]!)} 완료 — ${completed[2]} XP 획득 · 검증 통과 ${completed[3]}건 · 재작업 신호 ${completed[4]}건`;
  const blocked = summary.match(/^Run (.+) completed but reward was blocked by (\d+) safety incident\(s\)\.$/);
  if (blocked) return `Run ${short(blocked[1]!)} 완료 — 보안 사고 ${blocked[2]}건으로 보상이 지급되지 않았습니다`;
  return summary;
}
