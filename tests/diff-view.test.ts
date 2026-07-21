import test from "node:test";
import assert from "node:assert/strict";
import {splitUnifiedDiff} from "../apps/web/src/diff.js";

test("unified diff is split into auditable per-file sections",()=>{const patch=`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
 old
+new
diff --git a/test/a.test.ts b/test/a.test.ts
--- a/test/a.test.ts
+++ b/test/a.test.ts
@@ -0,0 +1 @@
+test`;
  const files=splitUnifiedDiff(patch);assert.deepEqual(files.map(file=>file.path),["src/a.ts","test/a.test.ts"]);assert.deepEqual(files.map(file=>file.additions),[1,1]);assert.equal(files[0]?.deletions,0);assert.match(files[1]?.patch??"",/\+test/);
});

test("non-git patches remain reviewable instead of disappearing",()=>{const files=splitUnifiedDiff("--- old\n+++ new\n-old\n+new");assert.equal(files.length,1);assert.equal(files[0]?.path,"전체 변경");assert.equal(files[0]?.additions,1);assert.equal(files[0]?.deletions,1);});
