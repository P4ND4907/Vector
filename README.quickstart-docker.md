# Docker Quick Start – Vector Control Hub

This guide lets you run **Vector Control Hub** on Windows using **Docker Desktop only**.  
You do not need Node.js, a manual WirePod install, or any other prerequisites beyond Docker Desktop.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop) | The only required install |
| 4 GB RAM free | For all three containers |
| Ports 4173, 8787, 8080, 8070 available | Can be changed in `docker-compose.yml` |

---

## Quick Start (two commands)

```powershell
# From the repository root directory:
docker compose up -d --build
```

Then open **http://localhost:4173** in your browser.

> **First run** will take 2–5 minutes while Docker builds the images.  
> Subsequent starts are near-instant.

---

## PowerShell Installer (easier for new users)

A helper PowerShell script does the same thing with friendly prompts:

```powershell
# From the repository root directory:
.\scripts\install-windows.ps1
```

The script will:
1. Check that Docker Desktop is installed and running
2. Build all images
3. Start all services in the background
4. Optionally open your browser to the UI

---

## Mock Mode (no robot required)

Mock Mode lets you explore the full UI without a physical Vector robot or WirePod.

### Option A – PowerShell script

```powershell
.\scripts\install-windows.ps1 -MockMode
```

### Option B – Environment variable

```powershell
$env:VITE_MOCK_MODE = "true"
docker compose up -d --build
```

### Option C – Query string (after the app is running)

Append `?mock=true` to the URL: `http://localhost:4173?mock=true`

---

## Services

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:4173 | The Vector Control Hub UI |
| API Server | http://localhost:8787 | Express backend (health: `/health`) |
| WirePod (legacy compatibility) | http://localhost:8080 | Legacy compatibility bridge, used only when Engine fallback is needed |

---

## Configuration

Copy the example environment file and fill in your values:

```powershell
copy server\.env.local.example server\.env.local
```

Then edit `server\.env.local` with your OpenAI key, Stripe links, etc.

To pass these to Docker, add them to a `.env` file in the repository root:

```dotenv
OPENAI_API_KEY=sk-...
VITE_API_BASE_URL=http://localhost:8787
```

Docker Compose automatically reads `.env` from the current directory.

---

## Stopping and Restarting

```powershell
# Stop all services (data is preserved)
docker compose down

# Or via script:
.\scripts\install-windows.ps1 -Down

# Stop AND wipe all data (robot settings, routines, etc.)
.\scripts\install-windows.ps1 -Clean
```

---

## Updating

```powershell
# Pull latest code, rebuild images, restart
git pull
docker compose up -d --build
```

---

## Troubleshooting

### Port already in use

If Docker reports a port conflict, another process is using that port.

```powershell
# Find what is using port 4173:
netstat -ano | findstr :4173
```

Change the host port in `docker-compose.yml` (left side of `port: "HOST:CONTAINER"`).

### Docker Desktop not running

Start Docker Desktop from the Start Menu and wait for the whale icon in the system tray to stop animating.

### Services start but the UI is blank

Give the services 30 seconds to fully initialise. Check logs with:

```powershell
docker compose logs -f
```

### WirePod can't see my robot

WirePod uses network discovery. The container shares your host network on Windows via port mapping.  
After the WirePod container is running, open **http://localhost:8080** and follow the WirePod setup wizard to authenticate your robot.

### "no such file" on first build

Make sure you are running the command from the **repository root directory** (the folder that contains `docker-compose.yml`).

---

## Further Help

- [Project README](./README.md)
- [Full change notes and suggestions](./docs/CHANGES_AND_SUGGESTIONS.md)
- [GitHub Issues](https://github.com/P4ND4907/Vector/issues)
