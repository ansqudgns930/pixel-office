import test from "node:test";
import assert from "node:assert/strict";
import { FirebaseHostingAdapter } from "../packages/deployment/src/index.js";

const request={id:"deployment",environment:"preview" as const,targetProjectId:"allowed-project",targetChannel:"goal-preview",artifactSnapshotHash:"a".repeat(64),approvedBy:"human-owner",approvedAt:new Date().toISOString(),credentialAvailable:true,sourceDirectory:"."};

test("Firebase adapter fails closed on disabled execution, target, credential, and missing human evidence",async()=>{
  const executor=async()=>({exitCode:0,stdout:"{}",stderr:""});
  await assert.rejects(new FirebaseHostingAdapter(executor,new Set(["allowed-project"]),false).deploy(request),/disabled/);
  await assert.rejects(new FirebaseHostingAdapter(executor,new Set(["other"]),true).deploy(request),/allowlisted/);
  await assert.rejects(new FirebaseHostingAdapter(executor,new Set(["allowed-project"]),true).deploy({...request,credentialAvailable:false}),/credential/);
  await assert.rejects(new FirebaseHostingAdapter(executor,new Set(["allowed-project"]),true).deploy({...request,approvedBy:""}),/human deployment approval/);
});

test("Firebase adapter uses bounded Hosting-only preview and production commands and returns receipts",async()=>{
  const calls:string[][]=[],executor=async(args:readonly string[])=>{calls.push([...args]);return{exitCode:0,stdout:JSON.stringify({result:{url:"https://allowed-project--goal-preview-123.web.app",version:"versions/42",release:"releases/7"}}),stderr:""};},adapter=new FirebaseHostingAdapter(executor,new Set(["allowed-project"]),true);
  const preview=await adapter.deploy(request);
  assert.deepEqual(calls[0], ["hosting:channel:deploy","goal-preview","--project","allowed-project","--json","--non-interactive"]);
  assert.equal(preview.url,"https://allowed-project--goal-preview-123.web.app");
  const production=await adapter.deploy({...request,environment:"production",targetChannel:null});
  assert.deepEqual(calls[1], ["deploy","--only","hosting","--project","allowed-project","--json","--non-interactive"]);
  assert.equal(production.rollbackRef,"versions/42");
  await assert.rejects(adapter.rollback({...request,environment:"production",targetChannel:null},production),/rollback executor is not configured/);
});
