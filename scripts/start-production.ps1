$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$node = if ($env:AGENT_COMPANY_NODE) { $env:AGENT_COMPANY_NODE } else { (Get-Command node -ErrorAction Stop).Source }
if (-not $env:AGENT_COMPANY_RUNTIME) { throw "AGENT_COMPANY_RUNTIME is required" }
$runtime = [IO.Path]::GetFullPath($env:AGENT_COMPANY_RUNTIME)
$pidFile = Join-Path $runtime "control-plane.pid"
$logDir = Join-Path $runtime "logs"
if (-not (Test-Path (Join-Path $root "dist\apps\local-control-plane\index.js"))) { throw "Production build missing. Run npm run build first." }
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Test-Path $pidFile) {
  $existing = [int](Get-Content $pidFile -Raw)
  if (Get-Process -Id $existing -ErrorAction SilentlyContinue) { throw "Control Plane already running with PID $existing" }
  Remove-Item -LiteralPath $pidFile -Force
}
Push-Location $root
try {
  & $node "dist/apps/production-preflight/index.js"
  if ($LASTEXITCODE -ne 0) { throw "Production preflight failed" }
  $process = Start-Process -FilePath $node -ArgumentList @("dist/apps/local-control-plane/index.js") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "control-plane.out.log") -RedirectStandardError (Join-Path $logDir "control-plane.err.log") -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -NoNewline
  Write-Output "Agent Company Control Plane started: PID $($process.Id)"
} finally { Pop-Location }
