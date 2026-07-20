import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CONTRACT_VERSION } from "../../packages/contracts/src/index.js";
import { LegacyNvidiaHostAdapter } from "../legacy-nvidia-host/src/index.js";
import { NvidiaHttpClient } from "../legacy-nvidia-host/src/http-client.js";

const root = resolve(import.meta.dirname, "../../../");
const reportPath = resolve(root, "outputs/phase1-live-report.json");
const outputPath = resolve(root, "outputs/phase1-blind-review.json");
const requirements: Record<string, string> = {
  "low-normalize": "Normalize string labels by trimming and collapsing whitespace; non-strings return empty string.",
  "medium-clamp": "Clamp finite numbers; reject non-finite inputs and invalid ranges with specified error types.",
  "high-redirect": "Allow only safe local absolute redirects; reject protocol-relative, schemes, backslashes, controls, and non-strings."
};
interface LiveRow { anonymousId: string; scenario: string }
interface LiveReport { model: string; results: LiveRow[] }
interface Review { id: string; score: number; defects: string[] }
interface ReviewBatch { offset: number; expected: number; parsed: number; tokens: number; raw: string; error?: string }

const report = JSON.parse(await readFile(reportPath, "utf8")) as LiveReport;
const candidates = [];
for (const row of report.results) candidates.push({ id: row.anonymousId, requirement: requirements[row.scenario], code: await readFile(resolve(root, `.phase1/worktrees/${row.anonymousId}/candidate.mjs`), "utf8") });

const reviewerModel = "deepseek-ai/deepseek-v4-flash";
const client = new NvidiaHttpClient("http://127.0.0.1:8787", 900);
const adapter = new LegacyNvidiaHostAdapter(client);
let reviews: Review[] = []; let batches: ReviewBatch[] = [];
try { const prior = JSON.parse(await readFile(outputPath, "utf8")) as { reviewerModel?: string; reviews?: Review[]; batches?: ReviewBatch[] }; if (prior.reviewerModel === reviewerModel) { reviews = prior.reviews ?? []; batches = prior.batches ?? []; } } catch {}
const currentIds=new Set(candidates.map(item=>item.id));reviews=reviews.filter(item=>currentIds.has(item.id));
const reviewed = new Set(reviews.map(item => item.id)); const remaining = candidates.filter(item => !reviewed.has(item.id));
for (let offset = 0; offset < remaining.length; offset += 9) {
  const batch = remaining.slice(offset, offset + 9);
  const prompt = `Blind-review these JavaScript candidates. Strategy and test results are hidden. Output exactly one line per candidate in original order: UUID|integer score 0-5|short defect, or none. Do not output reasoning, headings, markdown, or omit an ID.\n${JSON.stringify(batch)}`;
  const before = await client.usageTotals(); let response: { text: string } | null = null; let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { response = await chat(prompt, `blind-review-${offset}-${attempt}-${Date.now()}`); break; }
    catch (error) { lastError = error instanceof Error ? error.message : String(error); }
  }
  if (!response) { batches.push({ offset, expected: batch.length, parsed: 0, tokens: 0, error: lastError, raw: "" }); await checkpoint(); continue; }
  const after = await client.usageTotals(); const parsed: Review[] = [];
  for (const line of response.text.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f-]{36})\|([0-5])\|(.*)$/i);
    if (match?.[1] && match[2] !== undefined) parsed.push({ id: match[1], score: Number(match[2]), defects: match[3]?.trim().toLowerCase() === "none" ? [] : [match[3]?.trim() || "unspecified"] });
  }
  reviews.push(...parsed); batches.push({ offset, expected: batch.length, parsed: parsed.length, tokens: after.tokens - before.tokens, raw: response.text }); await checkpoint();
}
const expectedIds = new Set(candidates.map(item => item.id));
const unique = new Set(reviews.map(item => item.id));
const complete = reviews.length === candidates.length && unique.size === candidates.length && reviews.every(item => expectedIds.has(item.id));
await checkpoint(complete);
console.log(`blind review: ${reviews.length}/${candidates.length}, complete=${complete}, report=${outputPath}`);
if (!complete) process.exitCode = 2;

async function checkpoint(complete = false): Promise<void> {
  await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), reviewerModel, strategyHidden: true, testResultsHidden: true, complete, reviews, batches }, null, 2));
}

async function chat(message: string, conversationId: string): Promise<{ text: string }> {
  const response = await fetch("http://127.0.0.1:8787/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, model: reviewerModel, message, max_tokens: 900 }) });
  if (!response.ok) throw new Error(`NVIDIA chat ${response.status}: ${await response.text()}`);
  return response.json() as Promise<{ text: string }>;
}
