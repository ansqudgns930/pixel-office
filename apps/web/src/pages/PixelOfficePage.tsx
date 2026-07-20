import { useCallback, useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import PageHeader from "../components/PageHeader.tsx";
import CompanyModeBadge from "../components/CompanyModeBadge.tsx";
import { useSession } from "../auth/SessionContext.tsx";
import { apiGet, apiPost, readSse } from "../api.ts";
import type { CompanyMode, ResolvedAgentBinding } from "../types.ts";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AdvancedOfficePanel from "../components/AdvancedOfficePanel.tsx";
import { briefingLabel, eventLabel, incidentLabel } from "../eventLabels.ts";
import { shortId, uuid } from "../format.ts";
import {
  deskAssignmentsForRoom,
  deriveOfficeFeedback,
  interpolateOfficeMotion,
  latestWorkByAgent,
  meetingWorkItems,
  movementDuration,
  officeRoomFor,
  officeStatusPresentation,
  roomWorkCounts,
  selectUnseenOfficeFeedback,
  type OfficeFeedbackKind,
  type OfficePoint,
  type OfficeWorkItem,
} from "../../../../packages/office-view-model/src/index.ts";

type OfficePhase =
  | "idle"
  | "planning"
  | "working"
  | "validating"
  | "reviewing"
  | "approval"
  | "meeting"
  | "blocked"
  | "completed";
interface PixelAgent {
  principal_id: string;
  role: string;
}
interface CommandCenterSnapshot {
  pixel: { agents: PixelAgent[] };
  portfolio: { company: { name: string; mode: CompanyMode } };
  meetingSessions?: Array<{id:string;status:"scheduled"|"live"|"decision-pending"|"ended"|"cancelled";participantIds:string[];paused:boolean;title:string;currentMessage?:{speakerId:string;content:string}|null}>;
}
interface OfficeAlert {
  eventId: string;
  sequence: number;
  type: string;
  priority: "critical" | "high" | "warning";
  runId: string | null;
  taskId: string | null;
  message: string;
}
interface OfficeLink {
  projectId: string;
  taskId: string;
  runId: string | null;
  agentId: string;
  responsibility: string;
}
interface Projection {
  companyId: string;
  lastSequence: number;
  phase: OfficePhase;
  activeAgentId: string | null;
  projectId: string | null;
  runId: string | null;
  taskId: string | null;
  timeline: Array<{
    eventId: string;
    sequence: number;
    type: string;
    phase: OfficePhase;
    agentId: string | null;
  }>;
  alerts: OfficeAlert[];
  workItems: OfficeWorkItem[];
  stateHash: string;
}
interface GameProgression {
  companyXp: number;
  level: number;
  unlocks: string[];
  agents: Array<{
    agentId: string;
    xp: number;
    skills: {
      delivery: number;
      quality: number;
      efficiency: number;
      risk: number;
    };
  }>;
  metrics: {
    completedRuns: number;
    qualityPasses: number;
    validationFailures: number;
    incidents: number;
  };
  achievements: string[];
  ledger: Array<{
    sourceEventId: string;
    agentId: string;
    amount: number;
    reason: string;
  }>;
  incidents: Array<{
    sourceEventId: string;
    runId: string | null;
    severity: "warning" | "critical";
    reason: string;
  }>;
  briefings: Array<{
    sourceEventId: string;
    runId: string | null;
    summary: string;
    reward: number;
  }>;
  stateHash: string;
}
interface AgentMotion {
  group: Container;
  avatar: Container;
  leftLeg: Graphics;
  rightLeg: Graphics;
  from: OfficePoint;
  to: OfficePoint;
  startedAt: number;
  duration: number;
}
interface SpatialFeedbackMotion {
  id: string;
  kind: OfficeFeedbackKind;
  container: Container;
  startedAt: number;
  startY: number;
  duration: number;
  reduced: boolean;
}

const ROOMS = [
  {
    id: "planning",
    label: "CEO실 · 계획",
    shortLabel: "계획",
    x: 20,
    y: 20,
    color: 0x388bfd,
    icon: "◆",
  },
  {
    id: "working",
    label: "개발실 · 제작",
    shortLabel: "개발",
    x: 510,
    y: 20,
    color: 0x3fb950,
    icon: "</>",
  },
  {
    id: "validating",
    label: "QA실 · 검토",
    shortLabel: "검토",
    x: 20,
    y: 282,
    color: 0xd29922,
    icon: "✓",
  },
  {
    id: "approval",
    label: "승인실 · 보관",
    shortLabel: "승인",
    x: 510,
    y: 282,
    color: 0xa371f7,
    icon: "★",
  },
] as const;
const roomFor = officeRoomFor;
const phaseLabel: Record<OfficePhase, string> = {
  idle: "대기",
  planning: "계획",
  working: "작업",
  validating: "검증",
  reviewing: "검토",
  approval: "승인 대기",
  meeting: "회의",
  blocked: "차단",
  completed: "완료",
};
const monitorColor = {
  off: 0x0a1018,
  planning: 0x388bfd,
  working: 0x3fb950,
  validating: 0xd29922,
  approval: 0xa371f7,
  blocked: 0xf85149,
  completed: 0x39d0c8,
} as const;

function assignmentRationale(work: OfficeWorkItem | undefined, responsibility?: string | null): string {
  if (!work) return "현재 직접 배정된 업무가 없어 대기 중입니다. 새 업무가 들어오거나 회의에 초대되면 자동으로 방에 표시됩니다.";
  if (work.meetingId) return work.meetingStatus === "decision-pending" ? "회의에서 결정이 필요해 이 직원이 계획/회의 방에 남아 있습니다." : "현재 회의 참여자라서 계획/회의 방에 표시됩니다.";
  if (work.phase === "planning") return "업무 목표와 완료 조건을 정리하는 단계라 계획 담당자로 표시됩니다.";
  if (work.phase === "working") return responsibility === "reviewer" ? "검토 책임도 있지만 현재 Run 작업 흐름에 연결되어 개발실에 표시됩니다." : "실제 변경 작업을 맡고 있어 개발실에 표시됩니다.";
  if (work.phase === "validating" || work.phase === "reviewing") return "완료 조건과 결과 근거를 검토하는 단계라 QA/검토 방에 표시됩니다.";
  if (work.phase === "blocked") return "진행 차단 또는 검증 실패 신호가 있어 QA/검토 방에서 확인이 필요합니다.";
  if (work.phase === "approval") return "오너 승인이나 중요한 결정이 필요해 승인실에 표시됩니다.";
  if (work.phase === "completed") return "업무가 완료되어 결과 확인 대상으로 승인실에 보관됩니다.";
  return "회사 이벤트와 연결된 업무가 있어 현재 단계 방에 표시됩니다.";
}

function roomRationale(roomId: string): string {
  if (roomId === "planning") return "목표 해석, 계획 제안, 회의, 우선순위 조율이 모이는 방입니다.";
  if (roomId === "working") return "실제 구현·수정·작업 실행이 진행되는 방입니다.";
  if (roomId === "validating") return "QA, 검증 실패, blocked 상태, 재검토가 모이는 방입니다.";
  return "오너 승인, 완료 결과, 중요한 결정이 대기하는 방입니다.";
}

export default function PixelOfficePage() {
  const { actorId } = useSession(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [companyId, setCompanyId] = useState(
      () =>
        params.get("companyId") ??
        localStorage.getItem("agent-company-os.lastCompany") ??
        "demo-company",
    ),
    focusedGoalId = params.get("goalId"),
    [goal, setGoal] = useState("설정 화면에 연결 상태 배지를 추가해줘"),
    [company, setCompany] = useState<{
      name: string;
      mode: CompanyMode;
    } | null>(null),
    [agents, setAgents] = useState<PixelAgent[]>([]),
    [projection, setProjection] = useState<Projection | null>(null),
    [links, setLinks] = useState<OfficeLink[]>([]),
    [game, setGame] = useState<GameProgression | null>(null),
    [runBindings, setRunBindings] = useState<ResolvedAgentBinding[]>([]),
    [selectedAgentId, setSelectedAgentId] = useState<string | null>(() =>
      localStorage.getItem("agent-company-os.selectedAgent"),
    ),
    [connected, setConnected] = useState(false),
    [sceneReady, setSceneReady] = useState(false),
    [canvasSize, setCanvasSize] = useState({ width: 1012, height: 540 }),
    [running, setRunning] = useState(false),
    [restoring, setRestoring] = useState(true),
    [alertsExpanded, setAlertsExpanded] = useState(false),
    [activeRoom, setActiveRoom] = useState(0),
    [error, setError] = useState<string | null>(null),
    hostRef = useRef<HTMLDivElement | null>(null),
    feedbackLiveRef = useRef<HTMLParagraphElement | null>(null),
    sceneRef = useRef<Container | null>(null),
    pulseRef = useRef<Graphics[]>([]),
    agentPositionsRef = useRef(new Map<string, OfficePoint>()),
    motionsRef = useRef(new Map<string, AgentMotion>()),
    feedbackMotionsRef = useRef<SpatialFeedbackMotion[]>([]),
    seenFeedbackRef = useRef(new Set<string>()),
    feedbackCompanyRef = useRef<string | null>(null),
    restoredRef = useRef(false);
  useEffect(() => {
    const app = new Application();
    let cancelled = false,
      initialized = false,
      observer: ResizeObserver | undefined;
    const measure = () => {
      const width = Math.max(
          320,
          Math.min(
            1012,
            Math.floor(hostRef.current?.parentElement?.clientWidth ?? 1012),
          ),
        ),
        height = width < 600 ? 560 : 540;
      app.renderer.resize(width, height);
      setCanvasSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    void app
      .init({
        width: 1012,
        height: 540,
        backgroundColor: 0x080c12,
        antialias: false,
      })
      .then(() => {
        initialized = true;
        if (cancelled) {
          app.destroy(true);
          return;
        }
        hostRef.current?.appendChild(app.canvas);
        const scene = new Container();
        app.stage.addChild(scene);
        sceneRef.current = scene;
        measure();
        observer = new ResizeObserver(measure);
        if (hostRef.current?.parentElement)
          observer.observe(hostRef.current.parentElement);
        setSceneReady(true);
        app.ticker.add(() => {
          const now = performance.now(),
            reduced = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches,
            scale = 1 + Math.sin(now / 220) * 0.08;
          for (const dot of pulseRef.current) dot.scale.set(scale);
          const walkingFrames: number[] = [];
          for (const [agentId, motion] of motionsRef.current) {
            const frame = interpolateOfficeMotion(
              motion.from,
              motion.to,
              now - motion.startedAt,
              motion.duration,
              reduced,
            );
            motion.group.position.set(frame.x, frame.y);
            motion.avatar.scale.x = frame.direction;
            const stride = frame.frame === 1 ? 2 : frame.frame === 2 ? -2 : 0;
            motion.leftLeg.y = stride;
            motion.rightLeg.y = -stride;
            walkingFrames.push(frame.frame);
            agentPositionsRef.current.set(agentId, { x: frame.x, y: frame.y });
            if (frame.done) {
              motion.leftLeg.y = 0;
              motion.rightLeg.y = 0;
              motionsRef.current.delete(agentId);
            }
          }
          feedbackMotionsRef.current = feedbackMotionsRef.current.filter(
            (feedback) => {
              const elapsed = now - feedback.startedAt,
                progress = Math.min(1, elapsed / feedback.duration);
              if (!feedback.reduced) {
                feedback.container.y = feedback.startY - progress * 28;
                feedback.container.alpha =
                  progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
              }
              if (progress < 1) return true;
              feedback.container.removeFromParent();
              feedback.container.destroy({ children: true });
              return false;
            },
          );
          if (hostRef.current) {
            hostRef.current.dataset.movingAgents = String(
              motionsRef.current.size,
            );
            hostRef.current.dataset.walkFrames = walkingFrames.join(",");
            hostRef.current.dataset.activeFeedback = feedbackMotionsRef.current
              .map((feedback) => feedback.kind)
              .join(",");
          }
        });
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      setSceneReady(false);
      pulseRef.current = [];
      motionsRef.current.clear();
      feedbackMotionsRef.current = [];
      sceneRef.current = null;
      if (initialized) app.destroy(true);
      hostRef.current?.replaceChildren();
    };
  }, []);
  const render = useCallback(
    (people: PixelAgent[], state: Projection, progress: GameProgression) => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.removeChildren();
      pulseRef.current = [];
      motionsRef.current.clear();
      feedbackMotionsRef.current = [];
      const workStates = latestWorkByAgent(
          state.workItems ?? [],
          state.activeAgentId
            ? {
                key: state.runId ?? state.taskId ?? "legacy-active",
                projectId: state.projectId,
                runId: state.runId,
                taskId: state.taskId,
                phase: state.phase,
                agentId: state.activeAgentId,
                lastSequence: state.lastSequence,
              }
            : null,
        ),
        workByAgent = new Map(workStates.map((item) => [item.agentId, item])),
        roomCounts = roomWorkCounts(workStates),
        compact = canvasSize.width < 600,
        scale = compact ? 1 : canvasSize.width / 1012,
        roomWidth = compact ? (canvasSize.width - 30) / 2 : 462 * scale,
        roomHeight = compact ? 250 : 238,
        layouts = ROOMS.map((room, index) => ({
          ...room,
          x: compact ? 10 + (index % 2) * (roomWidth + 10) : room.x * scale,
          y: compact ? 10 + Math.floor(index / 2) * 270 : room.y,
          width: roomWidth,
          height: roomHeight,
        }));
      const allFeedback = deriveOfficeFeedback({
        timeline: state.timeline,
        alerts: state.alerts,
        ledger: progress.ledger ?? [],
      });
      let newFeedback: typeof allFeedback = [];
      if (feedbackCompanyRef.current !== state.companyId) {
        feedbackCompanyRef.current = state.companyId;
        seenFeedbackRef.current = new Set(allFeedback.map((item) => item.id));
      } else {
        const selected = selectUnseenOfficeFeedback(
          allFeedback,
          seenFeedbackRef.current,
        );
        newFeedback = selected.unseen;
        seenFeedbackRef.current = selected.seenIds;
      }
      if (hostRef.current) {
        hostRef.current.dataset.monitorStates = workStates
          .map(
            (work) =>
              `${work.agentId}:${officeStatusPresentation(work.phase).monitor}`,
          )
          .join(",");
        hostRef.current.dataset.statusBubbles = workStates
          .map(
            (work) =>
              `${work.agentId}:${officeStatusPresentation(work.phase).bubble}`,
          )
          .join(",");
        const meetingStates = workStates.filter((work) => work.phase === "meeting");
        hostRef.current.dataset.meetingParticipants = meetingStates
          .map((work) => work.agentId)
          .join(",");
        hostRef.current.dataset.meetingIds = [
          ...new Set(meetingStates.map((work) => work.meetingId).filter(Boolean)),
        ].join(",");
        hostRef.current.dataset.meetingStatuses = meetingStates
          .map(
            (work) =>
              `${work.agentId}:${work.meetingPaused ? "paused" : work.meetingStatus}`,
          )
          .join(",");
      }
      const floor = new Graphics();
      for (let x = 0; x < canvasSize.width; x += 16)
        for (let y = 0; y < canvasSize.height; y += 16)
          floor
            .rect(x, y, 16, 16)
            .fill({ color: (x / 16 + y / 16) % 2 ? 0x0b1119 : 0x0d141d });
      scene.addChild(floor);
      if (!compact) {
        const corridor = new Graphics();
        corridor.rect(0, 258, canvasSize.width, 24).fill(0x243143);
        corridor
          .rect(canvasSize.width / 2 - 12, 0, 24, canvasSize.height)
          .fill(0x243143);
        scene.addChild(corridor);
      }
      for (const [index, room] of layouts.entries()) {
        const count = roomCounts[room.id],
          active = count > 0 || (compact && index === activeRoom),
          box = new Graphics();
        box
          .roundRect(room.x, room.y, room.width, room.height, 4)
          .fill({
            color: active ? room.color : 0x131b25,
            alpha: active ? 0.18 : 0.96,
          })
          .stroke({
            width: active ? 3 : 2,
            color: active ? room.color : 0x425269,
          });
        box.eventMode = "static";
        box.cursor = "pointer";
        box.on("pointertap", () => focusRoom(index));
        const header = new Graphics();
        header.rect(room.x + 2, room.y + 2, room.width - 4, 34).fill({
          color: active ? room.color : 0x202c3a,
          alpha: active ? 0.42 : 0.95,
        });
        const label = new Text({
          text: `${room.icon}  ${room.label}  ·  ${count}명`,
          style: {
            fill: active ? 0xffffff : 0xc6d2df,
            fontSize: compact ? 10 : 13,
            fontWeight: "700",
            fontFamily: "monospace",
          },
        });
        label.position.set(room.x + 11, room.y + 10);
        scene.addChild(box, header, label);
        const deskColor =
          room.id === "working"
            ? 0x294d3d
            : room.id === "validating"
              ? 0x554722
              : room.id === "approval"
                ? 0x41325c
                : 0x243c5c;
        const deskAssignments = deskAssignmentsForRoom(workStates, room.id, 3);
        for (let desk = 0; desk < 3; desk++) {
          const furniture = new Graphics();
          const dx = room.x + 18 + desk * Math.max(52, (room.width - 50) / 3),
            dy = room.y + 64,
            assignedWork = deskAssignments[desk],
            monitor = assignedWork
              ? officeStatusPresentation(assignedWork.phase).monitor
              : "off",
            screenColor = monitorColor[monitor];
          furniture
            .rect(dx, dy, compact ? 38 : 54, 26)
            .fill(deskColor)
            .stroke({ width: 1, color: 0x60758c });
          furniture
            .rect(dx + 8, dy - 10, compact ? 22 : 34, 12)
            .fill({ color: screenColor, alpha: monitor === "off" ? 1 : 0.78 })
            .stroke({
              width: monitor === "blocked" ? 3 : 1,
              color: monitor === "off" ? room.color : screenColor,
            });
          if (assignedWork) {
            furniture
              .rect(dx + (compact ? 25 : 39), dy - 7, 3, 3)
              .fill(monitor === "blocked" ? 0xffffff : screenColor);
          }
          scene.addChild(furniture);
        }
        const plant = new Graphics();
        plant
          .rect(room.x + room.width - 25, room.y + room.height - 26, 13, 15)
          .fill(0x7b5133);
        plant
          .rect(room.x + room.width - 29, room.y + room.height - 39, 7, 14)
          .fill(0x3fb950);
        plant
          .rect(room.x + room.width - 21, room.y + room.height - 44, 7, 19)
          .fill(0x2ea043);
        scene.addChild(plant);
      }
      const meetingStates = workStates.filter((work) => work.phase === "meeting");
      if (meetingStates.length) {
        const planningRoom = layouts.find((room) => room.id === "planning")!;
        const table = new Graphics();
        const tableWidth = compact ? 86 : 132,
          tableHeight = compact ? 44 : 58,
          tableX = planningRoom.x + planningRoom.width / 2,
          tableY = planningRoom.y + 150;
        table
          .ellipse(tableX, tableY, tableWidth / 2, tableHeight / 2)
          .fill({ color: 0x274b73, alpha: 0.96 })
          .stroke({ width: 3, color: 0x79c0ff });
        const meetingLabel = new Text({
          text: `MEETING · ${new Set(meetingStates.map((work) => work.meetingId)).size}`,
          style: {
            fill: 0xdbeafe,
            fontSize: compact ? 8 : 10,
            fontWeight: "700",
            fontFamily: "monospace",
          },
        });
        meetingLabel.anchor.set(0.5);
        meetingLabel.position.set(
          tableX,
          tableY,
        );
        scene.addChild(table, meetingLabel);
      }
      const roomSlots = new Map<string, number>(),
        meetingSlots = new Map<string, number>(),
        reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      people.forEach((agent, index) => {
        const work = workByAgent.get(agent.principal_id),
          active = Boolean(work),
          targetRoom = work
            ? roomFor(work.phase)
            : index % 4 === 0
              ? "planning"
              : index % 4 === 1
                ? "working"
                : index % 4 === 2
                  ? "validating"
                  : "approval",
          room = layouts.find((x) => x.id === targetRoom) ?? layouts[0]!,
          slot = roomSlots.get(targetRoom) ?? 0,
          meetingSlot = work?.phase === "meeting"
            ? (meetingSlots.get(work.meetingId ?? "meeting") ?? 0)
            : -1,
          meetingOffsets = [
            { x: -76, y: -4 },
            { x: 76, y: -4 },
            { x: -52, y: 60 },
            { x: 52, y: 60 },
            { x: 0, y: -38 },
            { x: 0, y: 76 },
          ],
          // meetingOffsets are tuned for the desktop room width (462px). In compact mode the room
          // can be as narrow as ~145px, so seats must shrink toward the center or they overlap each
          // other and spill outside the room box (and their name/status labels with them).
          meetingScale = compact ? Math.min(1, (room.width / 2 - 15) / 76) : 1,
          rawMeetingOffset = meetingOffsets[((meetingSlot % meetingOffsets.length) + meetingOffsets.length) % meetingOffsets.length] ?? { x: 0, y: 0 },
          meetingOffset = { x: rawMeetingOffset.x * meetingScale, y: rawMeetingOffset.y * meetingScale },
          target = work?.phase === "meeting"
            ? {
                x: room.x + room.width / 2 + meetingOffset.x,
                y: room.y + 140 + meetingOffset.y,
              }
            : {
                x: room.x + 34 + (slot % 2) * Math.max(58, room.width / 2 - 25),
                y: room.y + 128 + Math.floor(slot / 2) * 67,
              };
        roomSlots.set(targetRoom, slot + 1);
        if (work?.phase === "meeting")
          meetingSlots.set(work.meetingId ?? "meeting", meetingSlot + 1);
        const roleColor = agent.role.includes("develop")
            ? 0x3fb950
            : agent.role.includes("qa") || agent.role.includes("review")
              ? 0xd29922
              : agent.role.includes("owner") || agent.role.includes("execut")
                ? 0xa371f7
                : 0x58a6ff,
          group = new Container(),
          avatar = new Container(),
          shadow = new Graphics(),
          body = new Graphics(),
          leftLeg = new Graphics(),
          rightLeg = new Graphics();
        shadow.ellipse(0, 15, 14, 5).fill({ color: 0x000000, alpha: 0.45 });
        body.rect(-7, -13, 14, 12).fill(roleColor);
        body.rect(-9, -1, 18, 14).fill(active ? room.color : roleColor);
        body.rect(-4, -9, 2, 2).fill(0x091018);
        body.rect(2, -9, 2, 2).fill(0x091018);
        leftLeg.rect(-7, 13, 5, 5).fill(0x73869a);
        rightLeg.rect(2, 13, 5, 5).fill(0x73869a);
        avatar.addChild(shadow, body, leftLeg, rightLeg);
        avatar.eventMode = "static";
        avatar.cursor = "pointer";
        avatar.on("pointertap", () => selectAgent(agent.principal_id));
        group.addChild(avatar);
        if (active) pulseRef.current.push(body);
        const status = work ? phaseLabel[work.phase] : "대기",
          // Meeting participants already show status in their speech bubble; the redundant second
          // label line collides with neighbors' labels once more than ~2 people share a table, on
          // desktop as well as compact mode (seats are only ~100px apart around a shrunk table).
          isMeetingParticipant = work?.phase === "meeting",
          label = new Text({
            text: isMeetingParticipant
              ? agent.principal_id.replace("demo-", "")
              : `${agent.principal_id.replace("demo-", "")}\n${status}${work ? ` · ${shortId(work.taskId ?? work.runId ?? work.key)}` : ""}`,
            style: {
              fill: active ? 0xffffff : 0xa9b7c6,
              fontSize: compact ? 8 : 10,
              fontWeight: active ? "700" : "500",
              fontFamily: "monospace",
              align: "center",
            },
          });
        label.anchor.set(0.5, 0);
        label.position.set(0, 22);
        group.addChild(label);
        if (work) {
          const presentation = work.phase==="meeting"?{bubble:work.meetingPaused?"회의 일시중지":work.meetingStatus==="decision-pending"?"결정 대기":work.meetingBubble?`${work.meetingBubble.slice(0,12)}${work.meetingBubble.length>12?"…":""}`:"회의 중",monitor:"planning" as const}:officeStatusPresentation(work.phase),
            severityColor =
              presentation.monitor === "blocked"
                ? monitorColor.blocked
                : presentation.monitor === "completed"
                  ? monitorColor.completed
                  : presentation.monitor === "approval"
                    ? monitorColor.approval
                    : room.color,
            bubbleWidth = compact ? 58 : 82,
            bubble = new Graphics();
          bubble
            .roundRect(12, -38, bubbleWidth, 22, 5)
            .fill(0xffffff)
            .stroke({ width: 2, color: severityColor });
          const bubbleText = new Text({
            text: presentation.bubble,
            style: {
              fill: presentation.monitor === "blocked" ? 0x7f1d1d : 0x111827,
              fontSize: compact ? 8 : 9,
              fontWeight: "700",
              fontFamily: "monospace",
            },
          });
          bubbleText.position.set(18, -32);
          group.addChild(bubble, bubbleText);
        }
        const previous =
            agentPositionsRef.current.get(agent.principal_id) ?? target,
          changed =
            Math.abs(previous.x - target.x) > 0.5 ||
            Math.abs(previous.y - target.y) > 0.5;
        if (changed && !reduced) {
          group.position.set(previous.x, previous.y);
          motionsRef.current.set(agent.principal_id, {
            group,
            avatar,
            leftLeg,
            rightLeg,
            from: previous,
            to: target,
            startedAt: performance.now(),
            duration: movementDuration(previous, target),
          });
        } else {
          group.position.set(target.x, target.y);
          agentPositionsRef.current.set(agent.principal_id, target);
        }
        scene.addChild(group);
      });
      const feedbackLanes = new Map<string, number>(),
        reducedFeedback = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches,
        feedbackColors: Record<OfficeFeedbackKind, number> = {
          xp: 0xf2cc60,
          "validation-passed": 0x3fb950,
          "validation-failed": 0xf85149,
          completed: 0x39d0c8,
        };
      for (const feedback of newFeedback) {
        if (!feedback.agentId) continue;
        const position = agentPositionsRef.current.get(feedback.agentId);
        if (!position) continue;
        const lane = feedbackLanes.get(feedback.agentId) ?? 0,
          color = feedbackColors[feedback.kind],
          container = new Container(),
          plate = new Graphics(),
          width = feedback.kind === "xp" ? 58 : 86;
        feedbackLanes.set(feedback.agentId, lane + 1);
        plate
          .roundRect(-4, -3, width, 19, 4)
          .fill({ color: 0x071018, alpha: 0.92 })
          .stroke({ width: 2, color });
        if (!reducedFeedback)
          plate
            .rect(-9, 2, 3, 3)
            .rect(width + 2, 7, 3, 3)
            .fill(color);
        const text = new Text({
          text: feedback.label,
          style: {
            fill: color,
            fontSize: compact ? 8 : 10,
            fontWeight: "700",
            fontFamily: "monospace",
          },
        });
        text.position.set(2, 1);
        container.addChild(plate, text);
        container.position.set(position.x - 12, position.y - 52 - lane * 23);
        scene.addChild(container);
        feedbackMotionsRef.current.push({
          id: feedback.id,
          kind: feedback.kind,
          container,
          startedAt: performance.now(),
          startY: container.y,
          duration: reducedFeedback ? 2400 : 1500,
          reduced: reducedFeedback,
        });
      }
      if (hostRef.current && newFeedback.length) {
        hostRef.current.dataset.lastFeedback = newFeedback
          .map(
            (feedback) =>
              `${feedback.agentId}:${feedback.kind}:${feedback.label}`,
          )
          .join(",");
        hostRef.current.dataset.feedbackMotion = reducedFeedback
          ? "static"
          : "floating";
      }
      if (feedbackLiveRef.current && newFeedback.length)
        feedbackLiveRef.current.textContent = newFeedback
          .map(
            (feedback) =>
              `${feedback.agentId ?? "담당자 미정"} ${feedback.label}`,
          )
          .join(", ");
      const sign = new Text({
        text: `${company?.name ?? companyId} · ${state.projectId ? shortId(state.projectId) : "NO PROJECT"} · EVENT #${state.lastSequence}`,
        style: {
          fill: 0x8fa6bd,
          fontSize: compact ? 9 : 11,
          fontFamily: "monospace",
        },
      });
      sign.position.set(12, canvasSize.height - 17);
      scene.addChild(sign);
    },
    [activeRoom, canvasSize, company?.name, companyId],
  );
  const load = useCallback(
    async (id = companyId) => {
      const [center, state, progress, agentLinks] = await Promise.all([
          apiGet<CommandCenterSnapshot>(
            `/api/companies/${encodeURIComponent(id)}?actor=${encodeURIComponent(actorId)}`,
          ),
          apiGet<Projection>(
            `/api/companies/${encodeURIComponent(id)}/office-projection?actor=${encodeURIComponent(actorId)}`,
          ),
          apiGet<GameProgression>(
            `/api/companies/${encodeURIComponent(id)}/game-progression?actor=${encodeURIComponent(actorId)}`,
          ),
          apiGet<OfficeLink[]>(
            `/api/companies/${encodeURIComponent(id)}/office-links?actor=${encodeURIComponent(actorId)}`,
          ),
        ]),
        resolved =
          center.portfolio.company.mode === "live" && state.runId
            ? await apiGet<ResolvedAgentBinding[]>(
                `/api/runs/${encodeURIComponent(state.runId)}/agent-bindings?actor=${encodeURIComponent(actorId)}`,
              ).catch(() => [])
            : [];
      localStorage.setItem("agent-company-os.lastCompany", id);
      if (state.projectId)
        localStorage.setItem("agent-company-os.lastProject", state.projectId);
      setCompany(center.portfolio.company);
      setAgents(center.pixel.agents);
      const meetingWork=meetingWorkItems({meetings:center.meetingSessions??[],agentIds:new Set(center.pixel.agents.map(agent=>agent.principal_id)),lastSequence:state.lastSequence});setProjection({...state,workItems:[...(state.workItems??[]),...meetingWork]});
      setLinks(agentLinks);
      setGame(progress);
      setRunBindings(resolved);
      return state.lastSequence;
    },
    [actorId, companyId],
  );
  useEffect(() => {
    if (sceneReady && projection && game) render(agents, projection, game);
  }, [sceneReady, agents, projection, game, render, canvasSize]);
  async function startDemo() {
    setError(null);
    setRunning(true);
    try {
      await apiPost("/api/demo/bootstrap", {});
      await apiPost("/api/demo/scenarios", {
        requestId: uuid(),
        goal,
        auto: true,
      });
      setCompanyId("demo-company");
      await load("demo-company");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }
  function selectAgent(id: string) {
    setSelectedAgentId(id);
    localStorage.setItem("agent-company-os.selectedAgent", id);
  }
  function closeDrawer() {
    setSelectedAgentId(null);
    localStorage.removeItem("agent-company-os.selectedAgent");
  }
  function focusRoom(index: number) {
    setActiveRoom(index);
  }
  function executionUrl(
    runId: string,
    projectId = projection?.projectId,
    agentId = selectedAgentId,
  ) {
    const query = new URLSearchParams({ runId, companyId });
    if (projectId) query.set("projectId", projectId);
    if (agentId) query.set("agentId", agentId);
    if (params.get("goalId")) query.set("goalId", params.get("goalId")!);
    return `/execution?${query.toString()}`;
  }
  function decisionInboxUrl() {
    const query = new URLSearchParams({ companyId });
    if (params.get("goalId")) query.set("goalId", params.get("goalId")!);
    return `/reviews?${query.toString()}`;
  }
  function alertTargetUrl(alert: OfficeAlert) {
    if (alert.priority === "high" || alert.type.startsWith("approval.") || alert.type.includes("approval")) return decisionInboxUrl();
    if (alert.runId) return executionUrl(alert.runId);
    if (alert.taskId && projection?.projectId) return `/projects?projectId=${encodeURIComponent(projection.projectId)}&companyId=${encodeURIComponent(companyId)}`;
    return decisionInboxUrl();
  }
  useEffect(() => {
    const agentId = params.get("agentId");
    if (agentId) selectAgent(agentId);
  }, []);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void load(companyId)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRestoring(false));
  }, [actorId]);
  useEffect(() => {
    if (!selectedAgentId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedAgentId]);
  useEffect(() => {
    if (!projection) return;
    const controller = new AbortController();
    let cursor = projection.lastSequence,
      stopped = false;
    setConnected(false);
    const loop = async () => {
      while (!stopped) {
        try {
          let received = false;
          await readSse(
            `/api/events?companyId=${encodeURIComponent(companyId)}&after=${cursor}`,
            controller.signal,
            (event) => {
              cursor = Math.max(cursor, event.id);
              received = true;
              void load(companyId);
            },
            () => setConnected(true),
          );
          if (received) cursor = await load(companyId);
          if (!stopped) setConnected(false);
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        } catch (e) {
          if (controller.signal.aborted) return;
          setConnected(false);
          setError(e instanceof Error ? e.message : String(e));
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
        }
      }
    };
    void loop();
    return () => {
      stopped = true;
      controller.abort();
      setConnected(false);
    };
  }, [companyId, load, projection?.companyId]);
  const agentWorkStates = projection
      ? latestWorkByAgent(
          projection.workItems ?? [],
          projection.activeAgentId
            ? {
                key: projection.runId ?? projection.taskId ?? "legacy-active",
                projectId: projection.projectId,
                runId: projection.runId,
                taskId: projection.taskId,
                phase: projection.phase,
                agentId: projection.activeAgentId,
                lastSequence: projection.lastSequence,
              }
            : null,
        )
      : [],
    workByAgent = new Map(agentWorkStates.map((item) => [item.agentId, item])),
    selectedWork = selectedAgentId
      ? workByAgent.get(selectedAgentId)
      : undefined,
    roomCounts = roomWorkCounts(agentWorkStates);
  const selectedLink = selectedAgentId ? links.find((item) => item.agentId === selectedAgentId && (!selectedWork?.taskId || item.taskId === selectedWork.taskId)) : undefined;
  const appliedBinding =
    runBindings.find((item) => item.memberId === selectedAgentId) ??
    (selectedWork
      ? runBindings.find((item) => item.role === "worker")
      : undefined);
  const groupedIncidents = Object.values(
    (game?.incidents ?? []).reduce<
      Record<
        string,
        { item: GameProgression["incidents"][number]; count: number }
      >
    >((result, item) => {
      const key = `${item.severity}:${item.reason}`;
      result[key] ??= { item, count: 0 };
      result[key].item = item;
      result[key].count += 1;
      return result;
    }, {}),
  )
    .slice(-3)
    .reverse();
  const groupedAlerts = Object.values(
    (projection?.alerts ?? []).reduce<
      Record<string, { item: OfficeAlert; count: number }>
    >((result, item) => {
      const key = `${item.runId ?? item.taskId ?? "company"}:${item.type}:${item.priority}`;
      result[key] ??= { item, count: 0 };
      result[key].count += 1;
      return result;
    }, {}),
  )
    .slice(-5)
    .reverse();
  return (
    <div className="pixel-office-page">
      <PageHeader
        title="픽셀 오피스"
        description="업무 절차가 아니라 AI 회사의 진행 상황을 보는 live view입니다."
      />
      <section
        className="office-toolbar card"
        aria-label="픽셀 오피스 연결 설정"
      >
        <div className="office-controls">
          <span className="connected-company">
            <small>연결 회사</small>
            <strong>{company?.name ?? companyId}</strong>
          </span>
          <button disabled={restoring} onClick={() => void load()}>
            상태 새로고침
          </button>
          <Link
            className="button-link"
            to={`/company?companyId=${encodeURIComponent(companyId)}`}
          >
            회사 홈
          </Link>
          <Link
            className="button-link"
            to={`/goals?companyId=${encodeURIComponent(companyId)}${params.get("goalId") ? `&goalId=${encodeURIComponent(params.get("goalId")!)}` : ""}`}
          >
            맡긴 일
          </Link>
          <Link
            className="button-link"
            to={`/meetings?companyId=${encodeURIComponent(companyId)}${params.get("goalId") ? `&goalId=${encodeURIComponent(params.get("goalId")!)}` : ""}`}
          >
            회의
          </Link>
          {projection?.projectId && (
            <Link
              className="button-link"
              to={`/projects?projectId=${encodeURIComponent(projection.projectId)}&companyId=${encodeURIComponent(companyId)}${params.get("goalId") ? `&goalId=${encodeURIComponent(params.get("goalId")!)}` : ""}`}
            >
              현재 프로젝트
            </Link>
          )}
        </div>
        <div className="office-connection" role="status">
          <span
            className={`status-dot ${connected ? "status-good" : "status-warning"}`}
          />
          {restoring
            ? "회사 업무 상태를 불러오는 중"
            : connected
              ? "실시간 연결됨"
              : "연결 대기"}
        </div>
      </section>
      <section className="card" aria-label="픽셀 오피스 live view 안내">
        <div className="section-heading">
          <div>
            <h2>진행 상황 Live View</h2>
            <p>픽셀 오피스는 업무를 시작하는 필수 단계가 아니라, AI 회사가 계획·작업·검증·결정을 어떻게 진행 중인지 보는 창입니다.</p>
          </div>
          <Link className="button-link" to={`/company?companyId=${encodeURIComponent(companyId)}`}>새 업무 맡기기</Link>
        </div>
        <div className="badge-row">
          <Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}${params.get("goalId") ? `&goalId=${encodeURIComponent(params.get("goalId")!)}` : ""}`}>맡긴 일 확인</Link>
          <Link className="button-link" to={`/reviews?companyId=${encodeURIComponent(companyId)}`}>결정 필요 처리</Link>
          <Link className="button-link" to={`/employees?companyId=${encodeURIComponent(companyId)}`}>직원·AI팀 보기</Link>
          <Link className="button-link" to={`/activity?companyId=${encodeURIComponent(companyId)}`}>결과·활동 보기</Link>
        </div>
      </section>
      {focusedGoalId && (
        <section className="card" aria-label="선택 목표 추적">
          <div className="section-heading"><div><span className="eyebrow">GOAL FOCUS</span><h2>선택 목표 추적 중</h2><p>이 live view는 현재 목표와 관련된 직원·방·결정 신호를 우선 해석합니다.</p></div><span className="badge">{shortId(focusedGoalId)}</span></div>
          <div className="badge-row">
            <Link className="button-link" to={`/goals?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(focusedGoalId)}`}>목표 상세</Link>
            <Link className="button-link" to={`/reviews?companyId=${encodeURIComponent(companyId)}`}>결정 필요</Link>
            <Link className="button-link" to={`/activity?companyId=${encodeURIComponent(companyId)}&goalId=${encodeURIComponent(focusedGoalId)}`}>결과·활동</Link>
          </div>
        </section>
      )}
      <details className="demo-tools card">
        <summary>데모·개발 도구</summary>
        <div className="row">
          <label className="inline office-goal">
            데모 목표
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && goal.trim()) void startDemo();
              }}
            />
          </label>
          <button
            className="secondary"
            disabled={running || !goal.trim()}
            onClick={() => void startDemo()}
          >
            {running ? "진행 중…" : "데모 실행"}
          </button>
        </div>
        <small>실제 회사 업무와 분리된 검증용 시나리오를 생성합니다.</small>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {company && projection && (
        <section className="office-summary">
          <div>
            <strong>{company.name}</strong>
            <CompanyModeBadge mode={company.mode} />
          </div>
          <span className={`phase-chip phase-${projection.phase}`}>
            동시 업무 {agentWorkStates.length}건
          </span>
          <span>
            계획 {roomCounts.planning} · 개발 {roomCounts.working} · 검토{" "}
            {roomCounts.validating} · 승인 {roomCounts.approval}
          </span>
          <span>이벤트 #{projection.lastSequence}</span>
          {game && (
            <>
              <span className="xp-chip">
                회사 Lv.{game.level} · {game.companyXp} XP
              </span>
              <span>
                완료 {game.metrics.completedRuns} · 품질{" "}
                {game.metrics.qualityPasses} · Incident {game.metrics.incidents}
              </span>
              {game.achievements.map((item) => (
                <span className="achievement-chip" key={item}>
                  업적 · {item}
                </span>
              ))}
            </>
          )}
        </section>
      )}
      {game && (
        <section
          className="game-progress card"
          aria-label="회사 성장과 Incident"
        >
          <div>
            <h2>회사 성장</h2>
            <p>해금: {game.unlocks.join(" · ")}</p>
          </div>
          <div>
            <h2>최근 Run 브리핑</h2>
            <p>
              {game.briefings.length
                ? briefingLabel(game.briefings.at(-1)!.summary)
                : "완료된 Run이 없습니다."}
            </p>
          </div>
          {groupedIncidents.length > 0 && (
            <div className="game-incidents">
              <h2>Incident</h2>
              {groupedIncidents.map(({ item, count }) => (
                <button
                  key={`${item.runId}:${item.severity}:${item.reason}`}
                  className={`office-alert priority-${item.severity}`}
                  onClick={() =>
                    item.runId && navigate(executionUrl(item.runId))
                  }
                >
                  <strong>{item.severity}</strong>
                  <span title={item.reason}>{incidentLabel(item.reason)}</span>
                  {count > 1 && <small>{count}건</small>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {groupedAlerts.length > 0 && (
        <section
          className={`office-alerts${alertsExpanded ? " expanded" : ""}`}
          aria-label="우선 알림"
        >
          <h2>
            우선 알림 <small>{groupedAlerts.length}건</small>
          </h2>
          {groupedAlerts.map(({ item: alert, count }) => (
            <button
              key={`${alert.runId ?? alert.taskId}:${alert.type}:${alert.priority}`}
              className={`office-alert priority-${alert.priority}`}
              onClick={() => navigate(alertTargetUrl(alert))}
            >
              <strong>{alert.priority}</strong>
              <span>{eventLabel(alert.type)}</span>
              <small title={alert.runId ?? alert.taskId ?? undefined}>
                {shortId(alert.runId ?? alert.taskId ?? "회사 이벤트")}
                {count > 1 ? ` · ${count}건` : ""}
              </small>
            </button>
          ))}
          {groupedAlerts.length > 2 && (
            <button
              className="secondary alert-expand"
              onClick={() => setAlertsExpanded((value) => !value)}
            >
              {alertsExpanded
                ? "알림 접기"
                : `알림 ${groupedAlerts.length - 2}개 더 보기`}
            </button>
          )}
        </section>
      )}
      <div className="office-layout">
        <div>
          <nav className="office-room-nav" aria-label="오피스 방 이동">
            {ROOMS.map((room, index) => {
              const roomStates = agentWorkStates.filter(
                (work) => roomFor(work.phase) === room.id,
              );
              return (
                <button
                  key={room.id}
                  className={activeRoom === index ? "active" : ""}
                  aria-pressed={activeRoom === index}
                  aria-label={`${room.shortLabel}, 활성 ${roomStates.length}명${roomStates.length ? `, ${roomStates.map((work) => `${work.agentId} ${officeStatusPresentation(work.phase).bubble}`).join(", ")}` : ", 모니터 꺼짐"}`}
                  onClick={() => focusRoom(index)}
                >
                  {room.label.split(" · ")[0]}{" "}
                  <small>{roomCounts[room.id]}</small>
                </button>
              );
            })}
          </nav>
          <section className="card" aria-label="선택한 방의 진행 업무">
            <div className="section-heading"><div><h2>{ROOMS[activeRoom]?.shortLabel ?? "오피스"} 진행 업무</h2><p>{roomRationale(ROOMS[activeRoom]?.id ?? "planning")} 방을 클릭해 단계별 업무를 보고, 필요한 화면으로 이동하세요.</p></div>{focusedGoalId && <span className="badge">목표 {shortId(focusedGoalId)}</span>}</div>
            <div className="badge-row">
              {agentWorkStates.filter(work => roomFor(work.phase) === ROOMS[activeRoom]?.id).map(work => (
                <button key={work.key} className="linked-work" onClick={() => work.runId ? navigate(executionUrl(work.runId, work.projectId, work.agentId)) : work.projectId ? navigate(`/projects?projectId=${encodeURIComponent(work.projectId)}&companyId=${encodeURIComponent(companyId)}`) : undefined}>
                  <strong>{work.agentId ?? "미배정"} · {phaseLabel[work.phase]}</strong>
                  <span>{shortId(work.taskId ?? work.runId ?? work.key)}</span>
                  <small>{assignmentRationale(work, links.find((link) => link.taskId === work.taskId && link.agentId === work.agentId)?.responsibility)}</small>
                  <small>{work.runId ? "고급 실행 근거 보기" : "프로젝트 보기"}</small>
                </button>
              ))}
              {!agentWorkStates.some(work => roomFor(work.phase) === ROOMS[activeRoom]?.id) && <span className="badge">현재 이 방에서 진행 중인 업무가 없습니다.</span>}
            </div>
          </section>
          <section
            className="office-canvas"
            aria-label={`CEO실, 개발실, QA실, 승인실로 구성된 픽셀 오피스. 실제 동시 업무 ${agentWorkStates.length}건`}
          >
            <div ref={hostRef} />
            <p
              ref={feedbackLiveRef}
              className="office-feedback-live"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            />
          </section>
          <section className="agent-roster" aria-label="직원별 실제 업무 상태">
            {[...agents]
              .sort(
                (a, b) =>
                  (a.principal_id === actorId ? 1 : 0) -
                  (b.principal_id === actorId ? 1 : 0),
              )
              .map((agent) => {
                const isMe = agent.principal_id === actorId,
                  work = workByAgent.get(agent.principal_id);
                return (
                  <button
                    className={`${work ? "active" : ""}${focusedGoalId && work ? " goal-focused" : ""}`.trim()}
                    aria-pressed={selectedAgentId === agent.principal_id}
                    aria-label={`${agent.principal_id} · ${work ? phaseLabel[work.phase] : "대기"}${work ? ` · ${work.taskId ?? work.runId ?? work.key}` : ""}`}
                    key={agent.principal_id}
                    onClick={() => selectAgent(agent.principal_id)}
                  >
                    <span className={`agent-avatar${isMe ? " human" : ""}`}>
                      {agent.principal_id
                        .replace("demo-", "")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span>
                      <strong>
                        {agent.principal_id.replace("demo-", "")}
                        {isMe && <span className="me-badge">나</span>}
                      </strong>
                      <small>
                        {work
                          ? `${phaseLabel[work.phase]} · ${shortId(work.taskId ?? work.runId ?? work.key)}`
                          : isMe
                            ? `${agent.role} · 사람 계정`
                            : `${agent.role} · ${game?.agents.find((x) => x.agentId === agent.principal_id)?.xp ?? 0} XP`}
                      </small>
                    </span>
                  </button>
                );
              })}
          </section>
          <Link
            className="button-link office-employees-link"
            to={`/employees?companyId=${encodeURIComponent(companyId)}`}
          >
            직원·AI팀 전체 보기
          </Link>
        </div>
        <aside className="office-timeline">
          <details open>
            <summary>이벤트 타임라인</summary>
            {projection?.timeline.length ? (
              <ol>
                {[...projection.timeline]
                  .reverse()
                  .slice(0, 12)
                  .map((item) => (
                    <li key={`${item.sequence}:${item.eventId}`}>
                      <span className="timeline-seq">#{item.sequence}</span>
                      <strong>{phaseLabel[item.phase]}</strong>
                      <small title={item.type}>{eventLabel(item.type)}</small>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="empty-state">수신된 업무 이벤트가 없습니다.</p>
            )}
          </details>
        </aside>
      </div>
      <details
        className="advanced-office-wrap"
        open={companyId === "qa-company"}
      >
        <summary>고급 Live View 운영 · 채용 · 전체 이벤트</summary>
        <AdvancedOfficePanel companyId={companyId} actorId={actorId} />
      </details>
      {projection && (
        <p className="office-hash">Projection hash: {projection.stateHash}</p>
      )}
      {selectedAgentId && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="직원 상세 닫기"
            onClick={closeDrawer}
          />
          <aside
            className="agent-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-drawer-title"
          >
            <header>
              <div>
                <span className="agent-avatar large">
                  {selectedAgentId
                    .replace("demo-", "")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <h2 id="agent-drawer-title">
                    {selectedAgentId.replace("demo-", "")}
                  </h2>
                  <p>
                    {agents.find((x) => x.principal_id === selectedAgentId)
                      ?.role ?? "직원"}
                  </p>
                </div>
              </div>
              <button
                className="icon-button"
                autoFocus
                aria-label="닫기"
                onClick={closeDrawer}
              >
                ×
              </button>
            </header>
            <Link
              className="button-link"
              to={`/employees?companyId=${encodeURIComponent(companyId)}&agentId=${encodeURIComponent(selectedAgentId)}`}
            >
              직원·AI팀 상세
            </Link>
            <dl>
              <div>
                <dt>현재 상태</dt>
                <dd>
                  {selectedWork ? phaseLabel[selectedWork.phase] : "대기"}
                </dd>
              </div>
              <div>
                <dt>경험치</dt>
                <dd>
                  {game?.agents.find((x) => x.agentId === selectedAgentId)
                    ?.xp ?? 0}{" "}
                  XP
                </dd>
              </div>
              {Object.entries(
                game?.agents.find((x) => x.agentId === selectedAgentId)
                  ?.skills ?? {},
              ).map(([skill, xp]) => (
                <div key={skill}>
                  <dt>{skill}</dt>
                  <dd>{xp} 숙련도</dd>
                </div>
              ))}
              <div>
                <dt>왜 배정됐나</dt>
                <dd>{assignmentRationale(selectedWork, selectedLink?.responsibility)}</dd>
              </div>
              {selectedLink?.responsibility && <div><dt>책임</dt><dd>{selectedLink.responsibility}</dd></div>}
              {focusedGoalId && <div><dt>추적 목표</dt><dd>{shortId(focusedGoalId)}</dd></div>}
              <div>
                <dt>연결 업무</dt>
                <dd>
                  {links.filter((x) => x.agentId === selectedAgentId).length}건
                </dd>
              </div>
              <div>
                <dt>현재 Task</dt>
                <dd>{selectedWork?.taskId ?? "배정 대기"}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{selectedWork?.runId ?? "-"}</dd>
              </div>
              {selectedWork?.meetingId&&<div><dt>회의</dt><dd><Link to={`/meetings?companyId=${encodeURIComponent(companyId)}&meetingId=${encodeURIComponent(selectedWork.meetingId)}&participantId=${encodeURIComponent(selectedAgentId ?? "")}`}>{selectedWork.meetingPaused?"일시중지":selectedWork.meetingStatus==="decision-pending"?"결정 대기":"진행 중"}</Link></dd></div>}
              {appliedBinding && (
                <>
                  <div>
                    <dt>Agent Backend</dt>
                    <dd>
                      {appliedBinding.backend} · {appliedBinding.modelId}
                    </dd>
                  </div>
                  <div>
                    <dt>해석 경로</dt>
                    <dd>
                      {appliedBinding.resolution} · {appliedBinding.role}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            {selectedWork?.runId && (
              <button
                className="linked-work"
                onClick={() =>
                  navigate(
                    executionUrl(
                      selectedWork.runId!,
                      selectedWork.projectId,
                      selectedAgentId,
                    ),
                  )
                }
              >
                <strong>고급 실행에서 Run 근거 보기</strong>
                <span>{shortId(selectedWork.taskId ?? selectedWork.key)}</span>
                <small>{shortId(selectedWork.runId)}</small>
              </button>
            )}
            {links
              .filter((x) => x.agentId === selectedAgentId)
              .map((link) => (
                <button
                  className="linked-work"
                  key={`${link.taskId}:${link.responsibility}`}
                  onClick={() =>
                    link.runId &&
                    navigate(
                      `/execution?runId=${encodeURIComponent(link.runId)}`,
                    )
                  }
                >
                  <strong>{link.responsibility}</strong>
                  <span title={link.taskId}>{shortId(link.taskId)}</span>
                  <small title={link.runId ?? undefined}>
                    {link.runId ? shortId(link.runId) : "Run 미연결"}
                  </small>
                </button>
              ))}
            <section>
              <h2>최근 관련 이벤트</h2>
              <ul>
                {projection?.timeline
                  .filter((item) => item.agentId === selectedAgentId)
                  .slice(-5)
                  .reverse()
                  .map((item) => (
                    <li key={`${item.sequence}:${item.eventId}`}>
                      <strong>{phaseLabel[item.phase]}</strong>
                      <span title={item.type}>{eventLabel(item.type)}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </aside>
        </>
      )}
    </div>
  );
}
