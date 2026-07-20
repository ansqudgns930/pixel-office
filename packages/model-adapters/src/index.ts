export interface ModelClientResult { text: string; tokens: number; cost: number; estimated?: boolean }
export type ModelClientErrorCode = "CAPABILITY_UNAVAILABLE" | "AUTHENTICATION_FAILED" | "HOST_UNAVAILABLE";
export class ModelClientError extends Error { constructor(public readonly code:ModelClientErrorCode,message:string){super(message);} }
export interface ModelClient {
  listModels(): Promise<string[]>;
  complete(request: { model: string; prompt: string; signal?: AbortSignal }): Promise<ModelClientResult>;
}

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  maxTokens?: number;
  costPer1kTokens?: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number };
}
interface ModelListResponse { data?: Array<{ id?: string }> }

export class OpenAICompatibleClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly maxTokens: number;
  private readonly costPer1kTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.maxTokens = options.maxTokens ?? 512;
    this.costPer1kTokens = options.costPer1kTokens ?? 0;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, { headers: this.headers() });
    if (!response.ok) throw new Error(`model list failed: ${response.status}`);
    const data = (await response.json()) as ModelListResponse;
    return (data.data ?? []).map(item => item.id ?? "").filter(Boolean);
  }

  async complete(request: { model: string; prompt: string; signal?: AbortSignal }): Promise<ModelClientResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model: request.model, messages: [{ role: "user", content: request.prompt }], max_tokens: this.maxTokens }),
      ...(request.signal ? { signal: request.signal } : {})
    });
    if (!response.ok) throw new Error(`chat completion failed: ${response.status}: ${await response.text()}`);
    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    const tokens = data.usage?.total_tokens ?? Math.ceil((request.prompt.length + text.length) / 4);
    return { text, tokens, cost: (tokens / 1000) * this.costPer1kTokens };
  }
}

export function localModelClient(baseUrl = "http://127.0.0.1:11434/v1", maxTokens = 512): OpenAICompatibleClient {
  return new OpenAICompatibleClient({ baseUrl, maxTokens, costPer1kTokens: 0 });
}
