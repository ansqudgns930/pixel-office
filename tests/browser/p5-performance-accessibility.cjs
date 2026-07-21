const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
async function main() {
  const root = path.resolve(__dirname, "../..");
  const server = spawn(
    process.execPath,
    [
      path.join(root, "apps/web/node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
    ],
    { cwd: path.join(root, "apps/web"), stdio: "ignore" },
  );
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch("http://127.0.0.1:4173");
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (i === 39) throw new Error("Vite preview did not start");
  }
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_AUTOMATION_EXECUTABLE,
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.addInitScript(() => {
      localStorage.setItem("agent-company-os.apiToken", "qa-token");
      localStorage.setItem("agent-company-os.actorId", "owner");
      localStorage.setItem("agent-company-os.username", "qa");
      localStorage.setItem("agent-company-os.role", "owner");
      localStorage.setItem("agent-company-os.lastCompany", "qa-company");
    });
    const staff = Array.from({ length: 30 }, (_, i) => ({
        principalId: `agent-${i}`,
        principal_id: `agent-${i}`,
        departmentId: "d",
        role: "member",
        specialty: i === 29 ? "security" : null,
        characterStyle: i === 29 ? "specialist" : "developer",
        placement: {
          floor: 1,
          zone: i % 2 ? "development" : "planning",
          desk: i,
        },
      })),
      events = Array.from({ length: 500 }, (_, i) => ({
        version: "1.0",
        eventId: `e-${i + 1}`,
        cursor: i + 1,
        tenantId: "qa-company",
        aggregateType: "office",
        aggregateId: "qa-company",
        type: "REPLAY_EVENT",
        timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        payload: { i },
      }));
    let workItems = [
        {
          key: "r1",
          projectId: "p1",
          runId: "r1",
          taskId: "t1",
          phase: "working",
          agentId: "agent-1",
          lastSequence: 498,
        },
        {
          key: "r2",
          projectId: "p1",
          runId: "r2",
          taskId: "t2",
          phase: "validating",
          agentId: "agent-2",
          lastSequence: 499,
        },
        {
          key: "r3",
          projectId: "p1",
          runId: "r3",
          taskId: "t3",
          phase: "approval",
          agentId: "agent-3",
          lastSequence: 500,
        },
        {
          key: "r4",
          projectId: "p1",
          runId: "r4",
          taskId: "t4",
          phase: "blocked",
          agentId: "agent-4",
          lastSequence: 497,
        },
        {
          key: "r5",
          projectId: "p1",
          runId: "r5",
          taskId: "t5",
          phase: "completed",
          agentId: "agent-5",
          lastSequence: 496,
        },
      ],
      timeline = [],
      alerts = [],
      ledger = [];
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname;
      let body = {};
      if (path.endsWith("/office-projection"))
        body = {
          companyId: "qa-company",
          lastSequence: 500,
          phase: "approval",
          activeAgentId: "agent-3",
          projectId: "p1",
          runId: "r3",
          taskId: "t3",
          timeline,
          alerts,
          workItems,
          stateHash: "hash",
        };
      else if (path.endsWith("/game-progression"))
        body = {
          companyXp: 0,
          level: 1,
          unlocks: [],
          agents: [],
          metrics: {
            completedRuns: 0,
            qualityPasses: 0,
            validationFailures: 0,
            incidents: 0,
          },
          achievements: [],
          ledger,
          incidents: [],
          briefings: [],
          stateHash: "game",
        };
      else if (path.endsWith("/office-links")) body = [];
      else if (
        path.startsWith("/api/runs/") &&
        path.endsWith("/agent-bindings")
      )
        body = [
          {
            companyId: "qa-company",
            role: "worker",
            memberId: "agent-1",
            backend: "codex-cli",
            modelId: "gpt-5",
            resolution: "member",
            bindingId: "binding-1",
            bindingVersion: 1,
          },
        ];
      else if (path.endsWith("/agent-bindings"))
        body = [
          {
            id: "binding-1",
            companyId: "qa-company",
            targetKind: "member",
            targetId: "agent-1",
            backend: "codex-cli",
            modelId: "gpt-5",
            config: {},
            version: 1,
            changedBy: "owner",
            changedAt: "2026-07-15T00:00:00.000Z",
          },
        ];
      else if (path.endsWith("/office/replay")) {
        const after = Number(url.searchParams.get("after") || 0);
        body = {
          events: after ? [] : events,
          nextAfter: after ? after : 500,
          hasMore: false,
        };
      } else if (path.endsWith("/office"))
        body = {
          floors: [
            {
              floor: 1,
              name: "Delivery Floor",
              unlockLevel: 1,
              zones: ["planning", "development", "qa", "approval"],
            },
          ],
          staff,
          decorations: [],
          projects: [
            { projectId: "p1", priority: 1 },
            { projectId: "p2", priority: 2 },
          ],
          capacity: { staff: 30, target: 30 },
          theme: "classic",
          availableThemes: ["classic", "night", "forest", "high-contrast"],
        };
      else if (path === "/api/events")
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: "",
        });
      else if (/^\/api\/companies\/[^/]+$/.test(path))
        body = {
          portfolio: {
            company: {
              id: "qa-company",
              name: "QA Company",
              mode: "live",
              status: "active",
              workspaceId: "w",
              budgetLimit: 20,
              mandatoryReviews: [],
              mandatoryApprovals: [],
              allowedTools: [],
            },
            departments: [],
            projects: [
              {
                departmentId: "d",
                priority: 1,
                project: {
                  id: "p1",
                  workspaceId: "w",
                  name: "QA Project",
                  repoPath: ".",
                  defaultBranch: "main",
                  runtimePath: ".",
                  organizationProfile: {},
                  budgetLimit: 10,
                  spent: 1,
                  status: "active",
                },
                progress: { total: 1, done: 0 },
                risks: { blocked: 0, stale: 0, conflicts: 0, approvals: 0 },
              },
            ],
            totals: {
              projects: 1,
              tasks: 1,
              done: 0,
              spent: 1,
              budget: 10,
              blocked: 0,
              stale: 0,
              conflicts: 0,
              approvals: 0,
            },
            snapshotHash: "portfolio",
          },
          briefings: [],
          meetings: [],
          audit: [],
          recommendations: [],
          pixel: { agents: staff },
        };
      else if (path === "/api/projects/p1")
        body = {
          project: {
            id: "p1",
            workspaceId: "w",
            name: "QA Project",
            repoPath: ".",
            defaultBranch: "main",
            runtimePath: ".",
            organizationProfile: {},
            budgetLimit: 10,
            spent: 1,
            status: "active",
          },
          milestones: [],
          tasks: [],
          notifications: [],
          progress: { total: 0, done: 0 },
        };
      else body = {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto(
      `${process.env.P5_QA_URL || "http://127.0.0.1:4173"}/pixel-office`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator("#advanced-office-title").waitFor({ timeout: 10000 });
    const canvas = page.locator("canvas");
    await canvas.waitFor();
    assert.equal(await canvas.count(), 1);
    assert.equal(await page.locator(".agent-roster button.active").count(), 5);
    const monitorStates =
      (await page
        .locator(".office-canvas > div")
        .getAttribute("data-monitor-states")) ?? "";
    assert.match(monitorStates, /agent-1:working/);
    assert.match(monitorStates, /agent-2:validating/);
    assert.match(monitorStates, /agent-3:approval/);
    assert.match(monitorStates, /agent-4:blocked/);
    assert.match(monitorStates, /agent-5:completed/);
    const statusBubbles =
      (await page
        .locator(".office-canvas > div")
        .getAttribute("data-status-bubbles")) ?? "";
    assert.match(statusBubbles, /agent-3:… 승인 대기/);
    assert.match(statusBubbles, /agent-4:! 차단/);
    assert.match(statusBubbles, /agent-5:✓ 완료/);
    assert.match(
      await page.locator(".office-summary").innerText(),
      /동시 업무 5건/,
    );
    assert.match(
      await page.locator(".office-summary").innerText(),
      /개발 1 · 검토 2 · 승인 2/,
    );
    await page.screenshot({
      path: path.join(root, "docs", "pixel-office-autostate-desktop.png"),
      fullPage: true,
    });
    timeline = [
      {
        eventId: "validation-pass-501",
        sequence: 501,
        type: "validation.completed",
        phase: "validating",
        agentId: "agent-2",
      },
    ];
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(() =>
      (
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback ?? ""
      ).includes("validation-passed"),
    );
    assert.match(
      (await page.locator(".office-feedback-live").textContent()) ?? "",
      /agent-2 ✓ 검증 통과/,
    );
    assert.equal(
      await page
        .locator(".office-canvas > div")
        .getAttribute("data-feedback-motion"),
      "floating",
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback === "",
    );
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForTimeout(120);
    assert.equal(
      await page
        .locator(".office-canvas > div")
        .getAttribute("data-active-feedback"),
      "",
    );
    timeline = [
      ...timeline,
      {
        eventId: "validation-fail-502",
        sequence: 502,
        type: "validation.completed",
        phase: "validating",
        agentId: "agent-4",
      },
    ];
    alerts = [
      {
        eventId: "validation-fail-502",
        sequence: 502,
        type: "validation.completed",
        priority: "warning",
        runId: "r4",
        taskId: "t4",
        message: "Validation did not pass",
      },
    ];
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(() =>
      (
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback ?? ""
      ).includes("validation-failed"),
    );
    assert.match(
      (await page
        .locator(".office-canvas > div")
        .getAttribute("data-last-feedback")) ?? "",
      /agent-4:validation-failed:! 검증 실패/,
    );
    timeline = [
      ...timeline,
      {
        eventId: "workflow-done-503",
        sequence: 503,
        type: "workflow.completed",
        phase: "completed",
        agentId: "agent-1",
      },
    ];
    ledger = [
      {
        sourceEventId: "workflow-done-503",
        agentId: "agent-1",
        amount: 23,
        reason: "Completed workflow",
      },
    ];
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(() => {
      const active =
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback ?? "";
      return active.includes("completed") && active.includes("xp");
    });
    assert.match(
      (await page
        .locator(".office-canvas > div")
        .getAttribute("data-last-feedback")) ?? "",
      /agent-1:xp:\+23 XP/,
    );
    await page.screenshot({
      path: path.join(root, "docs", "pixel-office-feedback-desktop.png"),
      fullPage: true,
    });
    workItems = workItems.map((item) =>
      item.agentId === "agent-1"
        ? { ...item, phase: "validating", lastSequence: 501 }
        : item,
    );
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector(".office-canvas > div")?.dataset
            .movingAgents ?? 0,
        ) > 0,
    );
    const walkingFrames = await page.evaluate(async () => {
      const seen = new Set();
      for (let index = 0; index < 9; index++) {
        for (const frame of (
          document.querySelector(".office-canvas > div")?.dataset.walkFrames ??
          ""
        ).split(","))
          if (frame) seen.add(Number(frame));
        await new Promise((resolve) => setTimeout(resolve, 55));
      }
      return [...seen].sort();
    });
    assert.deepEqual(walkingFrames, [0, 1, 2]);
    await page.screenshot({
      path: path.join(root, "docs", "pixel-office-walking-desktop.png"),
      fullPage: true,
    });
    await page.waitForFunction(
      () =>
        document.querySelector(".office-canvas > div")?.dataset.movingAgents ===
        "0",
    );
    assert.equal(await page.getByLabel("agent-1 · 검증 · t1").count(), 1);
    workItems = workItems.map((item) =>
      item.agentId === "agent-1"
        ? { ...item, phase: "working", lastSequence: 502 }
        : item,
    );
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector(".office-canvas > div")?.dataset
            .movingAgents ?? 0,
        ) > 0,
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".office-canvas > div")?.dataset.movingAgents ===
        "0",
    );
    const people = page.locator(".office-person");
    await people.first().waitFor();
    assert.equal(await people.count(), 30);
    const fps = await page.evaluate(async () => {
      const frames = [];
      await new Promise((resolve) => {
        let last = performance.now();
        function frame(now) {
          frames.push(now - last);
          last = now;
          if (frames.length >= 120) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      const avg =
        frames.slice(10).reduce((a, b) => a + b, 0) / (frames.length - 10);
      return 1000 / avg;
    });
    assert.ok(fps >= 30, `FPS below floor: ${fps}`);
    const list = page.locator(".virtual-timeline-viewport");
    await list.waitFor();
    const rendered = await list.getByRole("listitem").count();
    assert.ok(rendered <= 25, `virtual list rendered ${rendered}`);
    const before = await list.evaluate((x) => x.scrollTop);
    await list.focus();
    await page.keyboard.press("End");
    const after = await list.evaluate((x) => x.scrollTop);
    assert.ok(after > before, "End key did not scroll virtual list");
    await page.emulateMedia({ reducedMotion: "reduce" });
    timeline = [
      ...timeline,
      {
        eventId: "validation-pass-505",
        sequence: 505,
        type: "validation.completed",
        phase: "validating",
        agentId: "agent-2",
      },
    ];
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(() =>
      (
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback ?? ""
      ).includes("validation-passed"),
    );
    assert.equal(
      await page
        .locator(".office-canvas > div")
        .getAttribute("data-feedback-motion"),
      "static",
    );
    workItems = workItems.map((item) =>
      item.agentId === "agent-1"
        ? { ...item, phase: "validating", lastSequence: 503 }
        : item,
    );
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.getByLabel("agent-1 · 검증 · t1").waitFor();
    assert.equal(
      await page
        .locator(".office-canvas > div")
        .getAttribute("data-moving-agents"),
      "0",
    );
    workItems = workItems.map((item) =>
      item.agentId === "agent-1"
        ? { ...item, phase: "working", lastSequence: 504 }
        : item,
    );
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.getByLabel("agent-1 · 작업 · t1").waitFor();
    const duration = await page
      .locator(".person-sprite")
      .first()
      .evaluate((x) => getComputedStyle(x).animationDuration);
    assert.ok(
      Number.parseFloat(duration) <= 0.00001,
      `reduced motion not applied: ${duration}`,
    );
    const labels = await page.locator("[aria-label]").count();
    assert.ok(labels >= 8);
    const aria = await page.locator("body").ariaSnapshot();
    assert.match(aria, /직원별 실제 업무 상태/);
    assert.match(aria, /agent-2 · 검증 · t2/);
    await page.getByLabel("agent-1 · 작업 · t1").click();
    assert.match(await page.getByRole("dialog").innerText(), /작업/);
    assert.match(await page.getByRole("dialog").innerText(), /r1/);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(root, "docs", "pixel-office-workitems-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor();
    const mobile = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      mobile.scrollWidth <= mobile.clientWidth,
      `mobile overflow ${mobile.scrollWidth}/${mobile.clientWidth}`,
    );
    assert.equal(await page.locator(".agent-roster button.active").count(), 5);
    timeline = [
      ...timeline,
      {
        eventId: "validation-fail-mobile-506",
        sequence: 506,
        type: "validation.failed",
        phase: "blocked",
        agentId: "agent-1",
      },
    ];
    alerts = [
      ...alerts,
      {
        eventId: "validation-fail-mobile-506",
        sequence: 506,
        type: "validation.failed",
        priority: "warning",
        runId: "r4",
        taskId: "t4",
        message: "Validation failed",
      },
    ];
    await page.getByRole("button", { name: "상태 새로고침" }).click();
    await page.waitForFunction(() =>
      (
        document.querySelector(".office-canvas > div")?.dataset
          .activeFeedback ?? ""
      ).includes("validation-failed"),
    );
    await page.screenshot({
      path: path.join(root, "docs", "pixel-office-feedback-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `${process.env.P5_QA_URL || "http://127.0.0.1:4173"}/pixel-office`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("link", { name: "회사 상세" }).click();
    await page.getByRole("heading", { name: "회사 홈" }).waitFor();
    assert.match(page.url(), /companyId=qa-company/);
    await page.getByRole("link", { name: /QA Project/ }).click();
    await page.getByRole("heading", { name: "Project War Room" }).waitFor();
    assert.match(page.url(), /projectId=p1/);
    console.log(
      JSON.stringify({
        fps: Number(fps.toFixed(1)),
        staff: 30,
        activeWork: 5,
        totalEvents: 500,
        renderedRows: rendered,
        keyboardScroll: after,
        reducedMotionDuration: duration,
        ariaLabels: labels,
        mobileOverflow: mobile.scrollWidth - mobile.clientWidth,
      }),
    );
  } finally {
    await browser.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
