import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Worker } from "bullmq";
import { SQLiteStateStore } from "../../packages/persistence/src/index.js";
import { RunQueue, type RunJob } from "../../packages/queue/src/index.js";
import { RunController } from "../../packages/runtime/src/index.js";
import { RunIntakeService } from "../../packages/policy/src/index.js";
import {
  RolePipeline,
  type Role,
} from "../../packages/role-pipeline/src/index.js";
import { StandaloneHostAdapter } from "../standalone-host/src/index.js";
import { LegacyNvidiaHostAdapter } from "../legacy-nvidia-host/src/index.js";
import { NvidiaHttpClient } from "../legacy-nvidia-host/src/http-client.js";
import { OpenAICompatibleClient } from "../../packages/model-adapters/src/index.js";
import { loadAgentBackendConfig } from "../../packages/backend-config/src/index.js";
import { CliAgentClient } from "../../packages/cli-agent-adapter/src/index.js";
import {
  AgentBindingStore,
  type ResolvedAgentBinding,
  type ResolvedMeetingBinding,
} from "../../packages/agent-bindings/src/index.js";
import type { HostAdapter } from "../../packages/host-adapter-sdk/src/index.js";
import type { AgentBackendConfig } from "../../packages/backend-config/src/index.js";
import { WorktreeManager } from "../../packages/worktree/src/index.js";
import { ApprovalIntegrity } from "../../packages/approval/src/index.js";
import { MergeCandidateService } from "../../packages/merge-candidate/src/index.js";
import { Phase1Execution } from "../../packages/phase1-execution/src/index.js";
import { ControlPlaneApi } from "../control-plane/src/index.js";
import type { CommandPolicy } from "../../packages/execution-sandbox/src/index.js";
import {
  ProjectOperations,
  ProjectRunBudgetGuard,
} from "../../packages/project-ops/src/index.js";
import { CompanyOperations } from "../../packages/company-ops/src/index.js";
import {
  PlatformOperations,
  PlatformRunGovernance,
} from "../../packages/platform-ops/src/index.js";
import {
  LocalAuth,
  OperationalStore,
} from "../../packages/operations/src/index.js";
import { RepositoryRoleContext } from "../../packages/repository-context/src/index.js";
import { MeetingAgentRunner } from "../../packages/meeting-runner/src/index.js";
import { MeetingSemanticSummaryService } from "../../packages/meeting-semantics/src/index.js";
import { AgentReportInterpreter } from "../../packages/agent-reporting/src/index.js";
import { ReportingProjector } from "../../packages/reporting/src/index.js";
import { draftGoal } from "../../packages/goal-drafting/src/index.js";
import {
  FirebaseHostingAdapter,
  type FirebaseCommandResult,
} from "../../packages/deployment/src/index.js";
import {
  collectBuildReviewEvidence,
  type FrontendCaptureRequest,
  type FrontendState,
} from "../../packages/review-evidence/src/index.js";
import { PlaywrightFrontendCaptureAdapter } from "../../packages/review-evidence/src/playwright.js";

export interface LocalControlPlaneOptions {
  repo: string;
  runtimeDir: string;
  git: string;
  commands: Readonly<Record<string, CommandPolicy>>;
  redis?: { host: string; port: number };
  port?: number;
  apiToken?: string;
}
function modelMaxTokens(): number {
  const configured = Number(process.env.AGENT_COMPANY_MODEL_MAX_TOKENS ?? 8192);
  return Number.isFinite(configured) && configured >= 320
    ? Math.floor(configured)
    : 8192;
}
function boundHost(
  binding: Pick<ResolvedAgentBinding, "backend" | "modelId" | "config">,
  runtime: AgentBackendConfig,
  operations: OperationalStore,
): HostAdapter {
  const baseUrl =
      typeof binding.config.baseUrl === "string"
        ? binding.config.baseUrl
        : runtime.baseUrl,
    cliPath =
      typeof binding.config.cliPath === "string"
        ? binding.config.cliPath
        : undefined;
  if (binding.backend === "legacy-nvidia")
    return new LegacyNvidiaHostAdapter(
      new NvidiaHttpClient(
        baseUrl ?? "http://0.0.0.0:3000",
        modelMaxTokens(),
        operations,
      ),
      operations,
    );
  if (binding.backend === "openai-compatible")
    return new StandaloneHostAdapter(
      new OpenAICompatibleClient({
        baseUrl: baseUrl ?? "http://0.0.0.0:11434/v1",
        maxTokens: modelMaxTokens(),
        ...(runtime.apiKey ? { apiKey: runtime.apiKey } : {}),
      }),
      binding.backend,
    );
  if (binding.backend === "claude-cli" || binding.backend === "codex-cli")
    return new StandaloneHostAdapter(
      new CliAgentClient({
        provider: binding.backend === "claude-cli" ? "claude" : "codex",
        ...(cliPath ? { executable: cliPath } : {}),
      }),
      binding.backend,
    );
  return new StandaloneHostAdapter(undefined, "standalone");
}
export async function startLocalControlPlane(
  options: LocalControlPlaneOptions,
): Promise<{ url: string; close(): Promise<void> }> {
  const repo = resolve(options.repo),
    runtime = resolve(options.runtimeDir),
    connection = options.redis ?? { host: "0.0.0.0", port: 6379 };
  const dbPath = resolve(runtime, "data", "agent-company.sqlite"),
    store = new SQLiteStateStore(dbPath),
    queue = new RunQueue(connection),
    controller = new RunController(store, queue),
    intake = new RunIntakeService(store, controller),
    projects = new ProjectOperations(store.db, store),
    companies = new CompanyOperations(store.db, store, projects),
    platform = new PlatformOperations(store.db, store, projects, companies),
    operations = new OperationalStore(store.db, dbPath),
    backend = loadAgentBackendConfig(),
    client =
      backend.host === "openai-compatible"
        ? new OpenAICompatibleClient({
            baseUrl: backend.baseUrl!,
            maxTokens: modelMaxTokens(),
            ...(backend.apiKey ? { apiKey: backend.apiKey } : {}),
          })
        : backend.host === "claude-cli" || backend.host === "codex-cli"
          ? new CliAgentClient({
              provider: backend.host === "claude-cli" ? "claude" : "codex",
              ...(backend.cliPath ? { executable: backend.cliPath } : {}),
            })
          : undefined,
    host =
      backend.host === "legacy-nvidia"
        ? new LegacyNvidiaHostAdapter(
            new NvidiaHttpClient(
              backend.baseUrl!,
              modelMaxTokens(),
              operations,
            ),
            operations,
          )
        : new StandaloneHostAdapter(client, backend.host),
    bindings = new AgentBindingStore(store.db, companies, backend),
    bindingHosts = new Map<string, HostAdapter>(),
    router = {
      freeze(runId: string) {
        return bindings.freezeRun(runId);
      },
      resolve(runId: string, role: Role) {
        const selected = bindings.resolveRun(runId, role),
          key = JSON.stringify([selected.backend, selected.config]);
        let selectedHost = bindingHosts.get(key);
        if (!selectedHost) {
          selectedHost = boundHost(selected, backend, operations);
          bindingHosts.set(key, selectedHost);
        }
        return {
          host: selectedHost,
          model: selected.modelId,
          bindingId: selected.bindingId,
          bindingVersion: selected.bindingVersion,
          executionSnapshotId: selected.executionSnapshotId,
        };
      },
    },
    auth = options.apiToken ? new LocalAuth(store.db) : undefined,
    governance = new PlatformRunGovernance(companies, platform),
    pipeline = new RolePipeline(
      store,
      controller,
      host,
      new ProjectRunBudgetGuard(projects),
      governance,
      backend.model,
      router,
      new RepositoryRoleContext(store, projects),
      Number(process.env.AGENT_COMPANY_ROLE_DEADLINE_MS ?? 120_000),
    ),
    worktrees = new WorktreeManager(
      resolve(options.git),
      repo,
      resolve(runtime, "worktrees"),
      store,
    ),
    approvals = new ApprovalIntegrity(store, controller),
    execution = new Phase1Execution(
      store,
      controller,
      pipeline,
      worktrees,
      approvals,
      governance,
    ),
    candidates = new MergeCandidateService(store, approvals, worktrees);
  if (auth && !store.db.prepare("SELECT 1 FROM api_tokens_v6 LIMIT 1").get())
    auth.issue(
      {
        principalId: "local-owner",
        scopes: ["api:read", "api:write"],
        companyIds: ["*"],
      },
      options.apiToken,
    );
  if (auth && !store.db.prepare("SELECT 1 FROM local_users_v6 LIMIT 1").get())
    auth.createUser({
      username: "admin",
      password: "textadmin",
      principalId: "admin",
      role: "admin",
      scopes: ["*"],
      companyIds: ["*"],
    });
  companies.bootstrapDemo("admin");
  if (backend.host !== "standalone")
    try {
      await host.listModels();
    } catch (error) {
      throw new Error(
        `Selected Agent Backend health check failed (${backend.host}/${backend.model}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  const meetingHosts = new Map<string, HostAdapter>(),
    meetingRunnerHost = (binding: ResolvedMeetingBinding): HostAdapter => {
      const key = JSON.stringify([
        binding.backend,
        binding.modelId,
        binding.config,
      ]);
      let selected = meetingHosts.get(key);
      if (!selected) {
        selected = boundHost(binding, backend, operations);
        meetingHosts.set(key, selected);
      }
      return selected;
    },
    meetingRunner = new MeetingAgentRunner(store.db, companies, bindings, {
      resolve: meetingRunnerHost,
      providerIdempotent(binding) {
        return (
          binding.backend === "standalone" ||
          binding.config.providerIdempotent === true
        );
      },
    });
  const semanticSummaries = new MeetingSemanticSummaryService(
      store.db,
      companies,
    ),
    agentReports = new AgentReportInterpreter(store.db);
  const firebaseAllowedProjects = new Set(
      (process.env.AGENT_COMPANY_FIREBASE_PROJECTS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
    firebaseEnabled =
      process.env.AGENT_COMPANY_FIREBASE_DEPLOY_ENABLED === "true",
    firebaseCredentialAvailable = Boolean(
      process.env.FIREBASE_TOKEN || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    ),
    firebaseExecutor = async (
      args: readonly string[],
      cwd: string,
    ): Promise<FirebaseCommandResult> =>
      new Promise((resolveCommand) =>
        execFile(
          process.env.FIREBASE_CLI_PATH ?? "firebase",
          [...args],
          {
            cwd,
            env: process.env,
            windowsHide: true,
            maxBuffer: 2 * 1024 * 1024,
          },
          (error, stdout, stderr) =>
            resolveCommand({
              exitCode: error
                ? typeof error.code === "number"
                  ? error.code
                  : 1
                : 0,
              stdout: String(stdout),
              stderr: String(stderr),
            }),
        ),
      ),
    firebase = new FirebaseHostingAdapter(
      firebaseExecutor,
      firebaseAllowedProjects,
      firebaseEnabled,
    );
  const goalMeetingLimits = () => ({
      maxTokens: 30_000,
      maxCost: 10,
      maxRounds: 3,
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      maxTokensPerTurn: 5_000,
      maxCostPerTurn: 2,
      maxRetries: 2,
      leaseMs: 30_000,
      maxOutputBytes: 8192,
    }),
    collectGoalDeliveryBuildEvidence = async (runId: string): Promise<void> => {
      const work = companies
        .pendingGoalDeliveryStageWork()
        .find((item) => item.runId === runId && item.stage === "build");
      if (!work || companies.goalDeliveryBuildEvidenceForRun(runId)) return;
      const result = store.runResult(runId);
      if (!result) throw new Error("Build evidence requires a durable Run result");
      const worktree = resolve(result.worktree),
        files: Array<{ path: string; content?: string }> = [];
      for (const path of result.files.slice(0, 80)) {
        const absolute = resolve(worktree, path);
        if (absolute !== worktree && !absolute.startsWith(`${worktree}${sep}`))
          continue;
        try {
          const content = await readFile(absolute, "utf8");
          files.push({ path, content: content.slice(0, 64_000) });
        } catch {
          files.push({ path });
        }
      }
      const run = store.getRun(runId),
        checkpoint = run?.checkpoint ?? {},
        configured =
          checkpoint.reviewEvidence &&
          typeof checkpoint.reviewEvidence === "object"
            ? (checkpoint.reviewEvidence as Record<string, unknown>)
            : {},
        previewUrl =
          typeof configured.previewUrl === "string"
            ? configured.previewUrl.trim()
            : (process.env.AGENT_COMPANY_REVIEW_PREVIEW_URL ?? "").trim(),
        routeConfig =
          configured.routes && typeof configured.routes === "object"
            ? (configured.routes as Record<string, unknown>)
            : {},
        states: FrontendState[] = [
          "primary",
          "loading",
          "empty",
          "error",
          "permission",
        ],
        routes = Object.fromEntries(
          states.map((state) => [
            state,
            typeof routeConfig[state] === "string"
              ? routeConfig[state]
              : state === "primary"
                ? "/"
                : `/?reviewState=${state}`,
          ]),
        ) as Record<FrontendState, string>,
        manual = Array.isArray(configured.manual)
          ? configured.manual.filter((item): item is string => typeof item === "string")
          : [
              "핵심 행동을 시작하고 완료 상태까지 확인합니다.",
              "로딩·빈 화면·오류·권한 제한 상태의 안내와 복구 동작을 확인합니다.",
              "데스크톱과 모바일에서 주요 정보와 버튼이 잘리지 않는지 확인합니다.",
            ],
        request: FrontendCaptureRequest | null = previewUrl
          ? {
              previewUrl,
              expectedVersion: result.patchHash,
              scenario:
                typeof configured.scenario === "string"
                  ? configured.scenario
                  : "핵심 사용자 흐름과 예외 상태 검토",
              routes,
              manual,
            }
          : null,
        executable = (process.env.BROWSER_AUTOMATION_EXECUTABLE ?? "").trim(),
        validations = result.validation.map((value) => {
          const item =
              value && typeof value === "object"
                ? (value as Record<string, unknown>)
                : {},
            kind = typeof item.kind === "string" ? item.kind : "unknown";
          return {
            kind,
            passed: item.passed === true,
            output: [item.stdout, item.stderr]
              .filter((part): part is string => typeof part === "string")
              .join("\n")
              .slice(0, 8_000),
          };
        }),
        manifest = await collectBuildReviewEvidence(
          {
            runId,
            patchHash: result.patchHash,
            files,
            validations,
            artifactIds: [
              `run:${runId}`,
              `run-result:${result.patchHash}`,
              ...validations.map((item) => `validation:${item.kind}`),
              ...store
                .artifactVersionsForRun(runId)
                .map((item) => `artifact:${item.id}`),
            ],
            frontendExemption:
              typeof configured.frontendExemption === "string"
                ? configured.frontendExemption
                : null,
          },
          request,
          executable
            ? new PlaywrightFrontendCaptureAdapter(executable)
            : undefined,
        );
      companies.recordGoalDeliveryBuildEvidence(runId, manifest, work.ownerId);
    },
    advanceGoalDeliveryReview = async (runId: string): Promise<void> => {
      await collectGoalDeliveryBuildEvidence(runId);
      const review = companies.prepareGoalDeliveryReviewForRun(runId);
      if (!review) return;
      let meeting = review.meeting;
      if (meeting.status === "scheduled")
        meeting = companies.transitionMeeting(
          meeting.companyId,
          meeting.id,
          "live",
          review.actorId,
        );
      if (meeting.status === "live") {
        const limits = goalMeetingLimits();
        if (!meetingRunner.turns(meeting.id).length)
          meetingRunner.initialize(meeting.id, limits);
        else meetingRunner.recoverUsageLimitFailures(meeting.id, limits);
        await meetingRunner.runProtocol(meeting.id, `goal-delivery:${runId}`);
        meeting = companies.meeting(meeting.id)!;
      }
      if (meeting.status === "decision-pending" || meeting.status === "live")
        meeting = companies.transitionMeeting(
          meeting.companyId,
          meeting.id,
          "ended",
          review.actorId,
        );
      if (meeting.status === "ended")
        companies.completeGoalDeliveryTeamReview(meeting.id);
    };
  const deliveryStageInFlight = new Set<string>(),
    startGoalDeliveryStage = async (
      companyId: string,
      goalId: string,
      actorId: string,
    ): Promise<void> => {
      const snapshot = companies.goalDeliveryProcess(
        companyId,
        goalId,
        actorId,
      );
      if (
        !snapshot ||
        snapshot.process.status !== "active" ||
        !(["pending", "in-progress", "review-waiting"] as string[]).includes(
          snapshot.currentStageInstance.status,
        )
      )
        return;
      const work = companies
        .pendingGoalDeliveryStageWork()
        .find((x) => x.stageInstanceId === snapshot.currentStageInstance.id);
      if (!work) return;
      if (deliveryStageInFlight.has(work.stageInstanceId)) return;
      deliveryStageInFlight.add(work.stageInstanceId);
      try {
        if (work.runId) {
          const existing = store.getRun(work.runId);
          if (existing?.status === "PLAN_APPROVAL_WAITING") {
            const authorization = companies.goalDeliveryPlanAuthorization(
              work.runId,
            );
            if (authorization) {
              pipeline.approvePlan(work.runId, authorization.ownerId);
              companies.recordGoalDeliveryPlanAuthorized(authorization);
            }
          }
          let run = store.getRun(work.runId);
          if (run?.status === "FAILED") {
            const retryCount = Number(
              run.checkpoint?.goalDeliveryRetryCount ?? 0,
            );
            if (retryCount < 3) {
              controller.move(run.id, "READY", {
                ...(run.checkpoint ?? {}),
                goalDeliveryRetryCount: retryCount + 1,
                lastGoalDeliveryRetryAt: new Date().toISOString(),
              });
              run = store.getRun(run.id);
            }
          }
          if (
            run &&
            [
              "CREATED",
              "PLANNING",
              "READY",
              "REVISION_REQUIRED",
              "VALIDATING",
            ].includes(run.status)
          ) {
            await queue.remove(run.id).catch(() => false);
            await queue.enqueue({
              runId: run.id,
              requestId: `${run.requestId}:goal-delivery-recovery`,
            });
          } else if (run?.status === "RESULT_APPROVAL_WAITING")
            await advanceGoalDeliveryReview(run.id);
          return;
        }
        const goal = companies.goal(goalId);
        if (!goal) throw new Error("Goal missing");
        type Anchor = {
          taskId: string;
          projectId: string;
          milestoneId: string | null;
          budgetLimit: number;
          runId: string;
        };
        let anchor = store.db
          .prepare(
            "SELECT t.id taskId,t.project_id projectId,t.milestone_id milestoneId,t.budget_limit budgetLimit,t.run_id runId FROM goal_delivery_stage_instances_v19 s JOIN board_tasks_v3 t ON t.run_id=s.run_id WHERE s.process_id=? AND s.run_id IS NOT NULL ORDER BY s.created_at DESC LIMIT 1",
          )
          .get(work.processId) as Anchor | undefined;
        if (!anchor)
          anchor = store.db
            .prepare(
              "SELECT t.id taskId,t.project_id projectId,t.milestone_id milestoneId,t.budget_limit budgetLimit,t.run_id runId FROM board_tasks_v3 t JOIN company_goal_projects_v12 gp ON gp.project_id=t.project_id WHERE gp.goal_id=? AND t.run_id IS NOT NULL ORDER BY t.created_at DESC LIMIT 1",
            )
            .get(goalId) as Anchor | undefined;
        if (!anchor) throw new Error("Previous goal delivery Task is missing");
        const prior = store.getRun(anchor.runId),
          requestedPaths = Array.isArray(prior?.checkpoint?.requestedPaths)
            ? prior!.checkpoint!.requestedPaths.filter(
                (x): x is string => typeof x === "string",
              )
            : [],
          key = createHash("sha256")
            .update(work.stageInstanceId)
            .digest("hex")
            .slice(0, 24),
          taskId = `goal-stage-task-${key}`,
          runId = `goal-stage-run-${key}`,
          stageTitle = {
            discovery: "기획",
            "delivery-planning": "실행계획",
            build: "개발",
            release: "배포 준비",
            operate: "운영·완료 검증",
          }[work.stage],
          stageInstruction = {
            discovery:
              "요구사항과 성공 기준을 구체화하고 기획 산출물을 만드세요.",
            "delivery-planning":
              "승인된 기획을 실행 가능한 작업, 의존성, 검증 및 복구 계획으로 분해하세요.",
            build:
              "승인된 실행계획에 따라 구현하고 검증 가능한 결과를 만드세요.",
            release:
              "실제 운영 배포는 수행하지 말고 배포 후보, 검증 절차, 롤백 계획을 준비하세요.",
            operate:
              "배포 영수증과 운영 검증 근거를 확인하고 완료 후보를 준비하세요.",
          }[work.stage],
          budget = Math.max(
            0.01,
            Math.min(goal.budgetLimit, Number(anchor.budgetLimit)),
          );
        if (!projects.task(taskId))
          projects.createTask(
            {
              id: taskId,
              projectId: anchor.projectId,
              milestoneId: anchor.milestoneId,
              title: `${goal.title} · ${stageTitle} ${work.attempt}차`,
              status: "ready",
              priority: 100 - GOAL_DELIVERY_STAGE_ORDER(work.stage),
              completionCriteria: goal.completionCriteria,
              budgetLimit: budget,
            },
            { id: actorId },
          );
        const priorAssignments = projects.assignments(anchor.taskId);
        for (const assignment of priorAssignments)
          if (
            !projects
              .assignments(taskId)
              .some(
                (x) =>
                  x.principalId === assignment.principalId &&
                  x.responsibility === assignment.responsibility,
              )
          )
            projects.assign(
              taskId,
              { id: actorId },
              assignment.principalId,
              assignment.kind,
              assignment.responsibility,
            );
        if (!store.getRun(runId))
          await intake.create(
            {
              id: runId,
              requestId: `goal-delivery:${work.stageInstanceId}`,
              goal: [
                goal.title,
                stageInstruction,
                ...goal.completionCriteria,
              ].join("\n"),
              requestedPaths: requestedPaths.length ? requestedPaths : ["src"],
              requestedRisk:
                work.stage === "release" || work.stage === "operate"
                  ? "critical"
                  : "medium",
              budgetLimit: budget,
            },
            { deferEnqueue: true },
          );
        if (!projects.task(taskId)?.runId)
          projects.linkRun(taskId, runId, { id: actorId });
        companies.attachGoalDeliveryStageRun(
          companyId,
          goalId,
          work.stageInstanceId,
          runId,
          actorId,
        );
        if (projects.task(taskId)?.status === "ready")
          projects.transitionTask(taskId, "in-progress", { id: actorId });
        await queue.enqueue({
          runId,
          requestId: `goal-delivery:${work.stageInstanceId}:start`,
        });
      } catch (error) {
        companies.recordGoalDeliveryStageProvisionFailure(work, error);
      } finally {
        deliveryStageInFlight.delete(work.stageInstanceId);
      }
    };
  function GOAL_DELIVERY_STAGE_ORDER(stage: string): number {
    return [
      "discovery",
      "delivery-planning",
      "build",
      "release",
      "operate",
    ].indexOf(stage);
  }
  const worker: Worker<RunJob> = queue.worker(connection, async (job) => {
    let run = store.getRun(job.data.runId);
    if (!run) return;
    try {
      if (run.status === "RUNNING" || run.status === "VALIDATING") {
        store.audit(run.id, "GOAL_DELIVERY_STALE_EXECUTION_RECOVERED", {
          from: run.status,
          reason: "worker-restart",
          checkpointPreserved: true,
        });
        controller.move(run.id, "FAILED", {
          ...(run.checkpoint ?? {}),
          reason: "worker-restart-recovery",
          recoveredFrom: run.status,
        });
        controller.move(
          run.id,
          "READY",
          store.getRun(run.id)?.checkpoint ?? undefined,
        );
        run = store.getRun(run.id)!;
      }
      if (run.status === "REVISION_REQUIRED") {
        controller.move(run.id, "READY", run.checkpoint ?? undefined);
        run = store.getRun(run.id)!;
      }
      if (run.status === "CREATED" || run.status === "PLANNING")
        await pipeline.process(run.id);
      run = store.getRun(run.id)!;
      if (run.status === "PLAN_APPROVAL_WAITING") {
        const authorization = companies.goalDeliveryPlanAuthorization(run.id);
        if (authorization) {
          pipeline.approvePlan(run.id, authorization.ownerId);
          companies.recordGoalDeliveryPlanAuthorized(authorization);
          run = store.getRun(run.id)!;
        }
      }
      if (run.status === "READY") {
        const runId = run.id,
          deliveryWork = companies
            .pendingGoalDeliveryStageWork()
            .find((item) => item.runId === runId),
          documentStage =
            deliveryWork &&
            ["discovery", "delivery-planning"].includes(deliveryWork.stage);
        if (documentStage) {
          controller.move(run.id, "RUNNING");
          const planner =
              store
                .tasks(run.id)
                .find(
                  (task) =>
                    task.role === "planner" && task.status === "COMPLETED",
                ) ?? (await pipeline.planningArtifact(run.id)),
            artifact = String(
              (planner.output as { text?: unknown } | null)?.text ?? "",
            );
          if (!artifact)
            throw new Error(
              "Goal delivery document stage requires a completed planning artifact",
            );
          const patchHash = createHash("sha256").update(artifact).digest("hex"),
            logicalFile = `goal-delivery/${deliveryWork.stage}.json`,
            validation = [
              {
                command: "document-contract",
                passed: true,
                exitCode: 0,
                stdout:
                  "Structured planning artifact is durable and ready for team review",
                stderr: "",
              },
            ];
          controller.move(run.id, "VALIDATING", {
            stage: "document-artifact-complete",
            lastRole: "planner",
          });
          store.audit(run.id, "VALIDATION_COMPLETED", {
            passed: true,
            checks: ["document-contract"],
            stage: deliveryWork.stage,
            artifactHash: patchHash,
          });
          store.saveRunResult({
            runId: run.id,
            worktree: `goal-delivery-artifact:${deliveryWork.stageInstanceId}`,
            patch: artifact,
            patchHash,
            files: [logicalFile],
            validation,
          });
          store.createApproval({
            id: `${run.id}:result`,
            runId: run.id,
            kind: "result",
            status: "PENDING",
            expectedPatchHash: null,
          });
          approvals.bindResult(run.id, patchHash);
          controller.move(run.id, "RESULT_APPROVAL_WAITING", {
            worktree: `goal-delivery-artifact:${deliveryWork.stageInstanceId}`,
            patchHash,
            files: [logicalFile],
          });
          store.audit(run.id, "GOAL_DELIVERY_DOCUMENT_STAGE_COMPLETED", {
            stage: deliveryWork.stage,
            artifactHash: patchHash,
            logicalFile,
          });
        } else {
          const requestedPaths =
              (run.checkpoint?.requestedPaths as string[] | undefined) ?? [],
            validatorChecks = projects.validatorProfileForRun(run.id).checks;
          await execution.execute(run.id, {
            allowedPaths: requestedPaths,
            commands: options.commands,
            validatorChecks,
          });
        }
      }
      const current = store.getRun(run.id);
      if (current?.status === "RESULT_APPROVAL_WAITING")
        try {
          await advanceGoalDeliveryReview(run.id);
        } catch (error) {
          companies.recordGoalDeliveryAutomationFailure(run.id, error);
        }
    } catch (error) {
      const failed = store.getRun(run.id);
      store.audit(run.id, "GOAL_DELIVERY_WORKER_FAILED", {
        status: failed?.status ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      if (
        failed &&
        ["PLANNING", "RUNNING", "VALIDATING", "REVISION_REQUIRED"].includes(
          failed.status,
        )
      )
        controller.move(run.id, "FAILED", {
          ...(failed.checkpoint ?? {}),
          reason: "goal-delivery-worker-failed",
          lastError: error instanceof Error ? error.message : String(error),
        });
      throw error;
    }
  });
  await worker.waitUntilReady();
  await controller.recover();
  operations.setRuntimeStatus({
    redis: "ready",
    adapters: {
      active: {
        host: backend.host,
        model: backend.model,
        baseUrl: backend.baseUrl,
      },
      external: store.db
        .prepare(
          "SELECT status,COUNT(*) count FROM external_adapters_v5 GROUP BY status ORDER BY status",
        )
        .all(),
    },
  });
  for (const work of companies.pendingGoalDeliveryStageWork())
    await startGoalDeliveryStage(work.companyId, work.goalId, work.ownerId);
  const deliveryRecovery = setInterval(() => {
    for (const work of companies.pendingGoalDeliveryStageWork())
      void startGoalDeliveryStage(work.companyId, work.goalId, work.ownerId);
  }, 15_000);
  deliveryRecovery.unref();
  const approveGoalDeliveryStage = async (
    companyId: string,
    goalId: string,
    actorId: string,
    deployment?: {
      action: "deploy" | "skip";
      environment: "preview" | "production";
      targetProjectId?: string | null;
      targetChannel?: string | null;
      expectedSnapshotHash: string;
      confirmation?: string;
    },
  ): Promise<void> => {
    const delivery = companies.goalDeliveryProcess(companyId, goalId, actorId),
      review = delivery?.ownerReview;
    if (!delivery || !review || review.status !== "pending")
      throw new Error("Pending owner review required");
    if (review.runId) {
      const result = store.runResult(review.runId);
      if (!result) throw new Error("Run result missing");
      if (store.getRun(review.runId)?.status !== "COMPLETED")
        await candidates.approveAndCreate(
          review.runId,
          result.patchHash,
          actorId,
          result.worktree,
        );
      const task = store.db
        .prepare("SELECT id,status FROM board_tasks_v3 WHERE run_id=?")
        .get(review.runId) as { id: string; status: string } | undefined;
      if (task?.status === "ready")
        projects.transitionTask(task.id, "in-progress", { id: actorId });
      const currentTask = task ? projects.task(task.id) : null;
      if (currentTask?.status === "in-progress")
        projects.transitionTask(currentTask.id, "review", { id: actorId });
      const reviewTask = currentTask ? projects.task(currentTask.id) : null;
      if (reviewTask?.status === "review")
        projects.transitionTask(reviewTask.id, "done", { id: actorId });
    }
    const summary = companies.meetingSummary(review.meetingId) as {
      status?: string;
    } | null;
    if (summary?.status === "draft")
      companies.confirmMeetingSummary(companyId, review.meetingId, actorId);
    if (delivery.process.currentStage === "release") {
      if (!deployment) throw new Error("배포 여부를 선택해 주세요.");
      const record = companies.requestGoalDeployment(
        companyId,
        goalId,
        deployment,
        actorId,
      );
      if (record.action === "deploy" && record.status !== "succeeded") {
        const started = companies.beginGoalDeployment(record.id);
        try {
          const receipt = await firebase.deploy({
            id: started.id,
            environment: started.environment,
            targetProjectId: started.targetProjectId!,
            targetChannel: started.targetChannel,
            artifactSnapshotHash: started.artifactSnapshotHash,
            approvedBy: started.approvedBy,
            approvedAt: started.approvedAt,
            credentialAvailable: firebaseCredentialAvailable,
            sourceDirectory: repo,
          });
          companies.completeGoalDeployment(started.id, receipt);
        } catch (error) {
          companies.failGoalDeployment(started.id, error);
          throw error;
        }
      }
    }
  };
  const finalizeGoalDeliveryCompletion = async (
    companyId: string,
    goalId: string,
    actorId: string,
  ): Promise<void> => {
    const delivery = companies.goalDeliveryProcess(companyId, goalId, actorId);
    if (!delivery || delivery.process.status !== "completed") return;
    for (const stage of delivery.stages.filter(
      (item) => item.status === "revision-requested" && item.runId,
    )) {
      const run = store.getRun(stage.runId!);
      if (
        run &&
        !(["COMPLETED", "CANCELLED", "FAILED", "BLOCKED"] as string[]).includes(
          run.status,
        )
      )
        await controller.cancel(run.id);
      store.decideApproval(`${stage.runId}:plan`, false, actorId);
      store.decideApproval(`${stage.runId}:result`, false, actorId);
      const task = store.db
        .prepare("SELECT id,status FROM board_tasks_v3 WHERE run_id=?")
        .get(stage.runId) as { id: string; status: string } | undefined;
      if (task?.status === "ready")
        projects.transitionTask(task.id, "in-progress", { id: actorId });
      let current = task ? projects.task(task.id) : null;
      if (current?.status === "in-progress")
        projects.transitionTask(current.id, "review", { id: actorId });
      current = task ? projects.task(task.id) : null;
      if (current?.status === "review")
        projects.transitionTask(current.id, "done", { id: actorId });
    }
    const goal = companies.goal(goalId);
    if (goal?.status === "active")
      companies.transitionGoal(companyId, goalId, "completed", actorId);
  };
  const completedGoals = store.db
    .prepare(
      "SELECT p.company_id companyId,p.goal_id goalId,g.owner_id ownerId FROM goal_delivery_processes_v19 p JOIN company_goals_v12 g ON g.id=p.goal_id WHERE p.status='completed' AND g.status='active' AND p.process_version=(SELECT MAX(x.process_version) FROM goal_delivery_processes_v19 x WHERE x.goal_id=p.goal_id)",
    )
    .all() as Array<{ companyId: string; goalId: string; ownerId: string }>;
  for (const item of completedGoals)
    try {
      await finalizeGoalDeliveryCompletion(
        item.companyId,
        item.goalId,
        item.ownerId,
      );
    } catch (error) {
      console.error(
        `Goal completion reconciliation deferred (${item.goalId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  const api = new ControlPlaneApi(
    store,
    intake,
    controller,
    {
      async approvePlan(runId, userId) {
        pipeline.approvePlan(runId, userId);
        await queue.remove(runId).catch(() => false);
        const run = store.getRun(runId)!;
        await queue.enqueue({ runId, requestId: `${run.requestId}:approved` });
      },
      async approveResult(runId, userId, patchHash) {
        const result = store.runResult(runId);
        if (!result) throw new Error("Run result missing");
        await candidates.approveAndCreate(
          runId,
          patchHash,
          userId,
          result.worktree,
        );
      },
      approveGoalDeliveryStage,
      completeGoalDelivery: finalizeGoalDeliveryCompletion,
      startGoalDeliveryStage,
      async requeueRun(runId) {
        const run = store.getRun(runId);
        if (run)
          await queue.enqueue({
            runId,
            requestId: `${run.requestId}:project-recovery`,
          });
      },
      async probeAgentBinding(candidate) {
        const probe = boundHost(
          {
            backend: candidate.backend,
            modelId: candidate.modelId,
            config: candidate.config,
          },
          backend,
          operations,
        );
        const models = await probe.listModels();
        if (candidate.backend !== "standalone" && models.length === 0)
          throw new Error(
            `Agent Backend has no available models: ${candidate.backend}`,
          );
      },
      async generateMeetingSemanticSummary(meetingId) {
        bindings.freezeMeeting(meetingId);
        const binding = bindings.meetingSnapshots(meetingId)[0];
        return binding
          ? semanticSummaries.generate(meetingId, {
              host: meetingRunnerHost(binding),
              backend: binding.backend,
              model: binding.modelId,
              deadline: Date.now() + 120_000,
            })
          : semanticSummaries.generate(meetingId);
      },
      async interpretReport(companyId, reportId, actorId) {
        const report = new ReportingProjector(
            store.db,
            companies,
          ).reportForActor(companyId, reportId, actorId),
          perspective = store.db
            .prepare(
              "SELECT role,department_id AS departmentId FROM company_members_v4 WHERE company_id=? AND principal_id=?",
            )
            .get(companyId, actorId);
        return agentReports.interpret(report, {
          host,
          backend: backend.host,
          model: backend.model,
          deadline: Date.now() + 120_000,
          rolePerspective: perspective ?? { actorId },
        });
      },
      async draftGoal(rough) {
        return draftGoal(
          rough,
          backend.host === "standalone"
            ? undefined
            : {
                host,
                backend: backend.host,
                model: backend.model,
                deadline: Date.now() + 60_000,
              },
        );
      },
    },
    projects,
    companies,
    platform,
    auth,
    operations,
    bindings,
    meetingRunner,
    backend,
  );
  const server = api.server();
  server.listen(options.port ?? 0, "0.0.0.0");
  await new Promise<void>((resolveReady, reject) => {
    server.once("listening", resolveReady);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Control plane address unavailable");
  return {
    url: `http://0.0.0.0:${address.port}`,
    async close() {
      clearInterval(deliveryRecovery);
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      await worker.close(true);
      await queue.close();
      store.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const here = dirname(fileURLToPath(import.meta.url)),
    root = resolve(here, "..", "..", "..");
  const repo = process.env.AGENT_COMPANY_REPO;
  if (!repo) throw new Error("AGENT_COMPANY_REPO is required");
  const node = process.execPath,
    check = process.env.AGENT_COMPANY_CHECK_FILE;
  if (!check) throw new Error("AGENT_COMPANY_CHECK_FILE is required");
  const command = { file: node, args: ["--check", check] };
  const apiToken = process.env.AGENT_COMPANY_API_TOKEN;
  if (!apiToken) throw new Error("AGENT_COMPANY_API_TOKEN is required");
  const runtimeDir =
      process.env.AGENT_COMPANY_RUNTIME ??
      resolve(root, ".runtime", "control-plane"),
    app = await startLocalControlPlane({
      repo,
      runtimeDir,
      git:
        process.env.AGENT_COMPANY_GIT ??
        resolve(root, ".tools", "mingit", "cmd", "git.exe"),
      commands: {
        build: command,
        test: command,
        lint: command,
        security: command,
      },
      redis: {
        host: process.env.AGENT_COMPANY_REDIS_HOST ?? "0.0.0.0",
        port: Number(process.env.AGENT_COMPANY_REDIS_PORT ?? 6379),
      },
      port: Number(process.env.PORT ?? 4310),
      apiToken,
    });
  console.log(`Agent Company Control Plane: ${app.url}`);
  let closing = false;
  const stopFile = resolve(runtimeDir, "control-plane.stop"),
    shutdown = async (signal: string) => {
      if (closing) return;
      closing = true;
      console.log(`Stopping Agent Company Control Plane (${signal})`);
      await app.close();
      process.exit(0);
    };
  if (existsSync(stopFile)) unlinkSync(stopFile);
  const stopWatcher = setInterval(() => {
    if (existsSync(stopFile)) {
      clearInterval(stopWatcher);
      unlinkSync(stopFile);
      void shutdown("stop-request");
    }
  }, 1000);
  stopWatcher.unref();
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
