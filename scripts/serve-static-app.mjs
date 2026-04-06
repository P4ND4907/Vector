import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
};

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

const normalizeRequestPath = (requestUrl, host, port) => {
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

export const startStaticServer = ({
  root = "app/dist",
  host = "127.0.0.1",
  port = 4173
} = {}) => {
  const resolvedRoot = path.resolve(root);

  const server = createServer(async (request, response) => {
    try {
      const relativePath = normalizeRequestPath(request.url ?? "/", host, port);
      const requestedPath = safeJoin(resolvedRoot, relativePath);

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

      await sendFile(path.join(resolvedRoot, "index.html"), response);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Vector Control Hub static server error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`Vector Control Hub static server running at http://${host}:${port}/`);
      console.log(`Serving files from ${resolvedRoot}`);
      resolve(server);
    });
  });
};

const normalizedDirectRunPath = process.argv[1]
  ? path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
  : false;

if (normalizedDirectRunPath) {
  await startStaticServer({
    root: getArg("--root", "app/dist"),
    host: getArg("--host", "127.0.0.1"),
    port: Number(getArg("--port", "4173"))
  });
}
