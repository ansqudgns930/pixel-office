export type OfficePhase =
  | "idle"
  | "planning"
  | "working"
  | "validating"
  | "reviewing"
  | "approval"
  | "meeting"
  | "blocked"
  | "completed";

export interface OfficeWorkItem {
  key: string;
  projectId: string | null;
  runId: string | null;
  taskId: string | null;
  phase: OfficePhase;
  agentId: string | null;
  lastSequence: number;
  meetingId?: string | null;
  meetingStatus?: "live" | "decision-pending";
  meetingPaused?: boolean;
  meetingBubble?: string | null;
}

export interface AgentWorkState extends OfficeWorkItem {
  agentId: string;
}

export function meetingWorkItems(input:{meetings:ReadonlyArray<{id:string;status:"scheduled"|"live"|"decision-pending"|"ended"|"cancelled";participantIds:string[];paused:boolean;currentMessage?:{speakerId:string;content:string}|null}>;agentIds:ReadonlySet<string>;lastSequence:number}):OfficeWorkItem[]{return input.meetings.filter(meeting=>meeting.status==="live"||meeting.status==="decision-pending").flatMap((meeting,meetingIndex)=>meeting.participantIds.filter(id=>input.agentIds.has(id)).map((agentId,index)=>({key:`meeting:${meeting.id}:${agentId}`,projectId:null,runId:null,taskId:null,phase:"meeting" as const,agentId,lastSequence:input.lastSequence+1+meetingIndex*100+index,meetingId:meeting.id,meetingStatus:meeting.status as "live"|"decision-pending",meetingPaused:meeting.paused,meetingBubble:meeting.currentMessage?.speakerId===agentId?meeting.currentMessage.content.slice(0,80):null})));}

export function latestWorkByAgent(
  workItems: readonly OfficeWorkItem[],
  fallback?: OfficeWorkItem | null,
): AgentWorkState[] {
  const selected = new Map<string, AgentWorkState>();
  for (const item of workItems) {
    if (!item.agentId) continue;
    const candidate = { ...item, agentId: item.agentId },
      prior = selected.get(item.agentId);
    if (
      !prior ||
      candidate.lastSequence > prior.lastSequence ||
      (candidate.lastSequence === prior.lastSequence &&
        candidate.key.localeCompare(prior.key) < 0)
    )
      selected.set(item.agentId, candidate);
  }
  if (fallback?.agentId && !selected.has(fallback.agentId))
    selected.set(fallback.agentId, { ...fallback, agentId: fallback.agentId });
  return [...selected.values()].sort((a, b) =>
    a.agentId.localeCompare(b.agentId),
  );
}

export function officeRoomFor(
  phase: OfficePhase,
): "planning" | "working" | "validating" | "approval" {
  if (phase === "meeting") return "planning";
  if (phase === "working") return "working";
  if (phase === "validating" || phase === "reviewing" || phase === "blocked")
    return "validating";
  if (phase === "approval" || phase === "completed") return "approval";
  return "planning";
}

export function roomWorkCounts(
  states: readonly AgentWorkState[],
): Record<"planning" | "working" | "validating" | "approval", number> {
  const counts = { planning: 0, working: 0, validating: 0, approval: 0 };
  for (const state of states) counts[officeRoomFor(state.phase)]++;
  return counts;
}

export type OfficeMonitorState =
  | "off"
  | "planning"
  | "working"
  | "validating"
  | "approval"
  | "blocked"
  | "completed";

export interface OfficeStatusPresentation {
  bubble: string;
  monitor: OfficeMonitorState;
}

export function officeStatusPresentation(
  phase: OfficePhase,
): OfficeStatusPresentation {
  if (phase === "meeting") return { bubble: "회의 중", monitor: "planning" };
  if (phase === "working") return { bubble: "작업 중", monitor: "working" };
  if (phase === "validating")
    return { bubble: "검증 중", monitor: "validating" };
  if (phase === "reviewing")
    return { bubble: "검토 중", monitor: "validating" };
  if (phase === "approval")
    return { bubble: "… 승인 대기", monitor: "approval" };
  if (phase === "blocked") return { bubble: "! 차단", monitor: "blocked" };
  if (phase === "completed") return { bubble: "✓ 완료", monitor: "completed" };
  if (phase === "planning") return { bubble: "계획 중", monitor: "planning" };
  return { bubble: "대기", monitor: "off" };
}

export function deskAssignmentsForRoom(
  states: readonly AgentWorkState[],
  room: ReturnType<typeof officeRoomFor>,
  deskCount = 3,
): (AgentWorkState | null)[] {
  const assigned = states
    .filter((state) => officeRoomFor(state.phase) === room)
    .sort(
      (a, b) =>
        b.lastSequence - a.lastSequence || a.agentId.localeCompare(b.agentId),
    )
    .slice(0, Math.max(0, deskCount));
  return Array.from(
    { length: Math.max(0, deskCount) },
    (_, index) => assigned[index] ?? null,
  );
}

export type OfficeFeedbackKind =
  "xp" | "validation-passed" | "validation-failed" | "completed";

export interface OfficeFeedback {
  id: string;
  sourceEventId: string;
  sequence: number;
  agentId: string | null;
  kind: OfficeFeedbackKind;
  label: string;
  amount: number | null;
}

export function deriveOfficeFeedback(input: {
  timeline: readonly {
    eventId: string;
    sequence: number;
    type: string;
    agentId: string | null;
  }[];
  alerts: readonly { eventId: string; priority: string }[];
  ledger: readonly {
    sourceEventId: string;
    agentId: string;
    amount: number;
  }[];
}): OfficeFeedback[] {
  const warningIds = new Set(
      input.alerts
        .filter(
          (alert) =>
            alert.priority === "warning" || alert.priority === "critical",
        )
        .map((alert) => alert.eventId),
    ),
    timelineById = new Map(
      input.timeline.map((event) => [event.eventId, event]),
    ),
    rewardById = new Map(
      input.ledger.map((reward) => [reward.sourceEventId, reward]),
    ),
    feedback: OfficeFeedback[] = [];
  for (const event of input.timeline) {
    const failed =
      event.type === "validation.failed" ||
      (event.type === "validation.completed" && warningIds.has(event.eventId));
    if (
      event.type === "validation.completed" ||
      event.type === "validation.failed"
    )
      feedback.push({
        id: `validation:${event.eventId}`,
        sourceEventId: event.eventId,
        sequence: event.sequence,
        agentId: event.agentId,
        kind: failed ? "validation-failed" : "validation-passed",
        label: failed ? "! 검증 실패" : "✓ 검증 통과",
        amount: null,
      });
    if (event.type === "workflow.completed" || event.type === "run.completed") {
      const reward = rewardById.get(event.eventId);
      feedback.push({
        id: `completed:${event.eventId}`,
        sourceEventId: event.eventId,
        sequence: event.sequence,
        agentId: reward?.agentId ?? event.agentId,
        kind: "completed",
        label: "◆ 업무 완료",
        amount: null,
      });
    }
  }
  for (const reward of input.ledger) {
    const event = timelineById.get(reward.sourceEventId);
    feedback.push({
      id: `xp:${reward.sourceEventId}`,
      sourceEventId: reward.sourceEventId,
      sequence: event?.sequence ?? Number.MAX_SAFE_INTEGER,
      agentId: reward.agentId,
      kind: "xp",
      label: `+${reward.amount} XP`,
      amount: reward.amount,
    });
  }
  return feedback.sort(
    (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
  );
}

export function selectUnseenOfficeFeedback(
  feedback: readonly OfficeFeedback[],
  seenIds: ReadonlySet<string>,
): { unseen: OfficeFeedback[]; seenIds: Set<string> } {
  const nextSeen = new Set(seenIds),
    unseen: OfficeFeedback[] = [];
  for (const item of feedback) {
    if (!nextSeen.has(item.id)) unseen.push(item);
    nextSeen.add(item.id);
  }
  return { unseen, seenIds: nextSeen };
}

export interface OfficePoint {
  x: number;
  y: number;
}
export interface OfficeMotionFrame extends OfficePoint {
  progress: number;
  frame: 0 | 1 | 2;
  direction: -1 | 1;
  done: boolean;
}

export function movementDuration(from: OfficePoint, to: OfficePoint): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(360, Math.min(900, Math.round(distance * 2.2)));
}

export function interpolateOfficeMotion(
  from: OfficePoint,
  to: OfficePoint,
  elapsedMs: number,
  durationMs = movementDuration(from, to),
  reducedMotion = false,
): OfficeMotionFrame {
  const direction: OfficeMotionFrame["direction"] = to.x < from.x ? -1 : 1;
  if (reducedMotion || durationMs <= 0)
    return { x: to.x, y: to.y, progress: 1, frame: 0, direction, done: true };
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs)),
    eased =
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2,
    frame = (progress >= 1 ? 0 : Math.floor(elapsedMs / 110) % 3) as 0 | 1 | 2;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    progress,
    frame,
    direction,
    done: progress >= 1,
  };
}
