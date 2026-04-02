import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
};

const root = path.resolve(getArg("--root", "app/dist"));
const host = getArg("--host", "127.0.0.1");
const port = Number(getArg("--port", "4173"));

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"]
]);

const normalizeRequestPath = (requestUrl) => {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname === "") {
    return "index.html";
  }

  return pathname.replace(/^\/+/, "");
};

const safeJoin = (base, target) => {
  const candidate = path.resolve(base, target);
  return candidate.startsWith(base) ? candidate : null;
};

const sendFile = async (filePath, response) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes.get(ext) ?? "application/octet-stream";
  const body = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": mimeType,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
  });
  response.end(body);
};

const server = createServer(async (request, response) => {
  try {
    const relativePath = normalizeRequestPath(request.url ?? "/");
    const requestedPath = safeJoin(root, relativePath);

    if (requestedPath) {
      try {
        const stats = await fs.stat(requestedPath);
        if (stats.isDirectory()) {
          await sendFile(path.join(requestedPath, "index.html"), response);
          return;
        }

        await sendFile(requestedPath, response);
        return;
      } catch {
        // Fall through to SPA index.
      }
    }

    await sendFile(path.join(root, "index.html"), response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Vector Control Hub static server error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

server.listen(port, host, () => {
  console.log(`Vector Control Hub static server running at http://${host}:${port}/`);
  console.log(`Serving files from ${root}`);
});

