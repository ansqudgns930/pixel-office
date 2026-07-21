import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_EVENT_TYPE_MAP, mapLegacyEvent, mapLegacyEventType } from "../packages/event-mapper/src/index.js";

test("mapLegacyEventType translates known legacy types and falls back safely for unknown ones", () => {
  assert.equal(mapLegacyEventType("RUN_CREATED"), "run.created");
  assert.equal(mapLegacyEventType("WORKFLOW_PUBLISHED"), "workflow.published");
  assert.equal(mapLegacyEventType("SOME_FUTURE_TYPE_NOT_YET_MAPPED"), "legacy.some_future_type_not_yet_mapped");
});

test("every mapped legacy type produces a dot-notation string with no double dots or uppercase", () => {
  for (const [legacy, mapped] of Object.entries(LEGACY_EVENT_TYPE_MAP)) {
    assert.ok(mapped.includes("."), `${legacy} -> ${mapped} should contain a dot`);
    assert.equal(mapped, mapped.toLowerCase(), `${legacy} -> ${mapped} should be lowercase`);
    assert.ok(!mapped.includes(".."), `${legacy} -> ${mapped} should not have a double dot`);
  }
});

test("mapLegacyEvent builds a complete v2 envelope and omits absent optional identifiers", () => {
  const event = mapLegacyEvent({
    cursor: 42,
    eventId: "evt-1",
    tenantId: "company-a",
    aggregateType: "run",
    aggregateId: "run-1",
    type: "RUN_CREATED",
    timestamp: "2026-07-15T00:00:00.000Z",
    payload: { runId: "run-1", requestId: "req-1" }
  }, "demo");

  assert.equal(event.eventVersion, 2);
  assert.equal(event.eventId, "evt-1");
  assert.equal(event.sequence, 42);
  assert.equal(event.type, "run.created");
  assert.equal(event.companyId, "company-a");
  assert.equal(event.runId, "run-1");
  assert.equal(event.correlationId, "run-1");
  assert.equal(event.mode, "demo");
  assert.equal(event.actor.type, "system");
  assert.ok(!("projectId" in event));
  assert.ok(!("taskId" in event));
  assert.ok(!("agentId" in event));
});

test("mapLegacyEvent infers a user actor when the payload carries an actor identifier and defaults mode to live", () => {
  const event = mapLegacyEvent({
    cursor: 1,
    eventId: "evt-2",
    tenantId: "company-b",
    aggregateType: "project",
    aggregateId: "project-1",
    type: "TASK_ASSIGNED",
    timestamp: "2026-07-15T00:00:01.000Z",
    payload: { actorId: "owner", projectId: "project-1", taskId: "task-1" }
  });

  assert.equal(event.type, "task.assigned");
  assert.equal(event.mode, "live");
  assert.deepEqual(event.actor, { type: "user", id: "owner" });
  assert.equal(event.projectId, "project-1");
  assert.equal(event.taskId, "task-1");
  assert.equal(event.correlationId, "project-1");
});

test("mapLegacyEvent recovers project and run identifiers from aggregate metadata",()=>{const run=mapLegacyEvent({cursor:2,eventId:"run-event",tenantId:"company",aggregateType:"run",aggregateId:"run-42",type:"RUN_TRANSITIONED",timestamp:"2026-07-15T00:00:02.000Z",payload:{from:"RUNNING",to:"VALIDATING"}}),project=mapLegacyEvent({cursor:3,eventId:"project-event",tenantId:"company",aggregateType:"project",aggregateId:"project-42",type:"TASK_CLAIMED",timestamp:"2026-07-15T00:00:03.000Z",payload:{taskId:"task-42",owner:"agent-42"}});assert.equal(run.runId,"run-42");assert.equal(run.correlationId,"run-42");assert.equal(project.projectId,"project-42");assert.equal(project.taskId,"task-42");assert.equal(project.agentId,"agent-42");});
