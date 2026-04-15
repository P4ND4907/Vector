/**
 * packaging/electron/electron-main.ts
 *
 * Electron main process for Vector Control Hub.
 *
 * Responsibilities:
 *   - Single-instance lock (prevents multiple app windows)
 *   - Spawn the compiled Express server as a child process
 *   - Wait for the server to become ready (health-check polling)
 *   - Load the built frontend (app/dist) in a BrowserWindow
 *   - Gracefully shut down the server child process on quit
 *
 * NOTE: This file must be compiled to JS before use.
 * Run `npm run build:electron` inside packaging/electron/ or
 * `scripts/build-electron.sh` from the repository root.
 */

import { app, BrowserWindow, shell } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths relative to the packaged app's root
const REPO_ROOT    = path.resolve(__dirname, "..", "..");
const SERVER_ENTRY = path.join(REPO_ROOT, "server", "dist", "index.js");
const FRONTEND_DIR = path.join(REPO_ROOT, "app",    "dist");
const SERVER_PORT  = 8787;
const SERVER_URL   = `http://127.0.0.1:${SERVER_PORT}`;
const HEALTH_URL   = `${SERVER_URL}/health`;

let mainWindow:      BrowserWindow  | null = null;
let serverProcess:   ChildProcess   | null = null;

// ── Single-instance lock ──────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Server management ─────────────────────────────────────────────────────────

function startServer(): void {
  console.log("[electron] Starting server:", SERVER_ENTRY);
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT:     String(SERVER_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[server] ${data}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[server] ${data}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[electron] Server exited with code ${code}`);
    serverProcess = null;
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }
    serverProcess.once("exit", () => resolve());
    serverProcess.kill("SIGTERM");
    // Force-kill after 5 seconds if graceful shutdown doesn't complete
    setTimeout(() => {
      serverProcess?.kill("SIGKILL");
      resolve();
    }, 5_000);
  });
}

function waitForServer(
  url:        string,
  maxRetries: number = 30,
  delayMs:    number = 500
): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt(): void {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on("error", retry);
    }

    function retry(): void {
      attempts += 1;
      if (attempts >= maxRetries) {
        reject(new Error(`Server at ${url} did not become ready after ${maxRetries} attempts`));
        return;
      }
      setTimeout(attempt, delayMs);
    }

    attempt();
  });
}

// ── Window management ─────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width:           1200,
    height:          800,
    minWidth:        800,
    minHeight:       600,
    title:           "Vector Control Hub",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration:    false,
      contextIsolation:   true,
      sandbox:            true,
    },
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  void mainWindow.loadFile(path.join(FRONTEND_DIR, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startServer();

  try {
    await waitForServer(HEALTH_URL);
    console.log("[electron] Server is ready.");
  } catch (err) {
    console.error("[electron] Server failed to start:", err);
    // Load the UI anyway – it will show an error state
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (serverProcess) {
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});
