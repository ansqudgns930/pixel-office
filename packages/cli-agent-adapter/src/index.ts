import { execFile } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { ModelClientError, type ModelClient, type ModelClientResult } from "../../model-adapters/src/index.js";

/**
 * npm-installed CLI shims on Windows are `.cmd` launcher scripts, not `.exe`. execFile with
 * shell:false (required to avoid shell-metacharacter injection from prompt content) does not
 * apply PATHEXT resolution to an extension-less command name on every Node/libuv version, so a
 * bare "claude"/"codex" can silently resolve to nothing even though the shim is on PATH. Resolve
 * the concrete file (with extension) ourselves and exec that directly, still with shell:false.
 */
function resolveOnPath(name: string, pathVar: string): string | null {
  if (isAbsolute(name) || name.includes("/") || name.includes("\\")) return existsSync(name) ? name : null;
  const dirs = pathVar.split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  for (const dir of dirs) for (const ext of extensions) { const candidate = join(dir, name + ext); if (existsSync(candidate)) return candidate; }
  return null;
}

interface ExecuteOptions{env:NodeJS.ProcessEnv;windowsHide:boolean;shell:boolean;timeout:number;maxBuffer:number;signal?:AbortSignal;input?:string}
function execute(file:string,args:string[],options:ExecuteOptions):Promise<{stdout:string;stderr:string}>{const{input,...execOptions}=options;return new Promise((resolvePromise,reject)=>{const child=execFile(file,args,execOptions,(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolvePromise({stdout,stderr}));child.stdin?.end(input);});}
const ARG_PROMPT_LIMIT=7_000;
export type CliAgentProvider = "claude" | "codex";
export interface CliAgentOptions { provider:CliAgentProvider; executable?:string; timeoutMs?:number; maxOutputBytes?:number; executableArgsPrefix?:string[]; environment?:NodeJS.ProcessEnv }
const AUTH_ERROR=/(not logged in|login required|authentication|unauthorized|credentials|session.*expired|api key)/i;
// Model id becomes an argv token even under shell:true (see complete()); this is the only
// remaining shell-metacharacter surface once the prompt is forced onto stdin, so it is validated
// against a plain identifier shape rather than escaped.
const SAFE_MODEL_ID=/^[A-Za-z0-9._\-/:]+$/;
function schemaFor(value:unknown):Record<string,unknown>{
  if(Array.isArray(value))return{type:"array",items:value.length?schemaFor(value[0]):{}};
  if(value&&typeof value==="object"){const properties=Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,schemaFor(item)]));return{type:"object",properties,required:Object.keys(properties),additionalProperties:false};}
  if(typeof value==="number")return{type:"number"};
  if(typeof value==="boolean")return{type:"boolean"};
  return{type:"string"};
}
function codexOutputSchema(prompt:string):Record<string,unknown>|null{try{const parsed=JSON.parse(prompt) as {outputContract?:unknown};return parsed.outputContract&&typeof parsed.outputContract==="object"&&!Array.isArray(parsed.outputContract)?schemaFor(parsed.outputContract):null;}catch{return null;}}
/**
 * Neither CLI exposes a scriptable "list models" API (no API-key-based catalog endpoint like
 * OpenAI-compatible /v1/models). This is a maintained snapshot of accepted --model values;
 * update it when the CLI's supported models change.
 */
export const KNOWN_CLI_MODELS: Record<CliAgentProvider,string[]> = {
  claude: ["claude-fable-5","claude-opus-4-8","claude-sonnet-5","claude-haiku-4-5-20251001","sonnet","opus","haiku"],
  codex: ["gpt-5.6-sol","gpt-5.5","gpt-5.4","o3"]
};

export class CliAgentClient implements ModelClient {
  private readonly executable:string;private readonly timeoutMs:number;private readonly maxOutputBytes:number;private readonly env:NodeJS.ProcessEnv;
  constructor(private readonly options:CliAgentOptions){const source=options.environment??process.env,bundledClaude=resolve(dirname(process.execPath),"node_modules","@anthropic-ai","claude-code","bin","claude.exe");this.executable=options.executable??(process.platform==="win32"&&options.provider==="claude"&&existsSync(bundledClaude)?bundledClaude:resolveOnPath(options.provider,source.PATH??"")??options.provider);this.timeoutMs=options.timeoutMs??120_000;this.maxOutputBytes=options.maxOutputBytes??10*1024*1024;this.env={};for(const key of ["SystemRoot","WINDIR","TEMP","TMP","PATHEXT","HOME","USERPROFILE","APPDATA","LOCALAPPDATA","CODEX_HOME","CLAUDE_CONFIG_DIR"]){if(source[key]!==undefined)this.env[key]=source[key];}this.env.PATH=[dirname(resolve(this.executable)),source.PATH??""].filter(Boolean).join(delimiter);}
  async listModels():Promise<string[]>{await this.probe();return KNOWN_CLI_MODELS[this.options.provider];}
  async probe():Promise<void>{
    // Fixed, hardcoded args only (no untrusted content) -- shell:true is safe here and is required
    // because Windows always routes .cmd/.bat launcher shims through cmd.exe regardless of this
    // flag, and Node refuses to spawn them directly with shell:false. complete() carries untrusted
    // prompt content and must never set shell:true; see its own comment below.
    const args=[...(this.options.executableArgsPrefix??[]),...(this.options.provider==="codex"?["login","status"]:["auth","status"])];try{await execute(this.executable,args,{env:this.env,windowsHide:true,shell:this.executable.toLowerCase().endsWith(".cmd")||this.executable.toLowerCase().endsWith(".bat"),timeout:Math.min(this.timeoutMs,15_000),maxBuffer:Math.min(this.maxOutputBytes,1024*1024)});}catch(error){const value=error as NodeJS.ErrnoException&{stderr?:string;code?:string|number},message=[value.message,value.stderr].filter(Boolean).join(": ");if(value.code==="ENOENT")throw new ModelClientError("CAPABILITY_UNAVAILABLE",`${this.options.provider} CLI is not installed`);if(AUTH_ERROR.test(message))throw new ModelClientError("AUTHENTICATION_FAILED",`${this.options.provider} CLI session is unavailable`);throw new ModelClientError("HOST_UNAVAILABLE",message||`${this.options.provider} CLI probe failed`);}}
  async complete(request:{model:string;prompt:string;signal?:AbortSignal}):Promise<ModelClientResult>{
    // npm-installed claude/codex on Windows are .cmd shims, which Windows always routes through
    // cmd.exe -- Node refuses to spawn them with shell:false at all. When shell must be true, the
    // untrusted prompt is NEVER placed in argv (forced onto stdin) so cmd.exe's own metacharacter
    // reinterpretation has no attacker-controlled command-line text to act on; only the model id
    // (operator-controlled binding config, not agent/user output) remains an argv token.
    const needsShell=this.executable.toLowerCase().endsWith(".cmd")||this.executable.toLowerCase().endsWith(".bat");
    if(needsShell&&!SAFE_MODEL_ID.test(request.model))throw new ModelClientError("HOST_UNAVAILABLE",`Unsafe model id for shell invocation: ${request.model}`);
    const useStdin=needsShell||request.prompt.length>ARG_PROMPT_LIMIT,schema=this.options.provider==="codex"?codexOutputSchema(request.prompt):null,schemaPath=schema?join(tmpdir(),`agent-company-output-${randomUUID()}.json`):null;
    if(schemaPath)writeFileSync(schemaPath,JSON.stringify(schema),{encoding:"utf8",mode:0o600});
    const args=[...(this.options.executableArgsPrefix??[]),...this.arguments(request.model,request.prompt,useStdin,schemaPath)];
    try{const result=await execute(this.executable,args,{env:this.env,windowsHide:true,shell:needsShell,timeout:this.timeoutMs,maxBuffer:this.maxOutputBytes,...(request.signal?{signal:request.signal}:{}),...(useStdin?{input:request.prompt}:{})}),text=result.stdout.trim();if(!text)throw new ModelClientError("HOST_UNAVAILABLE",result.stderr.trim()||`${this.options.provider} returned no text`);const tokens=Math.ceil((request.prompt.length+text.length)/4);return{text,tokens,cost:0,estimated:true};}
    catch(error){if(error instanceof ModelClientError)throw error;if(error instanceof Error&&error.name==="AbortError")throw error;const value=error as NodeJS.ErrnoException&{stderr?:string;killed?:boolean;code?:string|number},message=[value.message,value.stderr].filter(Boolean).join(": "),diagnostic=value.stderr??"";if(value.code==="ENOENT")throw new ModelClientError("CAPABILITY_UNAVAILABLE",`${this.options.provider} CLI is not installed`);if(AUTH_ERROR.test(diagnostic))throw new ModelClientError("AUTHENTICATION_FAILED",`${this.options.provider} CLI session is unavailable`);throw new ModelClientError("HOST_UNAVAILABLE",message||`${this.options.provider} CLI failed`);}
    finally{if(schemaPath&&existsSync(schemaPath))unlinkSync(schemaPath);}
  }
  private arguments(model:string,prompt:string,useStdin=false,schemaPath:string|null=null):string[]{if(this.options.provider==="claude")return useStdin?["-p","--model",model,"--tools","","--output-format","text"]:["-p",prompt,"--model",model,"--tools","","--output-format","text"];
    return["exec","--ephemeral","--ignore-user-config","--ignore-rules","--sandbox","read-only","--skip-git-repo-check","--disable","shell_tool","--disable","apps","--disable","browser_use","--disable","computer_use","--disable","image_generation","--disable","enable_mcp_apps",...(schemaPath?["--output-schema",schemaPath]:[]),"--model",model,useStdin?"-":prompt];}
}
