import test from "node:test";
import assert from "node:assert/strict";
import {pixelOfficeReturnUrl} from "../apps/web/src/navigation.js";

test("Execution return URL restores company, project, agent and Run context",()=>{const url=pixelOfficeReturnUrl(new URLSearchParams("companyId=c&projectId=p&agentId=a&runId=old"),"r");assert.equal(url,"/pixel-office?companyId=c&projectId=p&agentId=a&runId=r");});
test("Execution return URL falls back to the last Pixel Office context",()=>{const url=pixelOfficeReturnUrl(new URLSearchParams(),"r",{companyId:"c",projectId:"p",agentId:"a"});assert.equal(url,"/pixel-office?companyId=c&projectId=p&agentId=a&runId=r");});
