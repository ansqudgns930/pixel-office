@echo off
setlocal

set BROWSER_AUTOMATION_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe
set AGENT_COMPANY_REPO=C:\Project\paperclip\texttrip
set AGENT_COMPANY_CHECK_FILE=health.js
set AGENT_COMPANY_RUNTIME=C:\Project\paperclip\multi-agent\agent-company-os\.runtime\control-plane
set AGENT_COMPANY_HOST=openai-compatible
set AGENT_COMPANY_MODEL_BASE_URL=https://integrate.api.nvidia.com/v1
set AGENT_COMPANY_MODEL=nvidia/nemotron-3-ultra-550b-a55b
set AGENT_COMPANY_MODEL_MAX_TOKENS=8192
set AGENT_COMPANY_ROLE_DEADLINE_MS=300000
set PORT=4310
set AGENT_COMPANY_GIT=C:\Project\paperclip\multi-agent\agent-company-os\.tools\mingit\cmd\git.exe
set AGENT_COMPANY_REDIS_HOST=127.0.0.1
set AGENT_COMPANY_REDIS_PORT=6379

if "%AGENT_COMPANY_API_TOKEN%"=="" (
  echo AGENT_COMPANY_API_TOKEN must be set in the parent environment.
  exit /b 1
)

if "%AGENT_COMPANY_MODEL_API_KEY%"=="" (
  echo AGENT_COMPANY_MODEL_API_KEY must be set in the parent environment.
  exit /b 1
)

C:\Project\paperclip\multi-agent\agent-company-os\.tools\node-v24.17.0-win-x64\node.exe dist\apps\local-control-plane\index.js

endlocal
