$ErrorActionPreference = "Stop"
$port = if ($env:PORT) { [int]$env:PORT } else { 4310 }
if (-not $env:AGENT_COMPANY_API_TOKEN) { throw "AGENT_COMPANY_API_TOKEN is required" }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -Headers @{ Authorization = "Bearer $env:AGENT_COMPANY_API_TOKEN" } -TimeoutSec 10
if ($health.status -ne "ready" -or $health.sqlite -ne "ready" -or $health.integrity -ne "ok") { throw "Control Plane health is not ready: $($health | ConvertTo-Json -Compress)" }
Write-Output ($health | ConvertTo-Json -Depth 8)
