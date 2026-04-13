<#
.SYNOPSIS
    Vector Control Hub – Windows Docker Installer

.DESCRIPTION
    Checks for Docker Desktop, pulls / builds images, and starts all
    Vector Control Hub services via docker compose.

    Run from the repository root directory.

.PARAMETER MockMode
    Start the frontend in Mock Mode (no WirePod or robot required).
    Useful for exploring the UI without real hardware.

.PARAMETER Down
    Stop and remove all running containers (does not delete volumes).

.PARAMETER Clean
    Stop containers AND remove all persistent data volumes.
    WARNING: this will erase all stored robot data and settings.

.EXAMPLE
    .\scripts\install-windows.ps1

.EXAMPLE
    .\scripts\install-windows.ps1 -MockMode

.EXAMPLE
    .\scripts\install-windows.ps1 -Down

.EXAMPLE
    .\scripts\install-windows.ps1 -Clean
#>

param(
    [switch]$MockMode,
    [switch]$Down,
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DockerDownloadUrl = "https://www.docker.com/products/docker-desktop"
$UiUrl              = "http://localhost:4173"

# ── helpers ──────────────────────────────────────────────────────────────────

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Text)
    Write-Host "  ▸ $Text" -ForegroundColor Yellow
}

function Write-OK {
    param([string]$Text)
    Write-Host "  ✔ $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "  ⚠ $Text" -ForegroundColor DarkYellow
}

# ── check prerequisites ───────────────────────────────────────────────────────

function Assert-Docker {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Write-Host ""
        Write-Host "  Docker Desktop is not installed or not on PATH." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Please install Docker Desktop first:"
        Write-Host "  $DockerDownloadUrl" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  After installing, restart this terminal and run the script again."
        exit 1
    }

    # Check that Docker daemon is running
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Docker Desktop is installed but not running." -ForegroundColor Red
        Write-Host "  Please start Docker Desktop and try again."
        exit 1
    }

    Write-OK "Docker Desktop is available."
}

function Assert-RepoRoot {
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Host ""
        Write-Host "  docker-compose.yml not found." -ForegroundColor Red
        Write-Host "  Please run this script from the repository root directory."
        exit 1
    }
}

# ── down / clean ─────────────────────────────────────────────────────────────

function Stop-Services {
    Write-Header "Stopping Vector Control Hub"
    Write-Step "Stopping containers..."
    docker compose down
    Write-OK "All services stopped."
}

function Remove-Services {
    Write-Header "Removing Vector Control Hub (full clean)"
    Write-Warn "This will delete all persistent robot data and settings."
    $confirm = Read-Host "  Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "  Aborted." -ForegroundColor Gray
        exit 0
    }
    docker compose down -v
    Write-OK "All services and volumes removed."
}

# ── start ────────────────────────────────────────────────────────────────────

function Start-Services {
    Write-Header "Starting Vector Control Hub"

    # Build args for mock mode
    $env:VITE_MOCK_MODE = if ($MockMode) { "true" } else { "false" }

    if ($MockMode) {
        Write-Warn "Mock Mode enabled – no WirePod or robot required."
        Write-Warn "Set VITE_MOCK_MODE=false to connect to a real robot."
        Write-Host ""
    }

    Write-Step "Building and starting services (this may take a few minutes on first run)..."
    docker compose up -d --build

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  docker compose failed. Check the output above for errors." -ForegroundColor Red
        exit 1
    }

    Write-OK "All services are starting up."
    Write-Host ""
    Write-Host "  Services:" -ForegroundColor Cyan
    Write-Host "    UI:       $UiUrl" -ForegroundColor White
    Write-Host "    API:      http://localhost:8787/health" -ForegroundColor White
    Write-Host "    WirePod:  http://localhost:8080" -ForegroundColor White
    Write-Host ""
    Write-Host "  It may take 10–30 seconds for all services to finish starting." -ForegroundColor Gray
    Write-Host ""

    # Offer to open the browser
    $open = Read-Host "  Open the UI in your browser now? (yes/no)"
    if ($open -eq "yes") {
        Start-Process $UiUrl
    }
}

# ── main ─────────────────────────────────────────────────────────────────────

Write-Header "Vector Control Hub – Windows Installer"

Assert-Docker
Assert-RepoRoot

if ($Clean) {
    Remove-Services
    exit 0
}

if ($Down) {
    Stop-Services
    exit 0
}

Start-Services
