/**
 * crypto.randomUUID()는 secure context(HTTPS 또는 localhost)에서만 존재한다. 사설망 IP로 평문 HTTP
 * 접속하면 undefined라서 그냥 호출하면 "crypto.randomUUID is not a function"으로 깨진다.
 * crypto.getRandomValues()는 secure context 여부와 무관하게 동작하므로 이를 이용해 RFC4122 v4 UUID를
 * 직접 만든다.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 긴 식별자(UUID 등)를 표시용으로 축약한다. 원문은 title 속성으로 함께 제공할 것. */
export function shortId(value: string, max = 18): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** 잘못된 인코딩으로 손상된 사용자 문자열을 운영 화면에 그대로 노출하지 않는다. */
export function safeUserText(value: string, fallback = "텍스트 인코딩 확인 필요"): string {
  const text = value.normalize("NFC").trim();
  const replacement = text.includes("�");
  const repeatedQuestionMarks = (text.match(/\?/g)?.length ?? 0) >= 3 && /(?:\?\s*){2,}/.test(text);
  return replacement || repeatedQuestionMarks ? fallback : text;
}

/** Run 상태 enum을 화면에 그대로 노출하지 않기 위한 공용 라벨. */
export const RUN_STATUS_LABEL: Record<string, string> = {
  CREATED: "접수", PLANNING: "계획 작성", PLAN_APPROVAL_WAITING: "계획 승인 대기", READY: "실행 준비", RUNNING: "실행 중",
  VALIDATING: "검증 중", RESULT_APPROVAL_WAITING: "결과 승인 대기", COMPLETED: "완료", PAUSED: "일시정지",
  BLOCKED: "차단", RETRY_WAITING: "재시도 대기", REVISION_REQUIRED: "재작업 필요", CANCELLING: "취소 중", CANCELLED: "취소됨", FAILED: "실패"
};
export function runStatusLabel(status: string): string { return RUN_STATUS_LABEL[status] ?? status; }
