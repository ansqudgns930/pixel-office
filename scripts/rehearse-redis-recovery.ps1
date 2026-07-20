$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$server = $env:AGENT_COMPANY_REDIS_SERVER
$cli = $env:AGENT_COMPANY_REDIS_CLI
if (-not $server -or -not (Test-Path -LiteralPath $server)) { throw "AGENT_COMPANY_REDIS_SERVER must point to redis-server.exe" }
if (-not $cli -or -not (Test-Path -LiteralPath $cli)) { throw "AGENT_COMPANY_REDIS_CLI must point to redis-cli.exe" }
$port = if ($env:AGENT_COMPANY_REDIS_PORT) { [int]$env:AGENT_COMPANY_REDIS_PORT } else { 6379 }
$runtime = Join-Path $root "runtime\redis-rehearsal"
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:REDIS_REHEARSAL_RUN_ID = "redis-recovery-$([guid]::NewGuid().ToString('N'))"

function Start-RehearsalRedis {
  $process = Start-Process -FilePath $server -ArgumentList @("--bind","127.0.0.1","--port",$port,"--appendonly","yes","--dir",$runtime) -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "redis.stdout.log") -RedirectStandardError (Join-Path $runtime "redis.stderr.log")
  for ($i=0; $i -lt 50; $i++) {
    try { if ((& $cli -h 127.0.0.1 -p $port ping) -eq "PONG") { return $process } } catch {}
    Start-Sleep -Milliseconds 100
  }
  throw "Redis did not become ready"
}
function Stop-RehearsalRedis($process) {
  try { & $cli -h 127.0.0.1 -p $port shutdown | Out-Null } catch {}
  if (-not $process.HasExited) { $process.WaitForExit(5000) | Out-Null }
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}

$first = $null
$second = $null
try {
  $first = Start-RehearsalRedis
  & node (Join-Path $root "scripts\rehearse-redis-queue.cjs") seed
  if ($LASTEXITCODE -ne 0) { throw "Redis seed phase failed" }
  Stop-RehearsalRedis $first
  $first = $null
  $second = Start-RehearsalRedis
  & node (Join-Path $root "scripts\rehearse-redis-queue.cjs") recover
  if ($LASTEXITCODE -ne 0) { throw "Redis recovery phase failed" }
  $env:REDIS_INTEGRATION = "1"
  & npm run test:redis
  if ($LASTEXITCODE -ne 0) { throw "Redis integration suite failed" }
} finally {
  if ($first) { Stop-RehearsalRedis $first }
  if ($second) { Stop-RehearsalRedis $second }
}
