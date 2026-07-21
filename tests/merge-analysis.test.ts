import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { MergeConflictAnalyzer } from "../packages/merge-analysis/src/index.js";
const git = join(process.cwd(), ".tools", "mingit", "cmd", "git.exe");
const g = (repo: string, args: string[]) => execFileSync(git, ["-C", repo, ...args], { encoding: "utf8" }).trim();

for (const conflict of [false, true]) test(`merge analysis detects moved base with ${conflict ? "conflicting" : "non-conflicting"} changes`, async t => {
  const root = mkdtempSync(join(tmpdir(), "merge-analysis-")), repo = join(root, "repo"); t.after(() => rmSync(root, { recursive: true, force: true })); execFileSync(git, ["init", repo]); g(repo,["config","user.email","test@example.com"]); g(repo,["config","user.name","Test"]); writeFileSync(join(repo,"shared.txt"),"base\n"); g(repo,["add","."]); g(repo,["commit","-m","base"]); const base=g(repo,["rev-parse","HEAD"]), main=g(repo,["symbolic-ref","--short","HEAD"]); g(repo,["checkout","-b","candidate"]); if(conflict) writeFileSync(join(repo,"shared.txt"),"candidate\n"); else writeFileSync(join(repo,"candidate.txt"),"candidate\n"); g(repo,["add","."]); g(repo,["commit","-m","candidate"]); const candidateCommit=g(repo,["rev-parse","HEAD"]); g(repo,["checkout",main]); if(conflict) writeFileSync(join(repo,"shared.txt"),"target\n"); else writeFileSync(join(repo,"target.txt"),"target\n"); g(repo,["add","."]); g(repo,["commit","-m","target"]);
  const store=new SQLiteStateStore(":memory:"); store.createRun({id:"run",requestId:"req",goal:"merge",risk:"medium",status:"COMPLETED",budgetLimit:1,spent:0,checkpoint:null}); const result=await new MergeConflictAnalyzer(git,repo,store).analyze({runId:"run",branch:"candidate",commit:candidateCommit,baseCommit:base,patchHash:"a".repeat(64)},main); assert.equal(result.baseMoved,true); assert.equal(result.conflict,conflict); assert.equal(result.revalidationRequired,true); assert.equal(store.mergeAssessments("run").length,1); assert.equal(g(repo,["symbolic-ref","--short","HEAD"]),main); store.close();
});
