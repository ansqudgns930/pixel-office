$ErrorActionPreference = "Stop"

function Read-ErrorBody($err) {
  try {
    $reader = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
    return $reader.ReadToEnd()
  } catch { return $err.Exception.Message }
}

$apiBase = if ($env:AGENT_COMPANY_API_BASE) { $env:AGENT_COMPANY_API_BASE } else { "http://127.0.0.1:4310" }
$username = if ($env:AGENT_COMPANY_QA_USERNAME) { $env:AGENT_COMPANY_QA_USERNAME } else { "admin" }
$password = if ($env:AGENT_COMPANY_QA_PASSWORD) { $env:AGENT_COMPANY_QA_PASSWORD } else { "textadmin" }
$companyId = if ($env:AGENT_COMPANY_BINDING_QA_COMPANY) { $env:AGENT_COMPANY_BINDING_QA_COMPANY } else { "live-binding-verification-company" }
$workspaceId = "$companyId-workspace"

$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$apiBase/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$headers = @{ Authorization = "Bearer $($login.token)" }

$companies = Invoke-RestMethod -Uri "$apiBase/api/companies?actor=$username" -Headers $headers
if (-not ($companies | Where-Object { $_.id -eq $companyId })) {
  try {
    $workspaceBody = @{ id = $workspaceId; name = "Live Binding Verification Workspace" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$apiBase/api/workspaces" -Headers $headers -Method POST -Body $workspaceBody -ContentType "application/json" | Out-Null
  } catch {
    if ((Read-ErrorBody $_) -notmatch "already|exist|duplicate|UNIQUE") { throw "Workspace create failed: $(Read-ErrorBody $_)" }
  }
  $companyBody = @{
    id = $companyId
    name = "Live Binding Verification Company"
    workspaceId = $workspaceId
    budgetLimit = 5
    mandatoryReviews = @("result")
    mandatoryApprovals = @("result")
    allowedTools = @("build", "test", "lint")
    ownerId = $username
    mode = "live"
  } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Uri "$apiBase/api/companies" -Headers $headers -Method POST -Body $companyBody -ContentType "application/json" | Out-Null
}

$targets = @(
  @{ targetKind = "company"; targetId = $companyId; backend = "openai-compatible"; modelId = "nvidia/nemotron-3-ultra-550b-a55b"; config = @{ baseUrl = "https://integrate.api.nvidia.com/v1" } },
  @{ targetKind = "role"; targetId = "planner"; backend = "claude-cli"; modelId = "sonnet-5"; config = @{} },
  @{ targetKind = "role"; targetId = "worker"; backend = "codex-cli"; modelId = "gpt-5"; config = @{} },
  @{ targetKind = "role"; targetId = "reviewer"; backend = "openai-compatible"; modelId = "nvidia/nemotron-3-ultra-550b-a55b"; config = @{ baseUrl = "https://integrate.api.nvidia.com/v1" } }
)
foreach ($target in $targets) {
  $body = @{ actorId = $username; targetKind = $target.targetKind; targetId = $target.targetId; backend = $target.backend; modelId = $target.modelId; config = $target.config } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri "$apiBase/api/companies/$companyId/agent-bindings" -Headers $headers -Method POST -Body $body -ContentType "application/json" | Out-Null
}

$goalId = [guid]::NewGuid().ToString()
$goalBody = @{
  actorId = $username
  id = $goalId
  title = "Live binding snapshot verification"
  description = "Verify live company role bindings are captured in Run snapshot."
  ownerId = $username
  completionCriteria = @("planner uses claude-cli sonnet-5", "worker uses codex-cli gpt-5", "reviewer uses openai-compatible nvidia model")
  budgetLimit = 1
  requestedRisk = "low"
  requestedPaths = @("src")
} | ConvertTo-Json -Depth 6
$launch = Invoke-RestMethod -Uri "$apiBase/api/companies/$companyId/goals/launch" -Headers $headers -Method POST -Body $goalBody -ContentType "application/json"
$runId = $launch.provisioning.runId
Start-Sleep -Seconds 2
$snapshots = Invoke-RestMethod -Uri "$apiBase/api/runs/$runId/agent-bindings?actor=$username" -Headers $headers
$summary = @($snapshots | ForEach-Object { $_ })
$expectations = @{
  planner = @{ backend = "claude-cli"; modelId = "sonnet-5"; resolution = "role" }
  worker = @{ backend = "codex-cli"; modelId = "gpt-5"; resolution = "role" }
  reviewer = @{ backend = "openai-compatible"; modelId = "nvidia/nemotron-3-ultra-550b-a55b"; resolution = "role" }
}
$failures = @()
foreach ($role in $expectations.Keys) {
  $row = $summary | Where-Object { $_.role -eq $role } | Select-Object -First 1
  if (-not $row) { $failures += "missing:$role"; continue }
  $expected = $expectations[$role]
  foreach ($field in @("backend", "modelId", "resolution")) {
    if ($row.$field -ne $expected[$field]) { $failures += "$role.$field expected=$($expected[$field]) actual=$($row.$field)" }
  }
}
$result = @{ companyId = $companyId; goalId = $launch.goal.id; runId = $runId; snapshots = $summary; failures = $failures }
$result | ConvertTo-Json -Depth 10
if ($failures.Count -gt 0) { exit 1 }
