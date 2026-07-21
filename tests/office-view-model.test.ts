import test from "node:test";
import assert from "node:assert/strict";
import {
  deskAssignmentsForRoom,
  deriveOfficeFeedback,
  interpolateOfficeMotion,
  latestWorkByAgent,
  movementDuration,
  officeStatusPresentation,
  roomWorkCounts,
  selectUnseenOfficeFeedback,
  type OfficeWorkItem,
} from "../packages/office-view-model/src/index.js";

const item = (
  key: string,
  agentId: string | null,
  phase: OfficeWorkItem["phase"],
  lastSequence: number,
): OfficeWorkItem => ({
  key,
  agentId,
  phase,
  lastSequence,
  projectId: "p",
  runId: key,
  taskId: `t-${key}`,
});

test("office view model selects each agent's latest independent work deterministically", () => {
  const states = latestWorkByAgent([
    item("r-old", "dev", "working", 1),
    item("r-qa", "qa", "validating", 4),
    item("r-new", "dev", "reviewing", 5),
    item("ignored", null, "blocked", 9),
  ]);
  assert.deepEqual(
    states.map((x) => [x.agentId, x.key, x.phase]),
    [
      ["dev", "r-new", "reviewing"],
      ["qa", "r-qa", "validating"],
    ],
  );
  assert.deepEqual(roomWorkCounts(states), {
    planning: 0,
    working: 0,
    validating: 2,
    approval: 0,
  });
});

test("office view model preserves the legacy active agent only when workItems lack that agent", () => {
  const fallback = item("legacy", "owner", "approval", 7);
  assert.deepEqual(
    latestWorkByAgent([], fallback).map((x) => [x.agentId, x.phase]),
    [["owner", "approval"]],
  );
  assert.equal(
    latestWorkByAgent([item("live", "owner", "working", 8)], fallback)[0]?.key,
    "live",
  );
});

test("office status presentation maps every phase to a truthful bubble and monitor state", () => {
  assert.deepEqual(
    [
      "idle",
      "planning",
      "working",
      "validating",
      "reviewing",
      "approval",
      "blocked",
      "completed",
    ].map((phase) =>
      officeStatusPresentation(phase as OfficeWorkItem["phase"]),
    ),
    [
      { bubble: "대기", monitor: "off" },
      { bubble: "계획 중", monitor: "planning" },
      { bubble: "작업 중", monitor: "working" },
      { bubble: "검증 중", monitor: "validating" },
      { bubble: "검토 중", monitor: "validating" },
      { bubble: "… 승인 대기", monitor: "approval" },
      { bubble: "! 차단", monitor: "blocked" },
      { bubble: "✓ 완료", monitor: "completed" },
    ],
  );
});

test("desk assignments prefer the newest room work and leave unused monitors off", () => {
  const states = latestWorkByAgent([
    item("old", "agent-c", "working", 1),
    item("new", "agent-a", "working", 9),
    item("middle", "agent-b", "working", 5),
    item("qa", "agent-d", "validating", 10),
  ]);
  assert.deepEqual(
    deskAssignmentsForRoom(states, "working", 4).map(
      (work) => work?.key ?? null,
    ),
    ["new", "middle", "old", null],
  );
  assert.deepEqual(
    deskAssignmentsForRoom(states, "validating", 2).map(
      (work) => work?.key ?? null,
    ),
    ["qa", null],
  );
});

test("office feedback uses event evidence for pass, failure, completion and exact XP", () => {
  const feedback = deriveOfficeFeedback({
    timeline: [
      {
        eventId: "pass",
        sequence: 10,
        type: "validation.completed",
        agentId: "qa",
      },
      {
        eventId: "fail",
        sequence: 11,
        type: "validation.completed",
        agentId: "qa",
      },
      {
        eventId: "done",
        sequence: 12,
        type: "workflow.completed",
        agentId: "owner",
      },
    ],
    alerts: [{ eventId: "fail", priority: "warning" }],
    ledger: [{ sourceEventId: "done", agentId: "developer", amount: 23 }],
  });
  assert.deepEqual(
    feedback.map((entry) => [
      entry.id,
      entry.agentId,
      entry.kind,
      entry.label,
      entry.amount,
    ]),
    [
      ["validation:pass", "qa", "validation-passed", "✓ 검증 통과", null],
      ["validation:fail", "qa", "validation-failed", "! 검증 실패", null],
      ["completed:done", "developer", "completed", "◆ 업무 완료", null],
      ["xp:done", "developer", "xp", "+23 XP", 23],
    ],
  );
});

test("office feedback selection never replays a seen event", () => {
  const feedback = deriveOfficeFeedback({
    timeline: [
      {
        eventId: "done",
        sequence: 1,
        type: "workflow.completed",
        agentId: "dev",
      },
    ],
    alerts: [],
    ledger: [{ sourceEventId: "done", agentId: "dev", amount: 25 }],
  });
  const first = selectUnseenOfficeFeedback(feedback, new Set());
  assert.deepEqual(
    first.unseen.map((entry) => entry.id),
    ["completed:done", "xp:done"],
  );
  assert.deepEqual(
    selectUnseenOfficeFeedback(feedback, first.seenIds).unseen,
    [],
  );
});

test("office motion interpolates deterministically with direction and three walking frames", () => {
  const from = { x: 10, y: 20 },
    to = { x: 210, y: 120 },
    duration = movementDuration(from, to),
    start = interpolateOfficeMotion(from, to, 0, duration),
    middle = interpolateOfficeMotion(from, to, duration / 2, duration),
    end = interpolateOfficeMotion(from, to, duration, duration);
  assert.deepEqual(
    [start.x, start.y, start.progress, start.done],
    [10, 20, 0, false],
  );
  assert.deepEqual([middle.x, middle.y, middle.progress], [110, 70, 0.5]);
  assert.deepEqual([end.x, end.y, end.frame, end.done], [210, 120, 0, true]);
  assert.ok(
    new Set(
      [0, 110, 220].map(
        (ms) => interpolateOfficeMotion(from, to, ms, duration).frame,
      ),
    ).size === 3,
  );
  assert.equal(interpolateOfficeMotion(to, from, 1, duration).direction, -1);
});

test("reduced motion jumps to the destination without a walking frame", () => {
  assert.deepEqual(
    interpolateOfficeMotion({ x: 1, y: 2 }, { x: 50, y: 60 }, 0, 500, true),
    { x: 50, y: 60, progress: 1, frame: 0, direction: 1, done: true },
  );
});
