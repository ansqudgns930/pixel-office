import test from "node:test";
import assert from "node:assert/strict";
import { loadAgentBackendConfig } from "../packages/backend-config/src/index.js";

test("backend config defaults to deterministic standalone", () => assert.deepEqual(loadAgentBackendConfig({}), { host: "standalone", model: "phase0-model", baseUrl: null }));
test("backend config loads OpenAI-compatible model settings", () => assert.deepEqual(loadAgentBackendConfig({AGENT_COMPANY_HOST:"openai-compatible",AGENT_COMPANY_MODEL:"qwen",AGENT_COMPANY_MODEL_BASE_URL:"http://models/v1",AGENT_COMPANY_MODEL_API_KEY:"secret"}), {host:"openai-compatible",model:"qwen",baseUrl:"http://models/v1",apiKey:"secret"}));
test("backend config rejects unknown hosts", () => assert.throws(() => loadAgentBackendConfig({AGENT_COMPANY_HOST:"unknown"}), /Unsupported/));
