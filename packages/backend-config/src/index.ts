export type AgentCompanyHost = "standalone" | "legacy-nvidia" | "openai-compatible" | "claude-cli" | "codex-cli";
export interface AgentBackendConfig { host: AgentCompanyHost; model: string; baseUrl: string | null; apiKey?: string; cliPath?:string }

export function loadAgentBackendConfig(env: NodeJS.ProcessEnv = process.env): AgentBackendConfig {
  const host = (env.AGENT_COMPANY_HOST ?? "standalone") as AgentCompanyHost;
  if (!(["standalone", "legacy-nvidia", "openai-compatible", "claude-cli", "codex-cli"] as string[]).includes(host)) throw new Error(`Unsupported AGENT_COMPANY_HOST: ${host}`);
  const model = env.AGENT_COMPANY_MODEL?.trim() || "phase0-model";
  const baseUrl = env.AGENT_COMPANY_MODEL_BASE_URL?.trim() || (host === "openai-compatible" ? "http://127.0.0.1:11434/v1" : host === "legacy-nvidia" ? "http://127.0.0.1:3000" : null);
  return { host, model, baseUrl, ...(env.AGENT_COMPANY_MODEL_API_KEY ? { apiKey: env.AGENT_COMPANY_MODEL_API_KEY } : {}),...(env.AGENT_COMPANY_CLI_PATH?{cliPath:env.AGENT_COMPANY_CLI_PATH}:{}) };
}
