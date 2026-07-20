const TOKEN_STORAGE_KEY = "agent-company-os.apiToken";

export function getStoredToken(): string {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

export class ApiError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "content-type": "application/json", ...(init?.headers as Record<string, string> | undefined) };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${response.status}`;
    throw new ApiError(message);
  }
  return body as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function apiPost<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export async function readSse(url:string,signal:AbortSignal,onEvent:(event:{id:number;type:string;data:unknown})=>void,onOpen?:()=>void):Promise<void>{
  const token=getStoredToken(),headers:Record<string,string>={accept:"text/event-stream"};if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(url,{headers,signal});if(!response.ok)throw new ApiError(`SSE HTTP ${response.status}`);if(!response.body)throw new ApiError("SSE response body missing");onOpen?.();
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";const dispatch=(block:string)=>{if(!block.trim()||block.trimStart().startsWith(":"))return;let id=0,type="message",data="";for(const line of block.split(/\r?\n/)){if(line.startsWith("id:"))id=Number(line.slice(3).trim());else if(line.startsWith("event:"))type=line.slice(6).trim();else if(line.startsWith("data:"))data+=(data?"\n":"")+line.slice(5).trimStart();}if(data)onEvent({id,type,data:JSON.parse(data) as unknown});};
  while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let boundary;while((boundary=buffer.search(/\r?\n\r?\n/))>=0){const block=buffer.slice(0,boundary),separator=buffer.slice(boundary).match(/^\r?\n\r?\n/)![0];buffer=buffer.slice(boundary+separator.length);dispatch(block);}if(done){if(buffer.trim())dispatch(buffer);return;}}
}
