import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const APP_PORT = 4183;
const API_PORT = 8787;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`;

let mainWindow = null;
let ownedApiServer = null;
let ownedStaticServer = null;

const isUrlReady = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
};

const waitForUrl = async (url, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUrlReady(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
};

const importModule = (targetPath) => import(pathToFileURL(targetPath).href);

const ensureRuntimeDir = (targetDir) => {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
};

const getAppRoot = () => app.getAppPath();

const getIconPath = () => {
  const candidates = [
    path.join(getAppRoot(), "build-resources", "icons", "vector-control-hub.png"),
    path.join(getAppRoot(), "app", "public", "icon.svg")
  ];

  return candidates.find((candidate) => existsSync(candidate));
};

const configureRuntimeEnv = () => {
  const runtimeDir = path.join(app.getPath("userData"), "runtime");
  ensureRuntimeDir(runtimeDir);

  process.env.PORT = String(API_PORT);
  process.env.NODE_ENV = "production";
  process.env.VECTOR_DATA_FILE = path.join(app.getPath("userData"), "vector-control-hub.local.json");
  process.env.VECTOR_ENV_FILE = path.join(app.getPath("userData"), ".env.local");
};

const ensureBackend = async () => {
  if (await isUrlReady(API_HEALTH_URL)) {
    return;
  }

  configureRuntimeEnv();
  const serverEntry = path.join(getAppRoot(), "server", "dist", "index.js");
  const serverModule = await importModule(serverEntry);
  ownedApiServer = await serverModule.startServer(undefined, "127.0.0.1");

  if (!(await waitForUrl(API_HEALTH_URL))) {
    throw new Error("The local Vector backend did not become ready.");
  }
};

const ensureStaticApp = async () => {
  if (await isUrlReady(APP_URL)) {
    return;
  }

  const staticServerEntry = path.join(getAppRoot(), "scripts", "serve-static-app.mjs");
  const staticServerModule = await importModule(staticServerEntry);
  ownedStaticServer = await staticServerModule.startStaticServer({
    root: path.join(getAppRoot(), "app", "dist"),
    host: "127.0.0.1",
    port: APP_PORT
  });

  if (!(await waitForUrl(APP_URL))) {
    throw new Error("The Vector Control Hub interface did not become ready.");
  }
};

const closeOwnedServer = async (serverRef) =>
  new Promise((resolve) => {
    if (!serverRef) {
      resolve();
      return;
    }

    serverRef.close(() => resolve());
  });

const createMainWindow = async () => {
  await ensureBackend();
  await ensureStaticApp();

  const icon = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1420,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    title: "Vector Control Hub",
    backgroundColor: "#060816",
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(APP_URL);
};

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("com.vectorcontrolhub.app");
    Menu.setApplicationMenu(null);

    try {
      await createMainWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown desktop startup error.";
      await dialog.showMessageBox({
        type: "error",
        title: "Vector Control Hub",
        message: "The Windows app could not start.",
        detail: message
      });
      app.quit();
    }
  });

  app.on("window-all-closed", async () => {
    await closeOwnedServer(ownedStaticServer);
    await closeOwnedServer(ownedApiServer);

    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}
