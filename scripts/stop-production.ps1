$ErrorActionPreference = "Stop"
if (-not $env:AGENT_COMPANY_RUNTIME) { throw "AGENT_COMPANY_RUNTIME is required" }
$runtime = [IO.Path]::GetFullPath($env:AGENT_COMPANY_RUNTIME)
$pidFile = Join-Path $runtime "control-plane.pid"
if (-not (Test-Path $pidFile)) { throw "PID file not found: $pidFile" }
$id = [int](Get-Content $pidFile -Raw)
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
if (-not $process) { Remove-Item -LiteralPath $pidFile -Force; throw "Recorded process $id is not running" }
if ($process.CommandLine -notlike "*dist/apps/local-control-plane/index.js*") { throw "PID $id is not an Agent Company Control Plane process" }
$stopFile = Join-Path $runtime "control-plane.stop"
Set-Content -LiteralPath $stopFile -Value (Get-Date -Format o) -NoNewline
for ($i=0; $i -lt 40; $i++) {
  if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}
if (Get-Process -Id $id -ErrorAction SilentlyContinue) { throw "Control Plane did not stop gracefully within 20 seconds" }
Remove-Item -LiteralPath $pidFile -Force
Write-Output "Agent Company Control Plane stopped: PID $id"
