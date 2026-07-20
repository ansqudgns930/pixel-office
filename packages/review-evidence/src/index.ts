import { createHash } from "node:crypto";

const sha = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex"),
  stable = (value: unknown): string =>
    JSON.stringify(value, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
          )
        : item,
    );

export type ReadinessStatus =
  | "passed"
  | "failed"
  | "needs-evidence"
  | "not-applicable";
export type ReadinessKey =
  | "api"
  | "database"
  | "authentication"
  | "input-validation"
  | "unit-tests"
  | "integration-tests"
  | "e2e-tests"
  | "security"
  | "observability"
  | "environment";
export interface BackendReadinessItem {
  key: ReadinessKey;
  label: string;
  applicability: "required" | "not-detected";
  status: ReadinessStatus;
  summary: string;
  evidenceIds: string[];
}
export interface BackendReadinessMatrix {
  version: 1;
  items: BackendReadinessItem[];
  ready: boolean;
  failedKeys: ReadinessKey[];
  sourceFingerprint: string;
}
export type FrontendState =
  | "primary"
  | "loading"
  | "empty"
  | "error"
  | "permission";
export interface FrontendCapture {
  state: FrontendState;
  viewport: "desktop" | "mobile";
  url: string;
  status: "captured" | "failed" | "exempted";
  mimeType: "image/png";
  sha256: string | null;
  dataUrl: string | null;
  width: number;
  height: number;
  capturedAt: string | null;
  failure: string | null;
}
export interface FrontendEvidenceManifest {
  applicability: "web" | "non-web";
  status: "captured" | "failed" | "exempted";
  previewUrl: string | null;
  expectedVersion: string;
  observedVersion: string | null;
  scenario: string;
  manual: string[];
  captures: FrontendCapture[];
  missingStates: FrontendState[];
  failure: string | null;
  exemptionReason: string | null;
}
export interface BuildReviewEvidenceManifest {
  version: 1;
  runId: string;
  patchHash: string;
  backend: BackendReadinessMatrix;
  frontend: FrontendEvidenceManifest;
  ready: boolean;
  missing: string[];
  snapshotHash: string;
  createdAt: string;
}
export interface ReadinessInput {
  runId: string;
  patchHash: string;
  files: Array<{ path: string; content?: string }>;
  validations: Array<{ kind: string; passed: boolean; output?: string }>;
  artifactIds: string[];
  frontendExemption?: string | null;
}
export interface FrontendCaptureRequest {
  previewUrl: string;
  expectedVersion: string;
  scenario: string;
  routes: Record<FrontendState, string>;
  manual: string[];
}
export interface FrontendCaptureAdapter {
  capture(request: FrontendCaptureRequest): Promise<FrontendEvidenceManifest>;
}

const labels: Record<ReadinessKey, string> = {
  api: "API",
  database: "데이터베이스",
  authentication: "인증·권한",
  "input-validation": "입력 검증",
  "unit-tests": "단위 테스트",
  "integration-tests": "통합 테스트",
  "e2e-tests": "E2E 테스트",
  security: "보안",
  observability: "관측성",
  environment: "환경 구성",
};
export function collectBackendReadiness(
  input: ReadinessInput,
): BackendReadinessMatrix {
  const normalized = input.files.map((file) => ({
      path: file.path.replaceAll("\\", "/"),
      content: file.content ?? "",
    })),
    text = normalized
      .map((x) => `${x.path}\n${x.content.slice(0, 64_000)}`)
      .join("\n")
      .toLowerCase(),
    paths = normalized.map((x) => x.path.toLowerCase()),
    has = (pattern: RegExp) => pattern.test(text),
    pathHas = (pattern: RegExp) => paths.some((x) => pattern.test(x)),
    validation = (...kinds: string[]) =>
      input.validations.some((x) => kinds.includes(x.kind) && x.passed),
    evidence = (pattern: RegExp) =>
      input.artifactIds.filter((id) => pattern.test(id)).sort(),
    code = normalized.length > 0,
    web =
      pathHas(/\.(tsx|jsx|css|html)$/) ||
      has(/react|vite|next\.config|vue|svelte/),
    api =
      pathHas(/(^|\/)(api|routes?|controllers?)(\/|\.)/) ||
      has(
        /\/api\/|createServer\(|router\.(get|post|put|delete)|request\.method/,
      ),
    database =
      pathHas(/migration|schema|\.sql$|database|persistence|repository/) ||
      has(/sqlite|postgres|mysql|create table|prisma|drizzle/),
    auth =
      pathHas(/auth|session|permission|rbac|policy/) ||
      has(/bearer|authenticate|authorization|principalid|password_hash/),
    inputValidation =
      pathHas(/validator|validation|schema/) ||
      has(/zod|joi|yup|parse\(|assert|invalid|required/),
    unit = pathHas(/(^|\/)(__tests__|tests?|spec)(\/|\.)|\.(test|spec)\./),
    integration = pathHas(/integration|vertical|api\.test|e2e/),
    e2e = pathHas(/e2e|browser|playwright|cypress/),
    security =
      pathHas(/security|auth|policy/) ||
      has(/csrf|xss|sql injection|path traversal|rate limit/),
    observability =
      pathHas(/metrics|logging|audit|telemetry|monitor/) ||
      has(/audit\(|logger|console\.error|metric|trace/),
    environment =
      pathHas(/\.env\.example|config|dockerfile|compose|package\.json/) ||
      has(/process\.env|environment/),
    backendSurface = api || database || auth;
  const row = (
    key: ReadinessKey,
    applicable: boolean,
    signal: boolean,
    passed: boolean,
    detail: string,
  ): BackendReadinessItem => ({
    key,
    label: labels[key],
    applicability: applicable ? "required" : "not-detected",
    status: !applicable
      ? "not-applicable"
      : signal && passed
        ? "passed"
        : signal
          ? "failed"
          : "needs-evidence",
    summary: !applicable
      ? "관련 표면이 변경 파일에서 감지되지 않았습니다."
      : signal && passed
        ? `${detail}와 결정론적 검증을 확인했습니다.`
        : signal
          ? `${detail}는 있으나 관련 검증이 통과하지 않았습니다.`
          : `${detail} 근거가 없습니다.`,
    evidenceIds: [
      ...new Set([
        ...input.artifactIds.filter((id) => id.startsWith("validation:")),
        ...evidence(new RegExp(key.replace("-", ".*"), "i")),
      ]),
    ].sort(),
  });
  const items = [
      row(
        "api",
        api,
        api,
        validation("build", "typecheck", "test"),
        "API 구현",
      ),
      row(
        "database",
        database,
        database,
        validation("build", "test"),
        "DB schema·migration",
      ),
      row(
        "authentication",
        auth,
        auth,
        validation("test", "security"),
        "인증·권한 경로",
      ),
      row(
        "input-validation",
        backendSurface || inputValidation,
        inputValidation,
        validation("test", "security"),
        "입력 검증",
      ),
      row("unit-tests", code, unit, validation("test"), "단위 테스트"),
      row(
        "integration-tests",
        backendSurface,
        integration,
        validation("test"),
        "통합 테스트",
      ),
      row("e2e-tests", web, e2e, validation("test"), "브라우저 E2E"),
      row(
        "security",
        backendSurface || security,
        security,
        validation("security"),
        "보안 검증",
      ),
      row(
        "observability",
        backendSurface,
        observability,
        validation("build", "test"),
        "로그·감사·지표",
      ),
      row(
        "environment",
        code,
        environment,
        validation("build", "typecheck"),
        "환경·빌드 구성",
      ),
    ],
    failedKeys = items
      .filter((x) => x.applicability === "required" && x.status !== "passed")
      .map((x) => x.key),
    sourceFingerprint = sha(
      stable({
        files: normalized.map((x) => ({ path: x.path, hash: sha(x.content) })),
        validations: input.validations,
        artifactIds: [...input.artifactIds].sort(),
      }),
    );
  return {
    version: 1,
    items,
    ready: failedKeys.length === 0,
    failedKeys,
    sourceFingerprint,
  };
}

export async function collectBuildReviewEvidence(
  input: ReadinessInput,
  request: FrontendCaptureRequest | null,
  adapter?: FrontendCaptureAdapter,
): Promise<BuildReviewEvidenceManifest> {
  const backend = collectBackendReadiness(input),
    webDetected =
      input.files.some((x) => /\.(tsx|jsx|css|html)$/i.test(x.path)) ||
      input.files.some((x) =>
        /react|vite|next|vue|svelte/i.test(x.content ?? ""),
      );
  let frontend: FrontendEvidenceManifest;
  if (!webDetected) {
    frontend = input.frontendExemption?.trim()
      ? {
          applicability: "non-web",
          status: "exempted",
          previewUrl: null,
          expectedVersion: input.patchHash,
          observedVersion: null,
          scenario: "비-프론트엔드 변경",
          manual: ["프론트엔드 변경 없음"],
          captures: [],
          missingStates: [],
          failure: null,
          exemptionReason: input.frontendExemption.trim(),
        }
      : {
          applicability: "non-web",
          status: "failed",
          previewUrl: null,
          expectedVersion: input.patchHash,
          observedVersion: null,
          scenario: "비-프론트엔드 변경",
          manual: [],
          captures: [],
          missingStates: ["primary"],
          failure: "비-프론트엔드 변경 면제 사유가 명시되지 않았습니다.",
          exemptionReason: null,
        };
  } else if (!request || !adapter) {
    frontend = {
      applicability: "web",
      status: "failed",
      previewUrl: request?.previewUrl ?? null,
      expectedVersion: input.patchHash,
      observedVersion: null,
      scenario: request?.scenario ?? "핵심 사용자 시나리오",
      manual: request?.manual ?? [],
      captures: [],
      missingStates: ["primary", "loading", "empty", "error", "permission"],
      failure: "preview 또는 capture adapter가 구성되지 않았습니다.",
      exemptionReason: null,
    };
  } else {
    try {
      frontend = await adapter.capture({
        ...request,
        expectedVersion: input.patchHash,
      });
    } catch (error) {
      frontend = {
        applicability: "web",
        status: "failed",
        previewUrl: request.previewUrl,
        expectedVersion: input.patchHash,
        observedVersion: null,
        scenario: request.scenario,
        manual: request.manual,
        captures: [],
        missingStates: ["primary", "loading", "empty", "error", "permission"],
        failure:
          error instanceof Error
            ? `화면 캡처 실패: ${error.message}`
            : `화면 캡처 실패: ${String(error)}`,
        exemptionReason: null,
      };
    }
  }
  const requiredStates: FrontendState[] = [
      "primary",
      "loading",
      "empty",
      "error",
      "permission",
    ],
    captureMissingStates =
      frontend.applicability === "web"
        ? requiredStates.filter(
            (state) =>
              !frontend.captures.some(
                (capture) =>
                  capture.state === state &&
                  capture.viewport === "desktop" &&
                  capture.status === "captured" &&
                  Boolean(capture.dataUrl),
              ),
          )
        : [],
    allMissingStates = [
      ...new Set([...frontend.missingStates, ...captureMissingStates]),
    ],
    primaryMobileMissing =
      frontend.applicability === "web" &&
      !frontend.captures.some(
        (capture) =>
          capture.state === "primary" &&
          capture.viewport === "mobile" &&
          capture.status === "captured" &&
          Boolean(capture.dataUrl),
      ),
    versionMismatch =
      frontend.applicability === "web" &&
      frontend.observedVersion !== frontend.expectedVersion;
  if (
    frontend.applicability === "web" &&
    (allMissingStates.length > 0 || primaryMobileMissing || versionMismatch)
  ) {
    frontend = {
      ...frontend,
      status: "failed",
      missingStates: allMissingStates,
      failure:
        frontend.failure ??
        "필수 화면 상태, 모바일 핵심 화면 또는 빌드 버전 증거가 부족합니다.",
    };
  }
  const missing = [
      ...backend.failedKeys.map((x) => `backend:${x}`),
      ...(frontend.status === "captured" || frontend.status === "exempted"
        ? []
        : ["frontend:capture"]),
      ...allMissingStates.map((x) => `frontend:${x}`),
      ...(primaryMobileMissing ? ["frontend:primary-mobile"] : []),
      ...(versionMismatch ? ["frontend:preview-version-mismatch"] : []),
    ],
    createdAt = new Date().toISOString(),
    body = {
      version: 1 as const,
      runId: input.runId,
      patchHash: input.patchHash,
      backend,
      frontend,
      ready: missing.length === 0,
      missing,
      createdAt,
    },
    snapshotHash = sha(stable(body));
  return { ...body, snapshotHash };
}
