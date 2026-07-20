$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$node = if ($env:AGENT_COMPANY_NODE) { $env:AGENT_COMPANY_NODE } else { (Get-Command node -ErrorAction Stop).Source }
if (-not $env:AGENT_COMPANY_RUNTIME) { throw "AGENT_COMPANY_RUNTIME is required" }
$runtime = [IO.Path]::GetFullPath($env:AGENT_COMPANY_RUNTIME)
$db = Join-Path $runtime "data\agent-company.sqlite"
if (-not (Test-Path $db)) { throw "Runtime database not found: $db" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $runtime "backup-rehearsals\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backup = Join-Path $backupDir "agent-company.bak"
$restore = Join-Path $backupDir "restored.sqlite"
Push-Location $root
try {
  & $node "dist/apps/operations-cli/index.js" backup $db $backup
  if ($LASTEXITCODE -ne 0) { throw "Backup rehearsal failed" }
  & $node "dist/apps/operations-cli/index.js" restore $backup $restore
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $restore)) { throw "Restore rehearsal failed" }
  Write-Output "Backup/restore rehearsal completed: $backupDir"
} finally { Pop-Location }
