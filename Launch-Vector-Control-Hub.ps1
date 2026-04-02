param(
  [switch]$Check,
  [switch]$NoOpen,
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

function Resolve-NodeTooling {
  $candidates = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs"
  )

  foreach ($candidate in $candidates) {
    $nodeExe = Join-Path $candidate "node.exe"
    $npmCmd = Join-Path $candidate "npm.cmd"

    if ((Test-Path $nodeExe) -and (Test-Path $npmCmd)) {
      return @{
        NodeDir = $candidate
        NodeExe = $nodeExe
        NpmCmd = $npmCmd
      }
    }
  }

  $nodeFromPath = (Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
  if ($nodeFromPath) {
    $nodeDir = Split-Path $nodeFromPath -Parent
    $npmCmd = Join-Path $nodeDir "npm.cmd"
    if (Test-Path $npmCmd) {
      return @{
        NodeDir = $nodeDir
        NodeExe = $nodeFromPath
        NpmCmd = $npmCmd
      }
    }
  }

  throw "Node.js could not be found. Install Node.js LTS and try again."
}

function Test-PortListening {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return ($null -ne $connections)
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3 | Out-Null
      return $true
    }
    catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function Open-AppWindow {
  param([string]$Url)

  $edgeCandidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )
  $chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )

  $edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($edge) {
    Start-Process -FilePath $edge -ArgumentList "--app=$Url" | Out-Null
    return
  }

  $chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "--app=$Url" | Out-Null
    return
  }

  Start-Process $Url | Out-Null
}

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:4183/"
$port = 4183
$apiPort = 8787
$tools = Resolve-NodeTooling
$serverScript = Join-Path $appDir "scripts\serve-static-app.mjs"
$apiServerEntry = Join-Path $appDir "server\dist\index.js"
$runtimeDir = Join-Path $appDir ".runtime"
$apiStdout = Join-Path $runtimeDir "api-server.out.log"
$apiStderr = Join-Path $runtimeDir "api-server.err.log"
$appStdout = Join-Path $runtimeDir "app-server.out.log"
$appStderr = Join-Path $runtimeDir "app-server.err.log"

$env:PATH = "$($tools.NodeDir);$env:PATH"

if (-not (Test-Path $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

if ($Check) {
  Write-Host "Node: $($tools.NodeExe)"
  Write-Host "npm:  $($tools.NpmCmd)"
  Write-Host "Project: $appDir"
  exit 0
}

Set-Location $appDir
$distIndex = Join-Path $appDir "app\dist\index.html"

Write-Host "=========================================="
Write-Host "Vector Control Hub Launcher"
Write-Host "=========================================="
Write-Host ""
Write-Host "Project: $appDir"
Write-Host "URL:     $url"
Write-Host ""

if (-not (Test-Path (Join-Path $appDir "node_modules"))) {
  Write-Host "Dependencies are missing, so the launcher will install them first."
  Write-Host ""
  & $tools.NpmCmd install
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
  }
  Write-Host ""
}

if ($Rebuild -or -not (Test-Path $distIndex) -or -not (Test-Path $apiServerEntry)) {
  Write-Host "Building the latest app bundle..."
  & $tools.NpmCmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
  }
  Write-Host ""
}
else {
  Write-Host "Using the existing built app bundle."
  Write-Host "Run with -Rebuild if you want a fresh production build first."
  Write-Host ""
}

if (-not (Test-PortListening -Port $apiPort)) {
  Write-Host "Starting Vector Control Hub API server..."
  Start-Process -FilePath $tools.NodeExe -ArgumentList @($apiServerEntry) -WorkingDirectory $appDir -WindowStyle Hidden -RedirectStandardOutput $apiStdout -RedirectStandardError $apiStderr | Out-Null
  Write-Host "Waiting for the API server to warm up..."
  if (-not (Wait-HttpReady -Url "http://127.0.0.1:$apiPort/health" -TimeoutSeconds 20)) {
    throw "The API server did not become healthy. Check $apiStdout and $apiStderr."
  }
  Write-Host ""
}
else {
  Write-Host "A local API server is already using port $apiPort."
  Write-Host "Reusing the existing API server."
  Write-Host ""
}

if (-not (Test-PortListening -Port $port)) {
  Write-Host "Starting Vector Control Hub static app server..."
  Start-Process -FilePath $tools.NodeExe -ArgumentList @($serverScript, "--root", "app/dist", "--host", "127.0.0.1", "--port", "$port") -WorkingDirectory $appDir -WindowStyle Hidden -RedirectStandardOutput $appStdout -RedirectStandardError $appStderr | Out-Null
  Write-Host "Waiting for the app server to warm up..."
  if (-not (Wait-HttpReady -Url $url -TimeoutSeconds 20)) {
    throw "The app server did not become ready. Check $appStdout and $appStderr."
  }
  Write-Host ""
}
else {
  Write-Host "A local app server is already using port $port."
  Write-Host "Reusing the existing app server."
  Write-Host ""
}

if (-not $NoOpen) {
  Open-AppWindow -Url $url
}
else {
  Write-Host "Skipping browser launch because --NoOpen was provided."
}

Write-Host "Vector Control Hub is ready."
Write-Host ""
