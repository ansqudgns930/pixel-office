$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$candidates = @(
  $env:BROWSER_AUTOMATION_EXECUTABLE,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if (-not $candidates) { throw "Chrome or Edge executable not found; set BROWSER_AUTOMATION_EXECUTABLE" }
$env:BROWSER_AUTOMATION_EXECUTABLE = $candidates[0]
& node "$root\tests\browser\p5-performance-accessibility.cjs"
exit $LASTEXITCODE
