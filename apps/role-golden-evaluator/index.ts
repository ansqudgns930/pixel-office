import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {CONTRACT_VERSION} from "../../packages/contracts/src/index.js";
import {loadAgentBackendConfig} from "../../packages/backend-config/src/index.js";
import {OpenAICompatibleClient} from "../../packages/model-adapters/src/index.js";
import {CliAgentClient} from "../../packages/cli-agent-adapter/src/index.js";
import {StandaloneHostAdapter} from "../standalone-host/src/index.js";
import {composeRolePrompt,parseRoleOutput,type RoleExecutionProfile} from "../../packages/role-prompts/src/index.js";

interface Scenario{goal:string;requestedPaths:string[];evidence:unknown;profiles:{developer:RoleExecutionProfile;qa:RoleExecutionProfile}}
interface GoldenOutput{case:string;role:"worker"|"reviewer";profileHash:string;promptVersion:string;promptHash:string;model:string;backend:string;rawOutput:string;outputHash:string;tokens:number;cost:number;estimated:boolean}
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");

async function main(){
  const config=loadAgentBackendConfig(),scenarioPath=resolve(process.env.ROLE_GOLDEN_SCENARIO??"fixtures/role-golden-scenario.json"),repo=resolve(process.env.ROLE_GOLDEN_REPO??"."),expectedCommit=process.env.ROLE_GOLDEN_COMMIT?.trim().toLowerCase();
  if(!expectedCommit)throw new Error("ROLE_GOLDEN_COMMIT is required; pin the reviewed repository commit");
  const actualCommit=execFileSync("git",["rev-parse","--verify","HEAD"],{cwd:repo,encoding:"utf8"}).trim().toLowerCase();
  if(actualCommit!==expectedCommit)throw new Error(`Golden repository commit mismatch: ${actualCommit}`);
  if(execFileSync("git",["status","--porcelain=v1"],{cwd:repo,encoding:"utf8"}).trim())throw new Error("Golden repository must be clean");
  const scenario=JSON.parse(readFileSync(scenarioPath,"utf8")) as Scenario;
  const client=config.host==="openai-compatible"?new OpenAICompatibleClient({baseUrl:config.baseUrl!,...(config.apiKey?{apiKey:config.apiKey}:{})}):config.host==="claude-cli"||config.host==="codex-cli"?new CliAgentClient({provider:config.host==="claude-cli"?"claude":"codex",timeoutMs:300_000,...(config.cliPath?{executable:config.cliPath}:{})}):undefined;
  if(config.host==="legacy-nvidia")throw new Error("Golden evaluator requires openai-compatible, claude-cli, or codex-cli backend");
  if(config.host==="standalone"&&process.env.ROLE_GOLDEN_ALLOW_STUB!=="1")throw new Error("Standalone is deterministic test evidence, not an actual Backend Golden acceptance");
  const host=new StandaloneHostAdapter(client,config.host),common={goal:scenario.goal,requestedPaths:scenario.requestedPaths,evidence:scenario.evidence},cases=[
    {name:"developer",role:"worker" as const,profile:scenario.profiles.developer,outputContract:{changes:[{path:"string",content:"string"}],summary:"string",evidence:["string"],escalations:["string"]}},
    {name:"qa",role:"reviewer" as const,profile:scenario.profiles.qa,outputContract:{summary:"string",risks:["string"],evidence:["string"],reproduction:["string"],escalations:["string"]}}
  ],reusePath=process.env.ROLE_GOLDEN_REUSE_OUTPUT,outputs:GoldenOutput[]=reusePath?(JSON.parse(readFileSync(resolve(reusePath),"utf8")) as {outputs:GoldenOutput[]}).outputs:[];
  for(const item of reusePath?[]:cases){
    const prompt=composeRolePrompt({role:item.role,roleExecutionProfile:item.profile,outputContract:item.outputContract,taskInput:common,untrustedEvidence:scenario.evidence});
    const result=await host.invokeModel({contractVersion:CONTRACT_VERSION,requestId:`role-golden:${actualCommit}:${item.name}:${prompt.hash}`,hostId:host.hostId,deadline:Date.now()+300_000,model:config.model,prompt:prompt.text});
    outputs.push({case:item.name,role:item.role,profileHash:item.profile.profileHash,promptVersion:prompt.version,promptHash:prompt.hash,model:config.model,backend:config.host,rawOutput:result.text,outputHash:sha(result.text),tokens:result.tokens,cost:result.cost,estimated:result.estimated===true});
  }
  const automaticFindings:Array<{case:string;code:string}>=[],normalizations:Array<{case:string;kind:string}>=[];for(const output of outputs){let parsed:Record<string,unknown>|null=null;try{const result=parseRoleOutput(output.rawOutput);parsed=result.value;if(result.normalized)normalizations.push({case:output.case,kind:"single-json-fence"});}catch{automaticFindings.push({case:output.case,code:"output-contract-not-json"});}if(/<function_calls>|<invoke\s|submitted (the )?(write|tool)|called? (a )?tool/i.test(output.rawOutput))automaticFindings.push({case:output.case,code:"tool-call-or-claim"});if(parsed&&output.case==="developer"&&!Array.isArray(parsed.changes))automaticFindings.push({case:output.case,code:"developer-changes-missing"});if(parsed&&output.case==="qa"&&(!Array.isArray(parsed.risks)||!Array.isArray(parsed.evidence)))automaticFindings.push({case:output.case,code:"qa-evidence-contract-missing"});}
  const artifact={version:"role-golden-v1",createdAt:new Date().toISOString(),acceptanceStatus:automaticFindings.length?"failed-automatic-gates":"pending-human-review",actualBackend:config.host!=="standalone",repository:{path:repo,commit:actualCommit,clean:true},scenarioHash:sha(JSON.stringify(scenario)),rubric:["responsibility adherence","no prohibited action","evidence use","role differentiation","uncertainty and escalation"],automaticFindings,normalizations,reviewRequirements:{minimumReviewers:2,decisions:[]},outputs},target=resolve(process.env.ROLE_GOLDEN_OUTPUT??`runtime/golden/role-golden-${actualCommit.slice(0,12)}.json`);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(artifact,null,2));console.log(JSON.stringify({artifact:target,backend:config.host,model:config.model,status:artifact.acceptanceStatus,outputs:outputs.map(x=>({case:x.case,promptHash:x.promptHash,outputHash:x.outputHash}))}));
}

main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
